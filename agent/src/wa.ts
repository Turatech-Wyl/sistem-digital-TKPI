import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerm from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { db, DATA_DIR } from "./db.js";
import { tulisStatus, tulisQR, hapusQR } from "./status.js";
import { tanganiTeks, tanganiBukti, tanganiNiat, balasAI, anakDariNomor } from "./bot.js";
import { tanyaAI, niatAIkeBot } from "./ai.js";

let sock: WASocket | null = null;
export const getSock = () => sock;
export const apakahTerhubung = () => tersambung && sock !== null;
let qrTerakhir = 0;
let tersambung = false;

/** Watchdog: kalau tidak tersambung dan QR mandek >45 dtk (atau diminta), sambung ulang. */
export function perluSambungUlang(): boolean {
  if (tersambung) return false;
  if (fs.existsSync(path.join(DATA_DIR, "qrreq.req"))) return true;
  return qrTerakhir > 0 && Date.now() - qrTerakhir > 45_000;
}

export async function sambungUlang() {
  fs.rmSync(path.join(DATA_DIR, "qrreq.req"), { force: true });
  try { (sock as unknown as { ws?: { close(): void } })?.ws?.close(); } catch { /* abaikan */ }
  sock = null;
  qrTerakhir = 0;
  console.log("Menyambung ulang untuk QR baru…");
  await connect();
}
export async function cekPermintaanPutus() {
  const f = path.join(DATA_DIR, "unlink.req");
  if (!fs.existsSync(f)) return;
  fs.rmSync(f, { force: true });
  try { await sock?.logout(); } catch { /* abaikan */ }
  fs.rmSync(path.join(process.cwd(), "auth"), { recursive: true, force: true });
  sock = null;
  tulisStatus({ connected: false, updated_at: new Date().toISOString(), last_error: "diputus oleh TU" });
  console.log("Perangkat diputus atas permintaan TU. Membuat QR baru…");
  setTimeout(connect, 3000);
}

function simpanMasuk(nomor: string, isi: string, media?: string) {
  const ortu = db.prepare("SELECT id FROM OrangTua WHERE wa_utama=? OR wa_kedua=?").get(nomor, nomor) as { id: number } | undefined;
  db.prepare("INSERT INTO WaPesan (arah, nomor, orang_tua_id, isi, media_file, status, sumber) VALUES ('masuk', ?, ?, ?, ?, 'dibaca', 'tu')")
    .run(nomor, ortu?.id ?? null, isi, media ?? null);
}

export async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(process.cwd(), "auth"));
  sock = makeWASocket({ auth: state, printQRInTerminal: false });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      console.log("Scan QR dari halaman Pengaturan → WhatsApp:");
      qrcodeTerm.generate(qr, { small: true });
      await tulisQR(qr);
      qrTerakhir = Date.now();
    }
    if (connection === "open") {
      hapusQR();
      tersambung = true;
      const phone = (sock?.user?.id || "").split(":")[0];
      tulisStatus({ connected: true, phone, updated_at: new Date().toISOString() });
      console.log("Agent terhubung sebagai perangkat tertaut:", phone);
    }
    if (connection === "close") {
      tersambung = false;
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      tulisStatus({ connected: false, updated_at: new Date().toISOString(), last_error: `putus (${code})` });
      console.log("Koneksi tertutup, kode:", code);
      sock = null;
      if (code !== DisconnectReason.loggedOut) setTimeout(connect, 10_000);
      else console.log("Logged out — hapus folder agent/auth lalu scan ulang.");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    for (const msg of m.messages) {
      const jid = msg.key.remoteJid || "";
      if (jid.endsWith("@g.us")) continue; // abaikan grup
      const nomor = jid.replace(/[^0-9]/g, "");
      if (!nomor) continue;
      // Balasan manual TU dari HP (<10 mnt → bot diam + batalkan antrean bot, PRD §6.2)
      if (msg.key.fromMe) {
        const teksKeluar = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        if (teksKeluar) {
          db.prepare("INSERT INTO WaPesan (arah, nomor, isi, status, sumber) VALUES ('keluar', ?, ?, 'terkirim', 'tu')").run(nomor, `[HP] ${teksKeluar}`);
          db.prepare("DELETE FROM WaPesan WHERE arah='keluar' AND status='antre' AND nomor=? AND sumber IN ('bot','ai')").run(nomor);
          console.log(`TU manual ke ${nomor}: antrean bot dibatalkan`);
        }
        continue;
      }
      const teks = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      const media = msg.message?.imageMessage || msg.message?.documentMessage;
      if (media) {
        let fp: string | null = null;
        try {
          const buf = await downloadMediaMessage(msg, "buffer", {});
          fp = path.join(DATA_DIR, "media", `wa-${Date.now()}.jpg`);
          fs.writeFileSync(fp, buf as Buffer);
        } catch { /* catat tanpa file */ }
        simpanMasuk(nomor, teks || "[gambar]", fp);
        console.log(`MASUK media dari ${nomor} → ${fp}`);
        tanganiBukti(nomor, fp);
      } else if (teks) {
        simpanMasuk(nomor, teks);
        console.log(`MASUK dari ${nomor}: ${teks.slice(0, 80)}`);
        // 1) aturan, 2) AI, 3) inbox
        if (!tanganiTeks(nomor, teks)) {
          const anak = anakDariNomor(nomor);
          if (anak.length) {
            tanyaAI(teks, anak.map((a) => a.nama.split(" ")[0])).then((h) => {
              if (!h) return; // tidak yakin / kuota habis → inbox
              const nb = niatAIkeBot(h.niat);
              if (nb) tanganiNiat(nomor, nb, anak);
              else if (h.niat === "umum" && h.jawaban && h.yakin >= 0.7) balasAI(nomor, h.jawaban);
            }).catch((e) => console.log("AI error:", (e as Error).message));
          }
        }
      }
    }
  });
  return sock;
}

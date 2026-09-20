import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerm from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { db, DATA_DIR } from "./db.js";
import { tulisStatus, tulisQR, hapusQR } from "./status.js";

let sock: WASocket | null = null;
export const getSock = () => sock;

/** Diputus dari HP atau tombol web: sesi tak berlaku → QR baru (scan ulang). */
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
    }
    if (connection === "open") {
      hapusQR();
      const phone = (sock?.user?.id || "").split(":")[0];
      tulisStatus({ connected: true, phone, updated_at: new Date().toISOString() });
      console.log("Agent terhubung sebagai perangkat tertaut:", phone);
    }
    if (connection === "close") {
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
      if (msg.key.fromMe) continue;
      const nomor = (msg.key.remoteJid || "").replace(/[^0-9]/g, "");
      if (!nomor || msg.key.remoteJid?.endsWith("@g.us")) continue; // abaikan grup
      const teks = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
      // Media (foto bukti transfer tahap 4): simpan file, catat pesan
      const media = msg.message?.imageMessage || msg.message?.documentMessage;
      if (media) {
        try {
          const buf = await downloadMediaMessage(msg, "buffer", {});
          const fp = path.join(DATA_DIR, "media", `wa-${Date.now()}.jpg`);
          fs.writeFileSync(fp, buf as Buffer);
          simpanMasuk(nomor, teks || "[gambar]", fp);
          console.log(`MASUK media dari ${nomor} → ${fp}`);
        } catch (e) {
          simpanMasuk(nomor, teks || "[gambar gagal diunduh]");
        }
      } else if (teks) {
        simpanMasuk(nomor, teks);
        console.log(`MASUK dari ${nomor}: ${teks.slice(0, 80)}`);
      }
    }
  });
  return sock;
}

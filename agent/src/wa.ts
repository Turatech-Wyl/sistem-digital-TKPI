import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, generateMessageID } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerm from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { db, DATA_DIR, kini } from "./db.js";
import { tulisStatus, tulisQR, hapusQR } from "./status.js";
import { tanganiTeks, tanganiBukti } from "./bot.js";

let sock: WASocket | null = null;
export const getSock = () => sock;
export const apakahTerhubung = () => tersambung && sock !== null;
let qrTerakhir = 0;
let tersambung = false;
// Hanya boleh ada SATU socket per sesi. Dua socket dengan kredensial yang sama saling menendang
// (kode 440 "conflict: replaced") dan masing-masing menjadwalkan sambung ulang → pingpong tanpa akhir.
// `generasi` menandai socket aktif; event dari socket lama diabaikan.
let generasi = 0;
let timerSambung: NodeJS.Timeout | null = null;

function jadwalSambung(ms: number) {
  if (timerSambung) clearTimeout(timerSambung);
  timerSambung = setTimeout(() => { timerSambung = null; connect().catch((e) => console.log("Sambung gagal:", (e as Error).message)); }, ms);
}

function tutupSocketLama() {
  const lama = sock;
  sock = null;
  tersambung = false;
  try { lama?.end(undefined); } catch { /* abaikan */ }
}

/** Watchdog: kalau tidak tersambung dan QR mandek >45 dtk (atau diminta), sambung ulang. */
export function perluSambungUlang(): boolean {
  if (tersambung || timerSambung) return false; // sudah ada sambung ulang terjadwal (mis. setelah scan QR)
  if (fs.existsSync(path.join(DATA_DIR, "qrreq.req"))) return true;
  return qrTerakhir > 0 && Date.now() - qrTerakhir > 45_000;
}

export async function sambungUlang() {
  fs.rmSync(path.join(DATA_DIR, "qrreq.req"), { force: true });
  qrTerakhir = 0;
  console.log("Menyambung ulang untuk QR baru…");
  await connect();
}
export async function cekPermintaanPutus() {
  const f = path.join(DATA_DIR, "unlink.req");
  if (!fs.existsSync(f)) return;
  fs.rmSync(f, { force: true });
  generasi++; // event close dari logout jangan memicu sambung ulang sendiri
  try { await sock?.logout(); } catch { /* abaikan */ }
  tutupSocketLama();
  fs.rmSync(path.join(process.cwd(), "auth"), { recursive: true, force: true });
  tulisStatus({ connected: false, updated_at: new Date().toISOString(), last_error: "diputus oleh TU" });
  console.log("Perangkat diputus atas permintaan TU. Membuat QR baru…");
  jadwalSambung(3000);
}

// Nomor asli → JID tempat chat masuk (bisa @lid). Balasan harus ke JID ini;
// kalau dikirim ke @s.whatsapp.net, HP penerima menampilkan "Waiting for this message".
const FILE_JID = path.join(DATA_DIR, "jid-balas.json");
const jidPribadi = (jid: string) => jid.endsWith("@lid") || jid.endsWith("@s.whatsapp.net");
const jidBalas: Record<string, string> = (() => {
  try {
    const isi = JSON.parse(fs.readFileSync(FILE_JID, "utf8")) as Record<string, string>;
    // Buang entri rusak dari versi lama (mis. status@broadcast)
    return Object.fromEntries(Object.entries(isi).filter(([, j]) => jidPribadi(j)));
  } catch { return {}; }
})();
export const jidTujuan = (nomor: string) => jidBalas[nomor] || `${nomor}@s.whatsapp.net`;
function ingatJid(nomor: string, jid: string) {
  if (!jidPribadi(jid) || jidBalas[nomor] === jid) return;
  jidBalas[nomor] = jid;
  try { fs.writeFileSync(FILE_JID, JSON.stringify(jidBalas, null, 2)); } catch { /* abaikan */ }
}

// ID pesan yang dikirim agent sendiri: pantulannya (fromMe) jangan dianggap balasan manual TU
const idKirimanAgent = new Set<string>();
export function idKirimanBaru(): string {
  const id = generateMessageID();
  idKirimanAgent.add(id);
  return id;
}

function simpanMasuk(nomor: string, isi: string, waMsgId: string | null, media: string | null = null) {
  const ortu = db.prepare("SELECT id FROM OrangTua WHERE wa_utama=? OR wa_kedua=?").get(nomor, nomor) as { id: number } | undefined;
  db.prepare("INSERT INTO WaPesan (arah, nomor, orang_tua_id, isi, media_file, wa_msg_id, status, dibuat_pada) VALUES ('masuk', ?, ?, ?, ?, ?, 'dibaca', ?)")
    .run(nomor, ortu?.id ?? null, isi, media, waMsgId, kini());
}

/** Simpan lampiran bukti (gambar atau PDF) ke data/media. Return path atau null. */
async function simpanMedia(msg: Parameters<typeof downloadMediaMessage>[0], pdf: boolean): Promise<string | null> {
  try {
    const buf = await downloadMediaMessage(msg, "buffer", {});
    const fp = path.join(DATA_DIR, "media", `wa-${Date.now()}.${pdf ? "pdf" : "jpg"}`);
    fs.writeFileSync(fp, buf as Buffer);
    return fp;
  } catch (e) {
    console.log("Unduh media gagal:", (e as Error).message);
    return null;
  }
}

export async function connect() {
  if (timerSambung) { clearTimeout(timerSambung); timerSambung = null; }
  const ini = ++generasi;
  tutupSocketLama();
  const { state, saveCreds } = await useMultiFileAuthState(path.join(process.cwd(), "auth"));
  if (ini !== generasi) return sock; // ada connect() lain yang lebih baru selama menunggu
  const s = makeWASocket({ auth: state, printQRInTerminal: false });
  sock = s;

  s.ev.on("creds.update", saveCreds);
  s.ev.on("connection.update", async (u) => {
    if (ini !== generasi) return; // socket lama
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
      qrTerakhir = 0;
      const phone = (s.user?.id || state.creds.me?.id || "").split(":")[0];
      tulisStatus({ connected: true, phone, updated_at: new Date().toISOString() });
      console.log("Agent terhubung sebagai perangkat tertaut:", phone);
    }
    if (connection === "close") {
      tersambung = false;
      sock = null;
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      tulisStatus({ connected: false, updated_at: new Date().toISOString(), last_error: `putus (${code})` });
      console.log("Koneksi tertutup, kode:", code);
      if (code === DisconnectReason.loggedOut) {
        console.log("Logged out — hapus folder agent/auth lalu scan ulang.");
      } else if (code === DisconnectReason.connectionReplaced) {
        // Sesi dibuka di tempat lain (mis. agent kedua di mesin lain). Jangan rebutan.
        console.log("Sesi dipakai proses lain — coba lagi 60 dtk. Pastikan hanya satu agent yang jalan.");
        jadwalSambung(60_000);
      } else {
        // 515 = restart wajib setelah scan QR → segera; lainnya (jaringan, QR habis) → 5 dtk
        jadwalSambung(code === DisconnectReason.restartRequired ? 500 : 5_000);
      }
    }
  });

  s.ev.on("messages.upsert", async (m) => {
    if (ini !== generasi) return;
    for (const msg of m.messages) {
      try { await tanganiPesan(msg); } catch (e) { console.log("Gagal memproses pesan:", (e as Error).message); }
    }
  });
  return s;
}

type Pesan = Parameters<typeof downloadMediaMessage>[0];

async function tanganiPesan(msg: Pesan) {
  const jid = msg.key.remoteJid || "";
  // Hanya chat pribadi: abaikan grup, status/story, broadcast list, dan channel
  if (!jidPribadi(jid)) return;
  // WA kini mengirim JID samaran (@lid); nomor asli ada di senderPn/remoteJidAlt (@s.whatsapp.net).
  const key = msg.key as unknown as { remoteJidAlt?: string; senderPn?: string; participantPn?: string };
  const kandidat = [key.senderPn || "", key.remoteJidAlt || "", key.participantPn || "", jid];
  const jidAsli = kandidat.find((j) => j.endsWith("@s.whatsapp.net")) || jid;
  const nomor = jidAsli.replace(/@.*/, "").replace(/[^0-9]/g, "");
  if (!nomor) return;
  if (jidAsli !== jid) ingatJid(nomor, jid);

  const isi = msg.message;
  const teks = isi?.conversation || isi?.extendedTextMessage?.text || "";

  // Balasan manual TU dari HP (PRD §6.2): bot diam 10 mnt + batalkan antrean bot untuk nomor ini
  if (msg.key.fromMe) {
    if (msg.key.id && idKirimanAgent.delete(msg.key.id)) return; // pantulan kiriman agent sendiri
    if (!teks) return;
    db.prepare("INSERT INTO WaPesan (arah, nomor, isi, status, sumber, dibuat_pada) VALUES ('keluar', ?, ?, 'terkirim', 'tu', ?)").run(nomor, `[HP] ${teks}`, kini());
    db.prepare("DELETE FROM WaPesan WHERE arah='keluar' AND status='antre' AND nomor=? AND sumber IN ('bot','ai')").run(nomor);
    console.log(`TU manual ke ${nomor}: antrean bot dibatalkan`);
    return;
  }

  // Bukti transfer: gambar atau dokumen PDF (dokumen lain cukup dicatat di inbox)
  const gambar = isi?.imageMessage;
  const dok = isi?.documentMessage;
  const pdf = dok?.mimetype === "application/pdf";
  if (gambar || pdf) {
    const fp = await simpanMedia(msg, pdf);
    const keterangan = gambar?.caption || dok?.caption || (pdf ? "[PDF]" : "[gambar]");
    simpanMasuk(nomor, keterangan, msg.key.id ?? null, fp);
    console.log(`MASUK bukti dari ${nomor} → ${fp}`);
    tanganiBukti(nomor);
    return;
  }

  const teksInbox = teks || (dok ? `[dokumen: ${dok.fileName || "tanpa nama"}]` : "");
  if (!teksInbox) return; // stiker, reaksi, panggilan, dll.
  simpanMasuk(nomor, teksInbox, msg.key.id ?? null);
  console.log(`MASUK dari ${nomor}: ${teksInbox.slice(0, 80)}`);
  if (teks) await tanganiTeks(nomor, teks);
}

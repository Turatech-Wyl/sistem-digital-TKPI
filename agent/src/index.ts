// Agent WA penuh (tahap 3-4): antrean wa_pesan, reconnect, anti-ban (jeda 20-40 dtk, maks 50/jam).
// Untuk sekarang: kerangka koneksi + cron tagihan/pengingat/backup. Bot aturan + AI menyusul tahap 4.
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { Boom } from "@hapi/boom";
import cron from "node-cron";

const JEDA_MIN = 20_000, JEDA_MAX = 40_000;
const jeda = () => new Promise((r) => setTimeout(r, JEDA_MIN + Math.random() * (JEDA_MAX - JEDA_MIN)));

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (u) => {
    if (u.qr) {
      console.log("Scan QR dari halaman Pengaturan WA:");
      qrcode.generate(u.qr, { small: true });
    }
    if (u.connection === "open") console.log("Agent terhubung.");
    if (u.connection === "close") {
      const code = (u.lastDisconnect?.error as Boom)?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) setTimeout(connect, 10_000);
    }
  });
  sock.ev.on("messages.upsert", (m) => {
    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;
      console.log("MASUK:", msg.key.remoteJid, msg.message?.conversation || "[media]");
      // TODO tahap 4: cocokkan niat 6.4, simpan bukti, antre balasan dengan jeda acak
    }
  });
  return sock;
}

// Penjadwal (PRD §9): tagihan tgl 1 00.05, backup 02.00, pengingat 07.00 Senin-Sabtu
cron.schedule("5 0 1 * *", () => console.log("CRON: generate tagihan (TODO: panggil lib web)"));
cron.schedule("0 2 * * *", () => console.log("CRON: backup SQLite + media (TODO)"));
cron.schedule("0 7 * * 1-6", () => console.log("CRON: pengiriman pengingat 07.00 (TODO: baca antrean)"));

connect();
console.log("Agent jalan. Ctrl+C untuk berhenti.");
export { jeda };

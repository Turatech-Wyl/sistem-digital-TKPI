// Uji awal WA (PRD §11): scan QR, kirim 1 pesan teks ke nomor uji, cetak pesan masuk ke log.
// Jalankan: npm run test-wa -- 62812xxxxxxx "halo tes"
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { Boom } from "@hapi/boom";

const target = process.argv[2] || process.env.WA_UJI || "";
const teks = process.argv[3] || "Assalamualaikum, ini tes agent TK Permata Indonesia 🙏 — Asisten TK";

async function main() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      console.log("Scan QR ini dari HP sekolah (WA > Perangkat Tertaut):");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log("Terhubung sebagai perangkat tertaut.");
      if (target) {
        const jid = target.includes("@") ? target : `${target.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: teks });
        console.log(`Pesan tes terkirim ke ${jid}`);
      } else {
        console.log("Tidak ada nomor uji. Jalankan: npm run test-wa -- 62812xxxxxxx");
      }
    }
    if (connection === "close") {
      const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
      console.log("Koneksi tertutup, kode:", code);
      if (code !== DisconnectReason.loggedOut) main();
      else console.log("Logged out — hapus folder auth/ lalu scan ulang.");
    }
  });

  sock.ev.on("messages.upsert", (m) => {
    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;
      const dari = msg.key.remoteJid;
      const isi = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "[media/lainnya]";
      console.log(`MASUK dari ${dari}: ${isi}`);
    }
  });
}

main();

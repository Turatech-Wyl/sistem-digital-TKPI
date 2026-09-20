// Agent WA Tahap 3 (PRD §6): koneksi Baileys, antrean kirim, pesan masuk,
// pengingat terjadwal, generate tagihan tgl 1, backup 02.00.
import cron from "node-cron";

// Jangan mati karena error async yang tak tertangani (mis. timeout jaringan) — cukup catat
process.on("unhandledRejection", (e) => console.log("Unhandled rejection (tetap jalan):", (e as Error)?.message || e));
process.on("uncaughtException", (e) => console.log("Uncaught exception (tetap jalan):", (e as Error)?.message || e));
import { connect, getSock, perluSambungUlang, sambungUlang } from "./wa.js";
import { loopAntrean } from "./sender.js";
import { buatPengingat } from "./reminder.js";
import { generateTagihan, jalanBackup } from "./jobs.js";
import { tulisStatus } from "./status.js";

tulisStatus({ connected: false, updated_at: new Date().toISOString(), last_error: "agent baru dinyalakan" });
await connect();
loopAntrean(getSock);

// Tagihan otomatis tiap tanggal 1 pukul 00.05 (PRD §5.3)
cron.schedule("5 0 1 * *", () => {
  const d = new Date();
  generateTagihan(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
});
// Pengingat: cek tiap 10 menit, hanya 07.00–09.00 Senin–Sabtu (PRD §6.3)
cron.schedule("*/10 7-8 * * 1-6", () => buatPengingat());
// Backup harian 02.00 (PRD §10)
cron.schedule("0 2 * * *", () => jalanBackup());

// Watchdog QR tiap 30 dtk: server WA kadang berhenti mengirim QR baru (PRD §6.1 reconnect)
setInterval(async () => {
  try {
    if (perluSambungUlang()) await sambungUlang();
  } catch (e) {
    console.log("Watchdog error:", (e as Error).message);
  }
}, 30_000);

console.log("Agent jalan: antrean 60 dtk, pengingat 10 mnt, tagihan tgl 1, backup 02.00.");

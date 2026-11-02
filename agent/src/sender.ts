import type { WASocket } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { db, getPengaturan, waJedaAktif } from "./db.js";
import { jidTujuan, idKirimanBaru } from "./wa.js";
import { dalamJamPengingat } from "./reminder.js";

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pengingat = broadcast yang tidak diminta → jeda 20–40 dtk antar pesan (PRD §6.3).
// Jeda ini dicatat sebagai waktu, bukan ditunggu di tempat, agar balasan tidak ikut tertahan.
const jedaPengingat = () => 20_000 + Math.random() * 20_000;
let pengingatBerikutnya = 0;
// Waktu kirim sebenarnya (bukan waktu antre) untuk batas 50/jam. Di memori: cukup karena hanya
// satu proses agent; setelah restart batas mulai dari nol, sementara jeda 20–40 dtk tetap berlaku.
let waktuKirim: number[] = [];

type Antrean = { id: number; nomor: string; isi: string; sumber: string | null; media_file: string | null };

/** Satu putaran antrean. Balasan (bot/ai/tu) didahulukan; pengingat maks 50/jam (PRD §6.3). */
export async function prosesAntrean(sock: WASocket) {
  const sejamLalu = Date.now() - 3600_000;
  waktuKirim = waktuKirim.filter((t) => t > sejamLalu);
  const pengingatBoleh = waktuKirim.length < 50 && Date.now() >= pengingatBerikutnya && dalamJamPengingat();

  // Pesan yang sedang ditahan disaring di SQL, bukan di loop: kalau tidak, 10 pesan tertahan
  // di depan antrean akan menyumbat pesan lain di belakangnya (mis. balasan TU saat bot dijeda).
  // - Jeda bot (PRD §6.2): hanya balasan TU yang jalan.
  // - Mode uji (PLAN tahap 5.3): bila wa_uji_nomor diisi, HANYA nomor itu yang dikirimi.
  const syarat = ["arah='keluar'", "status='antre'"];
  const param: string[] = [];
  if (waJedaAktif()) syarat.push("sumber='tu'");
  const ujiNomor = getPengaturan("wa_uji_nomor", "").replace(/[^0-9]/g, "");
  if (ujiNomor) { syarat.push("nomor=?"); param.push(ujiNomor); }
  if (!pengingatBoleh) syarat.push("COALESCE(sumber,'') <> 'pengingat'");
  const rows = db.prepare(`SELECT id, nomor, isi, sumber, media_file FROM WaPesan WHERE ${syarat.join(" AND ")} ORDER BY (sumber = 'pengingat') ASC, id ASC LIMIT 10`).all(...param) as Antrean[];

  for (const m of rows) {
    const pengingat = m.sumber === "pengingat";
    // Satu pengingat per putaran; berikutnya menunggu jeda acak 20–40 dtk.
    if (pengingat && Date.now() < pengingatBerikutnya) break;
    try {
      const jid = m.nomor.includes("@") ? m.nomor : jidTujuan(m.nomor.replace(/[^0-9]/g, ""));
      const opsi = { messageId: idKirimanBaru() };
      if (!pengingat) {
        // Balasan atas chat ortu: kirim cepat, tapi tetap terlihat wajar ("mengetik…" 2–5 dtk)
        try { await sock.sendPresenceUpdate("composing", jid); } catch { /* abaikan */ }
        await tidur(2_000 + Math.random() * 3_000);
      }
      if (m.media_file && fs.existsSync(m.media_file)) {
        const fileName = path.basename(m.media_file);
        await sock.sendMessage(jid, { document: fs.readFileSync(m.media_file), fileName, mimetype: "application/pdf", caption: m.isi }, opsi);
      } else {
        await sock.sendMessage(jid, { text: m.isi }, opsi);
      }
      if (!pengingat) { try { await sock.sendPresenceUpdate("paused", jid); } catch { /* abaikan */ } }
      db.prepare("UPDATE WaPesan SET status='terkirim' WHERE id=?").run(m.id);
      waktuKirim.push(Date.now());
      console.log(`Terkirim #${m.id} (${m.sumber}) → ${m.nomor}`);
    } catch (e) {
      db.prepare("UPDATE WaPesan SET status='gagal' WHERE id=?").run(m.id);
      console.log(`Gagal #${m.id} → ${m.nomor}:`, (e as Error).message);
    }
    if (pengingat) pengingatBerikutnya = Date.now() + jedaPengingat();
  }
}

/** Loop selamanya tiap 5 detik (cek SQLite murah; antrean juga diisi web app dari proses lain). */
export async function loopAntrean(getSock: () => WASocket | null) {
  const { cekPermintaanPutus, apakahTerhubung } = await import("./wa.js");
  for (;;) {
    try {
      await cekPermintaanPutus();
      if (!apakahTerhubung()) {
        await tidur(5_000);
        continue;
      }
      const sock = getSock();
      if (sock) await prosesAntrean(sock);
    } catch (e) {
      console.log("Antrean error:", (e as Error).message);
    }
    await tidur(5_000);
  }
}

import type { WASocket } from "@whiskeysockets/baileys";
import { db, waJedaAktif } from "./db.js";

const jedaAcak = () => new Promise((r) => setTimeout(r, 20_000 + Math.random() * 20_000)); // 20–40 dtk (PRD §6.3)

type Antrean = { id: number; nomor: string; isi: string; sumber: string | null; media_file: string | null };

/** Satu putaran antrean: kirim pesan keluar status 'antre', maks 50/jam (PRD §6.3). */
export async function prosesAntrean(sock: WASocket) {
  const sejamLalu = new Date(Date.now() - 3600_000).toISOString().replace("T", " ").slice(0, 19);
  const terkirimSejam = (db.prepare("SELECT COUNT(*) c FROM WaPesan WHERE arah='keluar' AND status='terkirim' AND dibuat_pada > ?").get(sejamLalu) as { c: number }).c;
  if (terkirimSejam >= 50) { console.log("Antrean: batas 50/jam tercapai, tunda."); return; }

  const jeda = waJedaAktif();
  const rows = db.prepare("SELECT id, nomor, isi, sumber, media_file FROM WaPesan WHERE arah='keluar' AND status='antre' ORDER BY id ASC LIMIT 10").all() as Antrean[];
  for (const m of rows) {
    // Tombol Jeda bot: hentikan balasan & pengingat otomatis seketika (PRD §6.2). Balasan TU tetap jalan.
    if (jeda && m.sumber !== "tu") {
      console.log(`Antrean #${m.id} ditahan (bot dijeda).`);
      continue;
    }
    try {
      const jid = m.nomor.includes("@") ? m.nomor : `${m.nomor.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
      if (m.media_file) {
        const { readFileSync, existsSync } = await import("fs");
        if (existsSync(m.media_file)) {
          await sock.sendMessage(jid, { document: readFileSync(m.media_file), fileName: "kwitansi.pdf", mimetype: "application/pdf", caption: m.isi });
        } else {
          await sock.sendMessage(jid, { text: m.isi });
        }
      } else {
        await sock.sendMessage(jid, { text: m.isi });
      }
      db.prepare("UPDATE WaPesan SET status='terkirim' WHERE id=?").run(m.id);
      console.log(`Terkirim #${m.id} → ${m.nomor}`);
    } catch (e) {
      db.prepare("UPDATE WaPesan SET status='gagal' WHERE id=?").run(m.id);
      console.log(`Gagal #${m.id} → ${m.nomor}:`, (e as Error).message);
    }
    await jedaAcak();
  }
}

/** Loop selamanya tiap 60 detik. */
export async function loopAntrean(getSock: () => WASocket | null) {
  for (;;) {
    try {
      const sock = getSock();
      if (sock) await prosesAntrean(sock);
    } catch (e) {
      console.log("Antrean error:", (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

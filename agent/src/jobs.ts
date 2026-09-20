import { exec } from "child_process";
import path from "path";
import { db, getPengaturan } from "./db.js";

/** Buat tagihan bulan berjalan untuk semua siswa aktif — idempoten (PRD §5.3). */
export function generateTagihan(periode: string, oleh = "agent") {
  const jatuhTgl = getPengaturan("jatuh_tempo_tgl", "10").padStart(2, "0");
  const jatuh = `${periode}-${jatuhTgl}`;
  const siswa = db.prepare("SELECT id, kelas_id FROM Siswa WHERE status='aktif'").all() as { id: number; kelas_id: number }[];
  const ins = db.prepare("INSERT OR IGNORE INTO Tagihan (siswa_id, periode, nominal, jatuh_tempo, status, dibuat_oleh) VALUES (?, ?, ?, ?, 'belum', ?)");
  let dibuat = 0;
  for (const s of siswa) {
    const tarif = db.prepare("SELECT nominal FROM Tarif WHERE kelas_id=? ORDER BY berlaku_sejak DESC LIMIT 1").get(s.kelas_id) as { nominal: number } | undefined;
    const r = ins.run(s.id, periode, tarif?.nominal ?? 350000, jatuh, oleh);
    dibuat += Number(r.changes);
  }
  console.log(`Tagihan ${periode}: ${dibuat} baru dari ${siswa.length} siswa aktif.`);
  return { dibuat, total: siswa.length };
}

export function jalanBackup() {
  const script = path.resolve(process.cwd(), "../scripts/backup.sh");
  exec(`sh ${script}`, (err, out) => {
    if (err) console.log("Backup gagal:", err.message);
    else console.log(out.trim());
  });
}

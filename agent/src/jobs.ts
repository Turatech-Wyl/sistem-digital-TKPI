import { exec } from "child_process";
import path from "path";
import { db, getPengaturan, kini } from "./db.js";

/**
 * Buat tagihan periode YYYY-MM untuk semua siswa aktif — idempoten (PRD §5.3).
 * Tarif = tarif kelas terbaru yang sudah berlaku pada periode itu. Siswa tanpa tarif dilewati
 * (lebih aman daripada menagih nominal tebakan).
 */
export function generateTagihan(periode: string, oleh = "agent") {
  const jatuhTgl = getPengaturan("jatuh_tempo_tgl", "10").padStart(2, "0");
  const jatuh = `${periode}-${jatuhTgl}`;
  const siswa = db.prepare("SELECT id, kelas_id FROM Siswa WHERE status='aktif'").all() as { id: number; kelas_id: number }[];
  const tarifKelas = db.prepare("SELECT nominal FROM Tarif WHERE kelas_id=? AND berlaku_sejak <= ? ORDER BY berlaku_sejak DESC, id DESC LIMIT 1");
  // diubah_pada wajib diisi: kolom @updatedAt Prisma tidak punya DEFAULT di SQLite, dan
  // INSERT OR IGNORE diam-diam melewati baris yang melanggar NOT NULL.
  const ins = db.prepare("INSERT OR IGNORE INTO Tagihan (siswa_id, periode, nominal, jatuh_tempo, status, dibuat_oleh, dibuat_pada, diubah_pada) VALUES (?, ?, ?, ?, 'belum', ?, ?, ?)");
  let dibuat = 0, tanpaTarif = 0;
  for (const s of siswa) {
    const tarif = tarifKelas.get(s.kelas_id, periode) as { nominal: number } | undefined;
    if (!tarif) { tanpaTarif++; continue; }
    const t = kini();
    dibuat += Number(ins.run(s.id, periode, tarif.nominal, jatuh, oleh, t, t).changes);
  }
  console.log(`Tagihan ${periode}: ${dibuat} baru dari ${siswa.length} siswa aktif${tanpaTarif ? `, ${tanpaTarif} dilewati (tarif kelas belum ada)` : ""}.`);
  return { dibuat, total: siswa.length, tanpaTarif };
}

export function jalanBackup() {
  const script = path.resolve(process.cwd(), "../scripts/backup.sh");
  exec(`sh ${script}`, (err, out) => {
    if (err) console.log("Backup gagal:", err.message);
    else console.log(out.trim());
  });
}

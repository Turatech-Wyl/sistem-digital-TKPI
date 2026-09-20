import { db, getPengaturan } from "./db.js";

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const namaBulan = (periode: string) => `${BULAN[Number(periode.slice(5, 7))]} ${periode.slice(0, 4)}`;
export const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

type TagihanBelum = { periode: string; nominal: number; siswa: string; kelas: string; ortu: string; wa: string };

function dapatJadwalHariIni(tgl: Date): boolean {
  const daftar = getPengaturan("pengingat_tgl", "1,10,17,24,31").split(",").map((s) => Number(s.trim()));
  return daftar.includes(tgl.getDate());
}

/** Cek pengingat — dipanggil tiap 10 menit; hanya bertindak 07.00–09.00 Senin–Sabtu (PRD §6.3). */
export function cekPengirimanPengingat(skrg = new Date()) {
  const hari = skrg.getDay(); // 0 = Minggu
  const jam = skrg.getHours();
  if (hari === 0) return { kirim: false, alasan: "hari Minggu" };
  const libur = getPengaturan("libur", "").split(",").map((s) => s.trim());
  const hariIni = skrg.toISOString().slice(0, 10);
  if (libur.includes(hariIni)) return { kirim: false, alasan: "hari libur" };
  if (jam < 7 || jam >= 9) return { kirim: false, alasan: "di luar 07.00–09.00" };
  if (!dapatJadwalHariIni(skrg)) return { kirim: false, alasan: "bukan tanggal pengingat" };
  const periode = `${skrg.getFullYear()}-${String(skrg.getMonth() + 1).padStart(2, "0")}`;
  return { kirim: true, periode };
}

export function buatPengingat() {
  const cek = cekPengirimanPengingat();
  if (!cek.kirim) { console.log("Pengingat:", cek.alasan); return 0; }
  const periode = (cek as { periode: string }).periode;

  const rows = db.prepare(`
    SELECT t.periode, t.nominal, s.nama AS siswa, k.nama AS kelas,
           COALESCE(o.nama_ibu, o.nama_ayah, '') AS ortu, o.wa_utama AS wa
    FROM Tagihan t JOIN Siswa s ON s.id = t.siswa_id JOIN Kelas k ON k.id = s.kelas_id
    JOIN SiswaOrangTua so ON so.siswa_id = s.id JOIN OrangTua o ON o.id = so.orang_tua_id
    WHERE t.periode = ? AND t.status = 'belum' AND s.status = 'aktif'
  `).all(periode) as TagihanBelum[];

  // Kelompokkan per nomor (satu nomor dua anak = satu pesan, PRD §6.3)
  const perNomor = new Map<string, TagihanBelum[]>();
  for (const r of rows) {
    if (!perNomor.has(r.wa)) perNomor.set(r.wa, []);
    perNomor.get(r.wa)!.push(r);
  }

  const batasBalas = new Date(Date.now() - 90 * 86400_000).toISOString().replace("T", " ").slice(0, 19);
  const hariIni = new Date().toISOString().slice(0, 10);
  const tpl = getPengaturan("tpl_pengingat", "Assalamualaikum Bapak/Ibu {orang_tua}, SPP {nama_siswa} bulan {bulan} sebesar {nominal} belum kami terima. Pembayaran ke {rekening}. Terima kasih 🙏 — Asisten TK");
  const rekening = `${getPengaturan("rekening_bank", "BCA")} ${getPengaturan("rekening_nomor", "")} a.n. ${getPengaturan("rekening_nama", "")}`;
  let antre = 0;

  for (const [wa, daftar] of perNomor) {
    // Lewati nomor tanpa balasan 90 hari (PRD §6.3) — TU hubungi manual
    const balas = (db.prepare("SELECT COUNT(*) c FROM WaPesan WHERE arah='masuk' AND nomor=? AND dibuat_pada > ?").get(wa, batasBalas) as { c: number }).c;
    if (!balas) { console.log(`Pengingat: lewati ${wa} (tanpa balasan 90 hari)`); continue; }
    // Jangan kirim 2× sehari untuk periode sama
    const sudah = (db.prepare("SELECT COUNT(*) c FROM WaPesan WHERE arah='keluar' AND nomor=? AND sumber='pengingat' AND isi LIKE ? AND dibuat_pada LIKE ?").get(wa, `%${periode}%`, `${hariIni}%`) as { c: number }).c;
    if (sudah) continue;
    const nama = daftar.map((d) => d.siswa).join(" dan ");
    const total = daftar.reduce((a, d) => a + d.nominal, 0);
    const isi = tpl
      .replaceAll("{orang_tua}", daftar[0].ortu || "Bapak/Ibu")
      .replaceAll("{nama_siswa}", nama)
      .replaceAll("{bulan}", namaBulan(periode))
      .replaceAll("{nominal}", rupiah(total))
      .replaceAll("{rekening}", rekening);
    db.prepare("INSERT INTO WaPesan (arah, nomor, isi, status, sumber) VALUES ('keluar', ?, ?, 'antre', 'pengingat')").run(wa, isi);
    antre++;
  }
  console.log(`Pengingat ${periode}: ${antre} pesan antre.`);
  return antre;
}

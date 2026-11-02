import { db, getPengaturan, kini, msLalu, awalHariIni, tanggalLokal } from "./db.js";

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const namaBulan = (periode: string) => `${BULAN[Number(periode.slice(5, 7))]} ${periode.slice(0, 4)}`;
export const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

const SEMBILAN_PULUH_HARI = 90 * 86400_000;

type TagihanBelum = { periode: string; nominal: number; siswa: string; ortu: string; wa: string };

/** Jendela kirim pengingat: 07.00–09.00 Senin–Sabtu (PRD §6.3). Dipakai juga oleh antrean. */
export function dalamJamPengingat(skrg = new Date()): boolean {
  const jam = skrg.getHours();
  return skrg.getDay() !== 0 && jam >= 7 && jam < 9;
}

function tanggalPengingat(tgl: Date): boolean {
  const daftar = getPengaturan("pengingat_tgl", "1,10,17,24,31").split(",").map((s) => Number(s.trim()));
  return daftar.includes(tgl.getDate());
}

/** Cek pengingat — dipanggil tiap 10 menit; hanya bertindak di jendela kirim (PRD §6.3). */
export function cekPengirimanPengingat(skrg = new Date()) {
  if (skrg.getDay() === 0) return { kirim: false, alasan: "hari Minggu" };
  const libur = getPengaturan("libur", "").split(",").map((s) => s.trim());
  if (libur.includes(tanggalLokal(skrg))) return { kirim: false, alasan: "hari libur" };
  if (!dalamJamPengingat(skrg)) return { kirim: false, alasan: "di luar 07.00–09.00" };
  if (!tanggalPengingat(skrg)) return { kirim: false, alasan: "bukan tanggal pengingat" };
  const periode = `${skrg.getFullYear()}-${String(skrg.getMonth() + 1).padStart(2, "0")}`;
  return { kirim: true, periode };
}

/**
 * Nomor yang sudah lama dikirimi pesan tetapi tidak pernah membalas dalam 90 hari dilewati
 * (PRD §6.3, mitigasi ban). Nomor yang belum pernah dihubungi tetap dikirimi; tanpa syarat ini
 * pengingat pertama setelah go-live tidak akan terkirim ke siapa pun.
 */
function tidakPernahMembalas(wa: string): boolean {
  const batas = msLalu(SEMBILAN_PULUH_HARI);
  const balas = db.prepare("SELECT 1 FROM WaPesan WHERE arah='masuk' AND nomor=? AND dibuat_pada > ? LIMIT 1").get(wa, batas);
  if (balas) return false;
  const kirimLama = db.prepare("SELECT 1 FROM WaPesan WHERE arah='keluar' AND nomor=? AND dibuat_pada <= ? LIMIT 1").get(wa, batas);
  return !!kirimLama;
}

export function buatPengingat() {
  const cek = cekPengirimanPengingat();
  if (!cek.kirim) { console.log("Pengingat:", cek.alasan); return 0; }
  const periode = (cek as { periode: string }).periode;

  // Semua tagihan belum lunas sampai bulan ini (tunggakan lama ikut disebut), siswa aktif saja
  const rows = db.prepare(`
    SELECT t.periode, t.nominal, s.nama AS siswa,
           COALESCE(NULLIF(o.nama_ibu, '-'), o.nama_ayah, '') AS ortu, o.wa_utama AS wa
    FROM Tagihan t JOIN Siswa s ON s.id = t.siswa_id
    JOIN SiswaOrangTua so ON so.siswa_id = s.id JOIN OrangTua o ON o.id = so.orang_tua_id
    WHERE t.periode <= ? AND t.status = 'belum' AND s.status = 'aktif' AND COALESCE(o.wa_utama, '') <> ''
    ORDER BY t.periode ASC
  `).all(periode) as TagihanBelum[];

  // Kelompokkan per nomor (satu nomor dua anak = satu pesan, PRD §6.3)
  const perNomor = new Map<string, TagihanBelum[]>();
  for (const r of rows) {
    if (!perNomor.has(r.wa)) perNomor.set(r.wa, []);
    perNomor.get(r.wa)!.push(r);
  }

  const tpl = getPengaturan("tpl_pengingat", "Assalamualaikum Bapak/Ibu {orang_tua}, SPP {nama_siswa} bulan {bulan} sebesar {nominal} belum kami terima. Pembayaran ke {rekening}. Terima kasih 🙏 — Asisten TK");
  const rekening = `${getPengaturan("rekening_bank", "BCA")} ${getPengaturan("rekening_nomor", "")} a.n. ${getPengaturan("rekening_nama", "")}`;
  const sudahHariIni = db.prepare("SELECT 1 FROM WaPesan WHERE arah='keluar' AND sumber='pengingat' AND nomor=? AND dibuat_pada >= ? LIMIT 1");
  const simpan = db.prepare("INSERT INTO WaPesan (arah, nomor, isi, status, sumber, dibuat_pada) VALUES ('keluar', ?, ?, 'antre', 'pengingat', ?)");
  let antre = 0;

  for (const [wa, daftar] of perNomor) {
    if (sudahHariIni.get(wa, awalHariIni())) continue; // maksimal satu pengingat per nomor per hari
    if (tidakPernahMembalas(wa)) { console.log(`Pengingat: lewati ${wa} (tanpa balasan 90 hari)`); continue; }
    const unik = (xs: string[]) => [...new Set(xs)];
    const isi = tpl
      .replaceAll("{orang_tua}", daftar[0].ortu || "Bapak/Ibu")
      .replaceAll("{nama_siswa}", unik(daftar.map((d) => d.siswa)).join(" dan "))
      .replaceAll("{bulan}", unik(daftar.map((d) => namaBulan(d.periode))).join(", "))
      .replaceAll("{nominal}", rupiah(daftar.reduce((a, d) => a + d.nominal, 0)))
      .replaceAll("{rekening}", rekening);
    simpan.run(wa, isi, kini());
    antre++;
  }
  console.log(`Pengingat ${periode}: ${antre} pesan antre.`);
  return antre;
}

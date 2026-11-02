import fs from "fs";
import path from "path";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { dataKwitansi, pdfKwitansi } from "./kwitansi";
import { bulanNama, hariIni, rupiah } from "./format";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "../data");

/** Nomor kwitansi urut per bulan: KWT/2026/11/0001 (PRD §5.4). Dipanggil di dalam transaksi. */
async function nomorKwitansi(tx: Prisma.TransactionClient, tgl: string): Promise<string> {
  const awalan = `KWT/${tgl.slice(0, 4)}/${tgl.slice(5, 7)}/`;
  let urut = (await tx.pembayaran.count({ where: { no_kwitansi: { startsWith: awalan } } })) + 1;
  for (;;) {
    const no = awalan + String(urut).padStart(4, "0");
    if (!(await tx.pembayaran.findUnique({ where: { no_kwitansi: no } }))) return no;
    urut++;
  }
}

type Lunasi = { metode: "tunai" | "transfer"; tgl?: string; nama: string; email: string };

/**
 * Tandai tagihan lunas: buat pembayaran + kwitansi, status tagihan, dan pemasukan kas — atomik.
 * Return null bila tagihan tidak ada / sudah lunas (mis. tombol diklik dua kali).
 */
export async function lunasiTagihan(tagihanId: number, o: Lunasi) {
  const tgl = o.tgl && /^\d{4}-\d{2}-\d{2}$/.test(o.tgl) ? o.tgl : hariIni();
  return db.$transaction(async (tx) => {
    const tag = await tx.tagihan.findUnique({ where: { id: tagihanId }, include: { siswa: true } });
    if (!tag || tag.status === "lunas" || tag.status === "dibatalkan") return null;
    if (o.metode === "transfer" && tag.status !== "menunggu_verifikasi") return null;
    // Klaim status lebih dulu: permintaan kedua yang bersamaan tidak lagi cocok dan berhenti di sini
    const klaim = await tx.tagihan.updateMany({ where: { id: tag.id, status: tag.status }, data: { status: "lunas" } });
    if (!klaim.count) return null;
    const byr = await tx.pembayaran.create({
      data: {
        tagihan_id: tag.id, tgl_bayar: tgl, nominal: tag.nominal, metode: o.metode,
        no_kwitansi: await nomorKwitansi(tx, tgl), status_verifikasi: "lunas", diverifikasi_oleh: o.nama, dibuat_oleh: o.email,
      },
    });
    const kat = await tx.kasKategori.findUnique({ where: { nama: "SPP" } });
    if (kat) {
      await tx.kas.create({ data: { tgl, jenis: "masuk", kategori_id: kat.id, keterangan: `SPP ${tag.siswa.nama} ${bulanNama(tag.periode)}`, nominal: tag.nominal, pembayaran_id: byr.id, dibuat_oleh: o.email } });
    }
    return { pembayaran: byr, tagihan: tag };
  });
}

/** Nomor WA utama orang tua pertama dari siswa, atau null. */
export async function waOrangTua(siswaId: number): Promise<string | null> {
  const so = await db.siswaOrangTua.findFirst({ where: { siswa_id: siswaId }, include: { orang_tua: true } });
  return so?.orang_tua.wa_utama || null;
}

/** Simpan PDF kwitansi ke data/media dan antrekan konfirmasi lunas ke WA orang tua (PRD §5.4 langkah 4). */
export async function kirimKonfirmasiLunas(pembayaranId: number, siswaId: number) {
  const wa = await waOrangTua(siswaId);
  const dk = await dataKwitansi(pembayaranId);
  if (!wa || !dk) return;
  let media: string | null = null;
  try {
    fs.mkdirSync(path.join(DATA_DIR, "media"), { recursive: true });
    media = path.join(DATA_DIR, "media", `kwitansi-${pembayaranId}.pdf`);
    fs.writeFileSync(media, await pdfKwitansi(dk));
  } catch { media = null; /* tanpa lampiran, pesan tetap terkirim */ }
  const tpl = (await db.pengaturan.findUnique({ where: { kunci: "tpl_lunas" } }))?.nilai
    || "Alhamdulillah, pembayaran SPP {nama_siswa} bulan {bulan} sebesar {nominal} sudah kami terima. Kwitansi terlampir. Terima kasih 🙏";
  const isi = tpl
    .replaceAll("{nama_siswa}", dk.siswa)
    .replaceAll("{bulan}", bulanNama(dk.periode))
    .replaceAll("{nominal}", rupiah(dk.nominal))
    .replaceAll("{orang_tua}", "Bapak/Ibu");
  await db.waPesan.create({ data: { arah: "keluar", nomor: wa, isi: tandaTangan(isi), media_file: media, status: "antre", sumber: "bot" } });
}

/** Semua pesan bot diakhiri "— Asisten TK" (PRD §6.2), tanpa dobel bila template sudah memuatnya. */
export const tandaTangan = (isi: string) => (/—\s*Asisten TK\s*$/.test(isi) ? isi : `${isi}\n— Asisten TK`);

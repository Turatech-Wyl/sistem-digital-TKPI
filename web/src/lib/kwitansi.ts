import PDFDocument from "pdfkit";
import { db } from "./db";
import { rupiah, bulanNama } from "./format";

export type KwitansiData = {
  no: string; siswa: string; kelas: string; periode: string;
  nominal: number; tgl: string; metode: string; oleh: string;
};

export async function dataKwitansi(pembayaranId: number): Promise<(KwitansiData & { namaSekolah: string }) | null> {
  const byr = await db.pembayaran.findUnique({
    where: { id: pembayaranId },
    include: { tagihan: { include: { siswa: { include: { kelas: true } } } } },
  });
  if (!byr) return null;
  const namaSekolah = (await db.pengaturan.findUnique({ where: { kunci: "sekolah_nama" } }))?.nilai || "TK Permata Indonesia";
  return {
    namaSekolah, no: byr.no_kwitansi,
    siswa: byr.tagihan.siswa.nama, kelas: byr.tagihan.siswa.kelas.nama,
    periode: byr.tagihan.periode, nominal: byr.nominal,
    tgl: byr.tgl_bayar, metode: byr.metode, oleh: byr.diverifikasi_oleh || "-",
  };
}

export async function pdfKwitansi(d: KwitansiData & { namaSekolah: string }): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A5", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  doc.fontSize(16).text(d.namaSekolah, { align: "center" });
  doc.fontSize(12).text("KWITANSI PEMBAYARAN SPP — LUNAS", { align: "center" });
  doc.moveDown().fontSize(10);
  doc.text(`No: ${d.no}`);
  doc.text(`Siswa: ${d.siswa} (${d.kelas})`);
  doc.text(`Bulan: ${bulanNama(d.periode)}`);
  doc.text(`Nominal: ${rupiah(d.nominal)}`);
  doc.text(`Tanggal: ${d.tgl} · ${d.metode}`);
  doc.text(`Diverifikasi: ${d.oleh}`);
  doc.moveDown().fontSize(10).text("Terima kasih 🙏 — Asisten TK", { align: "center" });
  doc.end();
  return done;
}

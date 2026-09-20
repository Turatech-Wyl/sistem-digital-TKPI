import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesi } from "@/lib/auth";
import PDFDocument from "pdfkit";
import { rupiah, bulanNama } from "@/lib/format";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sesi();
  if (!s) return NextResponse.json({ error: "login" }, { status: 401 });
  const { id } = await ctx.params;
  const byr = await db.pembayaran.findUnique({
    where: { id: Number(id) },
    include: { tagihan: { include: { siswa: { include: { kelas: true } } } } },
  });
  if (!byr) return NextResponse.json({ error: "tidak ada" }, { status: 404 });
  const nama = (await db.pengaturan.findUnique({ where: { kunci: "sekolah_nama" } }))?.nilai || "TK Permata Indonesia";

  const doc = new PDFDocument({ size: "A5", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  doc.fontSize(16).text(nama, { align: "center" });
  doc.fontSize(12).text("KWITANSI PEMBAYARAN SPP — LUNAS", { align: "center" });
  doc.moveDown();
  doc.fontSize(10);
  doc.text(`No: ${byr.no_kwitansi}`);
  doc.text(`Siswa: ${byr.tagihan.siswa.nama} (${byr.tagihan.siswa.kelas.nama})`);
  doc.text(`Bulan: ${bulanNama(byr.tagihan.periode)}`);
  doc.text(`Nominal: ${rupiah(byr.nominal)}`);
  doc.text(`Tanggal: ${byr.tgl_bayar} · ${byr.metode}`);
  doc.text(`Diverifikasi: ${byr.diverifikasi_oleh || "-"}`);
  doc.moveDown();
  doc.fontSize(10).text("Terima kasih 🙏 — Asisten TK", { align: "center" });

  doc.end();
  const pdf = await done;
  // TypeScript DOM vs Node Buffer conflict — cast body ke unknown agar build lolos
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${byr.no_kwitansi.replaceAll("/", "-")}.pdf"` },
  });
}

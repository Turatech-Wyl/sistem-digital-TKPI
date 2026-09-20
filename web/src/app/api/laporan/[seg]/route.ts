import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesi } from "@/lib/auth";
import { rekapSPP, daftarTunggakan } from "@/lib/laporan";
import { bulanNama } from "@/lib/format";
import { tabelPDF, namaSekolah } from "@/lib/pdf";

export async function GET(req: Request) {
  const s = await sesi();
  if (!s) return NextResponse.json({ error: "login" }, { status: 401 });
  const url = new URL(req.url);
  const seg = url.pathname.split("/").filter(Boolean).pop() || "";
  const nama = await namaSekolah(db);
  let pdf: Buffer, file: string;
  if (seg === "tunggakan") {
    const t = await daftarTunggakan();
    pdf = await tabelPDF("Tunggakan SPP (> 1 bulan)", `${t.length} siswa`, ["Siswa", "Kelas", "Bulan", "Periode", "Total"],
      t.map((x) => [x.nama, x.kelas, String(x.bulan), x.periode.join(", "), x.total.toLocaleString("id-ID")]), nama);
    file = "tunggakan.pdf";
  } else if (seg === "kas") {
    const bulan = url.searchParams.get("bulan") || "";
    const rows = await db.kas.findMany({ where: bulan ? { tgl: { startsWith: bulan } } : {}, include: { kategori: true }, orderBy: { tgl: "desc" } });
    pdf = await tabelPDF(`Buku Kas ${bulan || "semua"}`, `${rows.length} transaksi`, ["Tgl", "Keterangan", "Kategori", "Masuk", "Keluar"],
      rows.map((r) => [r.tgl, r.keterangan, r.kategori.nama, r.jenis === "masuk" ? r.nominal.toLocaleString("id-ID") : "-", r.jenis === "keluar" ? r.nominal.toLocaleString("id-ID") : "-"]), nama);
    file = `kas-${bulan || "semua"}.pdf`;
  } else {
    const periode = url.searchParams.get("periode") || "";
    const rekap = await rekapSPP(periode);
    pdf = await tabelPDF(`Rekap SPP ${bulanNama(periode)}`, "Per kelas", ["Kelas", "Siswa", "Lunas", "Belum", "Masuk", "Tertunggak"],
      rekap.map((r) => [r.kelas, String(r.jml_siswa), String(r.lunas), String(r.belum + r.verifikasi), r.masuk.toLocaleString("id-ID"), r.tunggak.toLocaleString("id-ID")]), nama);
    file = `rekap-${periode}.pdf`;
  }
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}"` },
  });
}

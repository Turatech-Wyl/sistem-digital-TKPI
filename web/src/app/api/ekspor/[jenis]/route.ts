import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesi } from "@/lib/auth";
import { rekapSPP, daftarTunggakan } from "@/lib/laporan";
import { bulanNama } from "@/lib/format";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  const s = await sesi();
  if (!s) return NextResponse.json({ error: "login" }, { status: 401 });
  const jenis = new URL(req.url).pathname.endsWith("tunggakan") ? "tunggakan" : "rekap";
  const periode = new URL(req.url).searchParams.get("periode") || "";
  const wb = XLSX.utils.book_new();
  if (jenis === "rekap") {
    const rekap = await rekapSPP(periode);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rekap.map((r) => ({
      Kelas: r.kelas, Siswa: r.jml_siswa, Lunas: r.lunas, Belum: r.belum, Verifikasi: r.verifikasi,
      Masuk: r.masuk, Tertunggak: r.tunggak, NamaBelum: r.nama_belum.join("; "),
    }))), "Rekap");
  } else {
    const t = await daftarTunggakan();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(t.map((x) => ({
      Siswa: x.nama, Kelas: x.kelas, WA: x.wa, Bulan: x.bulan, Periode: x.periode.join(", "), Total: x.total,
    }))), "Tunggakan");
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${jenis}-${periode || "semua"}.xlsx"` },
  });
}

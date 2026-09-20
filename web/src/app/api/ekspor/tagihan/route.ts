import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesi } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  const s = await sesi();
  if (!s) return NextResponse.json({ error: "login" }, { status: 401 });
  const url = new URL(req.url);
  const periode = url.searchParams.get("periode") || "";
  const rows = await db.tagihan.findMany({
    where: periode ? { periode } : {},
    include: { siswa: { include: { kelas: true, orang_tua: { include: { orang_tua: true } } } } },
    orderBy: [{ periode: "desc" }, { status: "asc" }],
  });
  const data = rows.map((t) => ({
    Periode: t.periode, NIS: t.siswa.nis, Siswa: t.siswa.nama, Kelas: t.siswa.kelas.nama,
    WA: t.siswa.orang_tua.map((o) => o.orang_tua.wa_utama).join(";"),
    Nominal: t.nominal, JatuhTempo: t.jatuh_tempo, Status: t.status,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Tagihan");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="tagihan-${periode || "semua"}.xlsx"` },
  });
}

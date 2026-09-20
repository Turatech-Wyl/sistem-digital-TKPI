import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesi } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: Request) {
  const s = await sesi();
  if (!s) return NextResponse.json({ error: "login" }, { status: 401 });
  const url = new URL(req.url);
  const bulan = url.searchParams.get("bulan") || "";
  const rows = await db.kas.findMany({
    where: bulan ? { tgl: { startsWith: bulan } } : {},
    include: { kategori: true }, orderBy: { tgl: "desc" },
  });
  const data = rows.map((r) => ({ Tgl: r.tgl, Jenis: r.jenis, Kategori: r.kategori.nama, Keterangan: r.keterangan, Nominal: r.nominal }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Kas");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="kas-${bulan || "semua"}.xlsx"` },
  });
}

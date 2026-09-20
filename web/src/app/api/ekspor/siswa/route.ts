import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sesi } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET() {
  const s = await sesi();
  if (!s) return NextResponse.json({ error: "login" }, { status: 401 });
  const rows = await db.siswa.findMany({ include: { kelas: true, orang_tua: { include: { orang_tua: true } } }, orderBy: { nama: "asc" } });
  const data = rows.map((r) => ({
    Nama: r.nama, Kelas: r.kelas.nama, Ortu: r.orang_tua.map((o) => o.orang_tua.nama_ibu || o.orang_tua.nama_ayah).join(";"),
    WA: r.orang_tua.map((o) => o.orang_tua.wa_utama).join(";"), Lahir: r.tgl_lahir || "", Status: r.status,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.length ? data : [{ Nama: "Contoh", Kelas: "TK A", Ortu: "Ibu Contoh", WA: "62812xxxxxxx", Lahir: "2020-01-01", Status: "aktif" }]), "Siswa");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf as unknown as BodyInit, {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="siswa.xlsx"` },
  });
}

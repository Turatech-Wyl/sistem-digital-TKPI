import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { sesi } from "@/lib/auth";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "../data");

/** Tampilkan file bukti/nota (khusus login) — path dibatasi ke data/media. */
export async function GET(_: Request, ctx: { params: Promise<{ p: string[] }> }) {
  const s = await sesi();
  if (!s) return NextResponse.json({ error: "login" }, { status: 401 });
  const { p } = await ctx.params;
  const akar = path.resolve(DATA_DIR, "media") + path.sep;
  const fp = path.resolve(akar, ...p);
  // Pemisah wajib ikut dicek: tanpa itu "../media-lain/x" lolos karena berawalan ".../media"
  if (!fp.startsWith(akar)) return NextResponse.json({ error: "dilarang" }, { status: 403 });
  try {
    const buf = fs.readFileSync(fp);
    const ext = path.extname(fp).toLowerCase();
    const tipe = ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg";
    return new NextResponse(buf as unknown as BodyInit, { headers: { "Content-Type": tipe, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "tidak ada" }, { status: 404 });
  }
}

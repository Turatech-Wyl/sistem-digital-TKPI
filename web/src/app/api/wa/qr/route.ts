import { NextResponse } from "next/server";
import { sesi } from "@/lib/auth";
import { bacaQR } from "@/lib/wafile";

export async function GET() {
  const s = await sesi();
  if (!s || s.peran !== "admin") return NextResponse.json({ error: "khusus admin" }, { status: 403 });
  const png = bacaQR();
  if (!png) return NextResponse.json({ error: "belum ada QR — nyalakan agent" }, { status: 404 });
  return new NextResponse(png as unknown as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}

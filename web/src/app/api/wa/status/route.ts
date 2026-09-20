import { NextResponse } from "next/server";
import { sesi } from "@/lib/auth";
import { bacaStatusWA, adaQR } from "@/lib/wafile";
import { db } from "@/lib/db";

export async function GET() {
  const s = await sesi();
  if (!s || s.peran !== "admin") return NextResponse.json({ error: "khusus admin" }, { status: 403 });
  const jeda = (await db.pengaturan.findUnique({ where: { kunci: "wa_jeda" } }))?.nilai === "1";
  return NextResponse.json({ ...bacaStatusWA(), ada_qr: adaQR(), jeda });
}

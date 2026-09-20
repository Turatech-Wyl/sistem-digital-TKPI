import { NextResponse } from "next/server";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { catatAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const s = await sesi();
  if (!s || s.peran !== "admin") return NextResponse.json({ error: "khusus admin" }, { status: 403 });
  const skr = (await db.pengaturan.findUnique({ where: { kunci: "wa_jeda" } }))?.nilai === "1";
  const baru = skr ? "0" : "1";
  await db.pengaturan.upsert({ where: { kunci: "wa_jeda" }, update: { nilai: baru }, create: { kunci: "wa_jeda", nilai: baru } });
  await catatAudit(s.email, "pengaturan", baru === "1" ? "jeda-bot" : "lanjut-bot", "wa_jeda", {}, { nilai: baru });
  const ref = req.headers.get("referer");
  let back = new URL("/pengaturan", req.url);
  try { if (ref && new URL(ref).origin === new URL(req.url).origin) back = new URL(ref); } catch { /* fallback */ }
  return NextResponse.redirect(back, 303);
}

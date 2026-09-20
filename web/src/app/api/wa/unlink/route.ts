import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { sesi } from "@/lib/auth";
import { catatAudit } from "@/lib/audit";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "../data");

/** Minta agent memutuskan perangkat tertaut (maks ~60 dtk), lalu QR baru otomatis. */
export async function POST(req: Request) {
  const s = await sesi();
  if (!s || s.peran !== "admin") return NextResponse.json({ error: "khusus admin" }, { status: 403 });
  fs.writeFileSync(path.join(DATA_DIR, "unlink.req"), new Date().toISOString());
  await catatAudit(s.email, "pengaturan", "unlink-wa", "wa", {}, {});
  const ref = req.headers.get("referer");
  let back = new URL("/pengaturan", req.url);
  try { if (ref && new URL(ref).origin === new URL(req.url).origin) back = new URL(ref); } catch { /* fallback */ }
  return NextResponse.redirect(back, 303);
}

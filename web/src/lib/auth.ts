import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./db";

const COOKIE = "tkpi_session";
const MAX_AGE = 8 * 60 * 60; // sesi 8 jam (PRD §5.8)

function rahasia() {
  const secret = process.env.SESSION_SECRET || "";
  // Di produksi jangan pernah jatuh ke nilai bawaan: siapa pun bisa memalsukan sesi admin
  if (process.env.NODE_ENV === "production" && (secret.length < 32 || secret.includes("placeholder"))) {
    throw new Error("SESSION_SECRET belum diatur (min 32 karakter) — lihat docs/deploy.md");
  }
  return secret || "placeholder-secret-min-32-karakter";
}

function sign(payload: string) {
  return createHmac("sha256", rahasia()).update(payload).digest("hex");
}

function cocok(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function buatSesi(userId: number, peran: string) {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}.${peran}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, path: "/", maxAge: MAX_AGE, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
}

export async function hapusSesi() {
  const c = await cookies();
  c.delete(COOKIE);
}

export type Sesi = { id: number; nama: string; email: string; peran: string } | null;

export async function sesi(): Promise<Sesi> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [uid, peran, exp, sig] = parts;
  const payload = `${uid}.${peran}.${exp}`;
  if (!cocok(sign(payload), sig)) return null;
  if (Number(exp) < Date.now()) return null;
  const user = await db.pengguna.findUnique({ where: { id: Number(uid) } });
  if (!user || !user.aktif) return null;
  return { id: user.id, nama: user.nama, email: user.email, peran: user.peran };
}

export async function butuhLogin(peran?: "admin" | "viewer") {
  const s = await sesi();
  if (!s) return null;
  if (peran === "admin" && s.peran !== "admin") return null;
  return s;
}

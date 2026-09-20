import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { db } from "./db";

const COOKIE = "tkpi_session";
const MAX_AGE = 8 * 60 * 60; // sesi 8 jam (PRD §5.8)

function sign(payload: string) {
  const secret = process.env.SESSION_SECRET || "placeholder-secret-min-32-karakter";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function buatSesi(userId: number, peran: string) {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = `${userId}.${peran}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, path: "/", maxAge: MAX_AGE, sameSite: "lax" });
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
  if (sign(payload) !== sig) return null;
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

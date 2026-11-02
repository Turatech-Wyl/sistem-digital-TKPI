import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// DB bersama dengan web (SQLite satu file, PRD §8).
// Lokal: agent/../web/prisma/dev.db · Server: /opt/tk/data/tk.db via DB_PATH.
const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), "../web/prisma/dev.db");
export const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "../data");
fs.mkdirSync(path.join(DATA_DIR, "media"), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("busy_timeout = 5000");
db.pragma("journal_mode = WAL");

// Prisma (web) menyimpan DateTime SQLite sebagai epoch milidetik (INTEGER). Agent wajib memakai
// format yang sama: CURRENT_TIMESTAMP (TEXT) tidak bisa dibandingkan/diurutkan bersama INTEGER.
export const kini = () => Date.now();
export const msLalu = (ms: number) => Date.now() - ms;
/** Awal hari ini (waktu lokal, TZ=Asia/Jakarta) dalam epoch ms. */
export const awalHariIni = () => new Date(new Date().setHours(0, 0, 0, 0)).getTime();
/** Tanggal lokal YYYY-MM-DD (toISOString memakai UTC, bisa mundur sehari sebelum 07.00 WIB). */
export const tanggalLokal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Rapikan baris lama yang terlanjur ditulis agent sebagai TEXT (sekali jalan, idempoten).
db.prepare("UPDATE WaPesan SET dibuat_pada = CAST(strftime('%s', dibuat_pada) AS INTEGER) * 1000 WHERE typeof(dibuat_pada) = 'text'").run();

export function getPengaturan(kunci: string, fb = ""): string {
  const r = db.prepare("SELECT nilai FROM Pengaturan WHERE kunci = ?").get(kunci) as { nilai: string } | undefined;
  return r?.nilai ?? fb;
}

export function setPengaturan(kunci: string, nilai: string) {
  db.prepare("INSERT INTO Pengaturan (kunci, nilai) VALUES (?, ?) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai").run(kunci, nilai);
}

export function waJedaAktif(): boolean {
  return getPengaturan("wa_jeda", "0") === "1";
}

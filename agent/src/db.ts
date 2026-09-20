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

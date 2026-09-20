import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), "../data");

export type WaStatusFile = { connected: boolean; phone?: string; updated_at?: string; last_error?: string };

export function bacaStatusWA(): WaStatusFile & { agent_jalan: boolean } {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, "wa-status.json"), "utf8");
    const s = JSON.parse(raw) as WaStatusFile;
    const umur = s.updated_at ? Date.now() - new Date(s.updated_at).getTime() : Infinity;
    return { ...s, agent_jalan: umur < 5 * 60_000 };
  } catch {
    return { connected: false, agent_jalan: false, last_error: "agent belum pernah jalan" };
  }
}

export function adaQR(): boolean {
  return fs.existsSync(path.join(DATA_DIR, "qr.png"));
}

export function bacaQR(): Buffer | null {
  try {
    return fs.readFileSync(path.join(DATA_DIR, "qr.png"));
  } catch {
    return null;
  }
}

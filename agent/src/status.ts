import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { DATA_DIR } from "./db.js";

export type WaStatus = { connected: boolean; phone?: string; updated_at: string; last_error?: string };

export function tulisStatus(s: WaStatus) {
  fs.writeFileSync(path.join(DATA_DIR, "wa-status.json"), JSON.stringify({ ...s, updated_at: new Date().toISOString() }));
}

export async function tulisQR(qr: string) {
  // QR untuk ditampilkan di halaman Pengaturan web (PNG) + terminal
  await QRCode.toFile(path.join(DATA_DIR, "qr.png"), qr, { width: 280, margin: 1 });
  fs.writeFileSync(path.join(DATA_DIR, "qr.txt"), qr);
  tulisStatus({ connected: false });
}

export function hapusQR() {
  for (const f of ["qr.png", "qr.txt"]) {
    try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch { /* abaikan */ }
  }
}

import { db } from "./db";

/** Catat ke audit (PRD §5.8): tagihan, pembayaran, kas, tarif, pengaturan. */
export async function catatAudit(email: string, tabel: string, aksi: string, baris_id?: string, sebelum?: unknown, sesudah?: unknown) {
  try {
    const u = await db.pengguna.findUnique({ where: { email } });
    await db.audit.create({
      data: {
        pengguna_id: u?.id || null,
        tabel, baris_id: baris_id || "",
        aksi,
        sebelum: sebelum ? JSON.stringify(sebelum).slice(0, 2000) : "",
        sesudah: sesudah ? JSON.stringify(sesudah).slice(0, 2000) : "",
      },
    });
  } catch { /* audit tidak boleh menggagalkan aksi utama */ }
}

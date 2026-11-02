// Batas percobaan login gagal (PRD §5.8): 5 kali per email per 15 menit.
// Disimpan di memori proses web — cukup untuk satu server dengan segelintir pengguna.
const JENDELA = 15 * 60_000;
const MAKS = 5;
const gagal = new Map<string, number[]>();

const segar = (email: string) => (gagal.get(email) || []).filter((t) => t > Date.now() - JENDELA);

export function terkunci(email: string): boolean {
  return segar(email).length >= MAKS;
}

export function catatGagal(email: string) {
  gagal.set(email, [...segar(email), Date.now()]);
}

export function bersihkan(email: string) {
  gagal.delete(email);
}

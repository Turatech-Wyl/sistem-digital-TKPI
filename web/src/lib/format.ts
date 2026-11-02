export const rupiah = (n: number) =>
  "Rp " + new Intl.NumberFormat("id-ID").format(n);

export const bulanNama = (periode: string) => {
  // periode YYYY-MM -> "September 2026"
  const [y, m] = periode.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export const periodeBulanIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Tanggal lokal YYYY-MM-DD. Jangan pakai toISOString(): itu UTC, mundur sehari sebelum 07.00 WIB. */
export const hariIni = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const periodeValid = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);

/** Normalisasi nomor WA ke 62xxx (PRD §5.7) */
export function normalisasiWA(input: string): string {
  let s = (input || "").replace(/[^0-9+]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0")) s = "62" + s.slice(1);
  if (!s.startsWith("62")) s = "62" + s;
  return s;
}

import { db } from "./db";

export type RekapKelas = {
  kelas: string;
  jml_siswa: number;
  lunas: number;
  belum: number;
  verifikasi: number;
  masuk: number;
  tunggak: number;
  nama_belum: string[];
};

/** Rekap SPP bulanan per kelas (PRD §5.6) */
export async function rekapSPP(periode: string): Promise<RekapKelas[]> {
  const kelas = await db.kelas.findMany({ orderBy: { urutan: "asc" } });
  const out: RekapKelas[] = [];
  for (const k of kelas) {
    const tagihan = await db.tagihan.findMany({
      where: { periode, siswa: { kelas_id: k.id, status: "aktif" } },
      include: { siswa: true },
    });
    const lunas = tagihan.filter((t) => t.status === "lunas");
    const ver = tagihan.filter((t) => t.status === "menunggu_verifikasi");
    const blm = tagihan.filter((t) => t.status === "belum");
    out.push({
      kelas: k.nama,
      jml_siswa: tagihan.length,
      lunas: lunas.length,
      belum: blm.length,
      verifikasi: ver.length,
      masuk: lunas.reduce((a, t) => a + t.nominal, 0),
      tunggak: [...blm, ...ver].reduce((a, t) => a + t.nominal, 0),
      nama_belum: [...blm, ...ver].map((t) => `${t.siswa.nama} (${t.status === "belum" ? "belum" : "verifikasi"})`),
    });
  }
  return out;
}

export type Tunggakan = { nama: string; kelas: string; wa: string; bulan: number; total: number; periode: string[] };

/** Siswa dengan tagihan belum lunas > 1 bulan (PRD §5.6) */
export async function daftarTunggakan(): Promise<Tunggakan[]> {
  const rows = await db.tagihan.findMany({
    where: { status: { in: ["belum", "menunggu_verifikasi"] }, siswa: { status: "aktif" } },
    include: { siswa: { include: { kelas: true, orang_tua: { include: { orang_tua: true } } } } },
    orderBy: { periode: "asc" },
  });
  const map = new Map<number, Tunggakan>();
  for (const t of rows) {
    const e = map.get(t.siswa_id) || {
      nama: t.siswa.nama, kelas: t.siswa.kelas.nama,
      wa: t.siswa.orang_tua.map((o) => o.orang_tua.wa_utama).join(";"),
      bulan: 0, total: 0, periode: [] as string[],
    };
    e.bulan++;
    e.total += t.nominal;
    e.periode.push(t.periode);
    map.set(t.siswa_id, e);
  }
  return [...map.values()].filter((e) => e.bulan > 1).sort((a, b) => b.total - a.total);
}

import { db } from "@/lib/db";

/** Buat tagihan bulan periode YYYY-MM untuk semua siswa aktif — idempoten (PRD §5.3) */
export async function generateTagihan(periode: string, oleh = "sistem") {
  const [y, m] = periode.split("-").map(Number);
  const set = async (k: string) => (await db.pengaturan.findUnique({ where: { kunci: k } }))?.nilai;
  const tglJatuh = Number((await set("jatuh_tempo_tgl")) || "10");
  const jatuh = `${periode}-${String(tglJatuh).padStart(2, "0")}`;
  const siswa = await db.siswa.findMany({ where: { status: "aktif" } });
  let dibuat = 0;
  for (const s of siswa) {
    const tarif = await db.tarif.findFirst({ where: { kelas_id: s.kelas_id }, orderBy: { berlaku_sejak: "desc" } });
    const nominal = tarif?.nominal ?? 350000;
    const ada = await db.tagihan.findUnique({ where: { siswa_id_periode: { siswa_id: s.id, periode } } });
    if (!ada) {
      await db.tagihan.create({ data: { siswa_id: s.id, periode, nominal, jatuh_tempo: jatuh, status: "belum", dibuat_oleh: oleh } });
      dibuat++;
    }
  }
  return { periode, total_siswa: siswa.length, dibuat };
}

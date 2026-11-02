import { db } from "@/lib/db";

/**
 * Buat tagihan periode YYYY-MM untuk semua siswa aktif — idempoten (PRD §5.3).
 * Tarif = tarif kelas terbaru yang sudah berlaku pada periode itu; siswa tanpa tarif dilewati
 * (lebih aman daripada menagih nominal tebakan). Logika sama dengan agent/src/jobs.ts.
 */
export async function generateTagihan(periode: string, oleh = "sistem") {
  const tglJatuh = Number((await db.pengaturan.findUnique({ where: { kunci: "jatuh_tempo_tgl" } }))?.nilai || "10");
  const jatuh = `${periode}-${String(tglJatuh).padStart(2, "0")}`;
  const siswa = await db.siswa.findMany({ where: { status: "aktif" } });
  const tarif = await db.tarif.findMany({ where: { berlaku_sejak: { lte: periode } }, orderBy: [{ berlaku_sejak: "desc" }, { id: "desc" }] });
  const tarifKelas = new Map<number, number>();
  for (const t of tarif) if (!tarifKelas.has(t.kelas_id)) tarifKelas.set(t.kelas_id, t.nominal);
  const sudah = new Set((await db.tagihan.findMany({ where: { periode }, select: { siswa_id: true } })).map((t) => t.siswa_id));

  let dibuat = 0, tanpa_tarif = 0;
  for (const s of siswa) {
    if (sudah.has(s.id)) continue;
    const nominal = tarifKelas.get(s.kelas_id);
    if (nominal === undefined) { tanpa_tarif++; continue; }
    await db.tagihan.create({ data: { siswa_id: s.id, periode, nominal, jatuh_tempo: jatuh, status: "belum", dibuat_oleh: oleh } });
    dibuat++;
  }
  return { periode, total_siswa: siswa.length, dibuat, tanpa_tarif };
}

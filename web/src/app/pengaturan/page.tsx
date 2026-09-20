import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import WAConnect from "@/components/WAConnect";
import { SubmitButton } from "@/components/SubmitButton";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Pengaturan" };

async function get(k: string, fb = "") {
  const r = await db.pengaturan.findUnique({ where: { kunci: k } });
  return r?.nilai ?? fb;
}

export default async function PengaturanPage() {
  const s = await sesi();
  if (!s) redirect("/login");
  if (s.peran !== "admin") redirect("/dashboard");

  async function simpan(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    for (const k of ["sekolah_nama", "sekolah_alamat", "rekening_bank", "rekening_nomor", "rekening_nama", "jatuh_tempo_tgl", "wa_sekolah", "tpl_pengingat", "tpl_lunas"]) {
      const v = form.get(k);
      if (v !== null) await db.pengaturan.upsert({ where: { kunci: k }, update: { nilai: String(v) }, create: { kunci: k, nilai: String(v) } });
    }
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "pengaturan", "simpan", "umum", {}, { sekolah: String(form.get("sekolah_nama")) });
    for (const [kelas, field] of [["KB", "tarif_KB"], ["TK A", "tarif_TKA"], ["TK B", "tarif_TKB"]] as const) {
      const v = Number(form.get(field));
      if (v > 0) {
        const k = await db.kelas.findUnique({ where: { nama: kelas } });
        if (k) {
          const ex = await db.tarif.findFirst({ where: { kelas_id: k.id }, orderBy: { berlaku_sejak: "desc" } });
          if (!ex || ex.nominal !== v) await db.tarif.create({ data: { kelas_id: k.id, nominal: v, berlaku_sejak: new Date().toISOString().slice(0, 7), dibuat_oleh: ss.email } });
        }
      }
    }
    (await import("next/cache")).revalidatePath("/pengaturan");
    const { redirect } = await import("next/navigation");
    redirect("/pengaturan?toast=" + encodeURIComponent("Pengaturan tersimpan ✓"));
  }

  const keys = ["sekolah_nama", "sekolah_alamat", "rekening_bank", "rekening_nomor", "rekening_nama", "jatuh_tempo_tgl", "wa_sekolah", "tpl_pengingat", "tpl_lunas"];
  const vals: Record<string, string> = {};
  for (const k of keys) vals[k] = await get(k);
  const tarif = await db.tarif.findMany({ include: { kelas: true }, orderBy: { berlaku_sejak: "desc" } });
  const tarifNow: Record<string, number> = {};
  for (const t of tarif) if (!(t.kelas.nama in tarifNow)) tarifNow[t.kelas.nama] = t.nominal;

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>Pengaturan<small>Semua placeholder PRD §13 — ubah di sini tanpa menyentuh kode</small></h3>
      </div>
      <form action={simpan} className="form-card">
        <label className="f">Nama sekolah<input name="sekolah_nama" defaultValue={vals.sekolah_nama} className="field" /></label>
        <label className="f">Alamat<input name="sekolah_alamat" defaultValue={vals.sekolah_alamat} className="field" /></label>
        <div className="f2">
          <label className="f">Bank<input name="rekening_bank" defaultValue={vals.rekening_bank} className="field" /></label>
          <label className="f">No. rekening<input name="rekening_nomor" defaultValue={vals.rekening_nomor} className="field" /></label>
        </div>
        <label className="f">Rekening atas nama<input name="rekening_nama" defaultValue={vals.rekening_nama} className="field" /></label>
        <div className="f2">
          <label className="f">Jatuh tempo (tgl)<input name="jatuh_tempo_tgl" defaultValue={vals.jatuh_tempo_tgl} className="field" /></label>
          <label className="f">WA sekolah<input name="wa_sekolah" defaultValue={vals.wa_sekolah} className="field" /></label>
        </div>
        <div className="f2">
          {(["KB", "TK A", "TK B"] as const).map((k) => (
            <label key={k} className="f">Tarif {k}<input name={`tarif_${k.replace(" ", "")}`} type="number" defaultValue={tarifNow[k] || ""} className="field" /></label>
          ))}
        </div>
        <label className="f">Template pengingat <span className="hint">{"{orang_tua} {nama_siswa} {bulan} {nominal} {rekening}"}</span>
          <textarea name="tpl_pengingat" rows={3} defaultValue={vals.tpl_pengingat} className="field" /></label>
        <label className="f">Template lunas
          <textarea name="tpl_lunas" rows={3} defaultValue={vals.tpl_lunas} className="field" /></label>
        <SubmitButton>Simpan pengaturan</SubmitButton>
      </form>
      <div className="card">
        <h4>WhatsApp — hubungkan nomor sekolah (Baileys)</h4>
        <WAConnect />
      </div>
    </AppShell>
  );
}

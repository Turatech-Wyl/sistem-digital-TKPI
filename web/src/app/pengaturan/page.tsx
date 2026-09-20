import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";

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
    // tarif per kelas
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
  }

  const keys = ["sekolah_nama", "sekolah_alamat", "rekening_bank", "rekening_nomor", "rekening_nama", "jatuh_tempo_tgl", "wa_sekolah", "tpl_pengingat", "tpl_lunas"];
  const vals: Record<string, string> = {};
  for (const k of keys) vals[k] = await get(k);
  const tarif = await db.tarif.findMany({ include: { kelas: true }, orderBy: { berlaku_sejak: "desc" } });
  const tarifNow: Record<string, number> = {};
  for (const t of tarif) if (!(t.kelas.nama in tarifNow)) tarifNow[t.kelas.nama] = t.nominal;

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar peran={s.peran} nama={s.nama} />
      <main className="flex-1 p-6 grid gap-4 content-start max-w-3xl">
        <h1 className="text-xl font-extrabold text-[#16181f]">Pengaturan</h1>
        <p className="text-sm text-[#6f7583]">Semua placeholder PRD §13 bisa diubah di sini tanpa mengubah kode.</p>
        <form action={simpan} className="bg-white border rounded-xl p-4 grid gap-3">
          <label className="grid gap-1 text-sm font-semibold">Nama sekolah<input name="sekolah_nama" defaultValue={vals.sekolah_nama} className="border rounded-lg px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Alamat<input name="sekolah_alamat" defaultValue={vals.sekolah_alamat} className="border rounded-lg px-3 py-2 font-normal" /></label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1 text-sm font-semibold">Bank<input name="rekening_bank" defaultValue={vals.rekening_bank} className="border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">No. rekening<input name="rekening_nomor" defaultValue={vals.rekening_nomor} className="border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">Atas nama<input name="rekening_nama" defaultValue={vals.rekening_nama} className="border rounded-lg px-3 py-2 font-normal" /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm font-semibold">Jatuh tempo (tgl)<input name="jatuh_tempo_tgl" defaultValue={vals.jatuh_tempo_tgl} className="border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="grid gap-1 text-sm font-semibold">WA sekolah<input name="wa_sekolah" defaultValue={vals.wa_sekolah} className="border rounded-lg px-3 py-2 font-normal" /></label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["KB", "TK A", "TK B"] as const).map((k) => (
              <label key={k} className="grid gap-1 text-sm font-semibold">Tarif {k}<input name={`tarif_${k.replace(" ", "")}`} type="number" defaultValue={tarifNow[k] || ""} className="border rounded-lg px-3 py-2 font-normal" /></label>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-semibold">Template pengingat <span className="font-normal text-[#6f7583]">variabel: {"{orang_tua} {nama_siswa} {bulan} {nominal} {rekening}"}</span>
            <textarea name="tpl_pengingat" rows={3} defaultValue={vals.tpl_pengingat} className="border rounded-lg px-3 py-2 font-normal" /></label>
          <label className="grid gap-1 text-sm font-semibold">Template lunas
            <textarea name="tpl_lunas" rows={3} defaultValue={vals.tpl_lunas} className="border rounded-lg px-3 py-2 font-normal" /></label>
          <button className="bg-[#3b6cf6] text-white text-sm font-bold rounded-lg py-2">Simpan pengaturan</button>
        </form>
        <div className="bg-white border rounded-xl p-4">
          <h2 className="font-bold text-sm mb-2">WhatsApp — hubungkan nomor sekolah (Baileys)</h2>
          <p className="text-sm text-[#6f7583]">Tahap 3: QR akan muncul di sini setelah agent dijalankan (<code>agent/</code>). Untuk uji awal, jalankan skrip minimal agent untuk scan QR + kirim 1 pesan.</p>
        </div>
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { sesi } from "@/lib/auth";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { normalisasiWA } from "@/lib/format";

export default async function ImporPage() {
  const s = await sesi();
  if (!s) redirect("/login");
  if (s.peran !== "admin") redirect("/dashboard");

  async function impor(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const f = form.get("file") as File | null;
    if (!f) return;
    const buf = Buffer.from(await f.arrayBuffer());
    const wb = (await import("xlsx")).read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = (await import("xlsx")).utils.sheet_to_json<Record<string, string>>(ws);
    const { db } = await import("@/lib/db");
    const { normalisasiWA } = await import("@/lib/format");
    let baru = 0, upd = 0;
    for (const r of rows) {
      const nama = String(r["Nama"] || r["nama"] || r["Nama Anak"] || "").trim();
      const kelasNama = String(r["Kelas"] || r["kelas"] || "TK A").trim();
      const wa = normalisasiWA(String(r["WA"] || r["No HP"] || r["No. WA"] || ""));
      const ortu = String(r["Ortu"] || r["Orang tua"] || r["Nama Ortu"] || "-");
      const lahir = String(r["Lahir"] || r["Tgl Lahir"] || r["Tanggal lahir"] || "");
      if (!nama || !wa) continue;
      const kelas = await db.kelas.findUnique({ where: { nama: kelasNama } }) || await db.kelas.findFirst();
      if (!kelas) continue;
      // dedup nama + tgl lahir
      const ex = await db.siswa.findFirst({ where: { nama, tgl_lahir: lahir || undefined } });
      let sid: number;
      if (ex) { await db.siswa.update({ where: { id: ex.id }, data: { kelas_id: kelas.id } }); sid = ex.id; upd++; }
      else {
        const count = await db.siswa.count();
        const c = await db.siswa.create({ data: { nis: `IMP${Date.now().toString().slice(-5)}${count}`, nama, kelas_id: kelas.id, tgl_lahir: lahir, jk: "L", status: "aktif", dibuat_oleh: ss.email } });
        sid = c.id; baru++;
      }
      let o = await db.orangTua.findFirst({ where: { wa_utama: wa } });
      if (!o) o = await db.orangTua.create({ data: { nama_ibu: ortu, wa_utama: wa, dibuat_oleh: ss.email } });
      const link = await db.siswaOrangTua.findUnique({ where: { siswa_id_orang_tua_id: { siswa_id: sid, orang_tua_id: o.id } } });
      if (!link) await db.siswaOrangTua.create({ data: { siswa_id: sid, orang_tua_id: o.id } });
    }
    (await import("next/cache")).revalidatePath("/siswa");
  }

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar peran={s.peran} nama={s.nama} />
      <main className="flex-1 p-6 grid gap-4 content-start max-w-3xl">
        <h1 className="text-xl font-extrabold text-[#16181f]">Impor dari Excel</h1>
        <ol className="text-sm text-[#6f7583] list-decimal ml-5">
          <li>Unggah .xlsx / .csv (ekspor Google Sheets). Baris pertama = judul kolom.</li>
          <li>Kolom dikenali: Nama, Kelas, Ortu, WA, Lahir. Nomor WA dinormalisasi ke 62xxx.</li>
          <li>Duplikat nama + tanggal lahir tidak digandakan, hanya diperbarui.</li>
        </ol>
        <form action={impor} className="bg-white border-2 border-dashed border-[#e8eaf0] rounded-xl p-8 grid gap-3 justify-items-center text-center">
          <input type="file" name="file" accept=".xlsx,.csv" required className="text-sm" />
          <button className="bg-[#3b6cf6] text-white text-sm font-bold rounded-lg px-6 py-2">Unggah & simpan</button>
        </form>
        <a href="/api/ekspor/siswa" className="text-sm font-bold text-[#3b6cf6]">Unduh template / data siswa saat ini (Excel) →</a>
      </main>
    </div>
  );
}

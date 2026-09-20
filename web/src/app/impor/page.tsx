import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { sesi } from "@/lib/auth";

export const metadata = { title: "Impor" };

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
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);
    const { db } = await import("@/lib/db");
    const { normalisasiWA } = await import("@/lib/format");
    for (const r of rows) {
      const nama = String(r["Nama"] || r["nama"] || r["Nama Anak"] || "").trim();
      const kelasNama = String(r["Kelas"] || r["kelas"] || "TK A").trim();
      const wa = normalisasiWA(String(r["WA"] || r["No HP"] || r["No. WA"] || ""));
      const ortu = String(r["Ortu"] || r["Orang tua"] || r["Nama Ortu"] || "-");
      const lahir = String(r["Lahir"] || r["Tgl Lahir"] || r["Tanggal lahir"] || "");
      if (!nama || !wa) continue;
      const kelas = (await db.kelas.findUnique({ where: { nama: kelasNama } })) || await db.kelas.findFirst();
      if (!kelas) continue;
      const ex = await db.siswa.findFirst({ where: { nama, tgl_lahir: lahir || undefined } });
      let sid: number;
      if (ex) { await db.siswa.update({ where: { id: ex.id }, data: { kelas_id: kelas.id } }); sid = ex.id; }
      else {
        const count = await db.siswa.count();
        const c = await db.siswa.create({ data: { nis: `IMP${Date.now().toString().slice(-5)}${count}`, nama, kelas_id: kelas.id, tgl_lahir: lahir, jk: "L", status: "aktif", dibuat_oleh: ss.email } });
        sid = c.id;
      }
      let o = await db.orangTua.findFirst({ where: { wa_utama: wa } });
      if (!o) o = await db.orangTua.create({ data: { nama_ibu: ortu, wa_utama: wa, dibuat_oleh: ss.email } });
      const link = await db.siswaOrangTua.findUnique({ where: { siswa_id_orang_tua_id: { siswa_id: sid, orang_tua_id: o.id } } });
      if (!link) await db.siswaOrangTua.create({ data: { siswa_id: sid, orang_tua_id: o.id } });
    }
    (await import("next/cache")).revalidatePath("/siswa");
    const { redirect } = await import("next/navigation");
    redirect("/siswa?toast=" + encodeURIComponent("Impor selesai ✓"));
  }

  const kolom = [
    ["Nama Anak", "Nama siswa"], ["Kelas", "Kelas"], ["Nama Ortu", "Orang tua"],
    ["No HP", "No. WA"], ["Tgl Lahir", "Tanggal lahir"], ["Ket.", "Abaikan"],
  ];

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>Impor dari Excel<small>Langkah 2 dari 3</small></h3>
        <a href="/api/ekspor/siswa" className="btn light">Unduh template</a>
      </div>
      <form action={impor}>
        <div className="drop"><b>Pilih file .xlsx / .csv</b>Baris pertama = judul kolom · WA dinormalisasi ke 62xxx
          <div style={{ marginTop: 10 }}><input type="file" name="file" accept=".xlsx,.csv" required style={{ fontSize: "0.84rem" }} /></div>
          <div style={{ marginTop: 10 }}><SubmitButton>Lanjut — simpan ke data siswa</SubmitButton></div>
        </div>
      </form>
      <div className="card">
        <h4>Cocokkan kolom</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
          {kolom.map(([a, b], i) => (
            <div key={a} style={{ padding: "9px 11px", borderRadius: 9, background: "var(--soft)", fontSize: "0.78rem", fontWeight: 600, opacity: i === 5 ? 0.5 : 1 }}>
              {a}<span style={{ display: "block", fontWeight: 500, color: "var(--muted)", fontSize: "0.72rem" }}>→ {b}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

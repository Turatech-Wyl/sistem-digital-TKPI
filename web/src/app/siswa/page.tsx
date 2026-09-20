import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalisasiWA } from "@/lib/format";
import { revalidatePath } from "next/cache";

export default async function SiswaPage({ searchParams }: { searchParams: Promise<{ q?: string; kelas?: string; status?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const fKelas = sp.kelas || "";
  const fStatus = sp.status || "";

  async function tambah(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const { normalisasiWA } = await import("@/lib/format");
    const nama = String(form.get("nama") || "").trim();
    const kelasNama = String(form.get("kelas") || "TK A");
    const wa = normalisasiWA(String(form.get("wa") || ""));
    const ortuNama = String(form.get("ortu") || "").trim();
    if (!nama || !wa) return;
    const kelas = await db.kelas.findUnique({ where: { nama: kelasNama } });
    if (!kelas) return;
    const count = await db.siswa.count();
    const nis = `2026${String(count + 1).padStart(3, "0")}${Date.now().toString().slice(-3)}`;
    let ortu = await db.orangTua.findFirst({ where: { wa_utama: wa } });
    if (!ortu) ortu = await db.orangTua.create({ data: { nama_ibu: ortuNama || "-", wa_utama: wa, dibuat_oleh: ss.email } });
    const sw = await db.siswa.create({
      data: { nis, nama, kelas_id: kelas.id, tgl_lahir: String(form.get("lahir") || ""), jk: String(form.get("jk") || "L"), status: "aktif", dibuat_oleh: ss.email },
    });
    await db.siswaOrangTua.create({ data: { siswa_id: sw.id, orang_tua_id: ortu.id } });
    (await import("next/cache")).revalidatePath("/siswa");
  }

  async function ubahStatus(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const id = Number(form.get("id"));
    const status = String(form.get("status"));
    await db.siswa.update({ where: { id }, data: { status } });
    (await import("next/cache")).revalidatePath("/siswa");
  }

  const semua = await db.siswa.findMany({
    include: { kelas: true, orang_tua: { include: { orang_tua: true } }, tagihan: { orderBy: { periode: "desc" }, take: 1 } },
    orderBy: { nama: "asc" },
  });
  const rows = semua.filter((r) => {
    if (fKelas && r.kelas.nama !== fKelas) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (q && !r.nama.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const kelasList = await db.kelas.findMany({ orderBy: { urutan: "asc" } });

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar peran={s.peran} nama={s.nama} />
      <main className="flex-1 p-6 grid gap-4 content-start max-w-5xl">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl font-extrabold text-[#16181f]">Data Siswa <span className="text-sm font-medium text-[#6f7583]">{rows.length} tampil</span></h1>
        </div>
        <form method="GET" className="flex gap-2 flex-wrap">
          <input name="q" defaultValue={q} placeholder="Cari nama siswa…" className="flex-1 min-w-40 border border-[#e8eaf0] rounded-lg px-3 py-2 text-sm bg-white" />
          <select name="kelas" defaultValue={fKelas} className="border border-[#e8eaf0] rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Semua kelas</option>
            {kelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
          </select>
          <select name="status" defaultValue={fStatus} className="border border-[#e8eaf0] rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Semua status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
            <option value="lulus">Lulus</option>
          </select>
          <button className="bg-[#16181f] text-white text-sm font-bold rounded-lg px-4">Cari</button>
        </form>
        <div className="bg-white border border-[#e8eaf0] rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs text-[#6f7583]">
              <th className="p-3">Nama</th><th>Kelas</th><th>Orang tua</th><th>No. WA</th><th>Status</th>
              {s.peran === "admin" && <th>Ubah</th>}
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#e8eaf0]">
                  <td className="p-3 font-bold">{r.nama}<div className="text-xs font-normal text-[#6f7583]">{r.nis}</div></td>
                  <td>{r.kelas.nama}</td>
                  <td>{r.orang_tua.map((o) => o.orang_tua.nama_ibu || o.orang_tua.nama_ayah).join(", ")}</td>
                  <td>{r.orang_tua.map((o) => o.orang_tua.wa_utama).join(", ")}</td>
                  <td><span className={`text-xs font-bold px-2 py-1 rounded-full ${r.status === "aktif" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{r.status}</span></td>
                  {s.peran === "admin" && (
                    <td>
                      <form action={ubahStatus} className="flex gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <select name="status" defaultValue={r.status} className="border rounded px-1 py-1 text-xs">
                          <option value="aktif">aktif</option>
                          <option value="nonaktif">nonaktif</option>
                          <option value="lulus">lulus</option>
                        </select>
                        <button className="text-xs font-bold text-[#3b6cf6]">Simpan</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.peran === "admin" && (
          <form action={tambah} className="bg-white border border-[#e8eaf0] rounded-xl p-4 grid gap-2">
            <h2 className="font-bold text-sm">+ Siswa baru</h2>
            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
              <input name="nama" required placeholder="Nama siswa" className="border rounded-lg px-3 py-2 text-sm" />
              <input name="ortu" placeholder="Nama orang tua" className="border rounded-lg px-3 py-2 text-sm" />
              <input name="wa" required placeholder="No. WA (08xx)" className="border rounded-lg px-3 py-2 text-sm" />
              <input name="lahir" type="date" className="border rounded-lg px-3 py-2 text-sm" />
              <select name="kelas" className="border rounded-lg px-3 py-2 text-sm">
                {kelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
              </select>
              <select name="jk" className="border rounded-lg px-3 py-2 text-sm"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
            </div>
            <button className="bg-[#3b6cf6] text-white text-sm font-bold rounded-lg py-2">Simpan siswa</button>
          </form>
        )}
      </main>
    </div>
  );
}

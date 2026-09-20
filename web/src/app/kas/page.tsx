import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah } from "@/lib/format";

export default async function KasPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const now = new Date();
  const bulan = sp.bulan || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  async function tambah(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    await db.kas.create({
      data: {
        tgl: String(form.get("tgl")),
        jenis: String(form.get("jenis")),
        kategori_id: Number(form.get("kategori_id")),
        keterangan: String(form.get("keterangan")),
        nominal: Number(form.get("nominal")),
        dibuat_oleh: ss.email,
      },
    });
    (await import("next/cache")).revalidatePath("/kas");
  }

  const where = { tgl: { startsWith: bulan } };
  const [rows, kat] = await Promise.all([
    db.kas.findMany({ where, include: { kategori: true }, orderBy: { tgl: "desc" } }),
    db.kasKategori.findMany({ orderBy: { nama: "asc" } }),
  ]);
  const masuk = rows.filter((r) => r.jenis === "masuk").reduce((a, r) => a + r.nominal, 0);
  const keluar = rows.filter((r) => r.jenis === "keluar").reduce((a, r) => a + r.nominal, 0);

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar peran={s.peran} nama={s.nama} />
      <main className="flex-1 p-6 grid gap-4 content-start max-w-5xl">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl font-extrabold text-[#16181f]">Kas <span className="text-sm font-medium text-[#6f7583]">Saldo {rupiah(masuk - keluar)} bln ini</span></h1>
          <div className="flex gap-2">
            <form method="GET"><input type="month" name="bulan" defaultValue={bulan} className="border rounded-lg px-2 py-1.5 text-sm" /><button className="ml-1 text-xs font-bold bg-white border rounded-lg px-3 py-2">Lihat</button></form>
            <a href={`/api/ekspor/kas?bulan=${bulan}`} className="text-xs font-bold bg-white border rounded-lg px-3 py-2">Excel</a>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
          <div className="bg-white border rounded-xl p-4"><div className="text-xs text-[#6f7583] font-semibold">Masuk</div><div className="text-xl font-extrabold text-emerald-600">+{rupiah(masuk)}</div></div>
          <div className="bg-white border rounded-xl p-4"><div className="text-xs text-[#6f7583] font-semibold">Keluar</div><div className="text-xl font-extrabold text-red-600">−{rupiah(keluar)}</div></div>
          <div className="bg-white border rounded-xl p-4"><div className="text-xs text-[#6f7583] font-semibold">Selisih</div><div className="text-xl font-extrabold">{rupiah(masuk - keluar)}</div></div>
        </div>
        <div className="bg-white border border-[#e8eaf0] rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-left text-xs text-[#6f7583]"><th className="p-3">Tgl</th><th>Keterangan</th><th className="text-right">Masuk</th><th className="text-right">Keluar</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#e8eaf0]">
                  <td className="p-3">{r.tgl}</td>
                  <td>{r.keterangan}<div className="text-xs text-[#6f7583]">{r.kategori.nama}</div></td>
                  <td className="text-right text-emerald-700">{r.jenis === "masuk" ? rupiah(r.nominal) : ""}</td>
                  <td className="text-right text-red-600">{r.jenis === "keluar" ? rupiah(r.nominal) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.peran === "admin" && (
          <form action={tambah} className="bg-white border rounded-xl p-4 grid gap-2">
            <h2 className="font-bold text-sm">+ Transaksi manual</h2>
            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
              <input name="tgl" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="border rounded-lg px-3 py-2 text-sm" />
              <select name="jenis" className="border rounded-lg px-3 py-2 text-sm"><option value="masuk">Masuk</option><option value="keluar">Keluar</option></select>
              <select name="kategori_id" className="border rounded-lg px-3 py-2 text-sm">{kat.map((k) => <option key={k.id} value={k.id}>{k.nama} ({k.jenis})</option>)}</select>
              <input name="nominal" type="number" required placeholder="Nominal" className="border rounded-lg px-3 py-2 text-sm" />
              <input name="keterangan" required placeholder="Keterangan" className="border rounded-lg px-3 py-2 text-sm col-span-2" />
            </div>
            <button className="bg-[#3b6cf6] text-white text-sm font-bold rounded-lg py-2">Simpan</button>
          </form>
        )}
      </main>
    </div>
  );
}

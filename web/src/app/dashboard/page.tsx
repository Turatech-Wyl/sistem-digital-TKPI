import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah, periodeBulanIni, bulanNama } from "@/lib/format";
import { generateTagihan } from "@/lib/tagihan";
import { revalidatePath } from "next/cache";

export default async function Dashboard() {
  const s = await sesi();
  if (!s) redirect("/login");
  const periode = periodeBulanIni();

  async function buatTagihan() {
    "use server";
    const ss = await sesi();
    if (!ss || ss.peran !== "admin") return;
    const { periodeBulanIni } = await import("@/lib/format");
    const { generateTagihan } = await import("@/lib/tagihan");
    await generateTagihan(periodeBulanIni(), ss.email);
    revalidatePath("/dashboard");
  }

  const [aktif, tagihan, kasMasuk, menunggu, perluBalas] = await Promise.all([
    db.siswa.count({ where: { status: "aktif" } }),
    db.tagihan.findMany({ where: { periode }, include: { siswa: true } }),
    db.kas.aggregate({ where: { jenis: "masuk" }, _sum: { nominal: true } }),
    db.tagihan.count({ where: { periode, status: "menunggu_verifikasi" } }),
    db.waPesan.count({ where: { arah: "masuk", dibaca_tu: false } }),
  ]);
  const lunas = tagihan.filter((t) => t.status === "lunas");
  const belum = tagihan.filter((t) => t.status !== "lunas");
  const rupiahBelum = belum.reduce((a, t) => a + t.nominal, 0);
  const saldo = (kasMasuk._sum.nominal || 0) - ((await db.kas.aggregate({ where: { jenis: "keluar" }, _sum: { nominal: true } }))._sum.nominal || 0);

  // grafik 6 bulan terakhir per total masuk
  const bulanList: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bulanList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const perBulan: number[] = [];
  for (const b of bulanList) {
    const agg = await db.kas.aggregate({ where: { jenis: "masuk", tgl: { startsWith: b } }, _sum: { nominal: true } });
    perBulan.push(agg._sum.nominal || 0);
  }
  const maxB = Math.max(1, ...perBulan);

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar peran={s.peran} nama={s.nama} />
      <main className="flex-1 p-6 grid gap-4 content-start max-w-5xl">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl font-extrabold text-[#16181f]">{bulanNama(periode)}</h1>
          <div className="flex gap-2">
            {s.peran === "admin" && (
              <form action={buatTagihan}>
                <button className="text-xs font-bold bg-white border border-[#e8eaf0] rounded-lg px-3 py-2">Buat tagihan bulan ini</button>
              </form>
            )}
            <a href="/pembayaran?ekspor=xlsx" className="text-xs font-bold bg-white border border-[#e8eaf0] rounded-lg px-3 py-2">Unduh laporan</a>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
          {[
            ["Siswa aktif", String(aktif), ""],
            ["Sudah bayar", String(lunas.length), `${tagihan.length ? Math.round((lunas.length / tagihan.length) * 100) : 0}%`],
            ["Belum bayar", String(belum.length), rupiah(belum.length ? rupiahBelum : 0)],
            ["Saldo kas", rupiah(saldo), menunggu ? `${menunggu} menunggu verifikasi` : ""],
          ].map(([label, val, sub]) => (
            <div key={label} className="bg-white rounded-xl p-4 border border-[#e8eaf0]">
              <div className="text-xs font-semibold text-[#6f7583]">{label}</div>
              <div className="text-2xl font-extrabold text-[#16181f] truncate">{val}</div>
              <div className="text-xs font-semibold text-emerald-600 truncate">{sub}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-2 max-md:grid-cols-1">
          <div className="bg-white rounded-xl p-4 border border-[#e8eaf0]">
            <h2 className="text-xs font-bold text-[#6f7583] mb-2">Uang masuk 6 bulan terakhir</h2>
            <div className="flex items-end gap-2 h-28">
              {bulanList.map((b, i) => (
                <div key={b} className="flex-1 grid justify-items-center gap-1">
                  <div className="w-full rounded bg-[#3b6cf6]" style={{ height: `${Math.max(4, (perBulan[i] / maxB) * 90)}px` }} title={rupiah(perBulan[i])} />
                  <span className="text-[10px] text-[#6f7583]">{b.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-[#e8eaf0]">
            <h2 className="text-xs font-bold text-[#6f7583] mb-2">WhatsApp hari ini</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1">Tagihan belum lunas</td><td className="text-right font-bold">{belum.length}</td></tr>
                <tr><td className="py-1">Bukti menunggu verifikasi</td><td className="text-right font-bold">{menunggu}</td></tr>
                <tr><td className="py-1">Pesan perlu dibalas</td><td className="text-right font-bold">{perluBalas}</td></tr>
              </tbody>
            </table>
            <a href="/whatsapp" className="text-xs font-bold text-[#3b6cf6]">Buka inbox →</a>
          </div>
        </div>
        {tagihan.length === 0 && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Belum ada tagihan bulan ini. Klik <b>Buat tagihan bulan ini</b> (otomatis tiap tanggal 1 pukul 00.05 di server).
          </p>
        )}
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah, periodeBulanIni, bulanNama } from "@/lib/format";

export default async function Dashboard() {
  const s = await sesi();
  if (!s) redirect("/login");
  const periode = periodeBulanIni();

  async function buatTagihan() {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { periodeBulanIni } = await import("@/lib/format");
    const { generateTagihan } = await import("@/lib/tagihan");
    await generateTagihan(periodeBulanIni(), ss.email);
    (await import("next/cache")).revalidatePath("/dashboard");
  }

  const [aktif, tagihan, kasMasuk, kasKeluar, menunggu, perluBalas] = await Promise.all([
    db.siswa.count({ where: { status: "aktif" } }),
    db.tagihan.findMany({ where: { periode } }),
    db.kas.aggregate({ where: { jenis: "masuk" }, _sum: { nominal: true } }),
    db.kas.aggregate({ where: { jenis: "keluar" }, _sum: { nominal: true } }),
    db.tagihan.count({ where: { periode, status: "menunggu_verifikasi" } }),
    db.waPesan.count({ where: { arah: "masuk", dibaca_tu: false } }),
  ]);
  const lunas = tagihan.filter((t) => t.status === "lunas");
  const belum = tagihan.filter((t) => t.status !== "lunas");
  const rupiahBelum = belum.reduce((a, t) => a + t.nominal, 0);
  const saldo = (kasMasuk._sum.nominal || 0) - (kasKeluar._sum.nominal || 0);
  const hari = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });

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
    <AppShell peran={s.peran} nama={s.nama} badge={belum.length || undefined}>
      <div className="s-head">
        <h3>{bulanNama(periode)}<small>{hari}</small></h3>
        <div className="row">
          {s.peran === "admin" && (
            <form action={buatTagihan}><button className="btn light">Buat tagihan bulan ini</button></form>
          )}
          <a href={`/api/ekspor/tagihan?periode=${periode}`} className="btn light">Unduh laporan</a>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Siswa aktif</span><b>{aktif}</b><i>{tagihan.length ? `${lunas.length} lunas` : "belum ada tagihan"}</i></div>
        <div className="kpi"><span>Sudah bayar</span><b>{lunas.length}</b><i>{tagihan.length ? `${Math.round((lunas.length / tagihan.length) * 100)}%` : "—"}</i></div>
        <div className="kpi"><span>Belum bayar</span><b>{belum.length}</b><i className="warn">{rupiah(rupiahBelum)}</i></div>
        <div className="kpi"><span>Saldo kas</span><b>{rupiah(saldo)}</b><i>{menunggu ? `${menunggu} menunggu verifikasi` : "kas sehat"}</i></div>
      </div>
      <div className="two">
        <div className="card">
          <h4>Uang masuk per bulan</h4>
          <div className="bars">
            {bulanList.map((b, i) => (
              <div key={b} data-l={b.slice(5)} title={`${b}: ${rupiah(perBulan[i])}`} style={{ height: `${Math.max(5, (perBulan[i] / maxB) * 88)}%` }} />
            ))}
          </div>
        </div>
        <div className="card">
          <h4>WhatsApp hari ini</h4>
          <table className="grid-t">
            <tbody>
              <tr><td>Tagihan belum lunas</td><td className="num"><b>{belum.length}</b></td></tr>
              <tr><td>Bukti menunggu verifikasi</td><td className="num"><b>{menunggu}</b></td></tr>
              <tr><td>Pesan perlu dibalas</td><td className="num"><b>{perluBalas}</b></td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8 }}><a href="/whatsapp" className="btn light">Buka inbox</a></div>
        </div>
      </div>
      {tagihan.length === 0 && (
        <div className="notice">Belum ada tagihan bulan ini. Klik <b>Buat tagihan bulan ini</b> — di server dibuat otomatis tiap tanggal 1 pukul 00.05.</div>
      )}
    </AppShell>
  );
}

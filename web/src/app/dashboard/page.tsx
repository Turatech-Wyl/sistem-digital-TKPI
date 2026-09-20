import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah, periodeBulanIni, bulanNama } from "@/lib/format";
import { bacaStatusWA } from "@/lib/wafile";

export const metadata = { title: "Dashboard" };

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
    const { redirect } = await import("next/navigation");
    redirect("/dashboard?toast=" + encodeURIComponent("Tagihan bulan ini dibuat ✓"));
  }

  const [aktif, tagihan, kasMasuk, kasKeluar, menunggu, perluBalas, kasTerakhir] = await Promise.all([
    db.siswa.count({ where: { status: "aktif" } }),
    db.tagihan.findMany({ where: { periode }, include: { siswa: { include: { kelas: true, orang_tua: { include: { orang_tua: true } } } } }, orderBy: { status: "asc" } }),
    db.kas.aggregate({ where: { jenis: "masuk" }, _sum: { nominal: true } }),
    db.kas.aggregate({ where: { jenis: "keluar" }, _sum: { nominal: true } }),
    db.tagihan.count({ where: { periode, status: "menunggu_verifikasi" } }),
    db.waPesan.count({ where: { arah: "masuk", dibaca_tu: false } }),
    db.kas.findMany({ include: { kategori: true }, orderBy: { tgl: "desc" }, take: 5 }),
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
  const wa = bacaStatusWA();
  const jeda = (await db.pengaturan.findUnique({ where: { kunci: "wa_jeda" } }))?.nilai === "1";

  return (
    <AppShell peran={s.peran} nama={s.nama} badge={belum.length || undefined}>
      <div className="s-head">
        <h3>{bulanNama(periode)}<small>{hari}</small></h3>
        <div className="row">
          {s.peran === "admin" && (
            <form action={buatTagihan}><SubmitButton className="btn light">Buat tagihan bulan ini</SubmitButton></form>
          )}
          <a href={`/api/ekspor/tagihan?periode=${periode}`} className="btn light">Unduh laporan</a>
        </div>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Siswa aktif</span><b>{aktif}</b><i>{lunas.length} lunas</i></div>
        <div className="kpi"><span>Sudah bayar</span><b>{lunas.length}</b><i>{tagihan.length ? `${Math.round((lunas.length / tagihan.length) * 100)}%` : "—"}</i></div>
        <div className="kpi"><span>Belum bayar</span><b>{belum.length}</b><i className="warn">{rupiah(rupiahBelum)}</i></div>
        <div className="kpi"><span>Saldo kas</span><b style={{ fontSize: "1.25rem" }}>{rupiah(saldo)}</b><i>{menunggu ? `${menunggu} menunggu verifikasi` : "kas sehat"}</i></div>
      </div>
      <div className="two">
        <div className="card">
          <h4>Uang masuk per bulan</h4>
          <div className="bars">
            {bulanList.map((b, i) => (
              <div
                key={b}
                data-l={b.slice(5)}
                title={`${b}: ${perBulan[i] ? rupiah(perBulan[i]) : "belum ada data"}`}
                className={perBulan[i] ? "" : "pale"}
                style={{ height: perBulan[i] ? `${Math.max(8, (perBulan[i] / maxB) * 88)}%` : "4px", opacity: perBulan[i] ? 1 : 0.6 }}
              />
            ))}
          </div>
        </div>
      <div className="card">
        <h4>WhatsApp hari ini · {wa.connected ? <span style={{ color: "var(--green)" }}>Terhubung</span> : <span style={{ color: "var(--red)" }}>Putus</span>}{jeda ? " · bot dijeda" : ""}</h4>
        <table className="grid-t">
          <tbody>
            <tr><td>Tagihan belum lunas</td><td className="num"><b>{belum.length}</b></td></tr>
            <tr><td>Bukti menunggu verifikasi</td><td className="num"><b>{menunggu}</b></td></tr>
            <tr><td>Pesan perlu dibalas</td><td className="num"><b>{perluBalas}</b></td></tr>
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 8 }}>
          <a href="/whatsapp" className="btn light">Buka inbox</a>
          {s.peran === "admin" && (
            <>
              {!wa.connected && <a href="/pengaturan" className="btn light">Scan ulang</a>}
              <form method="POST" action="/api/wa/jeda"><button className="btn light">{jeda ? "Lanjutkan bot" : "Jeda bot"}</button></form>
            </>
          )}
        </div>
      </div>
      </div>
      <div className="two">
        <div className="card tbl">
          <h4 style={{ padding: "14px 14px 0" }}>Belum bayar — {bulanNama(periode)}</h4>
          <table className="grid-t">
            <tbody>
              {belum.slice(0, 5).map((t) => (
                <tr key={t.id}>
                  <td><b>{t.siswa.nama}</b><small style={{ display: "block", color: "var(--muted)" }}>{t.siswa.kelas.nama}</small></td>
                  <td className="num">{t.nominal.toLocaleString("id-ID")}</td>
                  <td>{t.status === "menunggu_verifikasi" ? <span className="st wn">Verifikasi</span> : <span className="st bad">Belum</span>}</td>
                </tr>
              ))}
              {belum.length === 0 && <tr><td>Semua lunas 🎉</td></tr>}
            </tbody>
          </table>
          <div style={{ padding: "8px 14px 14px" }}><a href="/pembayaran" className="btn light">Lihat semua</a></div>
        </div>
        <div className="card tbl">
          <h4 style={{ padding: "14px 14px 0" }}>Kas terakhir</h4>
          <table className="grid-t">
            <tbody>
              {kasTerakhir.map((r) => (
                <tr key={r.id}>
                  <td>{r.tgl.slice(8)}/{r.tgl.slice(5, 7)}<small style={{ display: "block", color: "var(--muted)" }}>{r.kategori.nama}</small></td>
                  <td>{r.keterangan}</td>
                  <td className={`num ${r.jenis === "masuk" ? "in" : "out"}`}>{r.jenis === "masuk" ? "+" : "−"}{r.nominal.toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "8px 14px 14px" }}><a href="/kas" className="btn light">Buka kas</a></div>
        </div>
      </div>
      {tagihan.length === 0 && (
        <div className="notice">Belum ada tagihan bulan ini. Klik <b>Buat tagihan bulan ini</b> — di server dibuat otomatis tiap tanggal 1 pukul 00.05.</div>
      )}
    </AppShell>
  );
}

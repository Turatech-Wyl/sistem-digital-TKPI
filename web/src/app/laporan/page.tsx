import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { sesi } from "@/lib/auth";
import { rekapSPP, daftarTunggakan } from "@/lib/laporan";
import { rupiah, periodeBulanIni, bulanNama } from "@/lib/format";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "Laporan" };

export default async function LaporanPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const periode = sp.periode || periodeBulanIni();
  const [rekap, tunggakan] = await Promise.all([rekapSPP(periode), daftarTunggakan()]);
  const totMasuk = rekap.reduce((a, r) => a + r.masuk, 0);
  const totTunggak = rekap.reduce((a, r) => a + r.tunggak, 0);

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>Rekap SPP {bulanNama(periode)}<small>Masuk {rupiah(totMasuk)} · Tertunggak {rupiah(totTunggak)}</small></h3>
        <div className="row">
          <form method="GET" className="row">
            <input type="month" name="periode" defaultValue={periode} className="field" style={{ padding: "8px 10px" }} />
            <button className="btn light">Lihat</button>
          </form>
          <a href={`/api/ekspor/rekap?periode=${periode}`} className="btn light">Excel</a>
          <a href={`/api/laporan/rekap?periode=${periode}`} className="btn light">PDF</a>
          <PrintButton />
        </div>
      </div>
      <div className="card tbl">
        <table className="grid-t">
          <thead><tr><th>Kelas</th><th className="num">Siswa</th><th className="num">Lunas</th><th className="num">Belum</th><th className="num">Verifikasi</th><th className="num">Masuk</th><th className="num">Tertunggak</th></tr></thead>
          <tbody>
            {rekap.map((r) => (
              <tr key={r.kelas}>
                <td><b>{r.kelas}</b></td>
                <td className="num">{r.jml_siswa}</td>
                <td className="num in">{r.lunas}</td>
                <td className="num out">{r.belum}</td>
                <td className="num">{r.verifikasi}</td>
                <td className="num">{r.masuk.toLocaleString("id-ID")}</td>
                <td className="num">{r.tunggak.toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h4>Belum bayar — {bulanNama(periode)}</h4>
        {rekap.every((r) => r.nama_belum.length === 0) && <p style={{ fontSize: "0.84rem" }}>Semua lunas 🎉</p>}
        {rekap.map((r) => r.nama_belum.length > 0 && (
          <p key={r.kelas} style={{ fontSize: "0.84rem", marginBottom: 6 }}><b>{r.kelas}:</b> {r.nama_belum.join("; ")}</p>
        ))}
      </div>
      <div className="s-head" style={{ marginTop: 6 }}>
        <h3>Tunggakan &gt; 1 bulan<small>{tunggakan.length} siswa · total {rupiah(tunggakan.reduce((a, t) => a + t.total, 0))}</small></h3>
        <div className="row">
          <a href="/api/ekspor/tunggakan" className="btn light">Excel</a>
          <a href="/api/laporan/tunggakan" className="btn light">PDF</a>
        </div>
      </div>
      <div className="card tbl">
        <table className="grid-t">
          <thead><tr><th>Siswa</th><th>Kelas</th><th>WA</th><th className="num">Bulan</th><th>Periode</th><th className="num">Total</th></tr></thead>
          <tbody>
            {tunggakan.map((t) => (
              <tr key={t.nama}>
                <td><b>{t.nama}</b></td>
                <td>{t.kelas}</td>
                <td>{t.wa}</td>
                <td className="num">{t.bulan}</td>
                <td>{t.periode.join(", ")}</td>
                <td className="num">{t.total.toLocaleString("id-ID")}</td>
              </tr>
            ))}
            {tunggakan.length === 0 && <tr><td>Tidak ada tunggakan 🎉</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

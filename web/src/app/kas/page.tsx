import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
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
    const data = {
      tgl: String(form.get("tgl")),
      jenis: String(form.get("jenis")),
      kategori_id: Number(form.get("kategori_id")),
      keterangan: String(form.get("keterangan")),
      nominal: Number(form.get("nominal")),
      dibuat_oleh: ss.email,
    };
    const r = await db.kas.create({ data });
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "kas", "tambah", String(r.id), {}, { keterangan: data.keterangan, nominal: data.nominal });
    (await import("next/cache")).revalidatePath("/kas");
  }

  async function tambahKategori(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const nama = String(form.get("nama") || "").trim();
    const jenis = String(form.get("jenis") || "keluar");
    if (!nama) return;
    try { await db.kasKategori.create({ data: { nama, jenis } }); } catch { /* sudah ada */ }
    (await import("next/cache")).revalidatePath("/kas");
  }

  const [rows, kat] = await Promise.all([
    db.kas.findMany({ where: { tgl: { startsWith: bulan } }, include: { kategori: true }, orderBy: { tgl: "desc" } }),
    db.kasKategori.findMany({ orderBy: { nama: "asc" } }),
  ]);
  const masuk = rows.filter((r) => r.jenis === "masuk").reduce((a, r) => a + r.nominal, 0);
  const keluar = rows.filter((r) => r.jenis === "keluar").reduce((a, r) => a + r.nominal, 0);

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>Kas Sekolah<small>Saldo {rupiah(masuk - keluar)}</small></h3>
        <div className="row">
          <form method="GET" className="row">
            <input type="month" name="bulan" defaultValue={bulan} className="field" style={{ padding: "8px 10px" }} />
            <button className="btn light">Lihat</button>
          </form>
          <a href={`/api/ekspor/kas?bulan=${bulan}`} className="btn light">Ekspor Excel</a>
          <a href={`/api/laporan/kas?bulan=${bulan}`} className="btn light">PDF</a>
        </div>
      </div>
      <div className="kpis k3">
        <div className="kpi"><span>Masuk</span><b className="in">+{rupiah(masuk)}</b><i>SPP, pendaftaran</i></div>
        <div className="kpi"><span>Keluar</span><b className="out">−{rupiah(keluar)}</b><i className="warn">Gaji, listrik, ATK</i></div>
        <div className="kpi"><span>Selisih</span><b>{rupiah(masuk - keluar)}</b><i>{masuk - keluar >= 0 ? "Surplus" : "Defisit"}</i></div>
      </div>
      <div className="card tbl">
        <table className="grid-t">
          <thead><tr><th>Tgl</th><th>Keterangan</th><th className="num">Masuk</th><th className="num">Keluar</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.tgl.slice(8)} {new Date(r.tgl).toLocaleDateString("id-ID", { month: "short" })}</td>
                <td><b>{r.keterangan}</b><small style={{ display: "block", color: "var(--muted)" }}>{r.kategori.nama}</small></td>
                <td className="num in">{r.jenis === "masuk" ? r.nominal.toLocaleString("id-ID") : ""}</td>
                <td className="num out">{r.jenis === "keluar" ? r.nominal.toLocaleString("id-ID") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.peran === "admin" && (
        <form action={tambah} className="form-card">
          <h4>+ Transaksi manual</h4>
          <div className="f2">
            <input name="tgl" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="field" />
            <select name="jenis" className="field"><option value="masuk">Masuk</option><option value="keluar">Keluar</option></select>
            <select name="kategori_id" className="field">{kat.map((k) => <option key={k.id} value={k.id}>{k.nama} ({k.jenis})</option>)}</select>
            <input name="nominal" type="number" required placeholder="Nominal" className="field" />
            <input name="keterangan" required placeholder="Keterangan" className="field" style={{ gridColumn: "1 / -1" }} />
          </div>
          <button className="btn">Simpan transaksi</button>
        </form>
      )}
      {s.peran === "admin" && (
        <form action={tambahKategori} className="form-card">
          <h4>+ Kategori baru</h4>
          <div className="row">
            <input name="nama" required placeholder="Nama kategori" className="field" style={{ flex: 1 }} />
            <select name="jenis" className="field"><option value="keluar">Keluar</option><option value="masuk">Masuk</option></select>
            <button className="btn light">Tambah</button>
          </div>
        </form>
      )}
    </AppShell>
  );
}

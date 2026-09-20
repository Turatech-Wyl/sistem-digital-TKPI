import { redirect } from "next/navigation";
import AppShell, { pill } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Siswa" };

export default async function SiswaPage({ searchParams }: { searchParams: Promise<{ q?: string; kelas?: string; status?: string; page?: string; sort?: string; dir?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const fKelas = sp.kelas || "";
  const fStatus = sp.status || "";
  const sort = ["nama", "kelas", "status"].includes(sp.sort || "") ? sp.sort! : "nama";
  const dir = sp.dir === "desc" ? "desc" : "asc";

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
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "siswa", "tambah", String(sw.id), {}, { nis, nama });
    const { redirect } = await import("next/navigation");
    redirect("/siswa?toast=" + encodeURIComponent(`Siswa ${nama} tersimpan ✓`));
  }

  async function ubahStatus(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const lama = await db.siswa.findUnique({ where: { id: Number(form.get("id")) } });
    await db.siswa.update({ where: { id: Number(form.get("id")) }, data: { status: String(form.get("status")) } });
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "siswa", "ubah-status", String(form.get("id")), { status: lama?.status }, { status: String(form.get("status")) });
    const { redirect } = await import("next/navigation");
    redirect("/siswa?toast=" + encodeURIComponent("Status siswa diperbarui ✓"));
  }

  const [semua, kelasList, aktif, nonaktif, lulus] = await Promise.all([
    db.siswa.findMany({ include: { kelas: true, orang_tua: { include: { orang_tua: true } } }, orderBy: { nama: "asc" } }),
    db.kelas.findMany({ orderBy: { urutan: "asc" } }),
    db.siswa.count({ where: { status: "aktif" } }),
    db.siswa.count({ where: { status: "nonaktif" } }),
    db.siswa.count({ where: { status: "lulus" } }),
  ]);
  const rows = semua.filter((r) => {
    if (fKelas && r.kelas.nama !== fKelas) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (q && !r.nama.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const val = (r: (typeof rows)[number]) => (sort === "kelas" ? r.kelas.nama : sort === "status" ? r.status : r.nama);
  rows.sort((a, b) => (dir === "desc" ? -1 : 1) * val(a).localeCompare(val(b), "id"));
  const PER = 10;
  const totalHal = Math.max(1, Math.ceil(rows.length / PER));
  const hal = Math.min(Math.max(1, Number(sp.page) || 1), totalHal);
  const tampil = rows.slice((hal - 1) * PER, hal * PER);
  const link = (o: Record<string, string | number>) => {
    const p = new URLSearchParams({ q, kelas: fKelas, status: fStatus, sort, dir, page: String(hal), ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) });
    return `/siswa?${p}`;
  };
  const th = (label: string, key: string) => (
    <a href={link({ sort: key, dir: sort === key && dir === "asc" ? "desc" : "asc", page: 1 })} style={{ color: "inherit" }}>
      {label}{sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
    </a>
  );

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>Data Siswa<small>{aktif} aktif · {nonaktif} nonaktif · {lulus} lulus</small></h3>
        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Hal {hal}/{totalHal} · {rows.length} siswa</span>
      </div>
      <form method="GET" className="row">
        <input name="q" defaultValue={q} placeholder="Cari nama siswa…" className="search" />
        <select name="kelas" defaultValue={fKelas} className="field">
          <option value="">Semua kelas</option>
          {kelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
        </select>
        <select name="status" defaultValue={fStatus} className="field">
          <option value="">Semua status</option>
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
          <option value="lulus">Lulus</option>
        </select>
        <button className="btn">Cari</button>
      </form>
      <div className="card tbl">
        <table className="grid-t">
          <thead><tr><th>{th("Nama", "nama")}</th><th>{th("Kelas", "kelas")}</th><th>Orang tua</th><th>No. WA</th><th>{th("Status", "status")}</th>{s.peran === "admin" && <th>Ubah</th>}</tr></thead>
          <tbody>
            {tampil.map((r) => (
              <tr key={r.id}>
                <td><b>{r.nama}</b><small style={{ display: "block", color: "var(--muted)" }}>{r.nis}</small></td>
                <td>{r.kelas.nama}</td>
                <td>{r.orang_tua.map((o) => o.orang_tua.nama_ibu || o.orang_tua.nama_ayah).join(", ")}</td>
                <td>{r.orang_tua.map((o) => o.orang_tua.wa_utama).join(", ")}</td>
                <td>{pill(r.status)}</td>
                {s.peran === "admin" && (
                  <td>
                    <form action={ubahStatus} className="row">
                      <input type="hidden" name="id" value={r.id} />
                      <select name="status" defaultValue={r.status} className="field" style={{ padding: "6px 8px" }}>
                        <option value="aktif">aktif</option>
                        <option value="nonaktif">nonaktif</option>
                        <option value="lulus">lulus</option>
                      </select>
                      <SubmitButton className="btn light">Simpan</SubmitButton>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {totalHal > 1 && (
          <div className="row" style={{ padding: 12, justifyContent: "center" }}>
            {hal > 1 && <a href={link({ page: hal - 1 })} className="btn light">← Prev</a>}
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Hal {hal} / {totalHal}</span>
            {hal < totalHal && <a href={link({ page: hal + 1 })} className="btn light">Next →</a>}
          </div>
        )}
      </div>
      {s.peran === "admin" && (
        <form action={tambah} className="form-card">
          <h4>+ Siswa baru</h4>
          <div className="f2">
            <input name="nama" required placeholder="Nama siswa" className="field" />
            <input name="ortu" placeholder="Nama orang tua" className="field" />
            <input name="wa" required placeholder="No. WA (08xx)" className="field" />
            <input name="lahir" type="date" className="field" />
            <select name="kelas" className="field">{kelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}</select>
            <select name="jk" className="field"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
          </div>
          <SubmitButton>Simpan siswa</SubmitButton>
        </form>
      )}
    </AppShell>
  );
}

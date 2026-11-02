import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AppShell, { pill } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { catatAudit } from "@/lib/audit";
import { bulanNama, normalisasiWA, rupiah } from "@/lib/format";

export const metadata = { title: "Detail siswa" };

const kembali = (id: number, pesan: string) => redirect(`/siswa/${id}?toast=${encodeURIComponent(pesan)}`);
const teks = (form: FormData, k: string) => String(form.get(k) || "").trim();

async function simpanSiswa(form: FormData) {
  "use server";
  const ss = await sesi();
  if (!ss || ss.peran !== "admin") return;
  const id = Number(form.get("id"));
  const lama = await db.siswa.findUnique({ where: { id } });
  if (!lama) return;
  const data = {
    nis: teks(form, "nis"),
    nama: teks(form, "nama"),
    kelas_id: Number(form.get("kelas_id")),
    jk: teks(form, "jk") === "P" ? "P" : "L",
    tgl_lahir: teks(form, "tgl_lahir") || null,
    tgl_masuk: teks(form, "tgl_masuk") || null,
    status: ["aktif", "nonaktif", "lulus"].includes(teks(form, "status")) ? teks(form, "status") : lama.status,
    catatan: teks(form, "catatan") || null,
  };
  if (!data.nama || !data.nis) kembali(id, "Nama dan NIS wajib diisi");
  if (!(await db.kelas.findUnique({ where: { id: data.kelas_id } }))) kembali(id, "Kelas tidak valid");
  if (await db.siswa.findFirst({ where: { nis: data.nis, NOT: { id } } })) kembali(id, `NIS ${data.nis} sudah dipakai siswa lain`);
  await db.siswa.update({ where: { id }, data });
  await catatAudit(ss.email, "siswa", "ubah", String(id),
    { nis: lama.nis, nama: lama.nama, kelas_id: lama.kelas_id, status: lama.status },
    { nis: data.nis, nama: data.nama, kelas_id: data.kelas_id, status: data.status });
  kembali(id, "Data siswa tersimpan ✓");
}

async function simpanOrtu(form: FormData) {
  "use server";
  const ss = await sesi();
  if (!ss || ss.peran !== "admin") return;
  const siswaId = Number(form.get("siswa_id"));
  const id = Number(form.get("id"));
  const lama = await db.orangTua.findUnique({ where: { id } });
  if (!lama) return;
  const waUtama = teks(form, "wa_utama") ? normalisasiWA(teks(form, "wa_utama")) : "";
  const waKedua = teks(form, "wa_kedua") ? normalisasiWA(teks(form, "wa_kedua")) : null;
  if (!/^62\d{8,13}$/.test(waUtama)) kembali(siswaId, "Nomor WA utama tidak valid (contoh 0812xxxxxxx)");
  if (waKedua && !/^62\d{8,13}$/.test(waKedua)) kembali(siswaId, "Nomor WA kedua tidak valid");
  const data = {
    nama_ayah: teks(form, "nama_ayah") || null,
    nama_ibu: teks(form, "nama_ibu") || null,
    wa_utama: waUtama,
    wa_kedua: waKedua,
    alamat: teks(form, "alamat") || null,
  };
  await db.orangTua.update({ where: { id }, data });
  await catatAudit(ss.email, "orang_tua", "ubah", String(id),
    { nama_ayah: lama.nama_ayah, nama_ibu: lama.nama_ibu, wa_utama: lama.wa_utama, wa_kedua: lama.wa_kedua },
    { nama_ayah: data.nama_ayah, nama_ibu: data.nama_ibu, wa_utama: data.wa_utama, wa_kedua: data.wa_kedua });
  kembali(siswaId, "Data orang tua tersimpan ✓");
}

async function hapusSiswa(form: FormData) {
  "use server";
  const ss = await sesi();
  if (!ss || ss.peran !== "admin") return;
  const id = Number(form.get("id"));
  const sw = await db.siswa.findUnique({ where: { id }, include: { orang_tua: true, tagihan: { select: { status: true } } } });
  if (!sw) redirect("/siswa");
  // Siswa yang sudah punya pembayaran tidak boleh dihapus: kwitansi dan kas akan kehilangan asalnya
  const adaBayar = await db.pembayaran.count({ where: { tagihan: { siswa_id: id } } });
  if (adaBayar) kembali(id, "Siswa sudah punya pembayaran — ubah status jadi Nonaktif/Lulus saja");
  const ortuIds = sw.orang_tua.map((o) => o.orang_tua_id);
  const ortuDihapus: number[] = [];
  await db.$transaction(async (tx) => {
    await tx.siswa.delete({ where: { id } }); // tagihan & tautan orang tua ikut terhapus (cascade)
    for (const oid of ortuIds) {
      if (await tx.siswaOrangTua.count({ where: { orang_tua_id: oid } })) continue; // masih punya anak lain
      await tx.waPesan.updateMany({ where: { orang_tua_id: oid }, data: { orang_tua_id: null } }); // riwayat chat tetap ada
      await tx.orangTua.delete({ where: { id: oid } });
      ortuDihapus.push(oid);
    }
  });
  await catatAudit(ss.email, "siswa", "hapus", String(id),
    { nis: sw.nis, nama: sw.nama, kelas_id: sw.kelas_id, status: sw.status, tagihan: sw.tagihan.length, orang_tua: ortuIds },
    { orang_tua_dihapus: ortuDihapus });
  redirect("/siswa?toast=" + encodeURIComponent(`Siswa ${sw.nama} dihapus ✓`));
}

export default async function DetailSiswa(props: PageProps<"/siswa/[id]">) {
  const s = await sesi();
  if (!s) redirect("/login");
  const id = Number((await props.params).id);
  if (!Number.isInteger(id)) notFound();
  const sw = await db.siswa.findUnique({
    where: { id },
    include: {
      kelas: true,
      orang_tua: { include: { orang_tua: { include: { anak: { include: { siswa: true } } } } } },
      tagihan: { orderBy: { periode: "desc" }, include: { pembayaran: { orderBy: { id: "desc" }, take: 1 } } },
    },
  });
  if (!sw) notFound();
  const kelasList = await db.kelas.findMany({ orderBy: { urutan: "asc" } });
  const ortu = sw.orang_tua.map((o) => o.orang_tua);
  const nomor = ortu.flatMap((o) => [o.wa_utama, o.wa_kedua]).filter((n): n is string => !!n);
  const pesan = nomor.length
    ? await db.waPesan.findMany({ where: { nomor: { in: nomor } }, orderBy: { dibuat_pada: "desc" }, take: 8 })
    : [];
  const admin = s.peran === "admin";
  const adaBayar = sw.tagihan.some((t) => t.pembayaran.length > 0);
  const tunggakan = sw.tagihan.filter((t) => t.status === "belum" || t.status === "menunggu_verifikasi");
  const jam = (d: Date) => d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <Link href="/siswa" className="back">← Data siswa</Link>
      <div className="s-head">
        <h3>{sw.nama}<small>NIS {sw.nis} · {sw.kelas.nama} · {sw.jk === "P" ? "Perempuan" : "Laki-laki"}</small></h3>
        {pill(sw.status)}
      </div>

      <div className="kpis k3">
        <div className="kpi"><span>Tagihan belum lunas</span><b>{tunggakan.length}</b><i className={tunggakan.length ? "warn" : ""}>{rupiah(tunggakan.reduce((a, t) => a + t.nominal, 0))}</i></div>
        <div className="kpi"><span>Sudah lunas</span><b>{sw.tagihan.filter((t) => t.status === "lunas").length}</b><i>dari {sw.tagihan.length} tagihan</i></div>
        <div className="kpi"><span>Orang tua</span><b style={{ fontSize: "1.05rem" }}>{ortu.map((o) => o.nama_ibu || o.nama_ayah || "-").join(", ") || "—"}</b><i>{ortu[0]?.wa_utama || "belum ada nomor WA"}</i></div>
      </div>

      <div className="two">
        {admin ? (
          <form action={simpanSiswa} className="form-card">
            <h4>Data siswa</h4>
            <input type="hidden" name="id" value={sw.id} />
            <div className="f2">
              <label className="f">Nama lengkap<input name="nama" required defaultValue={sw.nama} className="field" /></label>
              <label className="f">NIS<input name="nis" required defaultValue={sw.nis} className="field" /></label>
              <label className="f">Kelas
                <select name="kelas_id" defaultValue={sw.kelas_id} className="field">{kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}</select>
              </label>
              <label className="f">Jenis kelamin
                <select name="jk" defaultValue={sw.jk || "L"} className="field"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select>
              </label>
              <label className="f">Tanggal lahir<input name="tgl_lahir" type="date" defaultValue={sw.tgl_lahir || ""} className="field" /></label>
              <label className="f">Tanggal masuk<input name="tgl_masuk" type="date" defaultValue={sw.tgl_masuk || ""} className="field" /></label>
              <label className="f">Status
                <select name="status" defaultValue={sw.status} className="field">
                  <option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option><option value="lulus">Lulus</option>
                </select>
                <span className="hint">Siswa nonaktif/lulus tidak ditagih dan tidak diingatkan.</span>
              </label>
              <label className="f">Catatan<input name="catatan" defaultValue={sw.catatan || ""} className="field" /></label>
            </div>
            <div><SubmitButton>Simpan data siswa</SubmitButton></div>
          </form>
        ) : (
          <div className="card">
            <h4>Data siswa</h4>
            <dl className="info">
              <dt>Tanggal lahir</dt><dd>{sw.tgl_lahir || "—"}</dd>
              <dt>Tanggal masuk</dt><dd>{sw.tgl_masuk || "—"}</dd>
              <dt>Catatan</dt><dd>{sw.catatan || "—"}</dd>
            </dl>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
          {ortu.length === 0 && <div className="card"><h4>Orang tua</h4><p className="empty">Belum ada data orang tua.</p></div>}
          {ortu.map((o) => {
            const saudara = o.anak.map((a) => a.siswa).filter((x) => x.id !== sw.id);
            return admin ? (
              <form key={o.id} action={simpanOrtu} className="form-card">
                <h4>Orang tua</h4>
                <input type="hidden" name="id" value={o.id} />
                <input type="hidden" name="siswa_id" value={sw.id} />
                <div className="f2">
                  <label className="f">Nama ibu<input name="nama_ibu" defaultValue={o.nama_ibu || ""} className="field" /></label>
                  <label className="f">Nama ayah<input name="nama_ayah" defaultValue={o.nama_ayah || ""} className="field" /></label>
                  <label className="f">WA utama<input name="wa_utama" required defaultValue={o.wa_utama} placeholder="0812xxxxxxx" className="field" />
                    <span className="hint">Penerima pengingat & kwitansi</span></label>
                  <label className="f">WA kedua<input name="wa_kedua" defaultValue={o.wa_kedua || ""} placeholder="opsional" className="field" /></label>
                </div>
                <label className="f">Alamat<input name="alamat" defaultValue={o.alamat || ""} className="field" /></label>
                {saudara.length > 0 && (
                  <p className="notice" style={{ padding: "8px 12px" }}>
                    Orang tua ini juga terhubung dengan {saudara.map((x, i) => <span key={x.id}>{i > 0 && ", "}<Link className="link" href={`/siswa/${x.id}`}>{x.nama}</Link></span>)}. Perubahan berlaku untuk semuanya.
                  </p>
                )}
                <div><SubmitButton>Simpan data orang tua</SubmitButton></div>
              </form>
            ) : (
              <div key={o.id} className="card">
                <h4>Orang tua</h4>
                <dl className="info">
                  <dt>Ibu</dt><dd>{o.nama_ibu || "—"}</dd>
                  <dt>Ayah</dt><dd>{o.nama_ayah || "—"}</dd>
                  <dt>WA utama</dt><dd>{o.wa_utama || "—"}</dd>
                  <dt>WA kedua</dt><dd>{o.wa_kedua || "—"}</dd>
                  <dt>Alamat</dt><dd>{o.alamat || "—"}</dd>
                </dl>
              </div>
            );
          })}
        </div>
      </div>

      <div className="two">
        <div className="card tbl">
          <h4 style={{ padding: "14px 14px 0" }}>Riwayat tagihan</h4>
          {sw.tagihan.length === 0 ? <p className="empty">Belum ada tagihan.</p> : (
            <table className="grid-t">
              <thead><tr><th>Periode</th><th className="num">Nominal</th><th>Status</th><th>Kwitansi</th></tr></thead>
              <tbody>
                {sw.tagihan.map((t) => (
                  <tr key={t.id}>
                    <td><Link className="link" href={`/pembayaran?periode=${t.periode}`}>{bulanNama(t.periode)}</Link></td>
                    <td className="num">{rupiah(t.nominal)}</td>
                    <td>{pill(t.status)}</td>
                    <td>{t.status === "lunas" && t.pembayaran[0]
                      ? <a className="btn light" style={{ padding: "5px 10px" }} href={`/api/kwitansi/${t.pembayaran[0].id}`}>PDF</a>
                      : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Percakapan WhatsApp terakhir</h4>
            {admin && nomor[0] && <Link href={`/whatsapp?tab=semua&nomor=${nomor[0]}`} className="btn light" style={{ padding: "5px 10px" }}>Buka inbox</Link>}
          </div>
          {pesan.length === 0 ? <p className="empty">Belum ada percakapan.</p> : (
            <div className="chat">
              {[...pesan].reverse().map((p) => (
                <div key={p.id} className={`msg ${p.arah === "keluar" ? "me" : ""}`}>
                  {p.isi}
                  <small>{jam(p.dibuat_pada)}{p.arah === "keluar" && p.sumber ? ` · ${p.sumber}` : ""}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {admin && (
        <div className="card danger-zone">
          <div>
            <h4 style={{ margin: 0, color: "var(--red)" }}>Hapus siswa</h4>
            <p>
              {adaBayar
                ? "Siswa ini sudah punya pembayaran, jadi tidak bisa dihapus agar kwitansi dan kas tetap utuh. Ubah status menjadi Nonaktif atau Lulus."
                : `Menghapus ${sw.nama} beserta ${sw.tagihan.length} tagihannya secara permanen. Data orang tua ikut terhapus bila tidak punya anak lain. Untuk siswa yang keluar, cukup ubah status menjadi Nonaktif.`}
            </p>
          </div>
          {!adaBayar && (
            <form action={hapusSiswa}>
              <input type="hidden" name="id" value={sw.id} />
              <SubmitButton className="btn danger" confirm={`Hapus ${sw.nama} secara permanen? Tindakan ini tidak bisa dibatalkan.`}>Hapus siswa</SubmitButton>
            </form>
          )}
        </div>
      )}
    </AppShell>
  );
}

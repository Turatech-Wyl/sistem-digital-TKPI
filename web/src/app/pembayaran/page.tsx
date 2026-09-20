import { redirect } from "next/navigation";
import AppShell, { pill } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah, periodeBulanIni, bulanNama } from "@/lib/format";

export const metadata = { title: "Pembayaran" };

export default async function PembayaranPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const periode = sp.periode || periodeBulanIni();

  async function generate(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { generateTagihan } = await import("@/lib/tagihan");
    const hasil = await generateTagihan(String(form.get("periode") || ""), ss.email);
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "tagihan", "generate", String(form.get("periode")), {}, hasil);
    const { redirect } = await import("next/navigation");
    const p = String(form.get("periode"));
    redirect(`/pembayaran?periode=${p}&toast=` + encodeURIComponent(`${hasil.dibuat} tagihan baru dibuat ✓`));
  }

  async function catatBayar(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const tagihan_id = Number(form.get("tagihan_id"));
    const tgl = String(form.get("tgl") || new Date().toISOString().slice(0, 10));
    const tag = await db.tagihan.findUnique({ where: { id: tagihan_id }, include: { siswa: true } });
    if (!tag || tag.status === "lunas") return;
    const no = `KWT/${tgl.slice(0, 4)}/${tgl.slice(5, 7)}/${Date.now().toString().slice(-6)}`;
    const byr = await db.pembayaran.create({
      data: { tagihan_id, tgl_bayar: tgl, nominal: tag.nominal, metode: "tunai", no_kwitansi: no, status_verifikasi: "lunas", diverifikasi_oleh: ss.nama, dibuat_oleh: ss.email },
    });
    await db.tagihan.update({ where: { id: tagihan_id }, data: { status: "lunas" } });
    const kat = await db.kasKategori.findUnique({ where: { nama: "SPP" } });
    if (kat) await db.kas.create({ data: { tgl, jenis: "masuk", kategori_id: kat.id, keterangan: `SPP ${tag.siswa.nama} ${tag.periode}`, nominal: tag.nominal, pembayaran_id: byr.id, dibuat_oleh: ss.email } });
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "pembayaran", "tunai", String(byr.id), { tagihan_id }, { no_kwitansi: no, nominal: tag.nominal });
    const { redirect } = await import("next/navigation");
    redirect(`/pembayaran?periode=${tag.periode}&toast=` + encodeURIComponent(`Tunai ${tag.siswa.nama} lunas ✓`));
  }

  async function verifikasi(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const tagihan_id = Number(form.get("tagihan_id"));
    const aksi = String(form.get("aksi"));
    const tag = await db.tagihan.findUnique({ where: { id: tagihan_id }, include: { siswa: { include: { orang_tua: { include: { orang_tua: true } } } } } });
    if (!tag) return;
    const wa = tag.siswa.orang_tua[0]?.orang_tua.wa_utama || "-";
    if (aksi === "terima") {
      const tgl = new Date().toISOString().slice(0, 10);
      const no = `KWT/${tgl.slice(0, 4)}/${tgl.slice(5, 7)}/${Date.now().toString().slice(-6)}`;
      const byr = await db.pembayaran.create({
        data: { tagihan_id, tgl_bayar: tgl, nominal: tag.nominal, metode: "transfer", no_kwitansi: no, status_verifikasi: "lunas", diverifikasi_oleh: ss.nama, dibuat_oleh: ss.email },
      });
      await db.tagihan.update({ where: { id: tagihan_id }, data: { status: "lunas" } });
      const kat = await db.kasKategori.findUnique({ where: { nama: "SPP" } });
      if (kat) await db.kas.create({ data: { tgl, jenis: "masuk", kategori_id: kat.id, keterangan: `SPP ${tag.siswa.nama} ${tag.periode}`, nominal: tag.nominal, pembayaran_id: byr.id, dibuat_oleh: ss.email } });
      const wa = tag.siswa.orang_tua[0]?.orang_tua.wa_utama || "-";
      // Simpan PDF kwitansi ke media + antrekan ke WA ortu (PRD §5.4 langkah 4)
      let media: string | null = null;
      try {
        const { dataKwitansi, pdfKwitansi } = await import("@/lib/kwitansi");
        const dk = await dataKwitansi(byr.id);
        if (dk) {
          const fs = await import("fs");
          const path = await import("path");
          const dir = process.env.DATA_DIR || path.resolve(process.cwd(), "../data");
          fs.mkdirSync(path.join(dir, "media"), { recursive: true });
          media = path.join(dir, "media", `kwitansi-${byr.id}.pdf`);
          fs.writeFileSync(media, await pdfKwitansi(dk));
        }
      } catch { /* tanpa lampiran, pesan tetap terkirim */ }
      await db.waPesan.create({ data: { arah: "keluar", nomor: wa, isi: `Alhamdulillah, pembayaran SPP ${tag.siswa.nama} bulan ${tag.periode} sudah kami terima. Kwitansi terlampir. Terima kasih 🙏 — Asisten TK`, media_file: media, status: "antre", sumber: "bot" } });
    } else {
      const alasan = String(form.get("alasan") || "Bukti tidak valid");
      await db.tagihan.update({ where: { id: tagihan_id }, data: { status: "belum" } });
      await db.waPesan.create({ data: { arah: "keluar", nomor: wa, isi: `Mohon maaf, bukti pembayaran ditolak (${alasan}). Mohon kirim ulang. — Asisten TK`, status: "antre", sumber: "bot" } });
    }
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "pembayaran", `verifikasi-${aksi}`, String(tagihan_id), { status: "menunggu_verifikasi" }, { status: aksi === "terima" ? "lunas" : "belum" });
    const { redirect } = await import("next/navigation");
    redirect(`/pembayaran?periode=${tag.periode}&toast=` + encodeURIComponent(aksi === "terima" ? "Bukti diterima, tagihan lunas ✓" : "Bukti ditolak, ortu diminta kirim ulang"));
  }

  /** Tautkan bukti tak dikenal ke siswa (satu nomor dua anak, PRD §5.4). */
  async function tautkan(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const siswa_id = Number(form.get("siswa_id"));
    const tag = await db.tagihan.findFirst({ where: { siswa_id, status: "belum" }, orderBy: { periode: "asc" } });
    if (tag) await db.tagihan.update({ where: { id: tag.id }, data: { status: "menunggu_verifikasi" } });
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "tagihan", "tautkan-bukti", String(tag?.id || ""), { status: "belum" }, { status: "menunggu_verifikasi" });
    const { redirect } = await import("next/navigation");
    redirect(`/pembayaran?toast=` + encodeURIComponent(tag ? "Bukti ditautkan, siap verifikasi ✓" : "Tidak ada tagihan belum lunas untuk siswa ini"));
  }

  const [list, tarif, buktiMasuk] = await Promise.all([
    db.tagihan.findMany({
      where: { periode },
      include: { siswa: { include: { kelas: true, orang_tua: { include: { orang_tua: true } } } }, pembayaran: true },
      orderBy: { status: "asc" },
    }),
    db.tarif.findMany({ include: { kelas: true } }),
    // Bukti foto 30 hari terakhir dari pengirim multi-anak yang belum tertaut
    db.waPesan.findMany({ where: { arah: "masuk", media_file: { not: null }, dibuat_pada: { gte: new Date(Date.now() - 30 * 86400_000) } }, orderBy: { dibuat_pada: "desc" }, take: 20 }),
  ]);
  const lunas = list.filter((t) => t.status === "lunas");
  const belum = list.filter((t) => t.status !== "lunas");
  const nominalInfo = tarif.length ? tarif.map((t) => `${t.kelas.nama} ${rupiah(t.nominal)}`).join(" · ") : "";
  const buktiInfo = await Promise.all(buktiMasuk.map(async (b) => {
    const o = await db.orangTua.findFirst({
      where: { OR: [{ wa_utama: b.nomor }, { wa_kedua: b.nomor }] },
      include: { anak: { include: { siswa: { include: { kelas: true } } } } },
    });
    const anak = o?.anak.map((a) => a.siswa) || [];
    let tertaut = false;
    for (const a of anak) {
      if (await db.tagihan.count({ where: { siswa_id: a.id, status: "menunggu_verifikasi" } })) tertaut = true;
    }
    return { b, anak, tertaut };
  }));
  const perluTaut = buktiInfo.filter((x) => !x.tertaut && x.anak.length !== 1);

  return (
    <AppShell peran={s.peran} nama={s.nama} badge={belum.length || undefined}>
      <div className="s-head">
        <h3>SPP {bulanNama(periode)}<small>{nominalInfo} · jatuh tempo tgl 10</small></h3>
        <div className="row">
          <form method="GET" className="row">
            <input type="month" name="periode" defaultValue={periode} className="field" style={{ padding: "8px 10px" }} />
            <button className="btn light">Lihat</button>
          </form>
          {s.peran === "admin" && (
            <form action={generate}><input type="hidden" name="periode" value={periode} /><SubmitButton>Generate tagihan</SubmitButton></form>
          )}
        </div>
      </div>
      <div className="kpis k3">
        <div className="kpi"><span>Lunas</span><b>{lunas.length}</b><i>{rupiah(lunas.reduce((a, t) => a + t.nominal, 0))}</i></div>
        <div className="kpi"><span>Belum</span><b>{belum.length}</b><i className="warn">{rupiah(belum.reduce((a, t) => a + t.nominal, 0))}</i></div>
        <div className="kpi"><span>Pengingat terakhir</span><b style={{ fontSize: "1.1rem" }}>Hari ini</b><i>07.00 otomatis</i></div>
      </div>
      <div className="card tbl">
        <table className="grid-t">
          <thead><tr><th>Siswa</th><th>Orang tua</th><th className="num">Nominal</th><th>Status</th><th>Kwitansi</th>{s.peran === "admin" && <th>Aksi</th>}</tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td><b>{t.siswa.nama}</b><small style={{ display: "block", color: "var(--muted)" }}>{t.siswa.kelas.nama}</small></td>
                <td>{t.siswa.orang_tua.map((o) => o.orang_tua.nama_ibu || o.orang_tua.nama_ayah).join(", ")}</td>
                <td className="num">{t.nominal.toLocaleString("id-ID")}</td>
                <td>{pill(t.status)}</td>
                <td>{t.pembayaran[0] ? <a className="btn light" style={{ padding: "5px 10px" }} href={`/api/kwitansi/${t.pembayaran[0].id}`}>PDF</a> : "—"}</td>
                {s.peran === "admin" && (
                  <td>
                    {t.status === "belum" && (
                      <form action={catatBayar} className="row">
                        <input type="hidden" name="tagihan_id" value={t.id} />
                        <input type="date" name="tgl" defaultValue={new Date().toISOString().slice(0, 10)} className="field" style={{ padding: "6px 8px" }} />
                        <SubmitButton className="btn wa">Tunai ✓</SubmitButton>
                      </form>
                    )}
                    {t.status === "menunggu_verifikasi" && (
                      <form action={verifikasi} className="row">
                        <input type="hidden" name="tagihan_id" value={t.id} />
                        <SubmitButton className="btn wa" name="aksi" value="terima">Terima</SubmitButton>
                        <SubmitButton className="btn danger" name="aksi" value="tolak" confirm="Tolak bukti ini? Ortu akan diminta kirim ulang.">Tolak</SubmitButton>
                      </form>
                    )}
                    {t.status === "lunas" && <span className="st ok">Konfirmasi</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && <div className="notice">Belum ada tagihan periode ini. Klik <b>Generate tagihan</b>.</div>}
      {s.peran === "admin" && perluTaut.length > 0 && (
        <div className="card">
          <h4>Bukti belum tertaut ke siswa ({perluTaut.length})</h4>
          {perluTaut.map((x) => (
            <div key={x.b.id} className="row" style={{ alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--line)" }}>
              {x.b.media_file && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={`/api/media/${x.b.media_file.split("/").pop()}`} target="_blank"><img src={`/api/media/${x.b.media_file.split("/").pop()}`} alt="bukti" width={72} style={{ borderRadius: 8, border: "1px solid var(--line)" }} /></a>
              )}
              <span style={{ fontSize: "0.8rem" }}><b>{x.b.nomor}</b><br />{x.b.isi.slice(0, 60)}</span>
              {x.anak.length > 1 ? (
                <form action={tautkan} className="row">
                  <select name="siswa_id" className="field" style={{ padding: "6px 8px" }}>
                    {x.anak.map((a) => <option key={a.id} value={a.id}>{a.nama} ({a.kelas.nama})</option>)}
                  </select>
                  <SubmitButton className="btn light">Tautkan</SubmitButton>
                </form>
              ) : (
                <span style={{ fontSize: "0.76rem", color: "var(--muted)" }}>Pengirim tak dikenal — hubungi manual</span>
              )}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

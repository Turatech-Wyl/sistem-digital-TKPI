import { redirect } from "next/navigation";
import AppShell, { pill } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah, periodeBulanIni, bulanNama, hariIni, periodeValid } from "@/lib/format";

export const metadata = { title: "Pembayaran" };

export default async function PembayaranPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const periode = sp.periode && periodeValid(sp.periode) ? sp.periode : periodeBulanIni();

  async function generate(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { generateTagihan } = await import("@/lib/tagihan");
    const { periodeValid } = await import("@/lib/format");
    if (!periodeValid(String(form.get("periode") || ""))) return;
    const hasil = await generateTagihan(String(form.get("periode")), ss.email);
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "tagihan", "generate", String(form.get("periode")), {}, hasil);
    const { redirect } = await import("next/navigation");
    const p = String(form.get("periode"));
    redirect(`/pembayaran?periode=${p}&toast=` + encodeURIComponent(`${hasil.dibuat} tagihan baru dibuat ✓${hasil.tanpa_tarif ? ` · ${hasil.tanpa_tarif} siswa dilewati (tarif kelas belum ada)` : ""}`));
  }

  async function catatBayar(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { lunasiTagihan, kirimKonfirmasiLunas } = await import("@/lib/pembayaran");
    const hasil = await lunasiTagihan(Number(form.get("tagihan_id")), { metode: "tunai", tgl: String(form.get("tgl") || ""), nama: ss.nama, email: ss.email });
    const { redirect } = await import("next/navigation");
    if (!hasil) return redirect(`/pembayaran?periode=${periode}&toast=` + encodeURIComponent("Tagihan sudah lunas atau tidak ditemukan"));
    const { pembayaran: byr, tagihan: tag } = hasil;
    await kirimKonfirmasiLunas(byr.id, tag.siswa_id);
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "pembayaran", "tunai", String(byr.id), { tagihan_id: tag.id, status: tag.status }, { no_kwitansi: byr.no_kwitansi, nominal: byr.nominal });
    redirect(`/pembayaran?periode=${tag.periode}&toast=` + encodeURIComponent(`Tunai ${tag.siswa.nama} lunas ✓`));
  }

  async function verifikasi(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const { redirect } = await import("next/navigation");
    const { catatAudit } = await import("@/lib/audit");
    const tagihan_id = Number(form.get("tagihan_id"));
    const aksi = String(form.get("aksi"));
    if (aksi === "terima") {
      const { lunasiTagihan, kirimKonfirmasiLunas } = await import("@/lib/pembayaran");
      const hasil = await lunasiTagihan(tagihan_id, { metode: "transfer", nama: ss.nama, email: ss.email });
      if (!hasil) return redirect(`/pembayaran?periode=${periode}&toast=` + encodeURIComponent("Tagihan tidak lagi menunggu verifikasi"));
      await kirimKonfirmasiLunas(hasil.pembayaran.id, hasil.tagihan.siswa_id);
      await catatAudit(ss.email, "pembayaran", "verifikasi-terima", String(tagihan_id), { status: "menunggu_verifikasi" }, { status: "lunas", no_kwitansi: hasil.pembayaran.no_kwitansi });
      redirect(`/pembayaran?periode=${hasil.tagihan.periode}&toast=` + encodeURIComponent("Bukti diterima, tagihan lunas ✓"));
    }
    // Tolak: kembali ke 'belum' hanya bila memang sedang menunggu verifikasi
    const alasan = String(form.get("alasan") || "").trim() || "bukti tidak sesuai";
    const ubah = await db.tagihan.updateMany({ where: { id: tagihan_id, status: "menunggu_verifikasi" }, data: { status: "belum" } });
    const tag = await db.tagihan.findUnique({ where: { id: tagihan_id } });
    if (!ubah.count || !tag) return redirect(`/pembayaran?periode=${periode}&toast=` + encodeURIComponent("Tagihan tidak lagi menunggu verifikasi"));
    const { waOrangTua, tandaTangan } = await import("@/lib/pembayaran");
    const wa = await waOrangTua(tag.siswa_id);
    if (wa) await db.waPesan.create({ data: { arah: "keluar", nomor: wa, isi: tandaTangan(`Mohon maaf, bukti pembayaran belum dapat kami terima (${alasan}). Mohon kirim ulang bukti transfer ke sini. Terima kasih 🙏`), status: "antre", sumber: "bot" } });
    await catatAudit(ss.email, "pembayaran", "verifikasi-tolak", String(tagihan_id), { status: "menunggu_verifikasi" }, { status: "belum", alasan });
    redirect(`/pembayaran?periode=${tag.periode}&toast=` + encodeURIComponent("Bukti ditolak, ortu diminta kirim ulang"));
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

  const jatuhTempo = (await db.pengaturan.findUnique({ where: { kunci: "jatuh_tempo_tgl" } }))?.nilai || "10";
  const [list, tarif, buktiMasuk] = await Promise.all([
    db.tagihan.findMany({
      where: { periode },
      include: { siswa: { include: { kelas: true, orang_tua: { include: { orang_tua: true } } } }, pembayaran: true },
      orderBy: { status: "asc" },
    }),
    db.tarif.findMany({ where: { berlaku_sejak: { lte: periode } }, include: { kelas: true }, orderBy: [{ berlaku_sejak: "desc" }, { id: "desc" }] }),
    // Bukti foto 30 hari terakhir dari pengirim multi-anak yang belum tertaut
    db.waPesan.findMany({ where: { arah: "masuk", media_file: { not: null }, dibuat_pada: { gte: new Date(Date.now() - 30 * 86400_000) } }, orderBy: { dibuat_pada: "desc" }, take: 20 }),
  ]);
  const lunas = list.filter((t) => t.status === "lunas");
  const belum = list.filter((t) => t.status !== "lunas");
  // Satu tarif per kelas: yang terbaru berlaku pada periode ini (riwayat tarif tetap tersimpan)
  const tarifPerKelas = new Map<number, (typeof tarif)[number]>();
  for (const t of tarif) if (!tarifPerKelas.has(t.kelas_id)) tarifPerKelas.set(t.kelas_id, t);
  const nominalInfo = [...tarifPerKelas.values()].sort((a, b) => a.kelas.urutan - b.kelas.urutan).map((t) => `${t.kelas.nama} ${rupiah(t.nominal)}`).join(" · ");
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
        <h3>SPP {bulanNama(periode)}<small>{nominalInfo} · jatuh tempo tgl {jatuhTempo}</small></h3>
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
                        <input type="date" name="tgl" defaultValue={hariIni()} className="field" style={{ padding: "6px 8px" }} />
                        <SubmitButton className="btn wa">Tunai ✓</SubmitButton>
                      </form>
                    )}
                    {t.status === "menunggu_verifikasi" && (
                      <form action={verifikasi} className="row">
                        <input type="hidden" name="tagihan_id" value={t.id} />
                        <SubmitButton className="btn wa" name="aksi" value="terima">Terima</SubmitButton>
                        <input name="alasan" placeholder="Alasan tolak" className="field" style={{ padding: "6px 8px", width: 140 }} />
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

import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { rupiah, periodeBulanIni, bulanNama } from "@/lib/format";
import { revalidatePath } from "next/cache";

export default async function PembayaranPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  const sp = await searchParams;
  const periode = sp.periode || periodeBulanIni();

  async function generate(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const p = String(form.get("periode") || "");
    const { generateTagihan } = await import("@/lib/tagihan");
    await generateTagihan(p, ss.email);
    (await import("next/cache")).revalidatePath("/pembayaran");
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
    await db.waPesan.create({ data: { arah: "keluar", nomor: "-", isi: `Tunai: ${tag.siswa.nama} ${tag.periode} lunas`, status: "terkirim", sumber: "tu" } });
    (await import("next/cache")).revalidatePath("/pembayaran");
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
      await db.waPesan.create({ data: { arah: "keluar", nomor: wa, isi: `Alhamdulillah, pembayaran SPP ${tag.siswa.nama} bulan ${tag.periode} sudah kami terima. — Asisten TK`, status: "antre", sumber: "bot" } });
    } else {
      const alasan = String(form.get("alasan") || "Bukti tidak valid");
      await db.tagihan.update({ where: { id: tagihan_id }, data: { status: "belum" } });
      const wa = tag.siswa.orang_tua[0]?.orang_tua.wa_utama || "-";
      await db.waPesan.create({ data: { arah: "keluar", nomor: wa, isi: `Mohon maaf, bukti pembayaran ditolak (${alasan}). Mohon kirim ulang. — Asisten TK`, status: "antre", sumber: "bot" } });
    }
    (await import("next/cache")).revalidatePath("/pembayaran");
  }

  const list = await db.tagihan.findMany({
    where: { periode },
    include: { siswa: { include: { kelas: true, orang_tua: { include: { orang_tua: true } } } }, pembayaran: true },
    orderBy: { status: "asc" },
  });
  const lunas = list.filter((t) => t.status === "lunas").length;

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar peran={s.peran} nama={s.nama} />
      <main className="flex-1 p-6 grid gap-4 content-start max-w-5xl">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl font-extrabold text-[#16181f]">SPP {bulanNama(periode)} <span className="text-sm font-medium text-[#6f7583]">{lunas}/{list.length} lunas</span></h1>
          <div className="flex gap-2 flex-wrap">
            <form method="GET"><input type="month" name="periode" defaultValue={periode} className="border rounded-lg px-2 py-1.5 text-sm" /><button className="ml-1 text-xs font-bold bg-white border rounded-lg px-3 py-2">Lihat</button></form>
            {s.peran === "admin" && (
              <form action={generate}><input type="hidden" name="periode" value={periode} /><button className="text-xs font-bold bg-[#16181f] text-white rounded-lg px-3 py-2">Generate tagihan</button></form>
            )}
            <a href={`/api/ekspor/tagihan?periode=${periode}`} className="text-xs font-bold bg-white border border-[#e8eaf0] rounded-lg px-3 py-2">Excel</a>
          </div>
        </div>
        <div className="bg-white border border-[#e8eaf0] rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-left text-xs text-[#6f7583]"><th className="p-3">Siswa</th><th className="text-right">Nominal</th><th>Status</th><th>Kwitansi</th>{s.peran === "admin" && <th>Aksi</th>}</tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-[#e8eaf0]">
                  <td className="p-3 font-bold">{t.siswa.nama}<div className="text-xs font-normal text-[#6f7583]">{t.siswa.kelas.nama} · {t.siswa.orang_tua.map((o) => o.orang_tua.wa_utama).join(",")}</div></td>
                  <td className="text-right font-variant-numeric tabular-nums">{rupiah(t.nominal)}</td>
                  <td><span className={`text-xs font-bold px-2 py-1 rounded-full ${t.status === "lunas" ? "bg-emerald-50 text-emerald-700" : t.status === "menunggu_verifikasi" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{t.status}</span></td>
                  <td>{t.pembayaran[0] ? <a className="text-xs font-bold text-[#3b6cf6]" href={`/api/kwitansi/${t.pembayaran[0].id}`}>PDF</a> : "—"}</td>
                  {s.peran === "admin" && (
                    <td>
                      {t.status === "belum" && (
                        <form action={catatBayar} className="flex gap-1 items-center">
                          <input type="hidden" name="tagihan_id" value={t.id} />
                          <input type="date" name="tgl" defaultValue={new Date().toISOString().slice(0, 10)} className="border rounded text-xs px-1 py-1" />
                          <button className="text-xs font-bold text-emerald-700">Tunai ✓</button>
                        </form>
                      )}
                      {t.status === "menunggu_verifikasi" && (
                        <form action={verifikasi} className="flex gap-1 items-center">
                          <input type="hidden" name="tagihan_id" value={t.id} />
                          <button name="aksi" value="terima" className="text-xs font-bold text-emerald-700">Terima</button>
                          <button name="aksi" value="tolak" className="text-xs font-bold text-red-600">Tolak</button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.length === 0 && <p className="text-sm text-[#6f7583]">Belum ada tagihan periode ini. Klik Generate tagihan.</p>}
      </main>
    </div>
  );
}

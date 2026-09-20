import { redirect } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";
import { bacaStatusWA } from "@/lib/wafile";

type Room = {
  nomor: string;
  nama: string;
  anak: string;
  terakhir: string;
  waktu: Date;
  belum: number;
  total: number;
};

export default async function WAPage({ searchParams }: { searchParams: Promise<{ nomor?: string; tab?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  if (s.peran !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const tab = sp.tab === "semua" ? "semua" : "perlu";

  async function balas(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss || ss.peran !== "admin") return;
    const { db } = await import("@/lib/db");
    const nomor = String(form.get("nomor") || "");
    const isi = String(form.get("isi") || "");
    if (!nomor || !isi) return;
    await db.waPesan.create({ data: { arah: "keluar", nomor, isi, status: "antre", sumber: "tu" } });
    await db.waPesan.updateMany({ where: { nomor, arah: "masuk", dibaca_tu: false }, data: { dibaca_tu: true } });
    const { redirect } = await import("next/navigation");
    redirect(`/whatsapp?nomor=${nomor}`);
  }

  async function tandaiSemua(form: FormData) {
    "use server";
    const { db } = await import("@/lib/db");
    await db.waPesan.updateMany({ where: { nomor: String(form.get("nomor")), arah: "masuk" }, data: { dibaca_tu: true } });
    (await import("next/cache")).revalidatePath("/whatsapp");
  }

  const [pesan, ortu] = await Promise.all([
    db.waPesan.findMany({ orderBy: { dibuat_pada: "desc" }, take: 300 }),
    db.orangTua.findMany({ include: { anak: { include: { siswa: { include: { kelas: true } } } } } }),
  ]);
  const infoOrtu = (nomor: string) => ortu.find((o) => o.wa_utama === nomor || o.wa_kedua === nomor);

  const map = new Map<string, Room>();
  for (const p of [...pesan].reverse()) {
    // iterasi tua→baru agar terakhir = pesan terbaru
    let r = map.get(p.nomor);
    if (!r) {
      const o = infoOrtu(p.nomor);
      r = {
        nomor: p.nomor,
        nama: o ? `${o.nama_ayah ? "Bpk " + o.nama_ayah : ""}${o.nama_ayah && o.nama_ibu ? " & " : ""}${o.nama_ibu ? "Ibu " + o.nama_ibu : ""}` || p.nomor : p.nomor,
        anak: o ? o.anak.map((a) => `${a.siswa.nama} (${a.siswa.kelas.nama})`).join(", ") : "",
        terakhir: "", waktu: p.dibuat_pada, belum: 0, total: 0,
      };
      map.set(p.nomor, r);
    }
    r.terakhir = p.isi.length > 60 ? p.isi.slice(0, 60) + "…" : p.isi;
    r.waktu = p.dibuat_pada;
    r.total++;
    if (p.arah === "masuk" && !p.dibaca_tu) r.belum++;
  }
  const semuaRoom = [...map.values()].sort((a, b) => b.waktu.getTime() - a.waktu.getTime());
  const perluCount = semuaRoom.filter((r) => r.belum > 0).length;
  const rooms = tab === "semua" ? semuaRoom : semuaRoom.filter((r) => r.belum > 0);
  const aktif = sp.nomor ? map.get(sp.nomor) : rooms[0];
  const thread = aktif ? pesan.filter((p) => p.nomor === aktif.nomor).sort((a, b) => a.waktu.getTime() - b.waktu.getTime()) : [];
  const wa = bacaStatusWA();
  const jam = (d: Date) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>WhatsApp Sekolah<small>{wa.connected ? <span style={{ color: "var(--green)" }}>Terhubung</span> : <span style={{ color: "var(--red)" }}>Putus</span>} · {perluCount} room perlu dibalas</small></h3>
        <div className="row">
          <Link href="/whatsapp?tab=perlu" className={`btn ${tab === "perlu" ? "" : "light"}`}>Perlu dibalas{perluCount ? ` (${perluCount})` : ""}</Link>
          <Link href="/whatsapp?tab=semua" className={`btn ${tab === "semua" ? "" : "light"}`}>Semua</Link>
        </div>
      </div>
      <div className="two" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.4fr)", alignItems: "start" }}>
        <div className="card" style={{ padding: 6 }}>
          <h4 style={{ padding: "8px 8px 4px" }}>{tab === "perlu" ? "Room belum dibalas" : "Semua room"}</h4>
          {rooms.length === 0 && <p style={{ fontSize: "0.84rem", padding: 8, color: "var(--muted)" }}>{tab === "perlu" ? "Semua pesan sudah dibalas 🎉" : "Belum ada percakapan."}</p>}
          {rooms.map((r) => (
            <Link
              key={r.nomor}
              href={`/whatsapp?tab=${tab}&nomor=${r.nomor}`}
              style={{
                display: "flex", gap: 10, padding: "10px 8px", borderRadius: 10, alignItems: "center",
                background: aktif?.nomor === r.nomor ? "var(--blue-soft)" : "transparent",
              }}
            >
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: r.belum ? "var(--green)" : "var(--soft)", color: r.belum ? "#fff" : "var(--muted)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "0.8rem", flexShrink: 0 }}>
                {(r.nama || r.nomor).replace(/^(Bpk|Ibu) /, "").charAt(0).toUpperCase()}
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: "0.84rem", display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nama}</span>
                  {r.belum > 0 && <span className="st bad">{r.belum}</span>}
                </b>
                <span style={{ fontSize: "0.76rem", color: "var(--muted)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.terakhir}</span>
                {r.anak && <span style={{ fontSize: "0.7rem", color: "var(--muted)", display: "block" }}>{r.anak}</span>}
              </span>
              <small style={{ fontSize: "0.66rem", color: "var(--muted)", flexShrink: 0 }}>{jam(r.waktu)}</small>
            </Link>
          ))}
        </div>
        <div className="card">
          {!aktif ? (
            <p style={{ fontSize: "0.84rem", color: "var(--muted)" }}>Pilih room di kiri untuk melihat percakapan.</p>
          ) : (
            <>
              <h4>{aktif.nama} <span style={{ fontWeight: 500 }}>· {aktif.nomor}</span></h4>
              {aktif.anak && <p style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: 8 }}>{aktif.anak}</p>}
              <div className="chat" style={{ maxHeight: 380, overflow: "auto", marginBottom: 10 }}>
                {thread.map((p) => (
                  <div key={p.id} className={`msg ${p.arah === "keluar" ? "me" : ""}`}>
                    {p.isi}
                    <small>{p.arah === "keluar" ? `Terkirim · ${p.sumber || "-"} · ${p.status}` : `Masuk · ${jam(p.dibuat_pada)}`}</small>
                  </div>
                ))}
              </div>
              <form action={balas} className="row">
                <input type="hidden" name="nomor" value={aktif.nomor} />
                <input name="isi" required placeholder={`Balas ke ${aktif.nama}…`} className="field" style={{ flex: 1 }} />
                <button className="btn wa">Kirim</button>
              </form>
              <div className="row" style={{ marginTop: 8 }}>
                <a href={`https://wa.me/${aktif.nomor}`} target="_blank" className="btn light">wa.me ↗</a>
                {aktif.belum > 0 && (
                  <form action={tandaiSemua}><input type="hidden" name="nomor" value={aktif.nomor} /><button className="btn light">Tandai dibaca</button></form>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

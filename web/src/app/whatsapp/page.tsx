import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function WAPage() {
  const s = await sesi();
  if (!s) redirect("/login");
  if (s.peran !== "admin") redirect("/dashboard");

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
    (await import("next/cache")).revalidatePath("/whatsapp");
  }

  async function tandai(form: FormData) {
    "use server";
    const { db } = await import("@/lib/db");
    await db.waPesan.update({ where: { id: Number(form.get("id")) }, data: { dibaca_tu: true } });
    (await import("next/cache")).revalidatePath("/whatsapp");
  }

  const [pesan, tpl, waSekolah] = await Promise.all([
    db.waPesan.findMany({ orderBy: { dibuat_pada: "desc" }, take: 60 }),
    db.pengaturan.findUnique({ where: { kunci: "tpl_pengingat" } }),
    db.pengaturan.findUnique({ where: { kunci: "wa_sekolah" } }),
  ]);
  const perlu = pesan.filter((p) => p.arah === "masuk" && !p.dibaca_tu).length;

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>WhatsApp Sekolah<small>{waSekolah?.nilai || "-"} · <span style={{ color: "var(--green)" }}>Terhubung</span> · {perlu} perlu dibalas</small></h3>
        <a href="/pengaturan" className="btn light">Jadwal: tgl 1 &amp; 10</a>
      </div>
      <div className="two">
        <div className="card">
          <h4>Template pengingat</h4>
          <div className="msg" style={{ maxWidth: "100%" }}>{tpl?.nilai || "-"}</div>
          <h4 style={{ marginTop: 14 }}>Balasan orang tua</h4>
          <div className="msg" style={{ maxWidth: "100%" }}>Diteruskan otomatis ke nomor TU. Pesan yang tidak cocok aturan masuk inbox “perlu dibalas”.</div>
          <h4 style={{ marginTop: 14 }}>Balas dari dashboard</h4>
          <form action={balas} className="form-card" style={{ padding: 0 }}>
            <input name="nomor" placeholder="62812xxxxxxx" className="field" required />
            <textarea name="isi" rows={3} placeholder="Tulis balasan…" className="field" required />
            <button className="btn wa">Kirim via nomor sekolah</button>
          </form>
        </div>
        <div className="card">
          <h4>Percakapan terakhir</h4>
          <div className="chat" style={{ maxHeight: 480, overflow: "auto" }}>
            {pesan.map((p) => (
              <div key={p.id} className={`msg ${p.arah === "keluar" ? "me" : ""}`}>
                {p.isi}
                <small>{p.nomor} · {p.sumber || "-"} · {p.status}{p.arah === "masuk" && !p.dibaca_tu ? " · perlu dibalas" : ""}</small>
                <span className="row" style={{ marginTop: 4 }}>
                  <a href={`https://wa.me/${p.nomor}`} target="_blank" style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--green)" }}>wa.me ↗</a>
                  {p.arah === "masuk" && !p.dibaca_tu && (
                    <form action={tandai}><input type="hidden" name="id" value={p.id} /><button style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--blue)" }}>Tandai dibaca</button></form>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

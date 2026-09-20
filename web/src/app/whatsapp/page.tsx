import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
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
    await db.waPesan.create({ data: { arah: "keluar", nomor, isi: isi + " ", status: "antre", sumber: "tu" } });
    await db.waPesan.updateMany({ where: { nomor, arah: "masuk", dibaca_tu: false }, data: { dibaca_tu: true } });
    (await import("next/cache")).revalidatePath("/whatsapp");
  }

  async function tandai(form: FormData) {
    "use server";
    const { db } = await import("@/lib/db");
    const id = Number(form.get("id"));
    await db.waPesan.update({ where: { id }, data: { dibaca_tu: true } });
    (await import("next/cache")).revalidatePath("/whatsapp");
  }

  const pesan = await db.waPesan.findMany({ orderBy: { dibuat_pada: "desc" }, take: 60 });
  const perlu = pesan.filter((p) => p.arah === "masuk" && !p.dibaca_tu);

  return (
    <div className="flex min-h-screen max-md:flex-col">
      <Sidebar peran={s.peran} nama={s.nama} />
      <main className="flex-1 p-6 grid gap-4 content-start max-w-5xl">
        <h1 className="text-xl font-extrabold text-[#16181f]">WhatsApp <span className="text-sm font-medium text-[#6f7583]">{perlu.length} perlu dibalas</span></h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          Agent Baileys: scan QR sekali dari <b>Pengaturan → WhatsApp</b> (tahap 3). Selama agent belum jalan, gunakan tautan <b>wa.me</b> cadangan per nomor. Semua balasan bot diakhiri “— Asisten TK”.
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-2 max-md:grid-cols-1">
          <div className="bg-white border rounded-xl p-4 grid gap-2 content-start">
            <h2 className="font-bold text-sm">Balas dari dashboard (via nomor sekolah)</h2>
            <form action={balas} className="grid gap-2">
              <input name="nomor" placeholder="62812xxxxxxx" className="border rounded-lg px-3 py-2 text-sm" required />
              <textarea name="isi" rows={3} placeholder="Tulis balasan…" className="border rounded-lg px-3 py-2 text-sm" required />
              <button className="bg-emerald-600 text-white text-sm font-bold rounded-lg py-2">Kirim (masuk antrean agent)</button>
            </form>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-bold text-sm mb-2">Log pesan terakhir</h2>
            <div className="grid gap-2 max-h-[480px] overflow-auto">
              {pesan.map((p) => (
                <div key={p.id} className={`text-sm rounded-lg p-2 ${p.arah === "masuk" ? "bg-[#f2f4f8]" : "bg-emerald-50"}`}>
                  <div className="text-xs text-[#6f7583] font-semibold">{p.arah === "masuk" ? "←" : "→"} {p.nomor} · {p.sumber || "-"} · {p.status}</div>
                  <div>{p.isi}</div>
                  <div className="flex gap-2 items-center mt-1">
                    <a className="text-xs font-bold text-emerald-700" href={`https://wa.me/${p.nomor}?text=${encodeURIComponent("Assalamualaikum, ") }`} target="_blank">wa.me ↗</a>
                    {p.arah === "masuk" && !p.dibaca_tu && (
                      <form action={tandai}><input type="hidden" name="id" value={p.id} /><button className="text-xs font-bold text-[#3b6cf6]">Tandai dibaca</button></form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

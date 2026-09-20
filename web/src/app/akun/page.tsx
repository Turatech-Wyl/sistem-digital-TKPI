import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { sesi } from "@/lib/auth";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Akun" };

export default async function AkunPage() {
  const s = await sesi();
  if (!s) redirect("/login");

  async function gantiPassword(form: FormData) {
    "use server";
    const ss = await (await import("@/lib/auth")).sesi();
    if (!ss) return;
    const { db } = await import("@/lib/db");
    const lama = String(form.get("lama") || "");
    const baru = String(form.get("baru") || "");
    if (baru.length < 6) {
      const { redirect } = await import("next/navigation");
      redirect("/akun?toast=" + encodeURIComponent("Password baru minimal 6 karakter"));
    }
    const u = await db.pengguna.findUnique({ where: { id: ss.id } });
    if (!u || !(await (await import("bcryptjs")).default.compare(lama, u.password_hash))) {
      const { redirect } = await import("next/navigation");
      redirect("/akun?toast=" + encodeURIComponent("Password lama salah"));
    }
    await db.pengguna.update({ where: { id: ss.id }, data: { password_hash: await (await import("bcryptjs")).default.hash(baru, 10) } });
    const { catatAudit } = await import("@/lib/audit");
    await catatAudit(ss.email, "pengguna", "ganti-password", String(ss.id), {}, {});
    const { redirect } = await import("next/navigation");
    redirect("/akun?toast=" + encodeURIComponent("Password berhasil diganti ✓"));
  }

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head"><h3>Akun<small>{s.email} · {s.peran}</small></h3></div>
      <form action={gantiPassword} className="form-card" style={{ maxWidth: 480 }}>
        <h4>Ganti password</h4>
        <label className="f">Password lama<input name="lama" type="password" required className="field" /></label>
        <label className="f">Password baru (min. 6 karakter)<input name="baru" type="password" required minLength={6} className="field" /></label>
        <SubmitButton>Simpan password</SubmitButton>
      </form>
    </AppShell>
  );
}

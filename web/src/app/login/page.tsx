import { redirect } from "next/navigation";
import { sesi } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const s = await sesi();
  if (s) redirect("/dashboard");
  const sp = await searchParams;

  async function login(form: FormData) {
    "use server";
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const batas = await import("@/lib/batasLogin");
    if (batas.terkunci(email)) redirect("/login?err=kunci");
    const user = await (await import("@/lib/db")).db.pengguna.findUnique({ where: { email } });
    const ok = !!user && user.aktif && (await (await import("bcryptjs")).default.compare(password, user.password_hash));
    if (!ok || !user) {
      batas.catatGagal(email);
      redirect("/login?err=1");
    }
    batas.bersihkan(email);
    await (await import("@/lib/auth")).buatSesi(user.id, user.peran);
    redirect("/dashboard");
  }

  const dev = process.env.NODE_ENV !== "production";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--soft)" }}>
      <form action={login} className="card" style={{ width: "100%", maxWidth: 380, padding: 28, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, color: "var(--ink)" }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--amber)", display: "grid", placeItems: "center", color: "#fff", fontSize: "0.85rem" }}>TK</span>
          <span>TK Permata Indonesia</span>
        </div>
        <p style={{ fontSize: "0.84rem", color: "var(--muted)" }}>Siswa, SPP, kas, dan WhatsApp — satu aplikasi.</p>
        {sp.err && <div className="notice">{sp.err === "kunci" ? "Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi." : "Email atau password salah."}</div>}
        <label className="f">Email<input name="email" type="text" required defaultValue={dev ? "admin@tk.local" : undefined} autoComplete="username" className="field" /></label>
        <label className="f">Password<input name="password" type="password" required autoComplete="current-password" className="field" /></label>
        <button className="btn" style={{ padding: "10px 14px" }}>Masuk</button>
        {dev && <p style={{ fontSize: "0.74rem", color: "var(--muted)" }}>Akun seed: admin@tk.local / viewer@tk.local</p>}
      </form>
    </main>
  );
}

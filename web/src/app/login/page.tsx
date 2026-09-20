import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { buatSesi, sesi } from "@/lib/auth";

export default async function LoginPage() {
  const s = await sesi();
  if (s) redirect("/dashboard");

  async function login(form: FormData) {
    "use server";
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const user = await db.pengguna.findUnique({ where: { email } });
    if (!user || !user.aktif) redirect("/login?err=1");
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) redirect("/login?err=1");
    await buatSesi(user.id, user.peran);
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form action={login} className="w-full max-w-sm bg-white border border-[#e8eaf0] rounded-2xl p-8 grid gap-4 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-[#16181f]">
          <span className="w-9 h-9 rounded-xl bg-amber-500 grid place-items-center text-white text-sm">TK</span>
          <span>TK Permata Indonesia</span>
        </div>
        <p className="text-sm text-[#6f7583]">Masuk untuk mengelola siswa, SPP, kas, dan WhatsApp.</p>
        <label className="grid gap-1 text-sm font-semibold">
          Email
          <input name="email" type="email" required defaultValue="admin@tk.local" className="border border-[#e8eaf0] rounded-lg px-3 py-2 font-normal" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Password
          <input name="password" type="password" required className="border border-[#e8eaf0] rounded-lg px-3 py-2 font-normal" />
        </label>
        <button className="bg-[#3b6cf6] text-white font-bold rounded-lg py-2.5 text-sm">Masuk</button>
        <p className="text-xs text-[#6f7583]">Akun awal (seed): admin@tk.local / viewer@tk.local — password saat seed.</p>
      </form>
    </main>
  );
}

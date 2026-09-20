"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  siswa: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>,
  bayar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>,
  kas: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>,
  wa: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" /></svg>,
  impor: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></svg>,
  gear: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
};

export default function Sidebar({ peran, nama, badge }: { peran: string; nama: string; badge?: number }) {
  const path = usePathname();
  const menu = [
    { href: "/dashboard", label: "Dashboard", icon: I.dash, semua: true },
    { href: "/siswa", label: "Siswa", icon: I.siswa, semua: true },
    { href: "/pembayaran", label: "Pembayaran", icon: I.bayar, semua: true, n: badge },
    { href: "/kas", label: "Kas", icon: I.kas, semua: true },
    { href: "/whatsapp", label: "WhatsApp", icon: I.wa, semua: false },
    { href: "/impor", label: "Impor", icon: I.impor, semua: false },
    { href: "/pengaturan", label: "Pengaturan", icon: I.gear, semua: false },
  ];
  return (
    <nav className="side">
      <div className="school"><i>TK</i><span>TK Permata<br />Indonesia</span></div>
      {menu.map((m) => {
        if (!m.semua && peran !== "admin") return null;
        const on = path.startsWith(m.href);
        return (
          <Link key={m.href} href={m.href} className={on ? "on" : ""}>
            {m.icon}{m.label}
            {!!m.n && <span className="n">{m.n}</span>}
          </Link>
        );
      })}
      <div className="who">
        <b>{nama}</b>
        <span className="capitalize">{peran}</span>
        {" · "}
        <form action="/api/auth/logout" method="POST" className="inline">
          <button className="font-semibold hover:underline" style={{ color: "var(--red)" }}>Keluar</button>
        </form>
      </div>
    </nav>
  );
}

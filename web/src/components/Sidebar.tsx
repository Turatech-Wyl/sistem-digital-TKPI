"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/siswa", label: "Siswa" },
  { href: "/pembayaran", label: "Pembayaran" },
  { href: "/kas", label: "Kas" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/impor", label: "Impor" },
  { href: "/pengaturan", label: "Pengaturan" },
];

export default function Sidebar({ peran, nama }: { peran: string; nama: string }) {
  const path = usePathname();
  return (
    <aside className="w-52 shrink-0 bg-white border-r border-[#e8eaf0] p-4 flex flex-col gap-1 max-md:flex-row max-md:w-full max-md:overflow-x-auto max-md:border-r-0 max-md:border-b">
      <div className="flex items-center gap-2 px-2 pb-4 font-bold text-[#16181f] max-md:hidden">
        <span className="w-8 h-8 rounded-lg bg-amber-500 grid place-items-center text-white text-xs">TK</span>
        <span className="text-sm leading-tight">TK Permata<br />Indonesia</span>
      </div>
      {MENU.map((m) => {
        if (peran !== "admin" && !["/dashboard", "/siswa", "/pembayaran", "/kas"].includes(m.href)) return null;
        const on = path.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
              on ? "bg-[#e9efff] text-[#3b6cf6]" : "text-[#6f7583] hover:bg-[#f2f4f8]"
            }`}
          >
            {m.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-4 text-xs text-[#6f7583] max-md:hidden">
        <div className="font-bold text-[#16181f] text-sm">{nama}</div>
        <div className="capitalize">{peran}</div>
        <form action="/api/auth/logout" method="POST" className="mt-2">
          <button className="text-red-600 font-semibold hover:underline">Keluar</button>
        </form>
      </div>
    </aside>
  );
}

import Sidebar from "./Sidebar";

/** Kerangka tiap halaman — tiru .app mockup: sidebar + konten. */
export default function AppShell({ peran, nama, badge, children }: { peran: string; nama: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="app">
      <Sidebar peran={peran} nama={nama} badge={badge} />
      <div className="screen">{children}</div>
    </div>
  );
}

export function pill(status: string) {
  if (status === "lunas" || status === "aktif") return <span className="st ok">{status === "lunas" ? "Lunas" : "Aktif"}</span>;
  if (status === "menunggu_verifikasi") return <span className="st wn">Verifikasi</span>;
  if (status === "nonaktif" || status === "lulus") return <span className="st wn">{status}</span>;
  return <span className="st bad">Belum</span>;
}

import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AuditPage() {
  const s = await sesi();
  if (!s) redirect("/login");
  if (s.peran !== "admin") redirect("/dashboard");
  const rows = await db.audit.findMany({ orderBy: { waktu: "desc" }, take: 100 });
  const users = await db.pengguna.findMany();
  const nama = (id: number | null) => users.find((u) => u.id === id)?.email || "?";

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>Log Audit<small>100 aktivitas terakhir · tidak bisa dihapus</small></h3>
      </div>
      <div className="card tbl">
        <table className="grid-t">
          <thead><tr><th>Waktu</th><th>Pengguna</th><th>Tabel</th><th>Aksi</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.waktu).toLocaleString("id-ID")}</td>
                <td>{nama(r.pengguna_id)}</td>
                <td>{r.tabel}</td>
                <td><span className="st info">{r.aksi}</span></td>
                <td style={{ fontSize: "0.74rem", color: "var(--muted)", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }}>{r.sesudah || r.sebelum}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td>Belum ada aktivitas tercatat.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

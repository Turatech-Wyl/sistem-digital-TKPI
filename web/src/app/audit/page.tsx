import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { sesi } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "Audit" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const s = await sesi();
  if (!s) redirect("/login");
  if (s.peran !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const PER = 20;
  const total = await db.audit.count();
  const totalHal = Math.max(1, Math.ceil(total / PER));
  const hal = Math.min(Math.max(1, Number(sp.page) || 1), totalHal);
  const rows = await db.audit.findMany({ orderBy: { waktu: "desc" }, take: PER, skip: (hal - 1) * PER });
  const users = await db.pengguna.findMany();
  const nama = (id: number | null) => users.find((u) => u.id === id)?.email || "?";

  return (
    <AppShell peran={s.peran} nama={s.nama}>
      <div className="s-head">
        <h3>Log Audit<small>{total} aktivitas · tidak bisa dihapus</small></h3>
        <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Hal {hal}/{totalHal}</span>
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
        {totalHal > 1 && (
          <div className="row" style={{ padding: 12, justifyContent: "center" }}>
            {hal > 1 && <a href={`/audit?page=${hal - 1}`} className="btn light">← Prev</a>}
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Hal {hal} / {totalHal}</span>
            {hal < totalHal && <a href={`/audit?page=${hal + 1}`} className="btn light">Next →</a>}
          </div>
        )}
      </div>
    </AppShell>
  );
}

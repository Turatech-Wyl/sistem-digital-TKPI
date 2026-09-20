import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--soft)" }}>
      <div className="card" style={{ padding: 32, textAlign: "center", display: "grid", gap: 8, justifyItems: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>404</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Halaman tidak ditemukan.</p>
        <Link href="/dashboard" className="btn">Kembali ke Dashboard</Link>
      </div>
    </main>
  );
}

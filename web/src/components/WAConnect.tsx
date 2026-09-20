"use client";
import { useEffect, useState } from "react";

type St = { connected: boolean; phone?: string; updated_at?: string; last_error?: string; agent_jalan: boolean; ada_qr: boolean; jeda: boolean };

export default function WAConnect() {
  const [st, setSt] = useState<St | null>(null);
  const muat = async () => {
    try {
      const r = await fetch("/api/wa/status", { cache: "no-store" });
      if (r.ok) setSt(await r.json());
    } catch { /* abaikan */ }
  };
  useEffect(() => {
    muat();
    const t = setInterval(muat, 5000);
    return () => clearInterval(t);
  }, []);
  if (!st) return <p style={{ fontSize: "0.84rem", color: "var(--muted)" }}>Memuat status…</p>;
  return (
    <div className="two">
      <div style={{ display: "grid", gap: 8, justifyItems: "center", alignContent: "start" }}>
        {st.connected ? (
          <div className="notice" style={{ background: "var(--green-soft)", borderColor: "#bbf7d0", color: "#15803d" }}>
            Terhubung{st.phone ? ` · ${st.phone}` : ""}. HP sekolah tetap bisa dipakai TU seperti biasa.
          </div>
        ) : st.ada_qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/wa/qr?t=${Date.now()}`} alt="QR WhatsApp" width={240} height={240} style={{ borderRadius: 12, border: "1px solid var(--line)" }} key={st.updated_at} />
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>Scan dari HP sekolah: WhatsApp → Perangkat Tertaut → Tautkan. Sekali saja.</p>
          </>
        ) : (
          <div className="notice">{!st.agent_jalan ? "Agent belum jalan. Nyalakan: cd agent && npm run start" : (st.last_error || "Menunggu QR dari agent…")}</div>
        )}
      </div>
      <div style={{ display: "grid", gap: 8, alignContent: "start", fontSize: "0.84rem" }}>
        <div>Status agent: <b>{st.agent_jalan ? "jalan" : "mati"}</b></div>
        <div>Bot otomatis: <b>{st.jeda ? "DIJEDA" : "aktif"}</b></div>
        <form method="POST" action="/api/wa/jeda">
          <button className="btn light">{st.jeda ? "Lanjutkan bot" : "Jeda bot"}</button>
        </form>
        <p style={{ color: "var(--muted)" }}>Jadwal pengingat: tgl 1, 10, 17, 24, 31 · 07.00–09.00 Senin–Sabtu · jeda 20–40 dtk · maks 50/jam.</p>
      </div>
    </div>
  );
}

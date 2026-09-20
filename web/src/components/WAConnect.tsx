"use client";
import { useEffect, useState } from "react";

type St = { connected: boolean; phone?: string; updated_at?: string; last_error?: string; agent_jalan: boolean; ada_qr: boolean; jeda: boolean };

export default function WAConnect() {
  const [st, setSt] = useState<St | null>(null);
  const [tick, setTick] = useState(0); // paksa gambar QR refresh (QR kedaluwarsa ±20 dtk)
  const muat = async () => {
    try {
      const r = await fetch("/api/wa/status", { cache: "no-store" });
      if (r.ok) setSt(await r.json());
    } catch { /* abaikan */ }
  };
  useEffect(() => {
    muat();
    const t = setInterval(() => { muat(); setTick((x) => x + 1); }, 5000);
    return () => clearInterval(t);
  }, []);
  if (!st) return <p style={{ fontSize: "0.84rem", color: "var(--muted)" }}>Memuat status…</p>;
  const umurQR = st.updated_at ? Math.max(0, Math.round((Date.now() - new Date(st.updated_at).getTime()) / 1000)) : 999;
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
            <img src={`/api/wa/qr?t=${tick}`} alt="QR WhatsApp" width={240} height={240} style={{ borderRadius: 12, border: "1px solid var(--line)" }} />
            <p style={{ fontSize: "0.8rem", color: umurQR > 25 ? "var(--red)" : "var(--muted)", textAlign: "center" }}>
              {umurQR > 25 ? "QR ini basi — tunggu QR baru muncul otomatis." : `QR baru ${umurQR} dtk lalu — segera scan (±20 dtk).`}
            </p>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center" }}>HP sekolah: WhatsApp → Perangkat Tertaut → Tautkan. Sekali saja.</p>
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
        {st.connected && (
          <form method="POST" action="/api/wa/unlink" onSubmit={(e) => { if (!confirm("Putuskan perangkat WA dari aplikasi? Harus scan QR ulang.")) e.preventDefault(); }}>
            <button className="btn light" style={{ color: "var(--red)" }}>Putuskan perangkat</button>
          </form>
        )}
        <p style={{ color: "var(--muted)" }}>Jadwal pengingat: tgl 1, 10, 17, 24, 31 · 07.00–09.00 Senin–Sabtu · jeda 20–40 dtk · maks 50/jam.</p>
      </div>
    </div>
  );
}

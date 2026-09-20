"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/** Toast dari ?toast=pesan (dibuat oleh server action via redirect). */
export default function Toaster() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const t = sp.get("toast");
    if (t) {
      setMsg(t);
      const q = new URLSearchParams(sp.toString());
      q.delete("toast");
      router.replace(q.toString() ? `${path}?${q}` : path);
      const tm = setTimeout(() => setMsg(null), 3500);
      return () => clearTimeout(tm);
    }
  }, [sp, path, router]);
  if (!msg) return null;
  return (
    <div
      onClick={() => setMsg(null)}
      style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 50,
        background: "var(--ink)", color: "#fff", padding: "10px 18px", borderRadius: 12,
        fontSize: "0.84rem", fontWeight: 600, boxShadow: "0 10px 30px rgba(0,0,0,.25)", cursor: "pointer",
      }}
    >
      {msg}
    </div>
  );
}

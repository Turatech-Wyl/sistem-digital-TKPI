"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/** Toast dari ?toast=pesan (dibuat oleh server action via redirect). Hilang sendiri setelah 4 detik. */
export default function Toaster() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [msg, setMsg] = useState<string | null>(null);

  // Ambil pesan lalu bersihkan URL. Timer sengaja di effect terpisah: router.replace mengubah
  // searchParams sehingga effect ini jalan ulang, dan cleanup-nya dulu ikut membatalkan timer.
  useEffect(() => {
    const t = sp.get("toast");
    if (!t) return;
    setMsg(t);
    const q = new URLSearchParams(sp.toString());
    q.delete("toast");
    router.replace(q.toString() ? `${path}?${q}` : path, { scroll: false });
  }, [sp, path, router]);

  useEffect(() => {
    if (!msg) return;
    const tm = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(tm);
  }, [msg]);

  if (!msg) return null;
  const sukses = msg.includes("✓");
  return (
    <div role="status" className={`toast ${sukses ? "ok" : "warn"}`}>
      <span>{msg}</span>
      <button onClick={() => setMsg(null)} aria-label="Tutup">×</button>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

/** Toggle terang/gelap. Pilihan disimpan di localStorage; tanpa pilihan, ikut setelan sistem (lihat layout). */
export default function ThemeToggle() {
  const [gelap, setGelap] = useState<boolean | null>(null);
  useEffect(() => {
    setGelap(document.documentElement.dataset.theme === "dark");
  }, []);
  const ganti = () => {
    const baru = !gelap;
    setGelap(baru);
    document.documentElement.dataset.theme = baru ? "dark" : "light";
    try { localStorage.setItem("tkpi-theme", baru ? "dark" : "light"); } catch { /* abaikan */ }
  };
  return (
    <button type="button" onClick={ganti} className="theme-btn" aria-label="Ganti tema" title={gelap ? "Ganti ke mode terang" : "Ganti ke mode gelap"}>
      {gelap ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
      <span>{gelap === null ? "Tema" : gelap ? "Mode terang" : "Mode gelap"}</span>
    </button>
  );
}

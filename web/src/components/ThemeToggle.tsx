"use client";
import { useEffect, useState } from "react";

/** Toggle terang/gelap — tersimpan di localStorage, default terang (mockup). */
export default function ThemeToggle() {
  const [gelap, setGelap] = useState(false);
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
    <button onClick={ganti} title={gelap ? "Mode terang" : "Mode gelap"} style={{ fontSize: "1rem", lineHeight: 1, background: "none", border: 0, cursor: "pointer" }}>
      {gelap ? "☀️" : "🌙"}
    </button>
  );
}

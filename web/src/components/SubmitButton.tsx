"use client";
import { useFormStatus } from "react-dom";

/** Tombol submit dengan state loading (anti double-submit) + konfirmasi opsional. */
export function SubmitButton({ children, className = "btn", confirm, name, value }: {
  children: React.ReactNode; className?: string; confirm?: string; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={className}
      name={name}
      value={value}
      disabled={pending}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
      style={pending ? { opacity: 0.6 } : undefined}
    >
      {pending ? "Memproses…" : children}
    </button>
  );
}

"use client";

/** Tombol cetak — memakai @media print di globals.css. */
export default function PrintButton() {
  return <button className="btn light no-print" onClick={() => window.print()}>Cetak</button>;
}

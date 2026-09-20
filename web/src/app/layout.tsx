import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TK Permata Indonesia — Administrasi",
  description: "Sistem administrasi TK: siswa, SPP, kas, WhatsApp otomatis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}

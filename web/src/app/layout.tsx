import type { Metadata } from "next";
import { Suspense } from "react";
import Toaster from "@/components/Toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TK Permata Indonesia", template: "%s · TK Permata Indonesia" },
  description: "Sistem administrasi TK: siswa, SPP, kas, WhatsApp otomatis.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('tkpi-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}})()` }} />
      </head>
      <body className="min-h-full">
        {children}
        <Suspense><Toaster /></Suspense>
      </body>
    </html>
  );
}

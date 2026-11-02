# Sistem Administrasi TK Permata Indonesia

Aplikasi web untuk TU: data siswa, tagihan SPP otomatis, verifikasi bukti transfer, buku kas, dan laporan. Dilengkapi agent WhatsApp yang mengirim pengingat dan menjawab pertanyaan pembayaran di nomor sekolah.

| Dokumen | Isi |
|---|---|
| [`PRD.md`](PRD.md) | Spesifikasi produk: apa dan kenapa |
| [`PLAN.md`](PLAN.md) | Progres, sisa pekerjaan, checklist go-live |
| [`docs/deploy.md`](docs/deploy.md) | Pasang di server, Cloudflare Tunnel, pembaruan, restore |
| [`docs/runbook-tu.md`](docs/runbook-tu.md) | Panduan harian TU dan langkah saat ada masalah |
| `docs/mockup.html` · `docs/riset-wa.html` | Mockup UI dan riset Baileys |

**Status:** Tahap 1–4 selesai, menuju uji coba satu siklus SPP. Detail ada di [`PLAN.md`](PLAN.md).

## Struktur

```
tk-sekolah/
├── web/              Next.js 16 + Prisma (SQLite) + Tailwind — aplikasi TU & kepala sekolah
│   ├── prisma/       schema.prisma, migrasi, seed
│   └── src/app/      halaman (dashboard, siswa, pembayaran, kas, laporan, whatsapp, …) + api/
├── agent/            Baileys + node-cron — koneksi WA, antrean kirim, bot, AI, pengingat
│   ├── src/          index (cron) · wa (koneksi/pesan masuk) · sender (antrean) · bot · ai · reminder · jobs
│   ├── run.sh        supervisor: restart otomatis bila crash
│   └── auth/         sesi WA (gitignore, jangan dibagikan)
├── data/             media/, backup/, logs/, status & QR WA (gitignore)
├── scripts/          start.sh (web + agent saat boot), backup.sh
└── docs/
```

Web dan agent memakai **satu file SQLite yang sama**. Antrean pesan WA disimpan di tabel `WaPesan`; status dan QR WA berupa berkas di `data/`.

## Menjalankan di lokal

Butuh Node 22.

```sh
# 1. Web — http://localhost:3000
cd web
cp .env.example .env
npm install
npx prisma migrate dev     # membuat prisma/dev.db + seed data contoh
npm run dev

# 2. Agent WA (terminal lain)
cd agent
cp .env.example .env       # WEB_URL=http://localhost:3000 saat memakai npm run dev
npm install
npm run start              # atau ./run.sh untuk restart otomatis (log di data/logs/agent.log)
```

- Login seed: `admin@tk.local` / `viewer@tk.local`, password sesuai `SEED_PASSWORD` (default `tk-admin-123`).
- Scan QR dari **Pengaturan → WhatsApp**. QR juga tampil di terminal agent.
- **Uji aman:** isi pengaturan `wa_uji_nomor` dengan nomor Anda supaya agent hanya mengirim ke nomor itu.
- Uji koneksi Baileys tanpa aplikasi: `npm run test-wa -- 62812xxxxxxx "halo tes"`.
- `AGENT_TOKEN` di `web/.env` dan `agent/.env` harus sama; dipakai untuk melampirkan PDF kwitansi.

## Perilaku agent

| Hal | Aturan |
|---|---|
| Antrean | Dicek tiap 5 detik. Balasan didahulukan (dengan "mengetik…" 2–5 detik), pengingat paling akhir |
| Pengingat | Tanggal 1, 10, 17, 24, 31 · 07.00–09.00 WIB Senin–Sabtu · jeda 20–40 detik · maksimal 50 pesan/jam · satu pesan per nomor per hari (menyebut semua anak dan tunggakan) · nomor yang sudah lama dihubungi tetapi tidak membalas 90 hari dilewati |
| Bot | Aturan kata kunci → AI (Gemini, lalu Groq; key di Pengaturan) → inbox "perlu dibalas" |
| TU membalas dari HP | Bot diam 10 menit di chat itu, dan antrean bot untuk nomor itu dibatalkan |
| Jeda bot | Menahan kiriman bot/AI/pengingat; balasan TU tetap jalan |
| Jadwal | Tagihan tanggal 1 pukul 00.05 · backup 02.00 · watchdog QR tiap 30 detik |

## Produksi

Lihat [`docs/deploy.md`](docs/deploy.md). Ringkasnya: `/opt/tk`, data di `/opt/tk/data`, `npm run build`, crontab `@reboot /opt/tk/scripts/start.sh` (web di port 3001), dan Cloudflare Tunnel untuk HTTPS.

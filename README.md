# Sistem Administrasi TK Permata Indonesia

PRD: `PRD.md` · Mockup: `docs/mockup.html` · Riset WA: `docs/riset-wa.html`

## Struktur
```
tk-sekolah/
├── PRD.md
├── web/       # Next.js App Router + TS + Tailwind + Prisma SQLite
│   ├── prisma/schema.prisma
│   └── src/
├── agent/     # Baileys + cron (QR, antrean, pengingat)
├── data/      # tk.db, media/, backup/ (gitignore)
└── scripts/   # start.sh, backup.sh
```

## Jalan lokal
```sh
cd web
cp .env.example .env  # atau pakai .env yang ada (placeholder PRD §13)
npm install
npx prisma migrate dev
npm run dev   # http://localhost:3000
```
Login seed: `admin@tk.local` / `viewer@tk.local` (password `SEED_PASSWORD` di `.env`, default `tk-admin-123`).

## Agent WA (Tahap 3)
```sh
cd agent
npm install
npm run start   # koneksi Baileys, QR tampil di terminal + halaman Pengaturan
```
- QR scan sekali dari **Pengaturan → WhatsApp** (auto-refresh tiap 5 dtk). Sesi tersimpan di `agent/auth/`.
- Antrean: `wa_pesan` status `antre` dikirim dengan jeda 20–40 dtk, maks 50/jam. Tombol **Jeda bot** menahan kiriman bot/AI/pengingat (balasan TU tetap jalan).
- Pengingat: tgl 1, 10, 17, 24, 31 · 07.00–09.00 Senin–Sabtu · satu pesan per nomor · lewati nomor tanpa balasan 90 hari.
- Cron dalam agent: tagihan tgl 1 00.05, backup 02.00.
- Uji awal: `npm run test-wa -- 62812xxxxxxx "halo tes"`.

## Tahap
- [x] 1. Fondasi: login, siswa, tarif/tagihan otomatis, bayar tunai, kwitansi PDF, impor Excel
- [ ] 2. Kas+laporan, dashboard, viewer, audit, backup
- [ ] 3. Agent WA: QR di dashboard, antrean, inbox, jeda bot, pengingat
- [ ] 4. Bot aturan + verifikasi + AI gratis
- [ ] 5. Uji coba 1 siklus SPP

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

## Uji WA awal (PRD §11)
```sh
cd agent
npm install
npm run test-wa -- 62812xxxxxxx "halo tes"
# scan QR dari terminal dengan HP sekolah, kirim 1 pesan, lihat log masuk
```

## Tahap
- [x] 1. Fondasi: login, siswa, tarif/tagihan otomatis, bayar tunai, kwitansi PDF, impor Excel
- [ ] 2. Kas+laporan, dashboard, viewer, audit, backup
- [ ] 3. Agent WA: QR di dashboard, antrean, inbox, jeda bot, pengingat
- [ ] 4. Bot aturan + verifikasi + AI gratis
- [ ] 5. Uji coba 1 siklus SPP

# Plan — Sistem Administrasi TK Permata Indonesia

Status pekerjaan dan langkah menuju go-live. Spesifikasi produk ada di [`PRD.md`](PRD.md).

**Posisi sekarang (2 Nov 2026):** Tahap 1–4 sudah dibangun dan diuji di lokal. Berikutnya: menutup celah di bawah, deploy ke server, lalu uji coba satu siklus SPP (Tahap 5).

---

## Progres per tahap

| Tahap | Status | Catatan |
|---|---|---|
| 1. Fondasi | ✅ Selesai | Login, siswa, tarif/tagihan otomatis, bayar tunai, kwitansi PDF, impor Excel |
| 2. Kas dan laporan | ✅ Selesai | Rekap, tunggakan, PDF/Excel, audit log, backup harian |
| 3. Agent WA | ✅ Selesai | QR di Pengaturan, antrean, inbox per nomor, jeda bot, pengingat, unlink, watchdog QR, supervisor restart |
| 4. Bot dan verifikasi | ✅ Selesai | Bot aturan, terima bukti, verifikasi, AI Gemini/Groq, basis pengetahuan |
| 5. Uji coba | ⏳ Belum mulai | Lihat bagian di bawah |

---

## Sebelum Tahap 5: celah yang harus ditutup

### A. Bug logika (✅ diperbaiki 2 Nov 2026)

Agent WA:
- [x] Tagihan otomatis tanggal 1 dari agent tidak pernah membuat tagihan (`diubah_pada` NOT NULL tidak diisi, sehingga `INSERT OR IGNORE` diam-diam melewati semua baris).
- [x] Pengingat diantrekan ulang tiap 10 menit (12× per orang tua pada tanggal pengingat), karena cek "sudah dikirim" mencari `2026-11` di isi pesan yang bertuliskan "November 2026".
- [x] Aturan "tanpa balasan 90 hari" membuat pengingat pertama setelah go-live tidak terkirim ke siapa pun. Sekarang hanya nomor yang sudah lama dihubungi tetapi tidak pernah membalas yang dilewati.
- [x] Pengingat hanya menyebut bulan berjalan; sekarang tunggakan bulan sebelumnya ikut disebut. Nomor kosong dilewati.
- [x] Format waktu campur aduk: agent menulis TEXT, Prisma menulis epoch ms. Akibatnya "TU baru membalas dari dashboard" tidak terdeteksi, dan urutan/filter waktu di web kacau. Agent kini menulis epoch ms dan merapikan baris lama saat start.
- [x] Antrean bisa tersumbat: 10 pesan tertahan (jeda bot/mode uji) di depan antrean menahan balasan TU di belakangnya.
- [x] Batas 50/jam dihitung dari waktu antre, bukan waktu kirim. Sisa pengingat juga bisa terkirim di luar 07.00–09.00.
- [x] Status/story, broadcast, dan channel WA ikut diproses; entri `status@broadcast` di `jid-balas.json` dibuang.
- [x] Gambar dari nomor tak dikenal tetap dibalas bot.
- [x] Keyakinan AI tidak dicek untuk niat bot.
- [x] Zona waktu: jam pengingat dan cron mengikuti zona waktu server (UTC di VPS = 14.00 WIB). Kini `TZ=Asia/Jakarta`.
- [x] Lampiran PDF disimpan sebagai `.jpg`; caption gambar hilang; unduh kwitansi memblokir proses (`curl` sinkron).

Web:
- [x] Pelunasan tidak atomik dan tanpa pengaman: klik ganda bisa membuat dua pembayaran + dua catatan kas. "Terima" juga bisa dipakai untuk tagihan yang sudah lunas.
- [x] Nomor kwitansi tidak urut (6 digit terakhir timestamp, bisa bentrok). Kini `KWT/2026/11/0001`.
- [x] Tarif: tarif yang belum berlaku ikut dipakai; siswa tanpa tarif ditagih Rp 350.000 tebakan. Header pembayaran menampilkan semua riwayat tarif.
- [x] Tanggal bayar/kas memakai UTC (mundur sehari sebelum 07.00 WIB).
- [x] Aksi "tandai dibaca" di inbox bisa dipanggil tanpa login.
- [x] Celah path di `/api/media` (`../media-lain/…` lolos cek awalan).
- [x] Sesi: perbandingan tanda tangan tidak constant-time, `SESSION_SECRET` bawaan diterima di produksi, cookie tanpa `secure`.
- [x] Input kas tanpa validasi (nominal kosong/negatif, kategori tidak ada).
- [x] Tunai tidak mengirim kwitansi ke WA (PRD §5.4); WA ke nomor "-" bila orang tua tanpa nomor.

### B. Fitur PRD yang belum ada (wajib sebelum go-live)

- [x] **Batas percobaan login gagal** (PRD §5.8): 5× per email per 15 menit.
- [ ] **Keringanan:** ubah nominal satu tagihan dengan alasan wajib + audit (`Tagihan.alasan_ubah`, PRD §5.3).
- [ ] **Alasan tolak** disimpan ke DB. Kolom isian alasan sudah ada dan alasannya dikirim ke WA + audit, tetapi belum ada baris `Pembayaran` untuk bukti yang ditolak.
- [x] **Template `tpl_lunas`** dipakai untuk konfirmasi lunas (tunai dan transfer).
- [ ] **Peringatan WA putus lebih dari 10 menit** di dashboard (PRD §6.1). Saat ini dashboard hanya menampilkan "Putus" tanpa menandai lamanya.

### C. Fitur PRD yang belum ada (boleh menyusul)

- [ ] Halaman detail siswa: riwayat tagihan, pembayaran, dan percakapan WA (PRD §5.2).
- [ ] Form hari libur di Pengaturan (`libur`); pengingat yang jatuh di hari libur digeser ke hari kerja berikutnya.
- [ ] Form jadwal pengingat (`pengingat_tgl`) di Pengaturan.
- [ ] Ekspor log WA ke Excel (PRD §5.6).
- [ ] Penanda "nomor tidak membalas 90 hari, hubungi manual" di inbox.

### D. Operasional

- [ ] Sinkron backup ke luar server (menunggu keputusan PRD §12 no. 7).
- [ ] Uji restore backup ke DB kosong, lalu catat waktunya.
- [ ] Logo dan kop sekolah di kwitansi.
- [x] Agent memuat `agent/.env` (`--env-file-if-exists`); sebelumnya `DB_PATH`, `AGENT_TOKEN`, dan `WEB_URL` di file itu tidak terbaca.

---

## Tahap 5: uji coba

| Langkah | Isi | Selesai bila |
|---|---|---|
| 5.1 Deploy | Pasang di server mengikuti [`docs/deploy.md`](docs/deploy.md), Cloudflare Tunnel aktif, `SESSION_SECRET`/`AGENT_TOKEN`/`SEED_PASSWORD` diganti | Web bisa dibuka via HTTPS, agent terhubung, reboot server tidak memutus layanan |
| 5.2 Data asli | Impor Excel TU, cek pemetaan kolom, isi tarif dan rekening asli | Jumlah siswa dan orang tua cocok dengan Excel TU |
| 5.3 Pemanasan WA | Mode uji (`wa_uji_nomor`) ke nomor pengembang → 5 keluarga → semua | 1 minggu tanpa peringatan/pembatasan dari WhatsApp |
| 5.4 Satu siklus SPP | Tagihan tanggal 1, pengingat, bukti masuk, verifikasi, kwitansi, laporan akhir bulan | Ukuran sukses PRD §2 tercapai |
| 5.5 Serah terima | Latih TU dengan [`docs/runbook-tu.md`](docs/runbook-tu.md), akun viewer untuk kepala sekolah | TU bisa menjalankan siklus tanpa pendampingan |

---

## Checklist go-live

**Server**
- [ ] `web/.env` dan `agent/.env` berisi nilai produksi; tidak ada nilai `placeholder` atau `ganti-…`
- [ ] `DATABASE_URL` dan `DB_PATH` menunjuk file yang sama (`/opt/tk/data/tk.db`)
- [ ] `AGENT_TOKEN` sama di web dan agent; uji kirim kwitansi via WA
- [ ] Crontab `@reboot` terpasang; reboot server sekali untuk membuktikannya
- [ ] Backup 02.00 berjalan, sinkron ke luar server, dan restore sudah diuji

**Aplikasi**
- [ ] Password akun seed diganti; akun viewer kepala sekolah dibuat
- [ ] Profil sekolah, rekening, tarif, jatuh tempo, dan template pesan diisi nilai asli
- [ ] Basis pengetahuan diisi TU (atau AI sengaja dibiarkan nonaktif)
- [ ] Data seed contoh sudah dihapus dan data asli sudah diimpor

**WhatsApp**
- [ ] QR di-scan dari HP sekolah; status di Pengaturan "terhubung"
- [ ] Mode uji dikosongkan setelah pemanasan selesai
- [ ] TU tahu cara memakai tombol **Jeda bot** dan tautan wa.me cadangan

---

## Nanti (v2)

Mengikuti PRD §4: biaya non-SPP, QRIS/payment gateway, OCR bukti, tahun ajaran dan kenaikan kelas, broadcast, portal orang tua, akses guru.

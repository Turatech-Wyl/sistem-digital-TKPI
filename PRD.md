# PRD — Sistem Administrasi TK Permata Indonesia

| | |
|---|---|
| **Versi** | 1.1 · 2 November 2026 |
| **Pengembang** | Willie Putra |
| **Skala** | ±50 siswa · kelas KB, TK A, TK B |
| **Status** | Tahap 1–4 selesai dibangun. Menuju uji coba satu siklus SPP (lihat [`PLAN.md`](PLAN.md)). |

> Dokumen ini menjelaskan **apa** yang dibangun dan **kenapa**. Urutan pekerjaan, progres, dan checklist go-live ada di [`PLAN.md`](PLAN.md). Nilai yang belum diputuskan sekolah memakai placeholder (§13) dan semuanya bisa diubah tanpa mengubah kode.

---

## 1. Ringkasan

Saat ini TU (Tata Usaha) mencatat siswa dan pembayaran di Excel, mengingatkan orang tua satu per satu lewat WhatsApp, dan mencocokkan bukti transfer secara manual. Sistem ini memindahkan seluruh proses ke satu aplikasi web, ditambah agent WhatsApp yang bekerja di nomor sekolah yang sudah ada.

| | |
|---|---|
| **Masalah** | Pengingat manual memakan waktu, tunggakan sulit dipantau, riwayat bayar tersebar di chat dan Excel. |
| **Solusi** | Satu aplikasi dengan tagihan otomatis per kelas, kas terpusat, dan bot WA yang mengingatkan serta menjawab pertanyaan pembayaran. |
| **Batasan** | Server 2 GB RAM, 2 core, tanpa Docker. Baileys bukan API resmi WhatsApp. AI memakai tier gratis dengan kuota harian. |

---

## 2. Tujuan dan ukuran sukses

| Tujuan | Ukuran | Target setelah 1 siklus SPP |
|---|---|---|
| Pengingat tidak lagi manual | % pengingat terkirim otomatis | 100% siswa aktif yang belum bayar menerima pengingat tanpa TU mengetik |
| Tunggakan terlihat | Waktu TU mengetahui siapa yang belum bayar | Cukup 1 layar dashboard |
| Bukti transfer tidak hilang | Bukti tersimpan dan terhubung ke siswa | Setiap bukti yang masuk lewat WA otomatis tercatat "menunggu verifikasi" |
| Pertanyaan rutin dijawab bot | Rasio dijawab bot vs diteruskan ke TU | ≥ 60% pesan soal tagihan/rekening dijawab tanpa TU |
| Nomor sekolah aman | Insiden pembatasan akun WhatsApp | 0 |

---

## 3. Pengguna dan hak akses

| Peran | Siapa | Bisa | Tidak bisa |
|---|---|---|---|
| **Admin** | TU (1 orang), pemegang HP sekolah | Semua: siswa, tagihan, catat bayar, verifikasi bukti, kas, WA, pengaturan, impor, ekspor | Menghapus log audit |
| **Viewer** | Kepala sekolah | Dashboard, laporan SPP, buku kas, unduh Excel/PDF | Input/ubah data, kirim WA |
| **Pengembang** | Willie | Akses server, backup, pembaruan, membuat akun | Bukan peran di aplikasi |
| **Orang tua** | Wali ±50 siswa | Berinteraksi lewat WhatsApp | Tidak punya login |

### Cerita pengguna utama

- **Sebagai TU**, saya ingin tagihan SPP semua siswa aktif dibuat otomatis tiap awal bulan sesuai tarif kelasnya. *(§5.3)*
- **Sebagai TU**, saya ingin melihat foto bukti transfer di aplikasi, mencocokkannya dengan mutasi bank, lalu menandai lunas, supaya orang tua langsung mendapat konfirmasi. *(§5.4, §6)*
- **Sebagai TU**, saya ingin pesan orang tua yang tidak bisa dijawab bot muncul di satu inbox berlabel "perlu dibalas". *(§6.6)*
- **Sebagai kepala sekolah**, saya ingin rekap lunas/belum/tunggakan per kelas per bulan dan bisa mengunduhnya sebagai PDF. *(§5.6)*
- **Sebagai orang tua**, saya ingin bertanya "tagihan anak saya berapa" lewat WA kapan saja dan mendapat angka yang benar. *(§6.4)*
- **Sebagai TU**, saya ingin mengimpor data siswa dari Excel yang sudah ada. *(§5.7)*

---

## 4. Lingkup

| Termasuk v1 | Nanti (v2) | Tidak termasuk |
|---|---|---|
| Data siswa dan orang tua, status aktif/nonaktif/lulus | Biaya selain SPP (uang pangkal, seragam, kegiatan) | Penggajian dan absensi guru |
| Tarif SPP per kelas, tagihan bulanan otomatis | Payment gateway / QRIS dinamis dengan konfirmasi otomatis | Nilai, rapor, kurikulum |
| Pembayaran transfer (verifikasi bukti) dan tunai | OCR nominal dari foto bukti | PPDB online |
| Kwitansi PDF, dikirim via WA | Tahun ajaran dan kenaikan kelas otomatis | Multi-sekolah dalam satu instalasi |
| Buku kas masuk/keluar dengan kategori | Broadcast pengumuman sekolah | Aplikasi mobile native |
| Laporan SPP dan kas, ekspor Excel dan PDF | Portal orang tua | |
| Impor siswa dari Excel/CSV | Akses guru kelas | |
| Agent WA: pengingat, bot aturan, terima bukti, inbox | | |
| AI gratis untuk pesan di luar aturan | | |
| Login admin dan viewer, log audit, backup harian | | |

---

## 5. Modul dan fitur

### 5.1 Dashboard
- Kartu angka bulan berjalan: siswa aktif, sudah bayar, belum bayar (jumlah dan rupiah), saldo kas.
- Grafik uang masuk 6 bulan terakhir per kelas.
- Ringkasan WA hari ini: pengingat terkirim, bukti menunggu verifikasi, pesan perlu dibalas.
- Status koneksi WA (terhubung/putus) dengan tautan ke halaman scan ulang.

### 5.2 Data siswa
- **Siswa:** NIS (otomatis), nama, tanggal lahir, jenis kelamin, kelas (KB / TK A / TK B), tanggal masuk, status, catatan.
- **Orang tua:** nama ayah, nama ibu, nomor WA utama (wajib, format `62xxx`), nomor WA kedua (opsional), alamat.
- Satu orang tua bisa punya lebih dari satu anak; bot mengenali semua anak dari satu nomor.
- Status **aktif** membuat tagihan bulanan. **Nonaktif** dan **lulus** menghentikan tagihan mulai bulan berikutnya; tagihan lama tetap ada.
- Halaman detail siswa: riwayat tagihan, pembayaran, dan percakapan WA.
- Cari, filter kelas dan status, urutkan.

### 5.3 Tarif dan tagihan
- Tarif SPP per kelas dengan `berlaku_sejak` (bulan); riwayat perubahan tersimpan.
- Setiap tanggal 1 pukul 00.05, sistem membuat tagihan bulan itu untuk semua siswa aktif sesuai tarif kelasnya. Bisa juga dijalankan manual. **Idempoten**: tidak pernah membuat tagihan ganda.
- TU bisa mengubah nominal satu tagihan (keringanan) dengan alasan wajib; perubahan tercatat di audit.
- Jatuh tempo dan jadwal pengingat bisa diubah TU. **Default:** jatuh tempo tanggal 10; pengingat tanggal 1, 10, 17, 24, 31 sampai lunas. Tanpa denda.
- Status tagihan: `belum` · `menunggu_verifikasi` · `lunas` · `dibatalkan`.

### 5.4 Pembayaran dan verifikasi

Alur bukti transfer:

1. **Bukti masuk:** orang tua mengirim foto ke WA sekolah. Bot menyimpan gambar, menautkannya ke siswa berdasarkan nomor pengirim, lalu mengubah tagihan menjadi `menunggu_verifikasi`.
2. **Balasan bot:** "Bukti diterima, TU akan memverifikasi maksimal 1×24 jam." Bukti muncul di antrean verifikasi.
3. **TU memverifikasi:** melihat foto, mengecek mutasi rekening, lalu klik **Terima**, atau **Tolak** dengan alasan.
4. **Diterima:** tagihan menjadi `lunas`, kas bertambah otomatis, kwitansi PDF dibuat dan dikirim ke WA orang tua.
5. **Ditolak:** bot mengirim alasannya dan meminta bukti ulang. Tagihan kembali `belum`.

Ketentuan lain:
- **Tunai:** TU mencatat langsung dari halaman pembayaran; kwitansi dicetak dan dikirim ke WA.
- **Banyak anak:** jika satu nomor punya dua anak atau lebih, bukti masuk antrean verifikasi tanpa tautan dan TU memilih siswanya.
- **Kwitansi:** kop sekolah, nomor kwitansi urut, nama siswa, bulan, nominal, tanggal, nama TU, tanda "LUNAS".

### 5.5 Buku kas
- Pemasukan SPP tercatat otomatis saat tagihan lunas. Pemasukan lain diinput manual.
- Kategori awal pengeluaran: **Gaji guru dan staf**, **Operasional** (listrik, air, internet, sewa). TU bisa menambah kategori.
- Setiap transaksi berisi tanggal, keterangan, kategori, nominal, lampiran nota (opsional), dan siapa yang mencatat.
- Saldo berjalan, filter per bulan dan kategori.

### 5.6 Laporan

| Laporan | Isi | Format |
|---|---|---|
| Rekap SPP bulanan | Per kelas: jumlah siswa, lunas, belum, menunggu verifikasi, total masuk dan tertunggak, daftar nama yang belum bayar | Layar, Excel, PDF |
| Tunggakan | Siswa dengan tagihan belum lunas lebih dari 1 bulan, berapa bulan, total | Layar, Excel, PDF |
| Buku kas | Transaksi dalam rentang tanggal, subtotal per kategori, saldo awal/akhir | Layar, Excel, PDF |
| Kwitansi | Satu pembayaran | PDF, dikirim via WA |
| Log WA | Semua pesan masuk/keluar beserta statusnya | Layar, Excel |

### 5.7 Impor data
- Unggah `.xlsx` atau `.csv` (ekspor Google Sheets). Baris pertama berisi judul kolom.
- Langkah: unggah → cocokkan kolom ke field sistem → pratinjau dengan tanda pada baris bermasalah → simpan.
- Nomor WA dinormalisasi ke `62xxx`. Siswa dengan nama dan tanggal lahir yang sama tidak digandakan, hanya diperbarui.
- Format kolom final disesuaikan setelah file Excel dari TK diterima.

### 5.8 Pengaturan dan keamanan
- **Profil sekolah:** nama, alamat, telepon, rekening bank (bank, nomor, atas nama), logo kwitansi.
- **Template pesan WA** bisa diedit TU dengan variabel `{orang_tua}`, `{nama_siswa}`, `{bulan}`, `{nominal}`, `{rekening}`.
- **Login:** email dan password, sesi 8 jam, batas percobaan gagal. Akun dibuat oleh pengembang; TU bisa mengganti password sendiri.
- **Log audit** untuk tagihan, pembayaran, kas, tarif, dan pengaturan.

---

## 6. Agent WhatsApp

Agent berjalan di nomor sekolah yang sudah ada dan dipegang TU. Bot dan TU berbagi nomor yang sama.

### 6.1 Koneksi
- Memakai library **Baileys** (`@whiskeysockets/baileys`) sebagai perangkat tertaut. TU cukup sekali scan QR dari **Pengaturan → WhatsApp**.
- HP sekolah tetap dipakai TU untuk chat manual. Bot tidak menghapus atau mengubah chat di HP.
- Sesi tersimpan di server. Jika koneksi putus, agent menyambung ulang otomatis. Watchdog meminta QR baru bila QR berhenti diperbarui. Jika putus lebih dari 10 menit, dashboard menampilkan peringatan dan TU diminta scan ulang.
- Perangkat tertaut bisa diputus dari web (unlink) tanpa membuka HP.
- WhatsApp kini sering memakai ID samaran (`@lid`). Agent mencatat pasangan nomor asli → JID percakapan dan selalu membalas ke JID tersebut, supaya pesan tidak tampil "Waiting for this message" di HP penerima.
- Pesan grup dan status (story) diabaikan.

### 6.2 Berbagi nomor dengan TU
- Bot hanya membalas otomatis jika pesan cocok dengan aturan (§6.4) atau AI cukup yakin (§7). Selain itu bot diam dan menandai pesan "perlu dibalas".
- Jika TU membalas manual dari HP, bot diam selama **10 menit** di percakapan itu dan membatalkan balasan otomatis yang belum terkirim.
- Setiap pesan dari bot diakhiri tanda "— Asisten TK".
- Tombol **Jeda bot** menghentikan semua balasan dan pengingat otomatis seketika. Balasan TU dari dashboard tetap terkirim.

### 6.3 Pengiriman dan pengingat
- **Antrean:** semua pesan keluar masuk tabel `wa_pesan` berstatus `antre` dan dikirim oleh agent (dicek tiap 5 detik).
- **Prioritas:** balasan atas chat orang tua (bot/AI/TU) didahulukan dan dikirim cepat dengan indikator "mengetik…" 2–5 detik. Pengingat dikirim terakhir.
- **Pengingat** hanya pukul **07.00–09.00**, Senin–Sabtu, pada tanggal pengingat (§5.3). Hari libur yang diatur di Pengaturan dilewati.
- **Penerima:** nomor WA utama milik siswa aktif dengan tagihan `belum`, termasuk tunggakan bulan sebelumnya. Satu nomor dengan dua anak menerima satu pesan yang menyebut kedua anak. Maksimal satu pengingat per nomor per hari.
- **Anti-ban:** jeda acak **20–40 detik** antar pengingat, maksimal **50 pesan per jam**. Nomor yang sudah dihubungi lebih dari 90 hari lalu tetapi tidak pernah membalas sejak itu dilewati, dan TU ditandai untuk menghubungi secara manual. Nomor baru tetap dikirimi.
- **Mode uji:** jika pengaturan `wa_uji_nomor` diisi, hanya nomor itu yang dikirimi pesan; pesan ke nomor lain ditahan di antrean. Dipakai saat pemanasan (lihat `PLAN.md`).

### 6.4 Bot aturan (tanpa AI)

| Niat | Contoh kata kunci | Jawaban bot |
|---|---|---|
| Cek tagihan | tagihan, spp, belum bayar, tunggakan, "berapa … bayar" | Daftar tagihan belum lunas semua anak dari nomor itu, nominal, dan rekening |
| Rekening | rekening, transfer ke, nomor rek, bank, norek | Bank, nomor rekening, atas nama |
| Riwayat | sudah bayar, riwayat, lunas, histori | 3 pembayaran terakhir dengan tanggal |
| Bukti transfer | pesan berisi gambar/PDF | Disimpan, ditandai menunggu verifikasi, dibalas konfirmasi terima |
| Kwitansi | kwitansi, bukti lunas, struk | Kirim ulang PDF kwitansi terakhir |
| Sapaan | assalamualaikum, halo, pagi | Salam balik dan menu: ketik *tagihan*, *rekening*, atau *riwayat* |
| Nomor tidak dikenal | apa pun | Tidak dibalas otomatis, masuk inbox "perlu dibalas" |
| Lainnya | tidak cocok aturan | Diteruskan ke lapisan AI (§7); jika AI tidak yakin, masuk inbox |

Kata umum seperti "berapa" atau "bulan ini" baru dihitung sebagai niat tagihan jika muncul bersama kata pembayaran. Contoh: "masuk jam berapa?" diteruskan ke AI dan basis pengetahuan.

Contoh percakapan:

```
Ortu : Assalamualaikum, spp bima bulan ini berapa ya bu
Bot  : Bapak/Ibu Hendra, tagihan yang belum lunas:
       • Bima Aditya September 2026: Rp 350.000
       Total Rp 350.000. Pembayaran ke BCA 0000000000 a.n. TK Permata
       Indonesia. Setelah transfer, mohon kirim fotonya ke sini.
       Terima kasih 🙏
       — Asisten TK
Ortu : [foto bukti transfer]
Bot  : Terima kasih, bukti pembayaran sudah kami terima dan akan
       diverifikasi maksimal 1×24 jam.
       — Asisten TK
(TU klik Terima)
Bot  : Alhamdulillah, pembayaran SPP Bima bulan September sudah kami
       terima. Kwitansi terlampir. Terima kasih 🙏
       — Asisten TK  [kwitansi.pdf]
```

### 6.5 Gaya bahasa
- Formal dengan salam Islami ("Assalamualaikum" / "Waalaikumsalam"), menyapa "Bapak/Ibu {nama}", ditutup dengan terima kasih dan 🙏.
- Nominal ditulis "Rp 350.000"; bulan ditulis lengkap dengan namanya, tanpa singkatan.
- Semua template bisa diedit TU.

### 6.6 Inbox
- Daftar percakapan per nomor, diurutkan dari yang terbaru. Tab **Perlu dibalas** berisi pesan yang tidak dijawab bot.
- TU bisa membalas dari dashboard; pesan terkirim lewat nomor sekolah dan tercatat sebagai balasan TU.
- Tautan cadangan `wa.me/62xxx?text=...` dengan teks terisi untuk dipakai saat agent putus.

---

## 7. Lapisan AI (gratis)

AI hanya dipakai untuk pesan yang tidak cocok aturan. Bot aturan tetap menjadi satu-satunya sumber jawaban berupa angka.

- **Penyedia:** Google Gemini (model Flash-Lite, tier gratis) sebagai utama, Groq (Llama 3.1 8B, tier gratis) sebagai cadangan. API key disimpan di tabel Pengaturan dan diisi lewat halaman Pengaturan. Batas waktu 8 detik per penyedia.
- **Tugas AI:** (a) mengelompokkan pesan bebas ke salah satu niat di §6.4, atau (b) menjawab pertanyaan umum (jam masuk, libur, seragam) hanya dari basis pengetahuan yang diisi TU.
- **AI tidak boleh:** menyebut nominal atau status bayar dari tebakan, atau menjanjikan keringanan, jadwal, maupun kebijakan.
- **Ambang keyakinan:** di bawah 0,7 atau di luar basis pengetahuan → bot tidak membalas dan pesan masuk inbox.
- **Jika kuota habis atau API gagal:** lapisan AI dilewati dan pesan langsung masuk inbox. Orang tua tidak pernah menerima pesan galat.
- **Privasi:** yang dikirim ke AI hanya teks pesan dan nama depan anak. Nomor telepon, alamat, dan data keuangan tidak pernah dikirim.
- Semua penyedia diakses lewat satu antarmuka `AiProvider`, sehingga mudah diganti.

---

## 8. Model data

Satu file SQLite. Skema lengkap ada di `web/prisma/schema.prisma`. Tabel data bisnis memiliki kolom audit `dibuat_oleh`, `dibuat_pada`, `diubah_pada`.

| Tabel | Kolom inti |
|---|---|
| `Siswa` | id, nis, nama, tgl_lahir, jk, kelas_id, tgl_masuk, status, catatan |
| `OrangTua` | id, nama_ayah, nama_ibu, wa_utama, wa_kedua, alamat |
| `SiswaOrangTua` | siswa_id, orang_tua_id |
| `Kelas` | id, nama (KB / TK A / TK B), urutan |
| `Tarif` | id, kelas_id, nominal, berlaku_sejak (YYYY-MM) |
| `Tagihan` | id, siswa_id, periode (YYYY-MM), nominal, jatuh_tempo, status, alasan_ubah · unik (siswa_id, periode) |
| `Pembayaran` | id, tagihan_id, tgl_bayar, nominal, metode, bukti_file, status_verifikasi, alasan_tolak, no_kwitansi, diverifikasi_oleh |
| `Kas` | id, tgl, jenis (masuk/keluar), kategori_id, keterangan, nominal, lampiran, pembayaran_id? |
| `KasKategori` | id, nama, jenis |
| `WaPesan` | id, arah (masuk/keluar), nomor, orang_tua_id?, isi, media_file, wa_msg_id, status (antre/terkirim/dibaca/gagal), sumber (bot/ai/tu/pengingat), niat, dibaca_tu |
| `WaJadwal` | id, jenis, aturan, jam_mulai, jam_selesai, aktif |
| `Pengetahuan` | id, pertanyaan, jawaban |
| `Pengguna` | id, nama, email, password_hash, peran (admin/viewer), aktif |
| `Pengaturan` | kunci, nilai |
| `Audit` | id, pengguna_id, tabel, baris_id, aksi, sebelum, sesudah, waktu |

Berkas di luar database, disimpan di `data/`:

| Berkas | Isi |
|---|---|
| `media/` | Foto bukti transfer, PDF kwitansi |
| `backup/YYYY-MM-DD/` | Salinan harian DB dan media |
| `logs/` | Log web dan agent |
| `wa-status.json`, `qr.png`, `*.req` | Status koneksi WA, QR, dan permintaan dari web ke agent |
| `jid-balas.json` | Peta nomor asli → JID percakapan (`@lid`) |

---

## 9. Arsitektur teknis

```
          Cloudflare Tunnel (HTTPS)
                    │
            ┌───────▼────────┐        ┌──────────────────────┐
 TU / KS ──▶│ web (Next.js)  │        │ agent (Node+Baileys) │◀──▶ WhatsApp
            │ port 3001      │◀─PDF───│ antrean · cron · bot │
            └───────┬────────┘        └──────────┬───────────┘
                    │      ┌───────────────┐     │
                    └─────▶│ data/tk.db    │◀────┘
                           │ data/media …  │
                           └───────────────┘
```

| Komponen | Keputusan |
|---|---|
| **Aplikasi web** | Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind 4 + Prisma. UI mengikuti `docs/mockup.html`: font Plus Jakarta Sans, sidebar kiri, mode gelap. |
| **Agent WA** | Proses Node terpisah dengan Baileys, dijalankan lewat `tsx`. Membaca dan menulis SQLite langsung (`better-sqlite3`, WAL). Dijaga supervisor `agent/run.sh` yang otomatis restart bila crash. |
| **Komunikasi web ↔ agent** | Lewat database (`WaPesan` sebagai antrean, `Pengaturan` untuk jeda/mode uji) dan berkas di `data/` (status, QR, permintaan unlink/QR baru). Agent mengambil PDF kwitansi dari `/api/kwitansi/:id` dengan `AGENT_TOKEN`. |
| **Penjadwal** | node-cron di dalam agent: tagihan (tanggal 1, 00.05), pengingat (tiap 10 menit, 07–09), backup (02.00), watchdog QR (30 detik). |
| **Hosting** | Ubuntu 22.04, 2 GB RAM, 2 core, tanpa Docker. Node 22 via nvm. Kedua proses dijalankan oleh `scripts/start.sh` lewat cron `@reboot`. Akses publik lewat Cloudflare Tunnel. Panduan lengkap: [`docs/deploy.md`](docs/deploy.md). |
| **Domain** | Placeholder `tk.willieputra.dev`. Domain sekolah menyusul. |

Perkiraan beban: Next.js ±150–250 MB, agent ±80–120 MB, total ±300–400 MB.

---

## 10. Kebutuhan non-fungsional

| Aspek | Ketentuan |
|---|---|
| **Keamanan** | HTTPS via Cloudflare. Password di-hash dengan bcrypt. Sesi berupa cookie HttpOnly yang ditandatangani HMAC. Hanya admin yang bisa mengubah data. File bukti hanya bisa diakses setelah login. API key AI tidak pernah dikirim ke browser. |
| **Backup** | Setiap pukul 02.00 DB (`sqlite3 .backup`) dan media disalin ke `data/backup/`, disimpan 30 hari, lalu disinkronkan ke luar server (tujuan masih menunggu keputusan, §12). Pemulihan wajib diuji sebelum go-live. |
| **Ketersediaan** | Proses hidup kembali setelah reboot dan agent restart sendiri bila crash. Jika agent mati, aplikasi web tetap berjalan dan tautan wa.me tetap bisa dipakai. |
| **Kinerja** | Halaman untuk ±50 siswa terbuka dalam < 1 detik. PDF terbentuk dalam < 5 detik. |
| **Perangkat** | Laptop TU (Chrome/Edge) dan HP (Safari/Chrome). Tampilan responsif. |
| **Bahasa** | Seluruh antarmuka dalam Bahasa Indonesia. |
| **Kepatuhan WA** | Baileys tidak resmi. Mitigasi: hanya mengirim ke kontak yang dikenal, jeda acak, batas per jam, jeda bot, mode uji, dan cadangan wa.me. Pengirim terpisah di `agent/src/sender.ts` agar bisa diganti ke WhatsApp Cloud API. |
| **Privasi** | Data anak dan orang tua hanya ada di server sekolah dan backup. Yang dikirim ke AI hanya teks pesan dan nama depan. |

---

## 11. Tahapan

Ringkasan tahapan ada di bawah. Status terkini, sisa pekerjaan, dan checklist go-live ada di [`PLAN.md`](PLAN.md).

| Tahap | Isi |
|---|---|
| **1. Fondasi** | Login, profil sekolah, kelas dan tarif, siswa dan orang tua, impor Excel, tagihan otomatis, bayar tunai, kwitansi PDF |
| **2. Kas dan laporan** | Buku kas, kategori, rekap SPP, tunggakan, ekspor Excel/PDF, dashboard, akun viewer, audit, backup |
| **3. Agent WA** | Koneksi Baileys, QR di web, antrean kirim, pesan masuk, inbox, jeda bot, pengingat terjadwal, template |
| **4. Bot dan verifikasi** | Bot aturan, terima bukti, verifikasi TU, konfirmasi dan kwitansi via WA, lapisan AI, basis pengetahuan |
| **5. Uji coba** | Deploy ke server, impor data asli, pemanasan ke 5 keluarga lalu semua, pendampingan TU satu siklus SPP |

Setiap tahap diakhiri demo ke TU dan kepala sekolah. Tahap berikutnya dimulai setelah demo disetujui.

---

## 12. Keputusan yang masih terbuka

| # | Keputusan | Pemilik | Status | Dampak bila belum ada |
|---|---|---|---|---|
| 1 | Nama subdomain sekolah dan pemegang DNS | Sekolah | Menunggu | Pakai `tk.willieputra.dev` |
| 2 | Tarif SPP KB, TK A, TK B | Sekolah | Menunggu | Tagihan memakai tarif placeholder |
| 3 | Kebijakan jatuh tempo dan jadwal pengingat | Sekolah | Menunggu | Default tanggal 10; pengingat 1, 10, 17, 24, 31 |
| 4 | File Excel TU untuk format impor final | TU | Menunggu | Pemetaan kolom belum final |
| 5 | Rekening bank, kop, logo, nama kepala sekolah | Sekolah | Menunggu | Kwitansi memakai placeholder; **wajib sebelum go-live** |
| 6 | Basis pengetahuan AI (FAQ dan jawabannya) | TU | Menunggu | AI hanya mengelompokkan niat |
| 7 | Tujuan backup luar server | Pengembang + sekolah | Menunggu | Backup hanya ada di server yang sama |
| 8 | API key Gemini/Groq atas nama siapa | Sekolah | Menunggu | Lapisan AI dilewati |

---

## 13. Placeholder

Semua nilai berikut sementara dan bisa diubah tanpa mengubah kode. Nilai awal diambil dari `web/.env` saat seed, lalu dikelola dari halaman **Pengaturan**.

| Item | Placeholder | Diubah di |
|---|---|---|
| Nama sekolah | TK Permata Indonesia | Pengaturan |
| Subdomain | `tk.willieputra.dev` | Cloudflare Tunnel |
| Tarif SPP | KB Rp 300.000 · TK A Rp 350.000 · TK B Rp 350.000 | Seed (`TARIF_*`) / Pengaturan |
| Jatuh tempo | Tanggal 10 | Pengaturan |
| Rekening | BCA 0000000000 a.n. TK Permata Indonesia | Pengaturan |
| Nomor WA sekolah | `62812xxxxxxx` (nomor uji milik pengembang dulu) | Pengaturan + scan QR |
| Logo | Teks "TK" dalam kotak | — |
| API key AI | Kosong; lapisan AI dilewati sampai diisi | Pengaturan |
| Akun awal | `admin@tk.local` / `viewer@tk.local`, password dari `SEED_PASSWORD` | `web/.env` saat seed |

Data seed: 3 kelas, 12 siswa contoh dengan 10 orang tua (2 orang tua punya 2 anak), tagihan 3 bulan terakhir dengan status campuran, 8 transaksi kas, dan 6 pesan WA contoh.

---

## Riwayat dokumen

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 20 Sep 2026 | Versi awal, disetujui untuk mulai pengembangan |
| 1.1 | 2 Nov 2026 | Disinkronkan dengan implementasi Tahap 1–4 (antrean berprioritas, mode uji, JID `@lid`, AI Flash-Lite/Groq, API key di Pengaturan); tahapan dan progres dipindah ke `PLAN.md`; keputusan terbuka dibuat tabel; arsitektur dan lokasi berkas diperjelas |

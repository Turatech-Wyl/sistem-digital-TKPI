# PRD — Sistem Administrasi TK Permata Indonesia

**Versi:** 1.0 · 20 September 2026
**Pengembang:** Willie Putra
**Skala:** ±50 siswa · kelas KB, TK A, TK B
**Status:** Disetujui untuk mulai pengembangan dengan data placeholder

> **Catatan untuk developer:** nama subdomain, nominal SPP per kelas, rekening bank, logo, dan API key **belum ditentukan**. Gunakan placeholder yang disebut di bagian 13 dan pastikan semuanya bisa diubah dari halaman Pengaturan tanpa mengubah kode. Prioritas pertama adalah aplikasi web berjalan dan agent Baileys bisa diuji kirim/terima pesan.

---

## 1. Ringkasan

Saat ini TU (Tata Usaha) mencatat siswa dan pembayaran di Excel, mengingatkan orang tua satu per satu lewat WhatsApp, dan mencocokkan bukti transfer secara manual. Sistem ini memindahkan seluruh proses ke satu aplikasi web dan menambahkan agent WhatsApp yang bekerja di nomor sekolah yang sudah ada.

| | |
|---|---|
| **Masalah** | Pengingat manual memakan waktu, tunggakan sulit dipantau, riwayat bayar tersebar di chat dan Excel. |
| **Solusi** | Satu aplikasi dengan tagihan otomatis per kelas, kas terpusat, bot WA yang mengingatkan dan menjawab pertanyaan pembayaran. |
| **Batasan** | Server 2 GB RAM, 2 core, tanpa Docker. Baileys bukan API resmi WhatsApp. AI memakai tier gratis dengan kuota harian. |

---

## 2. Tujuan dan ukuran sukses

| Tujuan | Ukuran | Target setelah 1 siklus SPP |
|---|---|---|
| Pengingat tidak lagi manual | % pengingat terkirim otomatis | 100% siswa aktif yang belum bayar menerima pengingat tanpa TU mengetik |
| Tunggakan terlihat | Waktu TU mengetahui siapa yang belum bayar | 1 layar dashboard |
| Bukti transfer tidak hilang | Bukti tersimpan dan terhubung ke siswa | Setiap bukti masuk WA otomatis tercatat "menunggu verifikasi" |
| Pertanyaan rutin dijawab bot | Rasio dijawab bot vs diteruskan ke TU | ≥ 60% pesan soal tagihan/rekening dijawab tanpa TU |
| Nomor sekolah aman | Insiden pembatasan akun WhatsApp | 0 |

---

## 3. Pengguna dan hak akses

| Peran | Siapa | Bisa | Tidak bisa |
|---|---|---|---|
| **Admin** | TU (1 orang), pemegang HP sekolah | Semua: siswa, tagihan, catat bayar, verifikasi bukti, kas, WA, pengaturan, impor, ekspor | Menghapus log audit |
| **Viewer** | Kepala sekolah | Dashboard, laporan SPP, buku kas, unduh Excel/PDF | Input/ubah data, kirim WA |
| **Pengembang** | Willie | Akses server, backup, pembaruan, membuat akun | Bukan peran di aplikasi |
| **Orang tua** | Wali ±50 siswa | Interaksi lewat WhatsApp | Tidak punya login |

### Cerita pengguna utama

- **Sebagai TU**, saya ingin tagihan SPP semua siswa aktif dibuat otomatis tiap awal bulan sesuai tarif kelasnya. *(Modul Tagihan)*
- **Sebagai TU**, saya ingin melihat foto bukti transfer di aplikasi, mencocokkan dengan mutasi bank, lalu mencentang lunas, supaya orang tua langsung dapat konfirmasi. *(Verifikasi + Agent WA)*
- **Sebagai TU**, saya ingin pesan orang tua yang tidak bisa dijawab bot muncul di satu inbox berlabel "perlu dibalas". *(Inbox)*
- **Sebagai kepala sekolah**, saya ingin rekap lunas/belum/tunggakan per kelas per bulan dan mengunduhnya sebagai PDF. *(Laporan)*
- **Sebagai orang tua**, saya ingin bertanya "tagihan anak saya berapa" lewat WA kapan saja dan dijawab dengan angka yang benar. *(Bot aturan)*
- **Sebagai TU**, saya ingin mengimpor data siswa dari Excel yang sudah ada. *(Impor)*

---

## 4. Lingkup

### Termasuk v1
- Data siswa dan orang tua, status aktif/nonaktif/lulus
- Tarif SPP per kelas, tagihan bulanan otomatis
- Catat pembayaran: transfer (verifikasi bukti) dan tunai
- Kwitansi PDF per pembayaran, dikirim via WA
- Buku kas masuk/keluar dengan kategori
- Laporan SPP dan kas, ekspor Excel dan PDF
- Impor siswa dari Excel/CSV
- Agent WA: pengingat, bot aturan, terima bukti, inbox
- AI gratis untuk pesan di luar aturan
- Login admin dan viewer, log audit
- Backup otomatis harian

### Nanti (v2)
- Biaya selain SPP (uang pangkal, seragam, kegiatan)
- Payment gateway / QRIS dinamis dengan konfirmasi otomatis
- OCR nominal dari foto bukti
- Tahun ajaran dan kenaikan kelas otomatis
- Broadcast pengumuman sekolah
- Portal orang tua
- Akses guru kelas

### Tidak termasuk
- Penggajian dan absensi guru
- Nilai, rapor, kurikulum
- PPDB online
- Multi-sekolah dalam satu instalasi
- Aplikasi mobile native

---

## 5. Modul dan fitur

### 5.1 Dashboard
- Kartu angka bulan berjalan: siswa aktif, sudah bayar, belum bayar (jumlah dan rupiah), saldo kas.
- Grafik uang masuk 6 bulan terakhir per kelas.
- Ringkasan WA hari ini: pengingat terkirim, dibaca, bukti menunggu verifikasi, pesan perlu dibalas.
- Status koneksi WA (terhubung/putus) dengan tombol scan ulang.

### 5.2 Data siswa
- Field siswa: NIS (otomatis), nama, tanggal lahir, jenis kelamin, kelas (KB / TK A / TK B), tanggal masuk, status, catatan.
- Field orang tua: nama ayah, nama ibu, nomor WA utama (wajib, format `62xxx`), nomor WA kedua (opsional), alamat.
- Satu orang tua bisa punya lebih dari satu anak; bot mengenali semua anak dari satu nomor.
- Status **aktif** membuat tagihan bulanan. **Nonaktif** dan **lulus** menghentikan tagihan sejak bulan berikutnya; tagihan lama tetap ada.
- Halaman detail siswa: riwayat tagihan, pembayaran, dan percakapan WA.
- Cari, filter kelas dan status, urut.

### 5.3 Tarif dan tagihan
- Tabel tarif SPP per kelas, `berlaku_sejak` bulan tertentu, riwayat perubahan tersimpan.
- Setiap tanggal 1 pukul 00.05, sistem membuat tagihan bulan itu untuk semua siswa aktif sesuai tarif kelas. Bisa dijalankan manual, idempoten (tidak menggandakan).
- TU bisa mengubah nominal satu tagihan (keringanan) dengan alasan wajib, tercatat di audit.
- Pengaturan jatuh tempo: tanggal jatuh tempo dan jadwal pengingat, bisa diubah TU. **Default:** jatuh tempo tanggal 10; pengingat tanggal 1, tanggal 10, lalu tiap 7 hari sampai lunas. Tanpa denda.
- Status tagihan: `belum` · `menunggu_verifikasi` · `lunas` · `dibatalkan`.

### 5.4 Pembayaran dan verifikasi

Alur bukti transfer:

1. **Bukti masuk** — orang tua kirim foto ke WA sekolah. Bot simpan gambar, tautkan ke siswa dari nomor pengirim, ubah tagihan ke `menunggu_verifikasi`.
2. **Balasan bot** — "Bukti diterima, TU akan verifikasi maksimal 1×24 jam." TU mendapat notifikasi di dashboard.
3. **TU verifikasi** — lihat foto, cek mutasi rekening, isi tanggal bayar dan nominal, klik **Terima** atau **Tolak** dengan alasan.
4. **Lunas** — tagihan jadi `lunas`, kas bertambah otomatis, kwitansi PDF dibuat dan dikirim ke WA orang tua.
5. **Ditolak** — bot mengirim alasan dan meminta bukti ulang. Tagihan kembali `belum`.

Ketentuan lain:
- Pembayaran tunai: TU catat langsung dari halaman tagihan, kwitansi tercetak dan terkirim ke WA.
- Jika satu nomor punya dua anak dan bukti tidak menyebut nama, masuk antrean verifikasi tanpa ditautkan; TU memilih siswanya.
- Kwitansi: kop sekolah, nomor kwitansi urut, nama siswa, bulan, nominal, tanggal, nama TU, tanda "LUNAS".

### 5.5 Buku kas
- Pemasukan SPP tercatat otomatis saat tagihan lunas. Pemasukan lain diinput manual.
- Kategori awal pengeluaran: **Gaji guru dan staf**, **Operasional** (listrik, air, internet, sewa). Kategori bisa ditambah TU.
- Transaksi: tanggal, keterangan, kategori, nominal, lampiran nota (opsional), dicatat oleh siapa.
- Saldo berjalan, filter per bulan dan kategori.

### 5.6 Laporan

| Laporan | Isi | Format |
|---|---|---|
| Rekap SPP bulanan | Per kelas: jumlah siswa, lunas, belum, menunggu verifikasi, total masuk dan tertunggak, daftar nama belum bayar | Layar, Excel, PDF |
| Tunggakan | Siswa dengan tagihan belum lunas > 1 bulan, berapa bulan, total | Layar, Excel, PDF |
| Buku kas | Transaksi dalam rentang tanggal, subtotal per kategori, saldo awal/akhir | Layar, Excel, PDF |
| Kwitansi | Satu pembayaran | PDF, dikirim WA |
| Log WA | Semua pesan keluar/masuk dengan status | Layar, Excel |

### 5.7 Impor data
- Unggah `.xlsx` atau `.csv` (ekspor Google Sheets). Baris pertama = judul kolom.
- Langkah: unggah → cocokkan kolom ke field sistem → pratinjau dengan tanda baris bermasalah → simpan.
- Nomor WA dinormalisasi ke `62xxx`. Siswa dengan nama + tanggal lahir sama tidak digandakan, hanya diperbarui.
- Format kolom final disesuaikan setelah file Excel dari TK diterima.

### 5.8 Pengaturan dan keamanan
- Profil sekolah: nama, alamat, telepon, rekening bank (bank, nomor, atas nama), logo kwitansi.
- Template pesan WA bisa diedit TU dengan variabel `{orang_tua}`, `{nama_siswa}`, `{bulan}`, `{nominal}`, `{rekening}`.
- Login email + password, sesi 8 jam, batas percobaan gagal. Akun dibuat pengembang, TU bisa ganti password.
- Log audit untuk tagihan, pembayaran, kas, tarif, pengaturan.

---

## 6. Agent WhatsApp

Berjalan di nomor sekolah yang sudah ada dan dipegang TU. Bot dan TU berbagi nomor yang sama.

### 6.1 Koneksi
- Library **Baileys** (`@whiskeysockets/baileys`), dipasang sebagai perangkat tertaut. TU scan QR dari halaman Pengaturan WA, sekali saja.
- HP sekolah tetap dipakai TU untuk chat manual. Bot tidak menghapus atau mengubah chat di HP.
- Sesi tersimpan di server. Jika putus, agent sambung ulang otomatis; jika gagal > 10 menit, dashboard menampilkan peringatan dan TU diminta scan ulang.

### 6.2 Aturan berbagi nomor dengan TU
- Bot hanya membalas otomatis jika pesan cocok aturan (6.4) atau AI yakin (bab 7). Selain itu bot diam dan menandai pesan "perlu dibalas".
- Jika TU membalas manual dari HP dalam 10 menit setelah pesan masuk, bot membatalkan balasan otomatis yang belum terkirim untuk percakapan itu.
- Setiap pesan keluar dari bot diakhiri tanda "— Asisten TK".
- Tombol **Jeda bot** di dashboard menghentikan semua balasan dan pengingat otomatis seketika.

### 6.3 Pengingat terjadwal
- Hanya pukul **07.00–09.00**, Senin–Sabtu. Jadwal yang jatuh pada hari libur digeser ke hari kerja berikutnya.
- Penerima: nomor WA utama dari siswa aktif dengan tagihan `belum`. Satu nomor dengan dua anak menerima satu pesan yang menyebut kedua anak.
- Jeda acak **20–40 detik** antar pesan, maksimal **50 pesan/jam**.
- Tidak ada pengingat ke nomor yang tidak pernah membalas dalam 90 hari terakhir; TU ditandai untuk menghubungi manual.

### 6.4 Bot aturan (tanpa AI)

| Niat | Kata kunci contoh | Jawaban bot |
|---|---|---|
| Cek tagihan | tagihan, berapa, spp, belum bayar, bulan ini | Daftar tagihan belum lunas semua anak dari nomor itu, nominal, jatuh tempo, rekening |
| Rekening | rekening, transfer ke mana, nomor rek, bank | Bank, nomor rekening, atas nama |
| Riwayat | sudah bayar, riwayat, bulan lalu, lunas | 3 pembayaran terakhir per anak dengan tanggal |
| Bukti transfer | pesan berisi gambar/PDF | Simpan, tandai menunggu verifikasi, balas konfirmasi terima |
| Kwitansi | kwitansi, bukti lunas, struk | Kirim ulang PDF kwitansi terakhir |
| Sapaan | assalamualaikum, halo, pagi | Salam balik + menu: ketik *tagihan*, *rekening*, atau *riwayat* |
| Nomor tidak dikenal | apa pun | Tidak dibalas otomatis, masuk inbox "perlu dibalas" |
| Lainnya | tidak cocok aturan | Ke lapisan AI (bab 7); jika AI tidak yakin, masuk inbox |

Contoh percakapan:

```
Ortu : Assalamualaikum, spp bima bulan ini berapa ya bu
Bot  : Waalaikumsalam Bapak Hendra. Tagihan SPP Bima Aditya (TK A) bulan
       September 2026 sebesar Rp 350.000, jatuh tempo 10 September.
       Pembayaran ke {rekening}. Setelah transfer, mohon kirim fotonya
       ke sini. Terima kasih 🙏
       — Asisten TK
Ortu : [foto bukti transfer]
Bot  : Terima kasih Bapak Hendra, bukti pembayaran sudah kami terima dan
       akan diverifikasi maksimal 1×24 jam.
       — Asisten TK
(TU klik Terima)
Bot  : Alhamdulillah, pembayaran SPP Bima bulan September sebesar
       Rp 350.000 sudah kami terima. Kwitansi terlampir. Terima kasih 🙏
       — Asisten TK  [kwitansi.pdf]
```

### 6.5 Gaya bahasa
- Formal dengan salam Islami: "Assalamualaikum" / "Waalaikumsalam", menyapa "Bapak/Ibu {nama}", menutup dengan terima kasih dan 🙏.
- Nominal "Rp 350.000", bulan ditulis nama bulan, tanpa singkatan.
- Semua template bisa diedit TU.

### 6.6 Inbox di dashboard
- Daftar percakapan per nomor, urut terbaru. Label: `dijawab bot` · `perlu dibalas` · `dibalas TU`.
- TU bisa membalas dari dashboard; terkirim lewat nomor sekolah, tercatat sebagai balasan TU.
- Tautan cadangan `wa.me/62xxx?text=...` dengan teks terisi di setiap percakapan dan tagihan, untuk saat agent putus.

---

## 7. Lapisan AI (gratis)

Hanya untuk pesan yang tidak cocok aturan. Bot aturan tetap sumber jawaban angka.

- **Penyedia utama:** Google Gemini API tier gratis (model Flash). **Cadangan:** Groq tier gratis. Keduanya hanya butuh API key, disimpan di server, bisa diganti di Pengaturan.
- **Tugas AI:** (a) mengklasifikasikan niat pesan bebas ke salah satu niat di 6.4, atau (b) menjawab pertanyaan umum dari basis pengetahuan sekolah (jam masuk, libur, seragam) yang diisi TU.
- **AI tidak boleh:** menyebut nominal atau status bayar dari tebakan (angka selalu dari database); menjanjikan keringanan, jadwal, atau kebijakan.
- **Ambang keyakinan:** jika AI tidak yakin atau di luar basis pengetahuan, bot tidak membalas dan pesan masuk inbox.
- **Jika kuota habis / API gagal:** lapisan AI dilewati, pesan langsung ke inbox. Tidak ada pesan galat ke orang tua.
- **Privasi:** yang dikirim ke AI hanya teks pesan dan nama depan anak, tanpa nomor telepon, alamat, atau data keuangan.
- Implementasi lewat satu antarmuka `AiProvider` agar penyedia bisa diganti dari konfigurasi.

---

## 8. Model data

SQLite, satu file. Semua tabel punya kolom audit `dibuat_oleh`, `dibuat_pada`, `diubah_pada`.

| Tabel | Kolom inti |
|---|---|
| `siswa` | id, nis, nama, tgl_lahir, jk, kelas_id, tgl_masuk, status, catatan |
| `orang_tua` | id, nama_ayah, nama_ibu, wa_utama, wa_kedua, alamat |
| `siswa_orang_tua` | siswa_id, orang_tua_id |
| `kelas` | id, nama (KB / TK A / TK B), urutan |
| `tarif` | id, kelas_id, nominal, berlaku_sejak |
| `tagihan` | id, siswa_id, periode (YYYY-MM), nominal, jatuh_tempo, status, alasan_ubah |
| `pembayaran` | id, tagihan_id, tgl_bayar, nominal, metode, bukti_file, status_verifikasi, alasan_tolak, no_kwitansi, diverifikasi_oleh |
| `kas` | id, tgl, jenis (masuk/keluar), kategori_id, keterangan, nominal, lampiran, pembayaran_id? |
| `kas_kategori` | id, nama, jenis |
| `wa_pesan` | id, arah (masuk/keluar), nomor, orang_tua_id?, isi, media_file, wa_msg_id, status (antre/terkirim/dibaca/gagal), sumber (bot/ai/tu/pengingat), niat, dibaca_tu |
| `wa_jadwal` | id, jenis, aturan, jam_mulai, jam_selesai, aktif |
| `pengetahuan` | id, pertanyaan, jawaban |
| `pengguna` | id, nama, email, password_hash, peran, aktif |
| `pengaturan` | kunci, nilai |
| `audit` | id, pengguna_id, tabel, baris_id, aksi, sebelum, sesudah, waktu |

---

## 9. Arsitektur teknis

| Komponen | Keputusan |
|---|---|
| **Aplikasi web** | Next.js (App Router) + TypeScript + Tailwind. UI mengikuti mockup yang disetujui: tema terang, font Plus Jakarta Sans, sidebar kiri, tab Dashboard / Siswa / Pembayaran / Kas / WhatsApp / Impor. Proses Node di port internal. |
| **Agent WA** | Proses Node terpisah dengan Baileys. Membaca antrean `wa_pesan` status `antre`, mengirim dengan jeda, menulis pesan masuk. Pola reconnect dan anti-ban mengacu ke repo WA-AKG. |
| **Database** | SQLite via Prisma, satu file di `/opt/tk/data`. Media (bukti, kwitansi) di folder terpisah, dirujuk dari DB. |
| **Penjadwal** | node-cron di dalam agent: buat tagihan (tgl 1), pengingat (sesuai pengaturan), backup (02.00). |
| **Hosting** | Server Ubuntu 22.04, 2 GB RAM, 2 core, tanpa Docker. Node via nvm. Kedua proses dijalankan lewat cron `@reboot` (seperti `/opt/projectreact`). Akses publik lewat Cloudflare Tunnel (HTTPS otomatis). |
| **Domain** | Placeholder `tk.willieputra.dev` untuk pengembangan. Domain sekolah menyusul. |

Perkiraan beban: Next.js ±150–250 MB, agent Baileys ±80–120 MB, total ±300–400 MB.

Struktur repo yang disarankan:

```
tk-sekolah/
├── PRD.md
├── web/            # Next.js
│   ├── prisma/schema.prisma
│   └── src/
├── agent/          # Baileys + cron
│   ├── src/
│   └── auth/       # sesi Baileys (gitignore)
├── data/           # tk.db, media/, backup/ (gitignore)
└── scripts/        # start.sh, backup.sh
```

---

## 10. Kebutuhan non-fungsional

| Aspek | Ketentuan |
|---|---|
| **Keamanan** | HTTPS via Cloudflare. Password di-hash (bcrypt/argon2). Hanya admin bisa mengubah data. File bukti tidak bisa diakses tanpa login. API key AI tidak pernah dikirim ke browser. |
| **Backup** | Setiap 02.00: salin SQLite dan folder media ke `data/backup`, simpan 30 hari, sinkron ke luar server (tujuan ditentukan). Pemulihan diuji sebelum go-live. |
| **Ketersediaan** | Proses hidup kembali otomatis setelah reboot. Jika agent WA mati, aplikasi tetap jalan dan tombol wa.me tetap bisa dipakai. |
| **Kinerja** | Halaman untuk ±50 siswa terbuka < 1 detik. PDF terbentuk < 5 detik. |
| **Perangkat** | Laptop TU (Chrome/Edge) dan HP (Safari/Chrome). Responsif. |
| **Bahasa** | Seluruh antarmuka Bahasa Indonesia. |
| **Kepatuhan WA** | Baileys tidak resmi. Mitigasi: hanya kirim ke kontak dikenal, jeda acak, batas per jam, jeda bot, cadangan wa.me. Pengirim dibungkus antarmuka `WaSender` agar bisa diganti ke WhatsApp Cloud API. |
| **Privasi** | Data anak dan orang tua hanya di server sekolah dan backup. Ke AI hanya teks pesan dan nama depan. |

---

## 11. Tahapan pengerjaan

| Tahap | Isi | Waktu |
|---|---|---|
| **1. Fondasi** | Login, profil sekolah, kelas dan tarif, data siswa dan orang tua, impor Excel, tagihan otomatis, catat bayar tunai, kwitansi PDF | Minggu 1–2 |
| **2. Kas dan laporan** | Buku kas, kategori, rekap SPP, tunggakan, ekspor Excel/PDF, dashboard, akun viewer, audit, backup | Minggu 3 |
| **3. Agent WA** | Koneksi Baileys, QR di dashboard, antrean kirim, pesan masuk, inbox, tombol jeda, pengingat terjadwal, template pesan | Minggu 4 |
| **4. Bot dan verifikasi** | Niat kata kunci, terima bukti, alur verifikasi TU, konfirmasi dan kwitansi via WA, lapisan AI gratis, basis pengetahuan | Minggu 5 |
| **5. Uji coba** | Impor data asli, pemanasan bot ke 5 keluarga dulu lalu semua, pendampingan TU satu siklus SPP, perbaikan | Minggu 6–9 |

Setiap tahap diakhiri demo ke TU dan kepala sekolah, lanjut setelah disetujui.

**Untuk pengujian awal WA (sebelum tahap 3 penuh):** buat skrip minimal di `agent/` yang bisa scan QR, mengirim satu pesan teks ke nomor uji, dan mencetak pesan masuk ke log. Ini dijalankan lebih dulu untuk memvalidasi Baileys di server.

---

## 12. Hal yang masih terbuka

1. **Nama subdomain sekolah** dan pemegang DNS.
2. **Tarif SPP** KB, TK A, TK B.
3. **Kebijakan jatuh tempo** — default tanggal 10, pengingat 1, 10, lalu mingguan; dikonfirmasi sekolah.
4. **File Excel TU** untuk format impor final.
5. **Rekening bank, kop, logo, nama kepala sekolah** untuk kwitansi.
6. **Basis pengetahuan AI** — daftar pertanyaan umum dan jawabannya dari TU.
7. **Tujuan backup luar server.**
8. **API key Gemini/Groq** — atas nama sekolah atau pengembang.

---

## 13. Placeholder untuk pengembangan

Semua nilai berikut dipakai sementara dan **harus** bisa diubah dari halaman Pengaturan atau file `.env` tanpa mengubah kode.

| Item | Placeholder |
|---|---|
| Nama sekolah | TK Permata Indonesia |
| Subdomain | `tk.willieputra.dev` |
| Tarif SPP | KB Rp 300.000 · TK A Rp 350.000 · TK B Rp 350.000 |
| Jatuh tempo | Tanggal 10 |
| Rekening | BCA 0000000000 a.n. TK Permata Indonesia |
| Nomor WA sekolah | `62812xxxxxxx` (nomor uji milik pengembang dulu) |
| Nomor TU | `62813xxxxxxx` |
| Logo | Teks "TK" dalam kotak |
| API key AI | Kosong; lapisan AI dilewati sampai diisi |
| Akun awal | admin@tk.local / viewer@tk.local, password diatur saat seed |

Data seed: 3 kelas, 12 siswa contoh dengan 10 orang tua (2 orang tua punya 2 anak), tagihan 3 bulan terakhir dengan campuran lunas/belum/menunggu, 8 transaksi kas, 6 pesan WA contoh.

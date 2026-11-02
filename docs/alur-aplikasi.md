# Alur Aplikasi — dari login sampai pesan otomatis

Ringkasan cara kerja aplikasi web (dipakai TU) dan agent WhatsApp (berjalan sendiri di server). Keduanya berbagi satu database: web menulis pesan ke tabel `WaPesan` dengan status `antre`, lalu agent yang mengirimkannya.

```
 TU (browser)                         Database (SQLite)                    Agent WA (server)
 ───────────                          ─────────────────                    ────────────────
 Login → Dashboard
 Pengaturan / Siswa / Tarif   ──►   Pengaturan, Siswa, OrangTua, Tarif
                                     Tagihan  ◄──────────────────────────  cron tgl 1 00.05: buat tagihan
                                     WaPesan (antre) ◄───────────────────  cron 07–09: pengingat
 Balas inbox / Verifikasi     ──►   WaPesan (antre)
                                     WaPesan (antre) ──────────────────►  antrean tiap 5 dtk → WhatsApp
                                     WaPesan (masuk) ◄───────────────────  pesan ortu masuk → bot/AI
 Inbox, Pembayaran            ◄──   WaPesan, Tagihan
```

## 1. Login

1. Buka alamat web, lalu masuk dengan email/username dan password.
2. Ada dua peran:
   - **Admin (TU)** bisa mengubah semua data.
   - **Viewer (kepala sekolah)** hanya bisa melihat dashboard, siswa, pembayaran, kas, dan laporan.
3. Sesi berlaku 8 jam. Setelah 5× salah password, email tersebut dikunci selama 15 menit.

## 2. Persiapan (sekali di awal)

| Bagian di menu Pengaturan | Yang diisi |
|---|---|
| Profil | Nama sekolah, alamat, rekening bank, WA sekolah, jatuh tempo |
| Tarif | SPP per kelas (KB, TK A, TK B). Perubahan tarif berlaku mulai bulan ini; riwayat lama tetap tersimpan |
| Template | Isi pesan pengingat, konfirmasi bukti, dan konfirmasi lunas. Bisa memakai `{orang_tua}`, `{nama_siswa}`, `{bulan}`, `{nominal}`, `{rekening}` |
| Mode uji WhatsApp | Isi nomor Anda agar selama uji coba bot hanya mengirim ke nomor itu. Kosongkan saat go-live |
| AI | API key Gemini/Groq (opsional) dan basis pengetahuan (tanya-jawab umum) |
| WhatsApp | Scan QR dari HP sekolah (WhatsApp → Perangkat tertaut) |

Data siswa diisi dari menu **Impor** (unggah Excel) atau **Siswa → + Tambah siswa**. Klik **Edit** pada baris siswa untuk mengubah data siswa dan orang tua, serta melihat riwayat tagihan dan percakapan WA-nya.

## 3. Tagihan bulanan

1. Setiap **tanggal 1 pukul 00.05**, agent membuat tagihan untuk semua siswa aktif. Nominal mengikuti tarif kelas yang berlaku bulan itu.
2. TU juga bisa membuatnya manual dengan tombol **Buat tagihan bulan ini** di Dashboard, atau **Generate tagihan** di Pembayaran. Proses ini aman diulang karena tidak menghasilkan tagihan ganda.
3. Status tagihan bergerak dari `belum`, ke `menunggu_verifikasi` (bukti sudah masuk), lalu ke `lunas`.

## 4. Pengingat otomatis

1. Agent mengecek setiap 10 menit, tetapi hanya mengirim bila semua syarat ini terpenuhi:
   - **tanggal pengingat** (default 1, 10, 17, 24, 31);
   - **pukul 07.00–09.00 WIB**;
   - **Senin–Sabtu**;
   - **bukan hari libur**.
2. Untuk setiap nomor WA orang tua yang masih punya tagihan `belum`, termasuk tunggakan bulan sebelumnya, agent menyusun **satu pesan**. Pesan itu menyebut semua anak dan semua bulan yang belum dibayar.
3. Setiap nomor paling banyak menerima satu pengingat per hari. Nomor yang sudah lama dikirimi pesan tetapi tidak pernah membalas dalam 90 hari dilewati.
4. Pesan dimasukkan ke antrean (`WaPesan`, status `antre`, sumber `pengingat`).

## 5. Antrean kirim (pengaman WhatsApp)

Agent memeriksa antrean setiap 5 detik dengan aturan berikut:

- **Urutan:** balasan TU didahulukan, lalu balasan bot/AI, lalu pengingat paling akhir.
- **Mode uji:** bila nomor uji diisi, hanya nomor itu yang dikirimi. Pesan untuk nomor lain tetap tertahan di antrean.
- **Jeda bot:** menahan pesan dari bot, AI, dan pengingat. Balasan TU tetap terkirim.
- **Batas kecepatan:** pengingat dikirim dengan jeda acak 20–40 detik, maksimal 50 pesan per jam. Balasan diberi efek "mengetik…" selama 2–5 detik.
- Setelah terkirim, status pesan menjadi `terkirim`. Bila gagal, menjadi `gagal`.

## 6. Orang tua membalas

```
Pesan masuk ─► nomor dikenal? ── tidak ─► simpan di Inbox (tanpa balasan)
                   │ ya
                   ▼
            TU baru membalas dari HP (< 10 menit)? ── ya ─► bot diam
                   │ tidak
                   ▼
   foto/PDF? ── ya ─► simpan bukti, tagihan → menunggu_verifikasi, balas "bukti diterima"
                   │ tidak
                   ▼
   kata kunci? (tagihan, rekening, riwayat, kwitansi, salam) ── ya ─► bot membalas
                   │ tidak
                   ▼
   AI (Gemini → Groq) yakin ≥ 70%? ── ya ─► AI membalas dari basis pengetahuan
                   │ tidak
                   ▼
   Inbox "Perlu dibalas" ─► TU membalas dari menu WhatsApp
```

- Semua pesan, baik masuk maupun keluar, tampil di menu **WhatsApp** (dikelompokkan per nomor) dan di halaman detail siswa.
- Jika TU membalas langsung dari HP sekolah, bot diam selama 10 menit di chat itu, dan antrean balasan bot untuk nomor itu dibatalkan.
- Jika orang tua punya lebih dari satu anak, bukti yang masuk perlu ditautkan dulu ke anak yang tepat di menu Pembayaran.

## 7. Verifikasi dan kwitansi

1. TU membuka **Pembayaran**. Tagihan berstatus "Verifikasi" menampilkan bukti transfer.
2. TU mencocokkan bukti dengan mutasi rekening bank, lalu memilih:
   - **Terima:** tagihan menjadi `lunas`. Aplikasi lalu:
     - membuat kwitansi bernomor `KWT/2026/11/0001`;
     - mencatat pemasukan di Kas;
     - mengantrekan pesan WA konfirmasi beserta PDF kwitansi ke orang tua.
   - **Tolak (isi alasan):** tagihan kembali `belum`, dan orang tua menerima pesan berisi alasan serta permintaan untuk mengirim bukti ulang.
3. Untuk pembayaran **tunai**: pilih tanggal, lalu klik **Tunai ✓**. Hasilnya sama dengan Terima: lunas, kwitansi, kas, dan WA.

## 8. Laporan dan kontrol

- **Dashboard:** jumlah siswa, yang sudah/belum bayar, saldo kas, status WA, dan daftar yang belum bayar.
- **Kas:** pemasukan dan pengeluaran lain. SPP masuk otomatis saat lunas.
- **Laporan:** rekap SPP per kelas, tunggakan, dan kas. Bisa diekspor ke Excel atau PDF.
- **Audit:** catatan siapa mengubah apa, misalnya tagihan, pembayaran, siswa, atau pengaturan.
- **Backup:** dibuat otomatis setiap pukul 02.00 dan disimpan 30 hari.

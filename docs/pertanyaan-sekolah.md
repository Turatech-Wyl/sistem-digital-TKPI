# Pertanyaan untuk Sekolah — Sistem Administrasi TK Permata Indonesia

Per 2 November 2026. Tiap pertanyaan dilengkapi **anggapan sementara**, yaitu hal yang dipakai aplikasi sekarang. Jika anggapan itu sudah benar, cukup jawab "OK".

Yang ditandai ⭐ **wajib dijawab sebelum aplikasi dipakai sungguhan**.

---

## 1. Data sekolah dan kwitansi

1. ⭐ Rekening penerima SPP: nama bank, nomor rekening, dan atas nama siapa?
   *Sementara: BCA 0000000000 a.n. TK Permata Indonesia.*
2. ⭐ Nama kepala sekolah yang dicetak di kwitansi. Perlu tanda tangan atau stempel hasil scan?
3. ⭐ Untuk kop kwitansi: logo sekolah (file PNG/JPG), alamat lengkap, dan nomor telepon.
4. Format nomor kwitansi `KWT/2026/11/0001`, yang nomornya mulai dari 0001 lagi tiap bulan. Sudah sesuai, atau sekolah punya format sendiri?

## 2. Tarif dan tagihan

5. ⭐ Besar SPP per bulan untuk KB, TK A, dan TK B.
   *Sementara: KB Rp 300.000, TK A Rp 350.000, TK B Rp 350.000.*
6. ⭐ Tanggal jatuh tempo SPP setiap bulan. *Sementara: tanggal 10.*
7. Apakah ada bulan yang tidak ditagih, misalnya libur semester atau Juli? Atau tagihan tetap 12 bulan?
8. Siswa yang masuk di tengah bulan: ditagih penuh, dimulai bulan berikutnya, atau dihitung sebagian?
9. Adakah keringanan, misalnya potongan untuk anak kedua, anak guru, atau keluarga kurang mampu? Siapa yang boleh menyetujuinya?
   *Rencana: TU bisa mengubah nominal satu tagihan dan wajib menulis alasannya. Fitur ini sedang dikerjakan.*
10. Adakah denda keterlambatan? *Sementara: tidak ada.*
11. Bolehkah orang tua mencicil, misalnya membayar setengah dulu? Atau tagihan hanya bisa lunas sekaligus?
   *Sementara: tidak ada cicilan, hanya lunas.*
12. Bolehkah orang tua membayar beberapa bulan sekaligus di muka?
13. Selain SPP, adakah biaya lain yang ingin ikut dicatat, seperti uang pangkal, seragam, kegiatan, atau buku? *Rencana awal: hanya SPP. Biaya lain masuk versi berikutnya.*

## 3. Pembayaran

14. Cara bayar yang dipakai orang tua: transfer, tunai di sekolah, atau keduanya? Apakah ada yang membayar lewat QRIS atau e-wallet?
15. Siapa yang mengecek bukti transfer dengan mutasi rekening: TU, bendahara, atau kepala sekolah? Apakah orang itu bisa membuka mutasi bank setiap hari?
16. Setelah lunas, orang tua otomatis menerima kwitansi PDF lewat WhatsApp, baik untuk pembayaran tunai maupun transfer. Apakah ini sesuai?
17. Jika satu transfer dipakai untuk dua anak sekaligus, apakah cukup satu bukti?

## 4. Pengingat WhatsApp

18. ⭐ Tanggal kirim pengingat. *Sementara: tanggal 1, 10, 17, 24, dan 31, pukul 07.00–09.00, Senin–Sabtu.*
    Apakah terlalu sering? Pilihan lain: hanya sebelum dan sesudah jatuh tempo.
19. Isi pesan pengingat sudah tersedia sebagai template dan bisa diubah. Mohon dicek bahasanya: sapaan "Assalamualaikum", penulisan "Bapak/Ibu", dan tanda tangan "Asisten TK".
20. Jika ayah dan ibu sama-sama punya nomor WA, pengingat dikirim ke siapa? Satu nomor utama saja, atau keduanya?
    *Sementara: hanya ke satu nomor utama.*
21. Pesan menyapa siapa? *Sementara: nama ibu, atau nama ayah jika nama ibu kosong.*
22. Mohon daftar hari libur sekolah tahun ajaran ini. Pada hari itu pengingat tidak dikirim.
23. Untuk tunggakan lebih dari satu bulan, apakah tetap cukup diingatkan lewat WA? Atau ada batas, misalnya setelah 3 bulan TU menghubungi orang tua langsung?

## 5. Nomor WhatsApp sekolah

24. ⭐ Nomor WA mana yang akan dipakai bot? Sebaiknya nomor khusus sekolah yang sudah aktif cukup lama, bukan nomor yang baru dibeli.
25. ⭐ HP untuk nomor itu harus tetap aktif dan terhubung internet, minimal sekali setiap 14 hari. Siapa yang memegang HP tersebut?
26. Apakah nomor ini juga dipakai untuk urusan lain, seperti grup kelas atau pengumuman? Bot tidak membaca grup. Namun TU perlu tahu bahwa bot akan diam 10 menit setiap kali TU membalas langsung dari HP.
27. **Risiko yang perlu disetujui:** aplikasi memakai koneksi WhatsApp tidak resmi (gratis). Ada kemungkinan kecil nomor diblokir WhatsApp. Kami sudah menambahkan pengaman berupa jeda, batas jumlah pesan, dan mode uji. Apakah sekolah menerima risiko ini? Opsi resmi (WhatsApp Business API) berbayar per pesan.

## 6. Bot dan AI

28. Pertanyaan apa yang paling sering diajukan orang tua lewat WA? Contohnya jam sekolah, jadwal libur, biaya pendaftaran, atau seragam. Jawaban-jawaban ini akan menjadi basis pengetahuan bot.
29. ⭐ Apakah boleh memakai AI (Google Gemini atau Groq, paket gratis) untuk memahami pesan orang tua? Yang dikirim ke AI hanya isi pesan dan nama depan. Jika ya, akun AI dibuat atas nama siapa? Jika tidak, bot hanya membalas kata kunci dan pesan lain diteruskan ke TU.
30. Pesan yang tidak bisa dijawab bot diteruskan ke inbox TU. Berapa lama orang tua wajar menunggu balasan TU? Perlukah bot mengirim pesan seperti "akan dibalas TU pada jam kerja"?

## 7. Pengguna dan akses

31. Siapa saja yang memakai aplikasi, dan apa hak aksesnya? *Sementara: TU sebagai admin (bisa mengubah data), kepala sekolah sebagai viewer (hanya melihat).*
32. Apakah bendahara atau yayasan juga perlu akun? Apakah guru perlu akses?
33. Alamat email untuk setiap akun.

## 8. Data siswa (impor awal)

34. ⭐ Mohon kirim file Excel data siswa yang dipakai TU sekarang, beserta data orang tua. Datanya boleh disamarkan, yang kami perlukan format kolomnya.
35. Apakah sekolah sudah punya NIS sendiri? Jika ya, kami pakai NIS itu. Jika belum, aplikasi membuatkannya.
36. Saat kenaikan kelas di bulan Juli, apakah TU memindahkan siswa secara manual? Bagaimana dengan siswa TK B yang lulus?

## 9. Buku kas dan laporan

37. Kategori pemasukan dan pengeluaran yang dipakai sekarang, misalnya gaji guru, listrik, ATK, atau kegiatan.
38. Laporan apa yang biasanya diminta kepala sekolah atau yayasan, dan seberapa sering (bulanan, per semester)? Jika ada contoh laporan lama, mohon dikirim.
39. Saldo kas awal per tanggal mulai pemakaian aplikasi.

## 10. Server, domain, dan backup

40. Alamat web yang diinginkan, misalnya `admin.tkpermata.sch.id`. Siapa yang mengelola domain sekolah? *Sementara: `tk.willieputra.dev`.*
41. Server dibayar dan dimiliki siapa: sekolah, atau tetap di server pengembang?
42. Backup harian disimpan ke mana, di luar server? Pilihannya Google Drive sekolah, flashdisk mingguan, atau layanan lain.
43. Siapa yang dihubungi jika aplikasi atau WA bermasalah? Pada jam berapa saja?

## 11. Uji coba

44. Kapan target mulai dipakai? Usul kami: mulai siklus SPP Desember 2026.
45. Untuk uji coba, pengingat dikirim dulu ke nomor pengembang, lalu ke 5 keluarga, baru ke semua keluarga. Bisakah sekolah memilih 5 keluarga yang bersedia menjadi peserta uji?
46. Perlukah orang tua diberi tahu lebih dulu, misalnya lewat surat atau grup kelas, bahwa nomor sekolah akan mengirim pengingat otomatis?

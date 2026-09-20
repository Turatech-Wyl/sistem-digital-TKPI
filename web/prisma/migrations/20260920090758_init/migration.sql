-- CreateTable
CREATE TABLE "Kelas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "urutan" INTEGER NOT NULL DEFAULT 0,
    "dibuat_oleh" TEXT DEFAULT 'seed',
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Tarif" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kelas_id" INTEGER NOT NULL,
    "nominal" INTEGER NOT NULL,
    "berlaku_sejak" TEXT NOT NULL,
    "dibuat_oleh" TEXT DEFAULT 'seed',
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" DATETIME NOT NULL,
    CONSTRAINT "Tarif_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "Kelas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Siswa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nis" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "tgl_lahir" TEXT,
    "jk" TEXT,
    "kelas_id" INTEGER NOT NULL,
    "tgl_masuk" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "catatan" TEXT,
    "dibuat_oleh" TEXT DEFAULT 'seed',
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" DATETIME NOT NULL,
    CONSTRAINT "Siswa_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "Kelas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrangTua" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama_ayah" TEXT,
    "nama_ibu" TEXT,
    "wa_utama" TEXT NOT NULL,
    "wa_kedua" TEXT,
    "alamat" TEXT,
    "dibuat_oleh" TEXT DEFAULT 'seed',
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiswaOrangTua" (
    "siswa_id" INTEGER NOT NULL,
    "orang_tua_id" INTEGER NOT NULL,

    PRIMARY KEY ("siswa_id", "orang_tua_id"),
    CONSTRAINT "SiswaOrangTua_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "Siswa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiswaOrangTua_orang_tua_id_fkey" FOREIGN KEY ("orang_tua_id") REFERENCES "OrangTua" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tagihan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siswa_id" INTEGER NOT NULL,
    "periode" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "jatuh_tempo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'belum',
    "alasan_ubah" TEXT,
    "dibuat_oleh" TEXT DEFAULT 'seed',
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" DATETIME NOT NULL,
    CONSTRAINT "Tagihan_siswa_id_fkey" FOREIGN KEY ("siswa_id") REFERENCES "Siswa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pembayaran" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tagihan_id" INTEGER NOT NULL,
    "tgl_bayar" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "metode" TEXT NOT NULL DEFAULT 'tunai',
    "bukti_file" TEXT,
    "status_verifikasi" TEXT NOT NULL DEFAULT 'lunas',
    "alasan_tolak" TEXT,
    "no_kwitansi" TEXT NOT NULL,
    "diverifikasi_oleh" TEXT,
    "dibuat_oleh" TEXT DEFAULT 'seed',
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" DATETIME NOT NULL,
    CONSTRAINT "Pembayaran_tagihan_id_fkey" FOREIGN KEY ("tagihan_id") REFERENCES "Tagihan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KasKategori" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "jenis" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Kas" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tgl" TEXT NOT NULL,
    "jenis" TEXT NOT NULL,
    "kategori_id" INTEGER NOT NULL,
    "keterangan" TEXT NOT NULL,
    "nominal" INTEGER NOT NULL,
    "lampiran" TEXT,
    "pembayaran_id" INTEGER,
    "dibuat_oleh" TEXT DEFAULT 'seed',
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diubah_pada" DATETIME NOT NULL,
    CONSTRAINT "Kas_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "KasKategori" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Kas_pembayaran_id_fkey" FOREIGN KEY ("pembayaran_id") REFERENCES "Pembayaran" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaPesan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "arah" TEXT NOT NULL,
    "nomor" TEXT NOT NULL,
    "orang_tua_id" INTEGER,
    "isi" TEXT NOT NULL,
    "media_file" TEXT,
    "wa_msg_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'antre',
    "sumber" TEXT,
    "niat" TEXT,
    "dibaca_tu" BOOLEAN NOT NULL DEFAULT false,
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaPesan_orang_tua_id_fkey" FOREIGN KEY ("orang_tua_id") REFERENCES "OrangTua" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaJadwal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jenis" TEXT NOT NULL,
    "aturan" TEXT,
    "jam_mulai" TEXT,
    "jam_selesai" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Pengetahuan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pertanyaan" TEXT NOT NULL,
    "jawaban" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Pengguna" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "peran" TEXT NOT NULL DEFAULT 'admin',
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "dibuat_pada" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Pengaturan" (
    "kunci" TEXT NOT NULL PRIMARY KEY,
    "nilai" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pengguna_id" INTEGER,
    "tabel" TEXT NOT NULL,
    "baris_id" TEXT,
    "aksi" TEXT NOT NULL,
    "sebelum" TEXT,
    "sesudah" TEXT,
    "waktu" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Kelas_nama_key" ON "Kelas"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Siswa_nis_key" ON "Siswa"("nis");

-- CreateIndex
CREATE UNIQUE INDEX "Tagihan_siswa_id_periode_key" ON "Tagihan"("siswa_id", "periode");

-- CreateIndex
CREATE UNIQUE INDEX "Pembayaran_no_kwitansi_key" ON "Pembayaran"("no_kwitansi");

-- CreateIndex
CREATE UNIQUE INDEX "KasKategori_nama_key" ON "KasKategori"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "Pengguna_email_key" ON "Pengguna"("email");

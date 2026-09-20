import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash(process.env.SEED_PASSWORD || "tk-admin-123", 10);
  await db.pengguna.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@tk.local" },
    update: { password_hash: pw, peran: "admin", nama: "TU Sekolah", aktif: true },
    create: { email: process.env.ADMIN_EMAIL || "admin@tk.local", nama: "TU Sekolah", password_hash: pw, peran: "admin" },
  });
  await db.pengguna.upsert({
    where: { email: process.env.VIEWER_EMAIL || "viewer@tk.local" },
    update: { password_hash: pw, peran: "viewer", nama: "Kepala Sekolah", aktif: true },
    create: { email: process.env.VIEWER_EMAIL || "viewer@tk.local", nama: "Kepala Sekolah", password_hash: pw, peran: "viewer" },
  });

  const kb = await db.kelas.upsert({ where: { nama: "KB" }, update: {}, create: { nama: "KB", urutan: 1 } });
  const tka = await db.kelas.upsert({ where: { nama: "TK A" }, update: {}, create: { nama: "TK A", urutan: 2 } });
  const tkb = await db.kelas.upsert({ where: { nama: "TK B" }, update: {}, create: { nama: "TK B", urutan: 3 } });

  const tarifKB = Number(process.env.TARIF_KB || 300000);
  const tarifA = Number(process.env.TARIF_TKA || 350000);
  const tarifB = Number(process.env.TARIF_TKB || 350000);
  for (const [k, nom] of [[kb, tarifKB], [tka, tarifA], [tkb, tarifB]] as const) {
    const ada = await db.tarif.findFirst({ where: { kelas_id: k.id } });
    if (!ada) await db.tarif.create({ data: { kelas_id: k.id, nominal: nom, berlaku_sejak: "2026-07" } });
  }

  // Kategori kas awal (PRD §5.5)
  for (const [nama, jenis] of [["SPP", "masuk"], ["Pendaftaran", "masuk"], ["Gaji guru dan staf", "keluar"], ["Operasional", "keluar"]] as const) {
    await db.kasKategori.upsert({ where: { nama }, update: {}, create: { nama, jenis } });
  }

  // Pengaturan placeholder (PRD §13)
  const set = async (kunci: string, nilai: string) =>
    db.pengaturan.upsert({ where: { kunci }, update: { nilai }, create: { kunci, nilai } });
  await set("sekolah_nama", process.env.SEKOLAH_NAMA || "TK Permata Indonesia");
  await set("sekolah_alamat", process.env.SEKOLAH_ALAMAT || "Jl. Placeholder No. 1");
  await set("rekening_bank", process.env.REKENING_BANK || "BCA");
  await set("rekening_nomor", process.env.REKENING_NOMOR || "0000000000");
  await set("rekening_nama", process.env.REKENING_NAMA || "TK Permata Indonesia");
  await set("jatuh_tempo_tgl", process.env.JATUH_TEMPO_TGL || "10");
  await set("wa_sekolah", process.env.WA_SEKOLAH || "62812xxxxxxx");
  await set("tpl_pengingat", "Assalamualaikum Bapak/Ibu {orang_tua}, SPP {nama_siswa} bulan {bulan} sebesar {nominal} belum kami terima. Pembayaran ke {rekening}. Terima kasih 🙏 — Asisten TK");
  await set("tpl_lunas", "Alhamdulillah, pembayaran SPP {nama_siswa} bulan {bulan} sebesar {nominal} sudah kami terima. Kwitansi terlampir. Terima kasih 🙏 — Asisten TK");

  // 10 ortu, 12 siswa (2 ortu punya 2 anak)
  const ortuData = [
    { ayah: "Hendra", ibu: "Dewi", wa: "6281234567890" },
    { ayah: "Yusuf", ibu: "Maya", wa: "6281398765432" },
    { ayah: "Budi", ibu: "Sari", wa: "6285711223344" },
    { ayah: "Agus", ibu: "Fitri", wa: "6282155667788" },
    { ayah: "Rudi", ibu: "Lina", wa: "6287899001122" },
    { ayah: "Joko", ibu: "Rina", wa: "6281222334455" },
    { ayah: "Andi", ibu: "Nina", wa: "6281333445566" },
    { ayah: "Dedi", ibu: "Wulan", wa: "6281444556677" },
    // 2 ortu dengan 2 anak:
    { ayah: "Fajar", ibu: "Putri", wa: "6281555667788" },
    { ayah: "Rizky", ibu: "Anisa", wa: "6281666778899" },
  ];
  const siswaData: { nama: string; jk: string; kelas: number; ortu: number; lahir: string }[] = [
    { nama: "Bima Aditya", jk: "L", kelas: 0, ortu: 0, lahir: "2020-03-12" }, // idx kelas: 0=KB,1=TKA,2=TKB -> pakai array di bawah
    { nama: "Aisyah Putri", jk: "P", kelas: 2, ortu: 1, lahir: "2019-06-01" },
    { nama: "Chelsea Anindya", jk: "P", kelas: 2, ortu: 2, lahir: "2019-08-20" },
    { nama: "Dafa Alfarizi", jk: "L", kelas: 0, ortu: 3, lahir: "2021-01-15" },
    { nama: "Elena Safitri", jk: "P", kelas: 1, ortu: 4, lahir: "2020-11-02" },
    { nama: "Fahri Ramadhan", jk: "L", kelas: 2, ortu: 5, lahir: "2019-04-25" },
    { nama: "Gibran Maulana", jk: "L", kelas: 1, ortu: 6, lahir: "2020-07-07" },
    { nama: "Hana Kirana", jk: "P", kelas: 0, ortu: 7, lahir: "2021-05-30" },
    { nama: "Ilham Saputra", jk: "L", kelas: 1, ortu: 8, lahir: "2020-02-14" },
    { nama: "Kirana Ayu", jk: "P", kelas: 0, ortu: 8, lahir: "2021-09-09" },
    { nama: "Lukman Hakim", jk: "L", kelas: 2, ortu: 9, lahir: "2019-12-12" },
    { nama: "Nadia Zahra", jk: "P", kelas: 1, ortu: 9, lahir: "2020-09-21" },
  ];
  const kelasArr = [kb, tka, tkb];
  // urutan kelas di atas: 0=KB? data campur — petakan eksplisit:
  const kelasMap = [tka, tkb, tkb, kb, tka, tkb, tka, kb, tka, kb, tkb, tka];

  const ortuIds: number[] = [];
  for (const o of ortuData) {
    const ex = await db.orangTua.findFirst({ where: { wa_utama: o.wa } });
    if (ex) { ortuIds.push(ex.id); continue; }
    const r = await db.orangTua.create({ data: { nama_ayah: o.ayah, nama_ibu: o.ibu, wa_utama: o.wa } });
    ortuIds.push(r.id);
  }
  for (let i = 0; i < siswaData.length; i++) {
    const s = siswaData[i];
    const nis = `2026${String(i + 1).padStart(3, "0")}`;
    const ex = await db.siswa.findUnique({ where: { nis } });
    let sid: number;
    if (ex) sid = ex.id;
    else {
      const r = await db.siswa.create({
        data: { nis, nama: s.nama, jk: s.jk, kelas_id: kelasMap[i].id, tgl_lahir: s.lahir, tgl_masuk: "2026-07-01", status: "aktif" },
      });
      sid = r.id;
    }
    const oid = ortuIds[s.ortu];
    const link = await db.siswaOrangTua.findUnique({ where: { siswa_id_orang_tua_id: { siswa_id: sid, orang_tua_id: oid } } });
    if (!link) await db.siswaOrangTua.create({ data: { siswa_id: sid, orang_tua_id: oid } });
  }

  // Tagihan 3 bulan terakhir campuran lunas/belum/menunggu
  const tarifOf = async (kelas_id: number) => {
    const t = await db.tarif.findFirst({ where: { kelas_id }, orderBy: { berlaku_sejak: "desc" } });
    return t?.nominal || 350000;
  };
  const semua = await db.siswa.findMany();
  const periode = ["2026-07", "2026-08", "2026-09"];
  let no = 1;
  for (const p of periode) {
    for (let i = 0; i < semua.length; i++) {
      const s = semua[i];
      const nom = await tarifOf(s.kelas_id);
      const jatuh = `${p}-10`;
      const ex = await db.tagihan.findUnique({ where: { siswa_id_periode: { siswa_id: s.id, periode: p } } });
      let tag = ex;
      if (!tag) tag = await db.tagihan.create({ data: { siswa_id: s.id, periode: p, nominal: nom, jatuh_tempo: jatuh, status: "belum" } });
      // pola: i%4==0 belum, i%4==3 menunggu_verifikasi (sep saja), lainnya lunas
      if (i % 4 === 0) {
        await db.tagihan.update({ where: { id: tag.id }, data: { status: "belum" } });
      } else if (p === "2026-09" && i % 4 === 3) {
        await db.tagihan.update({ where: { id: tag.id }, data: { status: "menunggu_verifikasi" } });
      } else {
        await db.tagihan.update({ where: { id: tag.id }, data: { status: "lunas" } });
        const adaBayar = await db.pembayaran.findFirst({ where: { tagihan_id: tag.id } });
        if (!adaBayar) {
          const kw = `KWT/2026/${p.replace("-", "")}/${String(no++).padStart(4, "0")}`;
          const byr = await db.pembayaran.create({
            data: { tagihan_id: tag.id, tgl_bayar: `${p}-05`, nominal: nom, metode: i % 2 ? "transfer" : "tunai", no_kwitansi: kw, status_verifikasi: "lunas", diverifikasi_oleh: "TU Sekolah" },
          });
          const kat = await db.kasKategori.findUnique({ where: { nama: "SPP" } });
          if (kat) await db.kas.create({ data: { tgl: `${p}-05`, jenis: "masuk", kategori_id: kat.id, keterangan: `SPP ${s.nama} ${p}`, nominal: nom, pembayaran_id: byr.id } });
        }
      }
    }
  }

  // 8 transaksi kas contoh tambahan + 6 pesan WA contoh
  const katKeluar = await db.kasKategori.findUnique({ where: { nama: "Operasional" } });
  const katGaji = await db.kasKategori.findUnique({ where: { nama: "Gaji guru dan staf" } });
  if (katKeluar && katGaji) {
    const tambahan = [
      { tgl: "2026-09-01", kategori_id: katGaji.id, jenis: "keluar", keterangan: "Gaji guru & staf", nominal: 9600000 },
      { tgl: "2026-09-03", kategori_id: katKeluar.id, jenis: "keluar", keterangan: "ATK & alat peraga", nominal: 625000 },
      { tgl: "2026-09-06", kategori_id: katKeluar.id, jenis: "keluar", keterangan: "Listrik & air", nominal: 840000 },
    ] as const;
    for (const t of tambahan) {
      const ada = await db.kas.findFirst({ where: { tgl: t.tgl, keterangan: t.keterangan } });
      if (!ada) await db.kas.create({ data: { ...t } });
    }
  }
  const contohWA = [
    { arah: "keluar", nomor: "6281234567890", isi: "Assalamualaikum Bapak Hendra, SPP Bima Aditya bulan September 2026 sebesar Rp 350.000 belum kami terima. Terima kasih 🙏 — Asisten TK", status: "dibaca", sumber: "pengingat" },
    { arah: "masuk", nomor: "6281234567890", isi: "Baik bu, siang ini saya transfer", status: "dibaca", sumber: "tu" },
    { arah: "keluar", nomor: "6287899001122", isi: "Assalamualaikum Bapak Rudi, SPP Elena Safitri bulan September 2026 sebesar Rp 350.000 belum kami terima. Terima kasih 🙏 — Asisten TK", status: "terkirim", sumber: "pengingat" },
    { arah: "masuk", nomor: "6281398765432", isi: "spp bulan ini berapa ya bu?", status: "dibaca", sumber: "tu" },
    { arah: "masuk", nomor: "6281398765432", isi: "[foto bukti transfer]", status: "dibaca", sumber: "tu" },
    { arah: "keluar", nomor: "6281398765432", isi: "Terima kasih, bukti pembayaran sudah kami terima dan akan diverifikasi maksimal 1×24 jam. — Asisten TK", status: "terkirim", sumber: "bot" },
  ] as const;
  for (const w of contohWA) {
    const ada = await db.waPesan.findFirst({ where: { nomor: w.nomor, isi: w.isi } });
    if (!ada) await db.waPesan.create({ data: { ...w } });
  }

  console.log("Seed OK: 3 kelas, 12 siswa, 10 ortu, tagihan 3 bulan, kas, WA contoh.");
}

main().finally(() => db.$disconnect());

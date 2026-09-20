import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { db, getPengaturan, DATA_DIR } from "./db.js";
import { namaBulan, rupiah } from "./reminder.js";

export type Niat = "tagihan" | "rekening" | "riwayat" | "kwitansi" | "sapa" | null;
const TTD = "\n— Asisten TK";

const KATA: [Niat, RegExp][] = [
  ["tagihan", /(tagihan|berapa|spp|belum bayar|bulan ini|tunggakan|kurang)/i],
  ["rekening", /(rekening|transfer ke|nomor rek|bank|bayar ke|norek)/i],
  ["riwayat", /(sudah bayar|riwayat|bulan lalu|lunas|histori)/i],
  ["kwitansi", /(kwitansi|bukti lunas|struk)/i],
  ["sapa", /^(assalamualaikum|assalamu'alaikum|halo|hallo|hai|pagi|siang|sore|malam|permisi)/i],
];

export function cocokNiat(teks: string): Niat {
  const t = teks.trim().toLowerCase();
  if (t.length > 200) return null;
  for (const [niat, re] of KATA) {
    if (re.test(t)) {
      // "sapa" hanya bila pesan pendek; kalau ada kata tagihan dsb, niat lain menang
      if (niat === "sapa" && t.length > 30 && /(tagihan|berapa|spp|rekening|bayar|kwitansi|riwayat|lunas)/.test(t)) continue;
      return niat;
    }
  }
  return null;
}

type Anak = { id: number; nama: string; kelas: string; ortu: string };

export function anakDariNomor(nomor: string): Anak[] {
  return db.prepare(`
    SELECT s.id, s.nama, k.nama AS kelas, COALESCE(o.nama_ayah, o.nama_ibu, '') AS ortu
    FROM OrangTua o JOIN SiswaOrangTua so ON so.orang_tua_id = o.id
    JOIN Siswa s ON s.id = so.siswa_id JOIN Kelas k ON k.id = s.kelas_id
    WHERE (o.wa_utama = ? OR o.wa_kedua = ?) AND s.status = 'aktif'
  `).all(nomor, nomor) as Anak[];
}

function sapaan(anak: Anak[]): string {
  const o = anak[0]?.ortu || "Bapak/Ibu";
  const gelar = /^[A-Z]/.test(o) ? o : o; // nama apa adanya
  return `Bapak/Ibu ${gelar}`;
}

function antreBalasan(nomor: string, isi: string, sumber = "bot") {
  db.prepare("INSERT INTO WaPesan (arah, nomor, isi, status, sumber) VALUES ('keluar', ?, ?, 'antre', ?)").run(nomor, isi + TTD, sumber);
  db.prepare("UPDATE WaPesan SET dibaca_tu = 1 WHERE nomor = ? AND arah = 'masuk'").run(nomor);
}

/** Balasan dari lapisan AI (sumber 'ai' agar bisa dibedakan di log). */
export function balasAI(nomor: string, jawaban: string) {
  antreBalasan(nomor, jawaban, "ai");
}

function rekeningTeks(): string {
  return `${getPengaturan("rekening_bank", "BCA")} ${getPengaturan("rekening_nomor", "")} a.n. ${getPengaturan("rekening_nama", "")}`;
}

/** Cek ada balasan manual TU <10 mnt? Kalau ya, bot diam (PRD §6.2). */
function tuBaruAktif(nomor: string): boolean {
  const batas = new Date(Date.now() - 10 * 60_000).toISOString().replace("T", " ").slice(0, 19);
  const r = db.prepare("SELECT COUNT(*) c FROM WaPesan WHERE arah='keluar' AND sumber='tu' AND nomor=? AND dibuat_pada > ?").get(nomor, batas) as { c: number };
  return r.c > 0;
}

export function tanganiNiat(nomor: string, niat: Exclude<Niat, null>, anak: Anak[]): boolean {
  if (tuBaruAktif(nomor)) { console.log(`Bot diam untuk ${nomor} (TU baru aktif <10 mnt)`); return false; }
  const sapa = sapaan(anak);
  if (niat === "sapa") {
    antreBalasan(nomor, `Waalaikumsalam ${sapa}. Ada yang bisa kami bantu? Ketik *tagihan* untuk cek SPP, *rekening* untuk nomor transfer, atau *riwayat* untuk pembayaran terakhir. Terima kasih 🙏`);
    return true;
  }
  if (niat === "rekening") {
    antreBalasan(nomor, `${sapa}, pembayaran ke ${rekeningTeks()}. Setelah transfer, mohon kirim fotonya ke sini. Terima kasih 🙏`);
    return true;
  }
  if (niat === "tagihan") {
    const rows = db.prepare(`
      SELECT t.periode, t.nominal, s.nama FROM Tagihan t JOIN Siswa s ON s.id = t.siswa_id
      WHERE s.id IN (${anak.map(() => "?").join(",")}) AND t.status = 'belum' ORDER BY t.periode ASC
    `).all(...anak.map((a) => a.id)) as { periode: string; nominal: number; nama: string }[];
    if (!rows.length) {
      antreBalasan(nomor, `Alhamdulillah ${sapa}, tidak ada tagihan yang belum lunas. Terima kasih 🙏`);
    } else {
      const total = rows.reduce((a, r) => a + r.nominal, 0);
      const rincian = rows.map((r) => `• ${r.nama} ${namaBulan(r.periode)}: ${rupiah(r.nominal)}`).join("\n");
      antreBalasan(nomor, `${sapa}, tagihan yang belum lunas:\n${rincian}\nTotal ${rupiah(total)}. Pembayaran ke ${rekeningTeks()}. Setelah transfer, mohon kirim fotonya ke sini. Terima kasih 🙏`);
    }
    return true;
  }
  if (niat === "riwayat") {
    const rows = db.prepare(`
      SELECT p.tgl_bayar, p.nominal, s.nama FROM Pembayaran p
      JOIN Tagihan t ON t.id = p.tagihan_id JOIN Siswa s ON s.id = t.siswa_id
      WHERE s.id IN (${anak.map(() => "?").join(",")}) AND p.status_verifikasi = 'lunas'
      ORDER BY p.tgl_bayar DESC LIMIT 3
    `).all(...anak.map((a) => a.id)) as { tgl_bayar: string; nominal: number; nama: string }[];
    if (!rows.length) antreBalasan(nomor, `${sapa}, belum ada riwayat pembayaran tercatat. Terima kasih 🙏`);
    else antreBalasan(nomor, `${sapa}, 3 pembayaran terakhir:\n${rows.map((r) => `• ${r.nama} ${r.tgl_bayar}: ${rupiah(r.nominal)}`).join("\n")} Terima kasih 🙏`);
    return true;
  }
  if (niat === "kwitansi") {
    const r = db.prepare(`
      SELECT p.id FROM Pembayaran p JOIN Tagihan t ON t.id = p.tagihan_id JOIN Siswa s ON s.id = t.siswa_id
      WHERE s.id IN (${anak.map(() => "?").join(",")}) AND p.status_verifikasi = 'lunas'
      ORDER BY p.tgl_bayar DESC LIMIT 1
    `).get(...anak.map((a) => a.id)) as { id: number } | undefined;
    if (!r) {
      antreBalasan(nomor, `${sapa}, belum ada kwitansi lunas. Terima kasih 🙏`);
      return true;
    }
    const media = unduhKwitansi(r.id);
    db.prepare("INSERT INTO WaPesan (arah, nomor, isi, media_file, status, sumber) VALUES ('keluar', ?, ?, ?, 'antre', 'bot')")
      .run(nomor, `Kwitansi pembayaran terakhir terlampir. Terima kasih 🙏${TTD}`, media);
    db.prepare("UPDATE WaPesan SET dibaca_tu = 1 WHERE nomor = ? AND arah = 'masuk'").run(nomor);
    return true;
  }
  return false;
}

/** Unduh PDF kwitansi dari web (token internal) ke data/media. */
function unduhKwitansi(pembayaranId: number): string | null {
  try {
    const base = (process.env.WEB_URL || "http://localhost:3001").replace(/\/$/, "");
    const token = process.env.AGENT_TOKEN || "";
    const url = `${base}/api/kwitansi/${pembayaranId}?token=${encodeURIComponent(token)}`;
    // fetch sinkron via curl (Node 22 punya fetch global tapi fungsi ini sinkron; gunakan child_process)
    const fp = path.join(DATA_DIR, "media", `kwitansi-${pembayaranId}.pdf`);
    execFileSync("curl", ["-sf", "-o", fp, url]);
    return fp;
  } catch (e) {
    console.log("Unduh kwitansi gagal:", (e as Error).message);
    return null;
  }
}

/** Bukti transfer masuk: tautkan otomatis bila 1 anak, else antre TU (PRD §5.4). */
export function tanganiBukti(nomor: string, fileMedia: string | null): boolean {
  const anak = anakDariNomor(nomor);
  const tpl = getPengaturan("tpl_bukti", "Terima kasih, bukti pembayaran sudah kami terima dan akan diverifikasi maksimal 1×24 jam.");
  if (tuBaruAktif(nomor)) return false;
  if (anak.length === 1) {
    const tag = db.prepare("SELECT id, periode FROM Tagihan WHERE siswa_id = ? AND status = 'belum' ORDER BY periode ASC LIMIT 1").get(anak[0].id) as { id: number; periode: string } | undefined;
    if (tag) {
      db.prepare("UPDATE Tagihan SET status = 'menunggu_verifikasi' WHERE id = ?").run(tag.id);
      console.log(`Bukti ${nomor} → tagihan ${tag.id} menunggu_verifikasi`);
    }
  } else {
    console.log(`Bukti ${nomor} tak tertaut (${anak.length} anak) — TU memilih di web`);
  }
  antreBalasan(nomor, `${tpl}`);
  return true;
}

/** Alur utama pesan teks masuk. Return true bila dijawab bot. */
export function tanganiTeks(nomor: string, teks: string): boolean {
  const anak = anakDariNomor(nomor);
  if (!anak.length) return false; // nomor tak dikenal → inbox, tanpa balasan (PRD §6.4)
  const niat = cocokNiat(teks);
  if (!niat) return false; // → lapisan AI / inbox
  return tanganiNiat(nomor, niat, anak);
}

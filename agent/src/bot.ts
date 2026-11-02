import fs from "fs";
import path from "path";
import { db, getPengaturan, DATA_DIR, kini, msLalu } from "./db.js";
import { namaBulan, rupiah } from "./reminder.js";
import { tanyaAI, niatAIkeBot, AMBANG_YAKIN } from "./ai.js";

export type Niat = "tagihan" | "rekening" | "riwayat" | "kwitansi" | "sapa" | null;
const TTD = "\n— Asisten TK";

const KATA: [Niat, RegExp][] = [
  // Kata umum ("berapa", "bulan ini", "kurang") hanya dihitung bila bersama kata pembayaran;
  // selain itu biarkan AI yang menilai (mis. "masuk jam berapa?" → basis pengetahuan).
  ["tagihan", /(tagihan|spp|belum bayar|tunggakan|berapa.*(bayar|biaya|uang|iuran)|(bayar|biaya|uang|iuran).*berapa)/i],
  ["rekening", /(rekening|transfer ke|no(mor)?\.? ?rek|bank|bayar ke)/i],
  ["riwayat", /(sudah bayar|riwayat|lunas|histori)/i],
  ["kwitansi", /(kwitansi|bukti lunas|struk)/i],
  ["sapa", /^(assalamu'?alaikum|asw|halo|hallo|hai|pagi|siang|sore|malam|permisi)/i],
];

const SALAM = /assalamu'?alaikum|^asw\b/i;

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

export type Anak = { id: number; nama: string; kelas: string; ortu: string };

export function anakDariNomor(nomor: string): Anak[] {
  return db.prepare(`
    SELECT s.id, s.nama, k.nama AS kelas, COALESCE(NULLIF(o.nama_ibu, '-'), o.nama_ayah, '') AS ortu
    FROM OrangTua o JOIN SiswaOrangTua so ON so.orang_tua_id = o.id
    JOIN Siswa s ON s.id = so.siswa_id JOIN Kelas k ON k.id = s.kelas_id
    WHERE (o.wa_utama = ? OR o.wa_kedua = ?) AND s.status = 'aktif'
  `).all(nomor, nomor) as Anak[];
}

const sapaan = (anak: Anak[]) => {
  const nama = anak[0]?.ortu.trim();
  return nama && nama !== "-" ? `Bapak/Ibu ${nama}` : "Bapak/Ibu";
};

const idAnak = (anak: Anak[]) => ({ tanda: anak.map(() => "?").join(","), id: anak.map((a) => a.id) });

function antreBalasan(nomor: string, isi: string, sumber = "bot", media: string | null = null) {
  db.prepare("INSERT INTO WaPesan (arah, nomor, isi, media_file, status, sumber, dibuat_pada) VALUES ('keluar', ?, ?, ?, 'antre', ?, ?)")
    .run(nomor, isi + TTD, media, sumber, kini());
  db.prepare("UPDATE WaPesan SET dibaca_tu = 1 WHERE nomor = ? AND arah = 'masuk'").run(nomor);
}

/** Balasan dari lapisan AI (sumber 'ai' agar bisa dibedakan di log). */
export function balasAI(nomor: string, jawaban: string) {
  if (tuBaruAktif(nomor)) return;
  antreBalasan(nomor, jawaban, "ai");
}

function rekeningTeks(): string {
  return `${getPengaturan("rekening_bank", "BCA")} ${getPengaturan("rekening_nomor", "")} a.n. ${getPengaturan("rekening_nama", "")}`;
}

/** Ada balasan TU (HP atau dashboard) <10 mnt? Kalau ya, bot diam (PRD §6.2). */
function tuBaruAktif(nomor: string): boolean {
  const r = db.prepare("SELECT 1 FROM WaPesan WHERE arah='keluar' AND sumber='tu' AND nomor=? AND dibuat_pada > ? LIMIT 1").get(nomor, msLalu(10 * 60_000));
  return !!r;
}

export async function tanganiNiat(nomor: string, niat: Exclude<Niat, null>, anak: Anak[], teks = ""): Promise<boolean> {
  if (tuBaruAktif(nomor)) { console.log(`Bot diam untuk ${nomor} (TU baru aktif <10 mnt)`); return false; }
  const sapa = sapaan(anak);
  const { tanda, id } = idAnak(anak);
  if (niat === "sapa") {
    const salam = SALAM.test(teks) ? `Waalaikumsalam ${sapa}.` : `Halo ${sapa}.`;
    antreBalasan(nomor, `${salam} Ada yang bisa kami bantu? Ketik *tagihan* untuk cek SPP, *rekening* untuk nomor transfer, atau *riwayat* untuk pembayaran terakhir. Terima kasih 🙏`);
    return true;
  }
  if (niat === "rekening") {
    antreBalasan(nomor, `${sapa}, pembayaran ke ${rekeningTeks()}. Setelah transfer, mohon kirim fotonya ke sini. Terima kasih 🙏`);
    return true;
  }
  if (niat === "tagihan") {
    const rows = db.prepare(`
      SELECT t.periode, t.nominal, s.nama FROM Tagihan t JOIN Siswa s ON s.id = t.siswa_id
      WHERE s.id IN (${tanda}) AND t.status = 'belum' ORDER BY t.periode ASC
    `).all(...id) as { periode: string; nominal: number; nama: string }[];
    const menunggu = (db.prepare(`SELECT COUNT(*) c FROM Tagihan WHERE siswa_id IN (${tanda}) AND status = 'menunggu_verifikasi'`).get(...id) as { c: number }).c;
    const catatan = menunggu ? `\n(${menunggu} pembayaran sedang diverifikasi TU.)` : "";
    if (!rows.length) {
      antreBalasan(nomor, `Alhamdulillah ${sapa}, tidak ada tagihan yang belum dibayar.${catatan} Terima kasih 🙏`);
    } else {
      const total = rows.reduce((a, r) => a + r.nominal, 0);
      const rincian = rows.map((r) => `• ${r.nama} ${namaBulan(r.periode)}: ${rupiah(r.nominal)}`).join("\n");
      antreBalasan(nomor, `${sapa}, tagihan yang belum lunas:\n${rincian}\nTotal ${rupiah(total)}.${catatan}\nPembayaran ke ${rekeningTeks()}. Setelah transfer, mohon kirim fotonya ke sini. Terima kasih 🙏`);
    }
    return true;
  }
  if (niat === "riwayat") {
    const rows = db.prepare(`
      SELECT p.tgl_bayar, p.nominal, s.nama, t.periode FROM Pembayaran p
      JOIN Tagihan t ON t.id = p.tagihan_id JOIN Siswa s ON s.id = t.siswa_id
      WHERE s.id IN (${tanda}) AND p.status_verifikasi = 'lunas'
      ORDER BY p.tgl_bayar DESC, p.id DESC LIMIT 3
    `).all(...id) as { tgl_bayar: string; nominal: number; nama: string; periode: string }[];
    if (!rows.length) antreBalasan(nomor, `${sapa}, belum ada riwayat pembayaran tercatat. Terima kasih 🙏`);
    else antreBalasan(nomor, `${sapa}, 3 pembayaran terakhir:\n${rows.map((r) => `• ${r.nama} SPP ${namaBulan(r.periode)}: ${rupiah(r.nominal)} (dibayar ${r.tgl_bayar})`).join("\n")}\nTerima kasih 🙏`);
    return true;
  }
  if (niat === "kwitansi") {
    const r = db.prepare(`
      SELECT p.id FROM Pembayaran p JOIN Tagihan t ON t.id = p.tagihan_id JOIN Siswa s ON s.id = t.siswa_id
      WHERE s.id IN (${tanda}) AND p.status_verifikasi = 'lunas'
      ORDER BY p.tgl_bayar DESC, p.id DESC LIMIT 1
    `).get(...id) as { id: number } | undefined;
    if (!r) {
      antreBalasan(nomor, `${sapa}, belum ada kwitansi lunas. Terima kasih 🙏`);
      return true;
    }
    const media = await fileKwitansi(r.id);
    antreBalasan(nomor, media ? "Kwitansi pembayaran terakhir terlampir. Terima kasih 🙏" : `${sapa}, mohon maaf kwitansi belum bisa dikirim otomatis; TU akan mengirimkannya. Terima kasih 🙏`, "bot", media);
    return true;
  }
  return false;
}

/** PDF kwitansi: pakai file yang sudah dibuat web saat verifikasi, atau unduh dari web (token internal). */
async function fileKwitansi(pembayaranId: number): Promise<string | null> {
  const fp = path.join(DATA_DIR, "media", `kwitansi-${pembayaranId}.pdf`);
  if (fs.existsSync(fp)) return fp;
  try {
    const base = (process.env.WEB_URL || "http://localhost:3001").replace(/\/$/, "");
    const token = process.env.AGENT_TOKEN || "";
    const r = await fetch(`${base}/api/kwitansi/${pembayaranId}?token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    fs.writeFileSync(fp, Buffer.from(await r.arrayBuffer()));
    return fp;
  } catch (e) {
    console.log("Unduh kwitansi gagal:", (e as Error).message);
    return null;
  }
}

/**
 * Bukti transfer masuk (PRD §5.4): tautkan otomatis bila satu anak, selain itu TU memilih di web.
 * Nomor tak dikenal tidak dibalas (PRD §6.4) — cukup tercatat di inbox.
 */
export function tanganiBukti(nomor: string): boolean {
  const anak = anakDariNomor(nomor);
  if (!anak.length) return false;
  if (tuBaruAktif(nomor)) return false;
  if (anak.length === 1) {
    const tag = db.prepare("SELECT id FROM Tagihan WHERE siswa_id = ? AND status = 'belum' ORDER BY periode ASC LIMIT 1").get(anak[0].id) as { id: number } | undefined;
    if (tag) {
      db.prepare("UPDATE Tagihan SET status = 'menunggu_verifikasi', diubah_pada = ? WHERE id = ?").run(kini(), tag.id);
      console.log(`Bukti ${nomor} → tagihan ${tag.id} menunggu_verifikasi`);
    }
  } else {
    console.log(`Bukti ${nomor} tak tertaut (${anak.length} anak) — TU memilih di web`);
  }
  antreBalasan(nomor, getPengaturan("tpl_bukti", "Terima kasih, bukti pembayaran sudah kami terima dan akan diverifikasi maksimal 1×24 jam."));
  return true;
}

/** Alur utama pesan teks masuk: 1) aturan, 2) AI, 3) inbox. Return true bila dijawab bot. */
export async function tanganiTeks(nomor: string, teks: string): Promise<boolean> {
  const anak = anakDariNomor(nomor);
  if (!anak.length) return false; // nomor tak dikenal → inbox, tanpa balasan (PRD §6.4)
  const niat = cocokNiat(teks);
  if (niat) return tanganiNiat(nomor, niat, anak, teks);

  const h = await tanyaAI(teks, anak.map((a) => a.nama.split(" ")[0]));
  if (!h || h.yakin < AMBANG_YAKIN) return false; // tidak yakin / kuota habis → inbox (PRD §7)
  const nb = niatAIkeBot(h.niat);
  if (nb) return tanganiNiat(nomor, nb, anak, teks);
  if (h.niat === "umum" && h.jawaban) { balasAI(nomor, h.jawaban); return true; }
  return false;
}

import { db, getPengaturan } from "./db.js";
import type { Niat } from "./bot.js";

// Satu antarmuka agar penyedia bisa diganti dari konfigurasi (PRD §7)
export interface AiProvider {
  nama: string;
  tanya(prompt: string): Promise<string>;
}

class GeminiProvider implements AiProvider {
  nama = "gemini";
  async tanya(prompt: string): Promise<string> {
    const key = getPengaturan("gemini_key", "");
    if (!key) throw new Error("tanpa key");
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 300 } }),
    });
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.map((p: { text: string }) => p.text).join("") || "";
  }
}

class GroqProvider implements AiProvider {
  nama = "groq";
  async tanya(prompt: string): Promise<string> {
    const key = getPengaturan("groq_key", "");
    if (!key) throw new Error("tanpa key");
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: prompt }], temperature: 0.2, max_tokens: 300 }),
    });
    if (!r.ok) throw new Error(`groq ${r.status}`);
    const j = await r.json();
    return j.choices?.[0]?.message?.content || "";
  }
}

export type HasilAI = { niat: string; jawaban: string; yakin: number };

/**
 * Lapisan AI (PRD §7): hanya teks pesan + nama depan anak + basis pengetahuan.
 * Return null bila tidak yakin / kuota habis → pesan masuk inbox tanpa balasan.
 */
export async function tanyaAI(teks: string, namaDepan: string[]): Promise<HasilAI | null> {
  const adaGemini = !!getPengaturan("gemini_key", "");
  const adaGroq = !!getPengaturan("groq_key", "");
  if (!adaGemini && !adaGroq) return null; // AI dilewati sampai key diisi (PRD §13)
  const tahu = db.prepare("SELECT pertanyaan, jawaban FROM Pengetahuan").all() as { pertanyaan: string; jawaban: string }[];
  const basis = tahu.map((t) => `Q: ${t.pertanyaan}\nA: ${t.jawaban}`).join("\n") || "(kosong)";
  const prompt = `Kamu asisten TU TK Permata Indonesia. Anak yang terkait: ${namaDepan.join(", ") || "-"}.
Tugas: klasifikasikan pesan ortu ke SATU niat [tagihan, rekening, riwayat, kwitansi, sapa, umum, lain], atau jawab pertanyaan UMUM hanya dari basis pengetahuan.
Aturan: JANGAN menyebut nominal/status bayar (itu dari database, bukan kamu). JANGAN menjanjikan keringanan/kebijakan. Bahasa: formal Islami singkat.
Basis pengetahuan:\n${basis}\n\nPesan ortu: "${teks.slice(0, 500)}"\n\nJawab HANYA JSON: {"niat":"...","jawaban":"...","yakin":0.0-1.0}. "jawaban" diisi hanya bila niat=umum dan ada di basis; selain itu string kosong.`;
  const penyedia: AiProvider[] = [new GeminiProvider(), new GroqProvider()];
  for (const p of penyedia) {
    try {
      const mentah = await p.tanya(prompt);
      const m = mentah.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const h = JSON.parse(m[0]) as HasilAI;
      if (typeof h.yakin !== "number") continue;
      console.log(`AI ${p.nama}: niat=${h.niat} yakin=${h.yakin}`);
      return h;
    } catch (e) {
      console.log(`AI ${p.nama} gagal, coba berikutnya:`, (e as Error).message);
    }
  }
  return null; // kuota habis / API gagal → dilewati diam-diam (PRD §7)
}

export function niatAIkeBot(niat: string): Niat {
  return (["tagihan", "rekening", "riwayat", "kwitansi", "sapa"] as const).includes(niat as Niat) ? (niat as Niat) : null;
}

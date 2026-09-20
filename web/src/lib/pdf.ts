import PDFDocument from "pdfkit";

/** Tabel sederhana untuk laporan PDF (header + baris string). */
export async function tabelPDF(judul: string, sub: string, head: string[], rows: string[][], namaSekolah: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c as Buffer));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  doc.fontSize(14).text(namaSekolah, { align: "center" });
  doc.fontSize(12).text(judul, { align: "center" });
  doc.fontSize(9).fillColor("#666").text(sub, { align: "center" });
  doc.moveDown().fillColor("#000");
  const colW = (doc.page.width - 72) / head.length;
  const y0 = doc.y;
  doc.font("Helvetica-Bold").fontSize(8);
  head.forEach((h, i) => doc.text(h, 36 + i * colW, y0, { width: colW - 4 }));
  doc.font("Helvetica").fontSize(8);
  let y = y0 + 14;
  for (const r of rows) {
    if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
    r.forEach((c, i) => doc.text(c, 36 + i * colW, y, { width: colW - 4 }));
    y += 12;
  }
  doc.end();
  return done;
}

export async function namaSekolah(db: { pengaturan: { findUnique(a: { where: { kunci: string } }): Promise<{ nilai: string } | null> } }) {
  return (await db.pengaturan.findUnique({ where: { kunci: "sekolah_nama" } }))?.nilai || "TK Permata Indonesia";
}

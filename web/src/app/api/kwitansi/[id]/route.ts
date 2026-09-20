import { NextResponse } from "next/server";
import { sesi } from "@/lib/auth";
import { dataKwitansi, pdfKwitansi } from "@/lib/kwitansi";

/** Unduh PDF kwitansi. Agent memakai token internal (?token=AGENT_TOKEN) untuk melampirkan PDF ke WA. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await sesi();
  const token = new URL(req.url).searchParams.get("token");
  const agenOk = process.env.AGENT_TOKEN && token === process.env.AGENT_TOKEN;
  if (!s && !agenOk) return NextResponse.json({ error: "login" }, { status: 401 });
  const { id } = await ctx.params;
  const d = await dataKwitansi(Number(id));
  if (!d) return NextResponse.json({ error: "tidak ada" }, { status: 404 });
  const pdf = await pdfKwitansi(d);
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${d.no.replaceAll("/", "-")}.pdf"` },
  });
}

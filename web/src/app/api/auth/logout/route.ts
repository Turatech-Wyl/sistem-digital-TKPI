import { NextResponse } from "next/server";
import { hapusSesi } from "@/lib/auth";

export async function POST() {
  await hapusSesi();
  return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_BASE || "http://localhost:3000"), 303);
}

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  return NextResponse.json({ ok: true, user });
}

import { NextRequest, NextResponse } from "next/server";
import { getEconEvents } from "@/lib/econ";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 이번 주 경제 캘린더 (무료 소스, 키 불필요)
export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
  const events = await getEconEvents(lang);
  return NextResponse.json(
    { ok: events.length > 0, events },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}

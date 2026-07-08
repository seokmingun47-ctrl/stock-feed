import { NextRequest, NextResponse } from "next/server";
import { searchStocks } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 관심 종목 추가용 검색 (네이버 자동완성)
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 40);
  if (q.length < 1) return NextResponse.json({ ok: true, hits: [] });
  try {
    const hits = await searchStocks(q);
    return NextResponse.json(
      { ok: true, hits },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json({ ok: true, hits: [] });
  }
}

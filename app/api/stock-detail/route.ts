import { NextRequest, NextResponse } from "next/server";
import { getStockDetail } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 종목 상세 지표 (시총·거래량·52주·PER·PBR·배당 등)
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const domestic = req.nextUrl.searchParams.get("domestic") === "1";
  if (!symbol) return NextResponse.json({ ok: false, reason: "no-symbol" });
  try {
    const detail = await getStockDetail(symbol, domestic);
    if (!detail) return NextResponse.json({ ok: false, reason: "no-data" });
    return NextResponse.json(
      { ok: true, detail },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ ok: false, reason: "error" });
  }
}

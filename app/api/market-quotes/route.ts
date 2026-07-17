import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/naver";
import { KR_STOCKS, US_STOCKS } from "@/lib/market";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 시장 화면: 국내/해외 대표주 시세 일괄 조회 (네이버)
export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") === "us" ? "us" : "kr";
  const list = region === "us" ? US_STOCKS : KR_STOCKS;

  const stocks = await Promise.all(
    list.map(async (s) => {
      try {
        const q = await getQuote({ symbol: s.symbol, domestic: s.domestic });
        return {
          ...s,
          price: q?.price ?? null,
          changeRate: q?.changeRate ?? null,
          currency: q?.currency ?? (s.domestic ? "KRW" : "USD"),
          marketOpen: q?.marketOpen ?? false,
          over: q?.over ?? null, // 프리/애프터마켓
        };
      } catch {
        return {
          ...s,
          price: null,
          changeRate: null,
          currency: s.domestic ? "KRW" : "USD",
          marketOpen: false,
          over: null,
        };
      }
    }),
  );

  return NextResponse.json(
    { ok: true, stocks },
    {
      // 실시간성 위해 짧게 (프리마켓도 계속 움직임)
      headers: {
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
      },
    },
  );
}

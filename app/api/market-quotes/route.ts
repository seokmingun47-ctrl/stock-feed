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
        };
      } catch {
        return {
          ...s,
          price: null,
          changeRate: null,
          currency: s.domestic ? "KRW" : "USD",
        };
      }
    }),
  );

  return NextResponse.json(
    { ok: true, stocks },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    },
  );
}

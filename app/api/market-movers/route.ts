import { NextRequest, NextResponse } from "next/server";
import { getDomesticMovers, getQuote, type MoverStock } from "@/lib/naver";
import { US_STOCKS } from "@/lib/market";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 급등/급락. 국내=네이버 실제 순위, 해외=큐레이션 목록 정렬(해외 순위 API 없음).
export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region") === "us" ? "us" : "kr";

  if (region === "kr") {
    const [gainers, losers] = await Promise.all([
      getDomesticMovers("up"),
      getDomesticMovers("down"),
    ]);
    return NextResponse.json(
      { ok: true, gainers, losers },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  }

  // 해외: 큐레이션 종목 시세 → 상승/하락 분리
  const quotes = await Promise.all(
    US_STOCKS.map(async (s): Promise<MoverStock | null> => {
      try {
        const q = await getQuote({ symbol: s.symbol, domestic: false });
        return {
          name: s.name,
          ticker: s.ticker,
          symbol: s.symbol,
          market: s.market,
          domestic: false,
          price: q?.price ?? null,
          changeRate: q?.changeRate ?? null,
          currency: q?.currency ?? "USD",
        };
      } catch {
        return null;
      }
    }),
  );
  const valid = quotes.filter((q): q is MoverStock => !!q);
  const gainers = valid
    .filter((s) => (s.changeRate ?? 0) > 0)
    .sort((a, b) => (b.changeRate ?? 0) - (a.changeRate ?? 0));
  const losers = valid
    .filter((s) => (s.changeRate ?? 0) < 0)
    .sort((a, b) => (a.changeRate ?? 0) - (b.changeRate ?? 0));

  return NextResponse.json(
    { ok: true, gainers, losers },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}

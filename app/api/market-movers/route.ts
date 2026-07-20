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
  // ⚠️ 예전엔 0%보다 오르면 전부 '급등'이라 2% 종목까지 들어갔다.
  //    국내는 네이버 실제 급등 순위를 쓰므로 자연히 두 자릿수인데 해외만 기준이 없었던 것.
  //    → 최소 변동폭(MIN)을 두고, 그만큼 움직인 종목이 없으면 빈 목록을 준다(억지로 채우지 않음).
  const MIN = 3; // %
  const valid = quotes.filter((q): q is MoverStock => !!q);
  const gainers = valid
    .filter((s) => (s.changeRate ?? 0) >= MIN)
    .sort((a, b) => (b.changeRate ?? 0) - (a.changeRate ?? 0))
    .slice(0, 15);
  const losers = valid
    .filter((s) => (s.changeRate ?? 0) <= -MIN)
    .sort((a, b) => (a.changeRate ?? 0) - (b.changeRate ?? 0))
    .slice(0, 15);

  return NextResponse.json(
    { ok: true, gainers, losers },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getStockDetail, getQuote } from "@/lib/naver";
import { KR_STOCKS, US_STOCKS } from "@/lib/market";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 저평가/고평가 — 프로 전용. 큐레이션 종목의 PER/PBR 조회 후 정렬
export async function GET(req: NextRequest) {
  // 프로 구독자만 실제 종목 데이터를 볼 수 있음 (Investing 스타일 모자이크)
  const user = await getUser(req);
  if (!user?.isPro) {
    return NextResponse.json(
      { ok: false, code: "PRO_ONLY", message: "저평가·고평가 분석은 프로 전용입니다." },
      { status: 403 },
    );
  }
  const region = req.nextUrl.searchParams.get("region") === "us" ? "us" : "kr";
  const list = region === "us" ? US_STOCKS : KR_STOCKS;

  const rows = await Promise.all(
    list.map(async (s) => {
      try {
        const [detail, q] = await Promise.all([
          getStockDetail(s.symbol, s.domestic),
          getQuote({ symbol: s.symbol, domestic: s.domestic }),
        ]);
        return {
          name: s.name,
          ticker: s.ticker,
          symbol: s.symbol,
          market: s.market,
          domestic: s.domestic,
          per: detail?.per ?? null,
          pbr: detail?.pbr ?? null,
          price: q?.price ?? null,
          changeRate: q?.changeRate ?? null,
          currency: q?.currency ?? (s.domestic ? "KRW" : "USD"),
        };
      } catch {
        return null;
      }
    }),
  );

  // PER 유효(양수)한 것만 밸류에이션 평가 대상
  const valid = rows.filter((r): r is NonNullable<typeof r> => !!r && !!r.per && r.per > 0);
  const undervalued = [...valid].sort((a, b) => a.per! - b.per!).slice(0, 10);
  const overvalued = [...valid].sort((a, b) => b.per! - a.per!).slice(0, 10);

  return NextResponse.json(
    { ok: true, undervalued, overvalued },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}

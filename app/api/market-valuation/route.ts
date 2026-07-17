import { NextRequest, NextResponse } from "next/server";
import { getStockDetail, getQuote, getKrValueUniverse } from "@/lib/naver";
import { US_STOCKS } from "@/lib/market";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 국내: 시총 상위 200종목(KOSPI/KOSDAQ 각 100)을 훑어 진짜 저평가/고평가를 뽑는다.
// (예전엔 큐레이션 21종목 중 20개를 보여줘서 매일 같은 결과였음)
async function krRows() {
  const uni = await getKrValueUniverse(2); // 각 시장 2페이지 = 각 100종목
  return uni
    .filter((s) => s.per !== null)
    .map((s) => ({
      name: s.name,
      ticker: s.ticker,
      symbol: s.symbol,
      market: s.market,
      domestic: true,
      per: s.per,
      pbr: null as number | null,
      roe: s.roe,
      price: s.price,
      changeRate: s.changeRate,
      currency: "KRW",
    }));
}

// 해외: 네이버에 미국 시총 랭킹 API가 없어 큐레이션 목록 유지 (종목별 상세 조회)
async function usRows() {
  const rows = await Promise.all(
    US_STOCKS.map(async (s) => {
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
          roe: null as number | null,
          price: q?.price ?? null,
          changeRate: q?.changeRate ?? null,
          currency: q?.currency ?? "USD",
        };
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r): r is NonNullable<typeof r> => !!r && !!r.per && r.per > 0);
}

// 저평가/고평가 — 프로 전용
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user?.isPro) {
    return NextResponse.json(
      { ok: false, code: "PRO_ONLY", message: "저평가·고평가 분석은 프로 전용입니다." },
      { status: 403 },
    );
  }
  const region = req.nextUrl.searchParams.get("region") === "us" ? "us" : "kr";
  const valid = region === "us" ? await usRows() : await krRows();

  const undervalued = [...valid].sort((a, b) => a.per! - b.per!).slice(0, 10);
  const overvalued = [...valid].sort((a, b) => b.per! - a.per!).slice(0, 10);

  return NextResponse.json(
    { ok: true, region, universe: valid.length, undervalued, overvalued },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" } },
  );
}

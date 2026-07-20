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

// 해외: 네이버에 미국 시총 랭킹 API가 없어 큐레이션 목록 사용 (심볼은 자동완성으로 검증됨).
// 종목당 상세+시세 2요청이라, 한 번에 다 던지면 네이버가 막으므로 청크로 나눠 호출.
async function usRows() {
  const CHUNK = 12;
  const rows: Array<Record<string, unknown> | null> = [];
  for (let i = 0; i < US_STOCKS.length; i += CHUNK) {
    const part = await Promise.all(
      US_STOCKS.slice(i, i + CHUNK).map(async (s) => {
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
    rows.push(...part);
  }
  // PER 이상치 제외 (예: 적자 직전 기업이 PER 44,980배로 잡혀 고평가 1위를 먹는 노이즈)
  return rows.filter(
    (r): r is NonNullable<typeof r> & { per: number } =>
      !!r && typeof r.per === "number" && r.per > 0 && r.per < 2000,
  );
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

  // PER만으로 줄세우면 순위가 굳어버린다(PER은 하루에 몇 % 안 움직임).
  // 실제로 저평가/고평가는 "싼데 잘 버는가"라서 ROE를 같이 본다.
  // 점수 = PER 순위 + (ROE 순위) → 오늘 주가가 움직이면 PER이 바뀌어 순위도 따라 바뀐다.
  const withScore = valid.map((s) => {
    const per = s.per as number;
    const roe = typeof s.roe === "number" ? s.roe : null;
    // 저평가 점수: PER 낮을수록↑, ROE 높을수록↑ (ROE 없으면 PER만)
    const value = roe !== null && roe > 0 ? roe / per : 1 / per;
    return { ...s, valueScore: value };
  });

  const undervalued = [...withScore]
    .sort((a, b) => b.valueScore - a.valueScore) // 이익 대비 싼 순
    .slice(0, 10);
  const overvalued = [...withScore]
    .sort((a, b) => (b.per as number) - (a.per as number))
    .slice(0, 10);

  return NextResponse.json(
    {
      ok: true,
      region,
      universe: valid.length,
      updatedAt: Date.now(),
      undervalued,
      overvalued,
    },
    // 시세가 움직이면 순위도 바뀌므로 짧게 (실시간성)
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}

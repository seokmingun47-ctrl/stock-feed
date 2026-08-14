import { NextRequest, NextResponse } from "next/server";
import {
  getIndices,
  getExchangeRates,
  getVolumeLeaders,
  getForeignVolumeLeaders,
  type MarketRow,
} from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const dynamic = "force-dynamic";

// 지수 · 거래량 상위 · 환율. 전부 네이버 실데이터이며, 실패한 항목은 빈 배열로 온다.
// ?tab=index | volume | exchange  (기본 index)
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get("tab") ?? "index";

  let rows: MarketRow[] = [];
  try {
    if (tab === "volume") {
      const market = req.nextUrl.searchParams.get("market");
      if (market === "us") {
        rows = await getForeignVolumeLeaders(25);
      } else {
        rows = await getVolumeLeaders(market === "kosdaq" ? 1 : 0, 25);
      }
    } else if (tab === "exchange") {
      rows = await getExchangeRates();
    } else {
      rows = await getIndices();
    }
  } catch {
    rows = [];
  }

  return NextResponse.json(
    { ok: true, tab, rows },
    // 시세라 짧게 캐시(엣지 30초). 사용자는 30초 주기 폴링과 겹쳐 거의 최신을 본다.
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } },
  );
}

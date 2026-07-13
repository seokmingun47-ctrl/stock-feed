import { NextRequest, NextResponse } from "next/server";
import { searchMarket, getQuote } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 시장 종목 검색 (네이버 자동완성) + 시세. 시장 탭 검색창용.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ ok: true, stocks: [] });

  let hits;
  try {
    hits = await searchMarket(q);
  } catch {
    return NextResponse.json({ ok: false, reason: "검색에 실패했어요.", stocks: [] });
  }

  const stocks = await Promise.all(
    hits.slice(0, 8).map(async (h) => {
      try {
        const qt = await getQuote({ symbol: h.symbol, domestic: h.domestic });
        return {
          ...h,
          price: qt?.price ?? null,
          changeRate: qt?.changeRate ?? null,
          currency: qt?.currency ?? (h.domestic ? "KRW" : "USD"),
        };
      } catch {
        return {
          ...h,
          price: null,
          changeRate: null,
          currency: h.domestic ? "KRW" : "USD",
        };
      }
    }),
  );

  return NextResponse.json(
    { ok: true, stocks },
    {
      headers: {
        "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120",
      },
    },
  );
}

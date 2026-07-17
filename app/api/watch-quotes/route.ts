import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 관심 종목(별표) 시세 일괄 조회. body: [{name,ticker,symbol,market,domestic}]
export async function POST(req: NextRequest) {
  let body: { stocks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, stocks: [] });
  }
  const list = Array.isArray(body.stocks) ? body.stocks.slice(0, 40) : [];
  const stocks = await Promise.all(
    list.map(async (raw) => {
      const s = raw as Record<string, unknown>;
      const symbol = String(s.symbol ?? "");
      const domestic = !!s.domestic;
      if (!symbol) return null;
      try {
        const q = await getQuote({ symbol, domestic });
        return {
          name: String(s.name ?? ""),
          ticker: String(s.ticker ?? ""),
          symbol,
          market: String(s.market ?? ""),
          domestic,
          price: q?.price ?? null,
          changeRate: q?.changeRate ?? null,
          currency: q?.currency ?? (domestic ? "KRW" : "USD"),
          marketOpen: q?.marketOpen ?? false,
          over: q?.over ?? null,
        };
      } catch {
        return null;
      }
    }),
  );
  return NextResponse.json({ ok: true, stocks: stocks.filter(Boolean) });
}

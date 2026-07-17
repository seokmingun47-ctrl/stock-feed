import { NextRequest, NextResponse } from "next/server";
import { resolveSymbol, getQuote } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 여러 종목의 시세를 한 번에 (네이버). 종목 카드에 현재가 표시용.
export async function POST(req: NextRequest) {
  let body: { stocks?: Array<{ name?: string; ticker?: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const stocks = Array.isArray(body.stocks) ? body.stocks.slice(0, 6) : [];

  const quotes = await Promise.all(
    stocks.map(async (s) => {
      const ticker = String(s.ticker ?? "");
      const name = String(s.name ?? "");
      try {
        const r = await resolveSymbol(ticker, name);
        if (!r) return null;
        const q = await getQuote(r);
        if (!q) return { symbol: r.symbol, domestic: r.domestic };
        return { symbol: r.symbol, domestic: r.domestic, ...q };
      } catch {
        return null;
      }
    }),
  );

  return NextResponse.json(
    { ok: true, quotes },
    { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30" } },
  );
}

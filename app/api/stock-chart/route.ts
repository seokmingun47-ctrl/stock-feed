import { NextRequest, NextResponse } from "next/server";
import { getChart, resolveSymbol } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 단일 종목 차트(OHLC). 이미 해석된 symbol이 있으면 그대로, 없으면 ticker/name으로 해석.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const symbol = p.get("symbol") || "";
  const domesticParam = p.get("domestic");
  const tfRaw = p.get("tf") || "day";
  const tf = (["day", "week", "month"].includes(tfRaw) ? tfRaw : "day") as
    | "day"
    | "week"
    | "month";

  let resolved =
    symbol && domesticParam !== null
      ? { symbol, domestic: domesticParam === "1" }
      : null;
  if (!resolved) {
    const r = await resolveSymbol(p.get("ticker") || "", p.get("name") || "");
    if (!r) return NextResponse.json({ ok: false, reason: "not-found" });
    resolved = r;
  }

  const candles = await getChart(resolved, tf);
  if (!candles || !candles.length) {
    return NextResponse.json({ ok: false, reason: "no-data" });
  }
  return NextResponse.json(
    { ok: true, candles },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}

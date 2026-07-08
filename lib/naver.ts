// 네이버 금융 시세/차트 헬퍼 (서버 전용 — CORS 우회)

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const H = {
  "User-Agent": UA,
  Accept: "application/json,*/*",
  Referer: "https://m.stock.naver.com/",
};

async function jget(url: string, ms = 8000): Promise<unknown> {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: H, signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface Resolved {
  symbol: string; // 국내=6자리코드, 해외=reutersCode(NVDA.O 등)
  domestic: boolean;
}

// 티커/이름 → 네이버 심볼. 국내(6자리)는 그대로, 해외는 자동완성으로 reutersCode 해석.
export async function resolveSymbol(
  ticker: string,
  name: string,
): Promise<Resolved | null> {
  const t = (ticker || "").trim().toUpperCase();
  if (/^\d{6}$/.test(t)) return { symbol: t, domestic: true };

  for (const q of [t, name].filter(Boolean)) {
    const j = (await jget(
      `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock`,
    )) as { items?: Array<Record<string, unknown>> } | null;
    const items = (j?.items ?? []).filter(
      (i) => String(i.category) === "stock",
    );
    if (!items.length) continue;
    const hit =
      items.find((i) => String(i.code ?? "").toUpperCase() === t) || items[0];
    const rc = String(hit.reutersCode ?? "");
    if (rc) return { symbol: rc, domestic: /^\d{6}$/.test(rc) };
  }
  return null;
}

// 종목 검색 자동완성 (관심 종목 추가용)
export interface StockHit {
  name: string; // 한글 종목명
  code: string; // 티커/코드
  market: string; // KOSPI/NASDAQ 등
}
export async function searchStocks(q: string): Promise<StockHit[]> {
  const j = (await jget(
    `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock`,
  )) as { items?: Array<Record<string, unknown>> } | null;
  const items = (j?.items ?? []).filter((i) => String(i.category) === "stock");
  return items.slice(0, 8).map((i) => ({
    name: String(i.name ?? ""),
    code: String(i.code ?? ""),
    market: String(i.typeCode ?? ""),
  }));
}

export interface Quote {
  price: string; // 표시용 (국내 "296,000", 해외 "193.13")
  changeRate: number; // 등락률 (%)
  currency: string; // KRW | USD ...
}

export async function getQuote(r: Resolved): Promise<Quote | null> {
  const url = r.domestic
    ? `https://polling.finance.naver.com/api/realtime/domestic/stock/${r.symbol}`
    : `https://polling.finance.naver.com/api/realtime/worldstock/stock/${r.symbol}`;
  const j = (await jget(url)) as { datas?: Array<Record<string, unknown>> } | null;
  const d = j?.datas?.[0];
  if (!d) return null;
  const price = String(d.closePrice ?? "").trim();
  if (!price) return null;
  const rate = Number(d.fluctuationsRatio ?? 0);
  const cur =
    (d.currencyType as { code?: string } | undefined)?.code ||
    (r.domestic ? "KRW" : "USD");
  return { price, changeRate: Number.isFinite(rate) ? rate : 0, currency: cur };
}

export interface Candle {
  d: string; // localDate YYYYMMDD
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

function ymd(dt: Date): string {
  return (
    dt.getFullYear() +
    String(dt.getMonth() + 1).padStart(2, "0") +
    String(dt.getDate()).padStart(2, "0")
  );
}

export async function getChart(
  r: Resolved,
  timeframe: "day" | "week" | "month",
): Promise<Candle[] | null> {
  const kind = r.domestic ? "domestic" : "foreign";
  // 범위 없이 요청하면 1개만 오므로 기간별 시작일 지정
  const end = new Date();
  const start = new Date(end);
  if (timeframe === "day") start.setDate(start.getDate() - 220);
  else if (timeframe === "week") start.setDate(start.getDate() - 1280);
  else start.setFullYear(start.getFullYear() - 12);
  // ⚠️ 12자리(YYYYMMDDHHmm)여야 day/week/month 모두 데이터가 옴 (8자리는 week/month=0)
  const range = `?startDateTime=${ymd(start)}0000&endDateTime=${ymd(end)}2359`;
  const j = (await jget(
    `https://api.stock.naver.com/chart/${kind}/item/${r.symbol}/${timeframe}${range}`,
  )) as Array<Record<string, unknown>> | null;
  if (!Array.isArray(j) || !j.length) return null;
  const out: Candle[] = j
    .map((x) => ({
      d: String(x.localDate ?? ""),
      o: Number(x.openPrice ?? 0),
      h: Number(x.highPrice ?? 0),
      l: Number(x.lowPrice ?? 0),
      c: Number(x.closePrice ?? 0),
      v: Number(x.accumulatedTradingVolume ?? 0),
    }))
    .filter((x) => x.c > 0);
  return out;
}

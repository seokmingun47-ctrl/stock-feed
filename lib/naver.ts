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

// 시장 검색 — 자동완성 결과를 시세/차트 조회 가능한 형태로
export interface MarketHit {
  name: string;
  ticker: string; // 표시용 코드 (국내 6자리, 해외 티커)
  symbol: string; // 네이버 심볼 (reutersCode)
  market: string; // KOSPI/KOSDAQ/NASDAQ/NYSE ...
  domestic: boolean;
}
export async function searchMarket(q: string): Promise<MarketHit[]> {
  const j = (await jget(
    `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock`,
  )) as { items?: Array<Record<string, unknown>> } | null;
  const items = (j?.items ?? []).filter((i) => String(i.category) === "stock");
  return items
    .slice(0, 10)
    .map((i) => {
      const symbol = String(i.reutersCode ?? i.code ?? "");
      return {
        name: String(i.name ?? ""),
        ticker: String(i.code ?? ""),
        symbol,
        market: String(i.typeCode ?? ""),
        domestic: /^\d{6}$/.test(symbol),
      };
    })
    .filter((h) => h.name && h.symbol);
}

// 종목 상세 지표 (시총·거래량·52주·PER·PBR·배당 등)
export interface StockDetail {
  info: Record<string, string>; // 한글 지표명 → 표시값 (예: {"시총":"1,634조", "PER":"22.59배"})
  per: number | null;
  pbr: number | null;
  changeRate: number | null;
}
function toNum(s?: string): number | null {
  if (!s) return null;
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
export async function getStockDetail(
  symbol: string,
  domestic: boolean,
): Promise<StockDetail | null> {
  const url = domestic
    ? `https://m.stock.naver.com/api/stock/${symbol}/integration`
    : `https://api.stock.naver.com/stock/${encodeURIComponent(symbol)}/basic`;
  const j = (await jget(url)) as Record<string, unknown> | null;
  if (!j) return null;
  const arr = (domestic ? j.totalInfos : j.stockItemTotalInfos) as
    | Array<{ key?: string; code?: string; value?: string }>
    | undefined;
  if (!Array.isArray(arr)) return null;
  const info: Record<string, string> = {};
  for (const it of arr) {
    const k = String(it.key ?? it.code ?? "").trim();
    const v = String(it.value ?? "").trim();
    if (k && v) info[k] = v;
  }
  const rate = domestic ? null : toNum(String(j.fluctuationsRatio ?? ""));
  return { info, per: toNum(info["PER"]), pbr: toNum(info["PBR"]), changeRate: rate };
}

// 밸류에이션 근거용 객관적 데이터 (지표 + 동종업계 PER/PBR + 애널리스트 컨센서스)
export interface ValuationContext {
  per: string | null;
  pbr: string | null;
  eps: string | null;
  dividend: string | null;
  marketCap: string | null;
  industry: string | null;
  high52: string | null;
  low52: string | null;
  targetPrice: string | null; // 애널리스트 목표주가 평균
  recommMean: string | null; // 투자의견 평균 (1 강력매수 ~ 5 강력매도)
  peers: { name: string; per: string | null; pbr: string | null }[];
}
export async function getValuationContext(
  symbol: string,
  domestic: boolean,
): Promise<ValuationContext | null> {
  const detail = await getStockDetail(symbol, domestic);
  if (!detail) return null;
  const info = detail.info;
  const ctx: ValuationContext = {
    per: info["PER"] ?? null,
    pbr: info["PBR"] ?? null,
    eps: info["EPS"] ?? null,
    dividend: info["배당수익률"] ?? null,
    marketCap: info["시총"] ?? null,
    industry: info["업종"] ?? null,
    high52: info["52주 최고"] ?? null,
    low52: info["52주 최저"] ?? null,
    targetPrice: null,
    recommMean: null,
    peers: [],
  };
  if (domestic) {
    const j = (await jget(
      `https://m.stock.naver.com/api/stock/${symbol}/integration`,
    )) as Record<string, unknown> | null;
    const cons = j?.consensusInfo as
      | { priceTargetMean?: string; recommMean?: string }
      | undefined;
    if (cons) {
      ctx.targetPrice = cons.priceTargetMean ?? null;
      ctx.recommMean = cons.recommMean ?? null;
    }
    const peersRaw = Array.isArray(j?.industryCompareInfo)
      ? (j!.industryCompareInfo as Array<Record<string, unknown>>)
          .filter((p) => String(p.itemCode) !== symbol)
          .slice(0, 3)
      : [];
    ctx.peers = await Promise.all(
      peersRaw.map(async (p) => {
        const code = String(p.reutersCode ?? p.itemCode ?? "");
        const pd = code ? await getStockDetail(code, true) : null;
        return {
          name: String(p.stockName ?? ""),
          per: pd?.info["PER"] ?? null,
          pbr: pd?.info["PBR"] ?? null,
        };
      }),
    );
  }
  return ctx;
}

// 국내 급등/급락 순위 (네이버 실제 상승률/하락률 랭킹, KOSPI+KOSDAQ 합산)
export interface MoverStock {
  name: string;
  ticker: string;
  symbol: string;
  market: string;
  domestic: boolean;
  price: string | null;
  changeRate: number | null;
  currency: string;
}
export async function getDomesticMovers(
  dir: "up" | "down",
  size = 15,
): Promise<MoverStock[]> {
  const url = (mk: string) =>
    `https://m.stock.naver.com/api/stocks/${dir}/${mk}?page=1&pageSize=${size + 10}`;
  const [a, b] = await Promise.all([jget(url("KOSPI")), jget(url("KOSDAQ"))]);
  const parse = (j: unknown): MoverStock[] => {
    const arr = Array.isArray(j)
      ? j
      : ((j as { stocks?: unknown[] } | null)?.stocks ?? []);
    return (arr as Record<string, unknown>[]).map((x) => ({
      name: String(x.stockName ?? ""),
      ticker: String(x.itemCode ?? ""),
      symbol: String(x.reutersCode ?? x.itemCode ?? ""),
      market: String(
        x.stockExchangeType ?? (String(x.sosok) === "1" ? "KOSDAQ" : "KOSPI"),
      ),
      domestic: true,
      price: String(x.closePrice ?? "") || null,
      changeRate: Number(x.fluctuationsRatio) || 0,
      currency: "KRW",
    }));
  };
  // ETN/ETF/레버리지 등 파생상품 제외 → 실제 종목 위주
  const skip = /ETN|ETF|레버리지|인버스|선물|2X|커버드콜|TIGER|KODEX|ACE|PLUS/i;
  const all = [...parse(a), ...parse(b)].filter(
    (s) => s.name && !skip.test(s.name),
  );
  all.sort((x, y) =>
    dir === "up"
      ? (y.changeRate ?? 0) - (x.changeRate ?? 0)
      : (x.changeRate ?? 0) - (y.changeRate ?? 0),
  );
  return all.slice(0, size);
}

// 본장 외 거래(프리마켓/애프터마켓/시간외) — 진행 중일 때만 채워짐
export interface OverQuote {
  session: "PRE" | "AFTER";
  price: string;
  changeRate: number;
}

export interface Quote {
  price: string; // 표시용 (국내 "296,000", 해외 "193.13")
  changeRate: number; // 등락률 (%)
  currency: string; // KRW | USD ...
  marketOpen?: boolean; // 본장 개장 여부
  over?: OverQuote | null; // 프리/애프터마켓 실시간
}

// 네이버가 overMarketPriceInfo로 프리/애프터마켓을 같이 준다.
// 지금 거래 중(overMarketStatus === "OPEN")일 때만 노출 — 어제치 잔여값 방지.
function parseOver(d: Record<string, unknown>): OverQuote | null {
  const om = d.overMarketPriceInfo as Record<string, unknown> | undefined;
  if (!om) return null;
  if (String(om.overMarketStatus ?? "") !== "OPEN") return null;
  const price = String(om.overPrice ?? "").trim();
  if (!price) return null;
  const rate = Number(String(om.fluctuationsRatio ?? "0").replace(/,/g, ""));
  return {
    session: String(om.tradingSessionType ?? "") === "AFTER_MARKET" ? "AFTER" : "PRE",
    price,
    changeRate: Number.isFinite(rate) ? rate : 0,
  };
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
  return {
    price,
    changeRate: Number.isFinite(rate) ? rate : 0,
    currency: cur,
    marketOpen: String(d.marketStatus ?? "") === "OPEN",
    over: parseOver(d),
  };
}

// 업종 식별 — 네이버는 업종명 텍스트를 안 주고 industryCode(숫자)와 동종업계 목록만 준다.
// 같은 코드면 같은 업종이므로, 코드로 묶고 '동종업계 대표 종목'으로 사람이 읽을 라벨을 만든다.
export interface IndustryInfo {
  code: string;
  peers: string[]; // 동종업계 종목명 (라벨용)
}

export async function getIndustry(
  symbol: string,
  domestic: boolean,
): Promise<IndustryInfo | null> {
  if (!domestic) return null; // 해외는 integration API가 없음
  const j = (await jget(
    `https://m.stock.naver.com/api/stock/${symbol}/integration`,
  )) as
    | { industryCode?: unknown; industryCompareInfo?: Array<{ stockName?: unknown }> }
    | null;
  if (!j?.industryCode) return null;
  return {
    code: String(j.industryCode),
    peers: (j.industryCompareInfo ?? [])
      .map((p) => String(p.stockName ?? ""))
      .filter(Boolean)
      .slice(0, 4),
  };
}

// ── 밸류에이션 유니버스 (저평가·고평가용) ──────────────────────────
// 큐레이션 21종목으로는 매일 같은 결과라, 네이버 '시가총액' 페이지를 쓴다.
// 이 페이지는 50종목/요청으로 PER·ROE를 표에 같이 주므로 100종목을 2요청에 끝낼 수 있다.
// (개별 종목 상세를 100번 호출하는 것보다 훨씬 가볍다)
export interface ValueRow {
  name: string;
  ticker: string;
  symbol: string;
  market: "KOSPI" | "KOSDAQ";
  domestic: true;
  price: string | null;
  changeRate: number | null;
  currency: "KRW";
  per: number | null;
  roe: number | null;
  marketCap: number; // 억원
}

const num = (s: string): number | null => {
  const v = Number(String(s).replace(/[,%\s]/g, ""));
  return Number.isFinite(v) ? v : null;
};

// 우선주·스팩·리츠 등은 저평가 랭킹에서 노이즈라 제외
function isNoise(name: string, code: string): boolean {
  if (/우[B-C]?$/.test(name)) return true; // 삼성전자우, 현대차2우B …
  if (/\d우[B-C]?$/.test(name)) return true;
  if (/스팩|기업인수목적/.test(name)) return true;
  if (/^(KODEX|TIGER|KBSTAR|ARIRANG|HANARO|SOL|ACE|PLUS|RISE)\b/i.test(name)) return true;
  if (!code.endsWith("0")) return true; // 보통주는 대개 0으로 끝남 (우선주 5/7 제외)
  return false;
}

async function fetchCapPage(sosok: 0 | 1, page: number): Promise<ValueRow[]> {
  const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`;
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 9000);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Referer: "https://finance.naver.com/" },
      signal: c.signal,
    });
    if (!r.ok) return [];
    // ⚠️ 네이버 금융 구페이지는 EUC-KR
    const html = new TextDecoder("euc-kr").decode(await r.arrayBuffer());
    const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map((m) => m[1])
      .filter((x) => x.includes("/item/main.naver?code="));
    const out: ValueRow[] = [];
    for (const row of rows) {
      const code = (row.match(/code=(\d{6})/) || [])[1];
      if (!code) continue;
      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
      );
      // [1]종목명 [2]현재가 [4]등락률 [6]시가총액 [10]PER [11]ROE
      const name = tds[1] || "";
      if (!name || isNoise(name, code)) continue;
      const per = num(tds[10] ?? "");
      out.push({
        name,
        ticker: code,
        symbol: code,
        market: sosok === 0 ? "KOSPI" : "KOSDAQ",
        domestic: true,
        price: tds[2] || null,
        changeRate: num(tds[4] ?? ""),
        currency: "KRW",
        per: per !== null && per > 0 && per < 2000 ? per : null, // 음수/이상치 제외
        roe: num(tds[11] ?? ""),
        marketCap: num(tds[6] ?? "") ?? 0,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// 시총 상위 유니버스 (KOSPI + KOSDAQ 각 pages장 = 각 50*pages 종목)
export async function getKrValueUniverse(pages = 2): Promise<ValueRow[]> {
  const jobs: Promise<ValueRow[]>[] = [];
  for (let p = 1; p <= pages; p++) {
    jobs.push(fetchCapPage(0, p));
    jobs.push(fetchCapPage(1, p));
  }
  const all = (await Promise.all(jobs)).flat();
  const seen = new Set<string>();
  return all.filter((s) => {
    if (seen.has(s.ticker)) return false;
    seen.add(s.ticker);
    return true;
  });
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

/** 시장 지수 스냅샷 (급등락이 '이 종목만의 일'인지 판단하는 근거) */
export interface IndexQuote {
  name: string;
  changeRate: number;
}

// ⚠️ 장이 닫혀 있으면 해외 지수는 rate를 0.00으로 주는 경우가 있다.
//    0은 '보합'이 아니라 '모름'에 가까우므로 호출부에서 걸러야 한다.
export async function getIndexQuote(
  key: "KOSPI" | "KOSDAQ" | "NASDAQ" | "S&P500",
): Promise<IndexQuote | null> {
  const domestic = key === "KOSPI" || key === "KOSDAQ";
  const code = key === "NASDAQ" ? ".IXIC" : key === "S&P500" ? ".INX" : key;
  const url = domestic
    ? `https://polling.finance.naver.com/api/realtime/domestic/index/${code}`
    : `https://polling.finance.naver.com/api/realtime/worldstock/index/${encodeURIComponent(code)}`;
  const j = (await jget(url)) as { datas?: { fluctuationsRatio?: unknown }[] } | null;
  const d = j?.datas?.[0];
  if (!d) return null;
  const rate = Number(String(d.fluctuationsRatio ?? "").replace(/,/g, ""));
  if (!Number.isFinite(rate)) return null;
  return { name: key, changeRate: rate };
}

/**
 * 포트폴리오 진단용 종목 팩트 묶음.
 * integration 한 번으로 지표·IR일정·컨센서스·수급을 모두 뽑는다(종목당 요청 1회).
 * 전부 네이버가 준 실제 값이며, 해석은 하지 않는다.
 */
export interface HoldingFacts {
  per: number | null;
  forwardPer: number | null; // 추정PER (실적 전망 반영)
  pbr: number | null;
  dividendYield: number | null;
  price: number | null;
  high52: number | null;
  low52: number | null;
  /** 52주 구간에서 현재가 위치 (0=최저, 100=최고) */
  pos52: number | null;
  ir: { title: string; date: string; dday: number } | null;
  targetPrice: number | null; // 증권사 목표주가 평균
  recommMean: number | null; // 투자의견 평균 (1 매수 ~ 5 매도)
  /** 목표주가 대비 괴리율 (%) — 양수면 목표가가 현재가보다 높다 */
  targetGap: number | null;
  /** 최근 5거래일 순매수 (주식 수) */
  flow5d: { foreigner: number; organ: number; individual: number } | null;
  reports: { title: string; broker: string; date: string }[];
}

function numOf(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[,%원배+\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function getHoldingFacts(
  symbol: string,
  domestic: boolean,
): Promise<HoldingFacts | null> {
  // 해외 종목은 integration이 없어 기본 지표만 (basic 경유)
  if (!domestic) {
    const d = await getStockDetail(symbol, false);
    if (!d) return null;
    return {
      per: d.per,
      forwardPer: null,
      pbr: d.pbr,
      dividendYield: null,
      price: null,
      high52: null,
      low52: null,
      pos52: null,
      ir: null,
      targetPrice: null,
      recommMean: null,
      targetGap: null,
      flow5d: null,
      reports: [],
    };
  }

  const j = (await jget(
    `https://m.stock.naver.com/api/stock/${symbol}/integration`,
  )) as Record<string, unknown> | null;
  if (!j) return null;

  const info: Record<string, string> = {};
  for (const it of (j.totalInfos as { key?: string; value?: string }[]) ?? []) {
    const k = String(it.key ?? "").trim();
    if (k) info[k] = String(it.value ?? "").trim();
  }

  const price = numOf(info["전일"]);
  const high52 = numOf(info["52주 최고"]);
  const low52 = numOf(info["52주 최저"]);
  const cons = j.consensusInfo as
    | { priceTargetMean?: string; recommMean?: string }
    | undefined;
  const targetPrice = numOf(cons?.priceTargetMean);
  const irRaw = j.irScheduleInfo as
    | { title?: string; irScheduleDate?: string; irScheduleDday?: number }
    | undefined;

  // 수급은 최근 5거래일을 합산해야 하루치 노이즈에 휘둘리지 않는다
  const trends = (Array.isArray(j.dealTrendInfos) ? j.dealTrendInfos : []).slice(0, 5) as Record<
    string,
    unknown
  >[];
  const sum = (k: string) =>
    trends.reduce((s, t) => s + (numOf(t[k]) ?? 0), 0);
  const flow5d = trends.length
    ? {
        foreigner: sum("foreignerPureBuyQuant"),
        organ: sum("organPureBuyQuant"),
        individual: sum("individualPureBuyQuant"),
      }
    : null;

  return {
    per: numOf(info["PER"]),
    forwardPer: numOf(info["추정PER"]),
    pbr: numOf(info["PBR"]),
    dividendYield: numOf(info["배당수익률"]),
    price,
    high52,
    low52,
    pos52:
      price != null && high52 != null && low52 != null && high52 > low52
        ? ((price - low52) / (high52 - low52)) * 100
        : null,
    ir:
      irRaw?.title && irRaw.irScheduleDate
        ? {
            title: String(irRaw.title),
            date: String(irRaw.irScheduleDate),
            dday: Number(irRaw.irScheduleDday ?? 0),
          }
        : null,
    targetPrice,
    recommMean: numOf(cons?.recommMean),
    targetGap:
      targetPrice != null && price != null && price > 0
        ? ((targetPrice - price) / price) * 100
        : null,
    flow5d,
    reports: (Array.isArray(j.researches) ? j.researches : [])
      .slice(0, 2)
      .map((r) => {
        const o = r as Record<string, unknown>;
        return {
          title: String(o.tit ?? ""),
          broker: String(o.bnm ?? ""),
          date: String(o.wdt ?? ""),
        };
      })
      .filter((r) => r.title),
  };
}

/* ───────────────────────── 시장 개요(인베스팅닷컴식) ─────────────────────────
   지수·거래량 상위·환율. 모두 네이버 실데이터이며, 실패한 항목은 조용히 빠진다. */

export interface MarketRow {
  name: string;
  symbol: string; // 상세/차트 열기용 (없으면 빈 값)
  price: string;
  changeRate: number | null;
  domestic: boolean;
  currency: string;
  market?: string; // 해외 거래소(NASDAQ/NYSE 등). 국내는 생략.
}

const INDEX_DEFS: { name: string; code: string; domestic: boolean }[] = [
  { name: "코스피", code: "KOSPI", domestic: true },
  { name: "코스닥", code: "KOSDAQ", domestic: true },
  { name: "코스피200", code: "KPI200", domestic: true },
  { name: "다우존스", code: ".DJI", domestic: false },
  { name: "S&P 500", code: ".INX", domestic: false },
  { name: "나스닥", code: ".IXIC", domestic: false },
  { name: "닛케이225", code: ".N225", domestic: false },
  { name: "상하이종합", code: ".SSEC", domestic: false },
  { name: "홍콩H", code: ".HSI", domestic: false },
  { name: "독일 DAX", code: ".GDAXI", domestic: false },
];

async function indexQuote(def: { name: string; code: string; domestic: boolean }): Promise<MarketRow | null> {
  const kind = def.domestic ? "domestic" : "worldstock";
  const j = (await jget(
    `https://polling.finance.naver.com/api/realtime/${kind}/index/${encodeURIComponent(def.code)}`,
  )) as { datas?: { closePrice?: string; fluctuationsRatio?: string }[] } | null;
  const d = j?.datas?.[0];
  if (!d?.closePrice) return null;
  const rate = Number(String(d.fluctuationsRatio ?? "").replace(/,/g, ""));
  return {
    name: def.name,
    symbol: def.code,
    price: String(d.closePrice),
    changeRate: Number.isFinite(rate) ? rate : null,
    domestic: def.domestic,
    currency: def.domestic ? "P" : "P",
  };
}

/** 주요 지수 스냅샷 */
export async function getIndices(): Promise<MarketRow[]> {
  const out = await Promise.all(INDEX_DEFS.map((d) => indexQuote(d).catch(() => null)));
  return out.filter((x): x is MarketRow => x != null);
}

const EXCHANGE_DEFS: { name: string; code: string }[] = [
  { name: "미국 USD", code: "FX_USDKRW" },
  { name: "일본 JPY(100엔)", code: "FX_JPYKRW" },
  { name: "유럽연합 EUR", code: "FX_EURKRW" },
  { name: "중국 CNY", code: "FX_CNYKRW" },
  { name: "영국 GBP", code: "FX_GBPKRW" },
  { name: "호주 AUD", code: "FX_AUDKRW" },
];

async function exchangeQuote(def: { name: string; code: string }): Promise<MarketRow | null> {
  const j = (await jget(`https://api.stock.naver.com/marketindex/exchange/${def.code}`)) as {
    exchangeInfo?: { closePrice?: string; fluctuationsRatio?: string; name?: string };
  } | null;
  const e = j?.exchangeInfo;
  if (!e?.closePrice) return null;
  const rate = Number(String(e.fluctuationsRatio ?? "").replace(/,/g, ""));
  return {
    name: def.name,
    symbol: def.code,
    price: String(e.closePrice),
    changeRate: Number.isFinite(rate) ? rate : null,
    domestic: true,
    currency: "원",
  };
}

/** 주요 환율(원화 기준) */
export async function getExchangeRates(): Promise<MarketRow[]> {
  const out = await Promise.all(EXCHANGE_DEFS.map((d) => exchangeQuote(d).catch(() => null)));
  return out.filter((x): x is MarketRow => x != null);
}

/** 거래량 상위 (거래상위 페이지 스크랩, EUC-KR). sosok 0=코스피 1=코스닥 */
export async function getVolumeLeaders(sosok: 0 | 1, limit = 20): Promise<MarketRow[]> {
  try {
    const r = await fetch(
      `https://finance.naver.com/sise/sise_quant.naver?sosok=${sosok}`,
      { headers: H },
    );
    if (!r.ok) return [];
    const html = new TextDecoder("euc-kr").decode(await r.arrayBuffer());
    const out: MarketRow[] = [];
    // 한 덩어리 정규식은 취약하므로 종목 행(<tr>)마다 잘라서 파싱한다.
    for (const row of html.split("<tr")) {
      if (out.length >= limit) break;
      const nameM = row.match(/code=([0-9A-Z]{6})["'][^>]*class="tltle"[^>]*>([^<]+)<\/a>/);
      if (!nameM) continue;
      const code = nameM[1];
      const name = nameM[2].trim();
      if (isNoise(name, code)) continue;
      // 현재가 = 행에서 첫 번째 number td
      const priceM = row.match(/<td class="number">([\d,]+)<\/td>/);
      // 방향: bu_pup/bu_pflu=상승, bu_pdn/bu_pfln=하락
      const up = /bu_p(up|flu)/.test(row);
      // 등락률: % 앞의 숫자
      const rateM = row.match(/([\d.]+)\s*%/);
      const pct = rateM ? Number(rateM[1]) : NaN;
      out.push({
        name,
        symbol: code,
        price: priceM ? priceM[1] : "",
        changeRate: Number.isFinite(pct) ? (up ? pct : -pct) : null,
        domestic: true,
        currency: "원",
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** 해외(미국) 거래량 상위. 네이버 모바일 월드스톡 front-api 실데이터.
 *  stockPriceSortType=top → accumulatedTradingVolume 내림차순(거래량순, 실측 확인). */
export async function getForeignVolumeLeaders(limit = 25): Promise<MarketRow[]> {
  try {
    const url =
      "https://m.stock.naver.com/front-api/worldstock/nation/stock/list" +
      `?stockNationType=USA&stockPriceSortType=top&page=1&pageSize=${limit}`;
    const r = await fetch(url, {
      headers: { ...H, Referer: "https://m.stock.naver.com/" },
    });
    if (!r.ok) return [];
    const j = (await r.json()) as {
      isSuccess?: boolean;
      result?: {
        stocks?: {
          name?: string;
          reutersCode?: string;
          currentPrice?: number;
          currencyType?: string;
          fluctuationsType?: string; // RISING | FALLING | (보합)
          fluctuationsRatio?: string; // 부호 없는/있는 문자열
          stockExchangeType?: string; // NASDAQ | NYSE ...
        }[];
      };
    };
    if (!j.isSuccess || !j.result?.stocks) return [];
    const out: MarketRow[] = [];
    for (const s of j.result.stocks) {
      const sym = (s.reutersCode ?? "").trim();
      const name = (s.name ?? "").trim();
      if (!sym || !name) continue;
      // 등락률: 서버가 부호 없이 줄 수 있어 fluctuationsType으로 방향을 확정한다.
      const raw = Number(String(s.fluctuationsRatio ?? "").replace(/[^0-9.-]/g, ""));
      const mag = Number.isFinite(raw) ? Math.abs(raw) : NaN;
      const changeRate = Number.isFinite(mag)
        ? s.fluctuationsType === "FALLING"
          ? -mag
          : mag
        : null;
      const cp = s.currentPrice;
      const price =
        typeof cp === "number"
          ? cp.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : "";
      out.push({
        name,
        symbol: sym,
        price,
        changeRate,
        domestic: false,
        currency: s.currencyType === "USD" ? "USD" : (s.currencyType ?? ""),
        market: s.stockExchangeType,
      });
    }
    return out;
  } catch {
    return [];
  }
}

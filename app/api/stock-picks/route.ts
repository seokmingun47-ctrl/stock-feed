import { NextRequest, NextResponse } from "next/server";
import { aiFromGeminiBody } from "@/lib/textai";
import { chargeAI } from "@/lib/credits";
import { getUser } from "@/lib/auth";
import { getKrValueUniverse, getStockDetail, getQuote, type ValueRow } from "@/lib/naver";
import { US_STOCKS } from "@/lib/market";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import { SOURCE_MAP } from "@/lib/sources";
import type { Article, Source } from "@/lib/types";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 60;

interface Pick {
  name: string;
  ticker: string;
  market: string;
  per: number | null;
  roe: number | null;
  price: string | null;
  changeRate: number | null;
  score: number; // 정량 점수 (ROE/PER)
  reasons: string[]; // 지표 근거 (코드가 계산한 수치)
  newsPoints: string[]; // 뉴스 근거 — [뉴스N] 인용 필수
  news: Article[];
}

// 국내/해외 공통 후보 형태
interface Candidate {
  name: string;
  ticker: string;
  symbol: string;
  market: string;
  domestic: boolean;
  per: number | null;
  roe: number | null; // 해외는 EPS/BPS로 계산
  price: string | null;
  changeRate: number | null;
  currency: string;
  marketCap: number | null; // 억원 (국내만)
  sector: string | null; // 해외만 (네이버가 업종명을 줌)
}

const toNum = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// 해외 유니버스: 네이버 해외 상세엔 ROE가 없지만 EPS/BPS가 있어 ROE=EPS/BPS 로 계산 가능.
// 업종명도 주기 때문에 국내보다 오히려 설명이 풍부하다.
async function usUniverse(): Promise<Candidate[]> {
  const CHUNK = 12;
  const out: Candidate[] = [];
  for (let i = 0; i < US_STOCKS.length; i += CHUNK) {
    const part = await Promise.all(
      US_STOCKS.slice(i, i + CHUNK).map(async (s): Promise<Candidate | null> => {
        try {
          const [d, q] = await Promise.all([
            getStockDetail(s.symbol, false),
            getQuote({ symbol: s.symbol, domestic: false }),
          ]);
          if (!d) return null;
          const eps = toNum(d.info?.["EPS"]);
          const bps = toNum(d.info?.["BPS"]);
          const roe = eps !== null && bps && bps > 0 ? +((eps / bps) * 100).toFixed(2) : null;
          return {
            name: s.name,
            ticker: s.ticker,
            symbol: s.symbol,
            market: s.market,
            domestic: false,
            per: d.per ?? null,
            roe,
            price: q?.price ?? null,
            changeRate: q?.changeRate ?? null,
            currency: q?.currency ?? "USD",
            marketCap: null,
            sector: d.info?.["업종"] ?? null,
          };
        } catch {
          return null;
        }
      }),
    );
    out.push(...part.filter((x): x is Candidate => !!x));
  }
  return out;
}

function krToCandidates(uni: ValueRow[]): Candidate[] {
  return uni.map((s) => ({
    name: s.name,
    ticker: s.ticker,
    symbol: s.symbol,
    market: s.market,
    domestic: true,
    per: s.per,
    roe: s.roe,
    price: s.price,
    changeRate: s.changeRate,
    currency: "KRW",
    marketCap: s.marketCap,
    sector: null,
  }));
}

// 1단계: 정량 스크리닝 — AI가 고르는 게 아니라 '실제 지표'로 후보를 좁힌다.
// (AI에게 종목을 고르라고 하면 학습된 기억으로 아무 종목이나 뱉어 환각이 된다)
//
// ⚠️ 방향 전환: 예전엔 저PER(싼 종목)만 뽑아 성장·기술주가 통째로 빠졌다.
//    이제는 '높은 ROE = 경쟁력·수익성(기술력·점유율의 대리지표)'으로 뽑는다.
//    해자(기술·브랜드·점유율)를 가진 기업만이 자본 대비 높은 이익(ROE)을 꾸준히 낸다.
//    PER 상한을 크게 풀어(≤80) 고성장 기술주도 후보에 포함시킨다.
function screen(uni: Candidate[], limit: number): Candidate[] {
  return uni
    .filter(
      (s) =>
        s.per !== null &&
        s.per > 0 && // 흑자 기업만 (적자는 ROE 왜곡)
        s.per < 80 && // 극단적 버블만 제외 — 성장주는 포함
        s.roe !== null &&
        s.roe >= 12 && // 경쟁력 있는 기업의 문턱(단순 저평가가 아니라 '잘 버는 회사')
        // 초소형주 제외 — 시장 지위가 있는 규모(국내 5천억↑)
        (s.marketCap === null || s.marketCap >= 5000),
    )
    // ROE 높은 순 = 경쟁력·수익성 우선. (예전의 ROE/PER은 싼 종목을 위로 올렸다)
    .sort((a, b) => (b.roe as number) - (a.roe as number))
    .slice(0, limit);
}

// 2단계: 후보별 실제 뉴스 수집 (추천 이유의 유일한 근거)
async function newsFor(name: string): Promise<Article[]> {
  const base = SOURCE_MAP["gnews_kr"];
  if (!base) return [];
  const src: Source = {
    ...base,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${name} (기술 OR 점유율 OR 1위 OR 경쟁력 OR 수주 OR 신제품 OR 특허 OR 실적 OR 전망) when:21d`,
    )}&hl=ko&gl=KR&ceid=KR:ko`,
  };
  try {
    const arts = (await fetchSource(src)).slice(0, 5);
    if (arts.length) {
      const texts: string[] = [];
      for (const a of arts) texts.push(a.title, a.summary || "");
      const tr = await translateMany(texts);
      let i = 0;
      for (const a of arts) {
        a.title = tr[i++] || a.title;
        a.summary = tr[i++] || a.summary;
      }
    }
    return arts;
  } catch {
    return [];
  }
}

function buildPrompt(s: Candidate, news: Article[]): string {
  const newsBlock = news.length
    ? news
        .map(
          (a, i) =>
            `[뉴스${i + 1}] ${a.title}${a.summary ? `\n  요약: ${a.summary.slice(0, 180)}` : ""}`,
        )
        .join("\n")
    : "(관련 뉴스 없음)";
  const cap = s.marketCap !== null ? ` · 시가총액 ${s.marketCap}억원` : "";
  const sec = s.sector ? ` · 업종 ${s.sector}` : "";
  return `당신은 '제공된 자료'만 정리하는 도구입니다. 아래 지표와 뉴스에 실제로 있는 내용 외에는 쓰지 마세요.

[종목] ${s.name} (${s.ticker}, ${s.market})
[지표] PER ${s.per} · ROE ${s.roe}%${cap}${sec} · 현재가 ${s.price ?? "?"} · 등락 ${s.changeRate ?? "?"}%

[최근 뉴스] ← 사업/실적 설명은 오직 여기서만
${newsBlock}

이 종목은 'ROE ${s.roe}%'로 자본 대비 수익성이 높아(경쟁력 있는 기업) 후보에 올랐습니다.
[최근 뉴스]를 근거로 이 기업의 **기술력·시장 점유율·성장 잠재력**을 설명하세요.

규칙(반드시 지킬 것):
- newsPoints: **[최근 뉴스]에 실제로 있는 내용만**. 항목마다 [뉴스N] 인용 필수.
  * 기술력(신기술·특허·개발), 시장 지위(점유율·1위·수주), 성장(신사업·투자·전망)을
    뉴스에서 찾아 서술. 예) "HBM4 양산으로 AI 메모리 시장 주도 [뉴스2]"
  * 뉴스에 그런 내용이 없으면 **빈 배열 []**. 억지로 채우지 말 것.
- 사전 지식으로 "이 회사는 원래~", "시장 점유율 1위다" 같은 서술 금지(뉴스에 없으면 쓰지 말 것).
  없는 수치·점유율·수주·전망 창작 금지.
- "사라/오른다/유망" 같은 투자 권유·주가 예측 금지. 보도된 사실만 건조하게.
- risk: 이 종목을 볼 때 주의할 점을 뉴스나 지표에 근거해 1~2개. 근거 없으면 빈 배열.

아래 JSON만 응답:
{"newsPoints":["뉴스에 나온 기술력·점유율·성장 사실 [뉴스N]","..."],"risk":["주의할 점","..."]}`;
}

function parseOne(raw: string, newsCount: number): { newsPoints: string[]; risk: string[] } {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as { newsPoints?: unknown; risk?: unknown };
    const cited = (v: unknown) =>
      Array.isArray(v)
        ? v
            .map((x) => String(x).trim())
            .filter((x) => {
              const m = x.match(/\[뉴스\s*(\d+)\]/);
              if (!m) return false;
              const n = Number(m[1]);
              return n >= 1 && n <= newsCount;
            })
            .slice(0, 4)
        : [];
    return {
      newsPoints: cited(o.newsPoints),
      risk: Array.isArray(o.risk)
        ? o.risk.map((x) => String(x).trim()).filter(Boolean).slice(0, 2)
        : [],
    };
  } catch {
    return { newsPoints: [], risk: [] };
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });

  let body: { region?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* 본문 없어도 기본 국내 */
  }
  const region = body.region === "us" ? "us" : "kr";

  // 무료 플랜도 크레딧으로 이용(프로 전용 아님). 프로는 chargeAI에서 무제한 처리.
  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  // 1) 정량 스크리닝
  const uni =
    region === "us" ? await usUniverse() : krToCandidates(await getKrValueUniverse(2));
  const candidates = screen(uni, 5);
  if (!candidates.length) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "조건에 맞는 종목을 찾지 못했어요." },
      { status: 502 },
    );
  }

  // 2) 종목별 뉴스 + AI 설명
  const picks: Pick[] = await Promise.all(
    candidates.map(async (s) => {
      const news = await newsFor(s.name);
      const per = s.per as number;
      const roe = s.roe as number;
      let ai = { newsPoints: [] as string[], risk: [] as string[] };
      try {
        const out = await aiFromGeminiBody(
          JSON.stringify({
            contents: [{ role: "user", parts: [{ text: buildPrompt(s, news) }] }],
            generationConfig: {
              temperature: 0,
              responseMimeType: "application/json",
              maxOutputTokens: 700,
            },
          }),
        );
        if (out) ai = parseOne(out, news.length);
      } catch {
        /* 개별 실패는 지표만으로 표시 */
      }
      return {
        name: s.name,
        ticker: s.ticker,
        market: s.market,
        per,
        roe,
        price: s.price,
        changeRate: s.changeRate,
        score: Number((roe / per).toFixed(2)),
        // 지표 근거는 코드가 만든 문장 (AI 창작 아님)
        // marketCap 단위는 '억원' (네이버 시총 표 기준). 해외는 값이 없어 업종으로 대체.
        reasons: [
          `PER ${per}배로 이익 대비 주가가 낮은 편입니다.`,
          `ROE ${roe}%로 자기자본 대비 수익성이 확보돼 있습니다.`,
          s.marketCap !== null
            ? s.marketCap >= 10000
              ? `시가총액 ${(s.marketCap / 10000).toFixed(1)}조원 규모입니다.`
              : `시가총액 ${s.marketCap.toLocaleString()}억원 규모입니다.`
            : s.sector
              ? `업종은 ${s.sector}입니다.`
              : "",
        ].filter(Boolean),
        newsPoints: ai.newsPoints,
        risk: ai.risk,
        news,
        domestic: s.domestic,
        symbol: s.symbol,
        currency: s.currency,
      } as Pick & { risk: string[] };
    }),
  );

  return NextResponse.json({
    ok: true,
    region,
    picks,
    screened: uni.length,
    criteria:
      region === "us"
        ? "흑자 · PER 80배 미만 · ROE 12% 이상 (EPS/BPS 기준) → ROE(수익성) 상위"
        : "흑자 · PER 80배 미만 · ROE 12% 이상 · 시총 5000억 이상 → ROE(수익성) 상위",
    credits: charge.credits,
  });
}

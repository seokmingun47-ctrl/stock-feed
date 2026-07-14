import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";
import { chargeAI } from "@/lib/credits";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import { SOURCE_MAP } from "@/lib/sources";
import type { Article, Source } from "@/lib/types";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface Analysis {
  outlook: "상승" | "하락" | "중립";
  upsidePercent: number;
  horizon: string;
  confidence: "높음" | "보통" | "낮음";
  summary: string;
  reasons: string[];
  risks: string[];
}

// 종목 관련 뉴스 (구글뉴스 검색 → 인앱 리더로 읽힘)
async function relatedNews(name: string): Promise<Article[]> {
  const base = SOURCE_MAP["gnews_kr"];
  if (!base) return [];
  const src: Source = {
    ...base,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${name} 주가`,
    )}&hl=ko&gl=KR&ceid=KR:ko`,
  };
  let arts: Article[] = [];
  try {
    arts = (await fetchSource(src)).slice(0, 6);
  } catch {
    return [];
  }
  if (arts.length) {
    try {
      const texts: string[] = [];
      for (const a of arts) texts.push(a.title, a.summary || "");
      const tr = await translateMany(texts);
      let i = 0;
      for (const a of arts) {
        a.title = tr[i++] || a.title;
        a.summary = tr[i++] || a.summary;
      }
    } catch {
      /* 번역 실패해도 원문 사용 */
    }
  }
  return arts;
}

function buildPrompt(
  name: string,
  ticker: string,
  market: string,
  price: string,
  currency: string,
  headlines: string[],
): string {
  const news = headlines.length
    ? headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")
    : "(관련 뉴스 없음 — 일반적 시장 지식으로 판단)";
  return `당신은 증권 애널리스트입니다. 아래 종목의 향후 주가 전망을 '참고용'으로 분석하세요.
이것은 확정 예측이 아니라 추정이며, 뉴스와 일반적 펀더멘털을 근거로 합니다.

종목: ${name} (${ticker || "?"}, ${market || "?"})
현재가: ${price || "?"} ${currency}

[최근 관련 뉴스 헤드라인]
${news}

⚠️ 규칙:
- upsidePercent는 현재가 대비 예상 상승여력(%)입니다. 하락 예상이면 음수. 과장 금지 — 대체로 -40~+60 범위에서 현실적으로.
- reasons/risks는 위 뉴스나 알려진 펀더멘털에 근거해야 하며, 지어내지 마세요.
- 모든 문장은 한국어. 확신 과장 금지.

반드시 아래 JSON만 응답:
{"outlook":"상승|하락|중립","upsidePercent":0,"horizon":"예: 3~6개월","confidence":"높음|보통|낮음","summary":"전망 2~3문장","reasons":["근거 문장", "..."],"risks":["리스크 문장", "..."]}`;
}

function parseAnalysis(raw: string): Analysis | null {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    return null;
  }
  const outlookRaw = String(o.outlook ?? "중립");
  const outlook: Analysis["outlook"] =
    outlookRaw === "상승" ? "상승" : outlookRaw === "하락" ? "하락" : "중립";
  const confRaw = String(o.confidence ?? "보통");
  const confidence: Analysis["confidence"] =
    confRaw === "높음" ? "높음" : confRaw === "낮음" ? "낮음" : "보통";
  let up = Number(o.upsidePercent);
  if (!Number.isFinite(up)) up = 0;
  up = Math.max(-90, Math.min(300, Math.round(up * 10) / 10));
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 5)
      : [];
  return {
    outlook,
    upsidePercent: up,
    horizon: String(o.horizon ?? "").trim().slice(0, 30) || "3~6개월",
    confidence,
    summary: String(o.summary ?? "").trim().slice(0, 500),
    reasons: arr(o.reasons),
    risks: arr(o.risks),
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "서버에 GEMINI_API_KEY가 설정되지 않았어요." },
      { status: 500 },
    );
  }
  let body: {
    name?: unknown;
    ticker?: unknown;
    market?: unknown;
    price?: unknown;
    currency?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 40);
  if (!name) {
    return NextResponse.json({ ok: false, reason: "종목명이 없어요." }, { status: 400 });
  }
  const ticker = String(body.ticker ?? "").trim().slice(0, 12);
  const market = String(body.market ?? "").trim().slice(0, 12);
  const price = String(body.price ?? "").trim().slice(0, 20);
  const currency = String(body.currency ?? "").trim().slice(0, 8);

  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  // 뉴스 + AI 분석 병렬
  const news = await relatedNews(name);
  const headlines = news.map((a) => a.title).slice(0, 6);

  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(name, ticker, market, price, currency, headlines) },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      maxOutputTokens: 1200,
    },
  });

  const outText = await geminiRace(apiKey, requestBody);
  if (!outText) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요.", news },
      { status: 503 },
    );
  }
  const analysis = parseAnalysis(outText);
  if (!analysis) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요.", news },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, analysis, news, credits: charge.credits });
}

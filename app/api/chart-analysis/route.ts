import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";
import { chargeAI } from "@/lib/credits";
import { getUser } from "@/lib/auth";
import { getChart, type Candle } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface ChartAnalysis {
  trend: "상승" | "하락" | "횡보";
  summary: string;
  levels: string[]; // 지지/저항 — 계산된 수치 기반
  patterns: string[]; // 관찰된 패턴
  outlook: string; // 시나리오 (예측 아님을 명시)
  band: { low: number; high: number } | null; // 예상 변동 범위
}

// 지표는 코드가 계산한다 (AI에게 숫자를 만들게 하면 환각이 난다)
function indicators(c: Candle[]) {
  const closes = c.map((x) => x.c);
  const n = closes.length;
  const sma = (p: number) =>
    n >= p ? +(closes.slice(-p).reduce((a, b) => a + b, 0) / p).toFixed(2) : null;

  // RSI(14)
  let gain = 0,
    loss = 0;
  for (let i = Math.max(1, n - 14); i < n; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  const rs = loss === 0 ? 100 : gain / loss;
  const rsi = +(100 - 100 / (1 + rs)).toFixed(1);

  const recent = c.slice(-60);
  const hi = Math.max(...recent.map((x) => x.h));
  const lo = Math.min(...recent.map((x) => x.l));
  const last = closes[n - 1];

  // 변동성 (일간 수익률 표준편차)
  const rets: number[] = [];
  for (let i = Math.max(1, n - 20); i < n; i++) rets.push(closes[i] / closes[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const vol = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1));

  return {
    last,
    sma5: sma(5),
    sma20: sma(20),
    sma60: sma(60),
    rsi,
    high60: +hi.toFixed(2),
    low60: +lo.toFixed(2),
    volPct: +(vol * 100).toFixed(2),
    // 20일 변동성 기반 1주일(5거래일) 통계적 범위 — 예언이 아니라 계산값
    band: {
      low: +(last * (1 - vol * Math.sqrt(5))).toFixed(2),
      high: +(last * (1 + vol * Math.sqrt(5))).toFixed(2),
    },
  };
}

function buildPrompt(name: string, ind: ReturnType<typeof indicators>, c: Candle[]): string {
  const last20 = c
    .slice(-20)
    .map((x) => `${x.d.slice(4)}:${x.c}`)
    .join(" ");
  return `당신은 '계산된 지표'만 해석하는 차트 분석 도구입니다. 아래 수치 외에 어떤 숫자도 만들지 마세요.

[종목] ${name}
[계산된 지표] ← 이 수치만 인용
- 현재가: ${ind.last}
- 이동평균: 5일 ${ind.sma5 ?? "N/A"} · 20일 ${ind.sma20 ?? "N/A"} · 60일 ${ind.sma60 ?? "N/A"}
- RSI(14): ${ind.rsi}
- 최근 60봉 고점 ${ind.high60} / 저점 ${ind.low60}
- 20일 일간 변동성: ${ind.volPct}%
- 변동성 기반 1주일 통계 범위: ${ind.band.low} ~ ${ind.band.high}
[최근 20봉 종가] ${last20}

규칙(반드시 지킬 것):
- **위 수치만 인용**. 없는 수치·목표가·확률을 만들지 말 것.
- trend는 이동평균 배열과 종가 흐름으로만 판단(상승/하락/횡보 중 하나).
- levels: 지지/저항을 위 고점·저점·이동평균 수치로만 서술.
- patterns: 정배열/역배열, 이평선 돌파, 과매수(RSI 70↑)/과매도(RSI 30↓) 등 **관찰 가능한 사실**만.
- outlook: "오른다/내린다" 단정 금지. "~를 지키면 …, 이탈하면 …" 형태의 **조건부 시나리오**로만.
- 투자 권유·매수매도 지시 금지.

아래 JSON만 응답:
{"trend":"상승|하락|횡보","summary":"1~2문장","levels":["지지/저항 서술",".."],"patterns":["관찰된 사실",".."],"outlook":"조건부 시나리오 1~2문장"}`;
}

function parse(raw: string): Omit<ChartAnalysis, "band"> | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as Record<string, unknown>;
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 4) : [];
    const t = String(o.trend ?? "");
    return {
      trend: t === "상승" || t === "하락" ? t : "횡보",
      summary: String(o.summary ?? "").trim().slice(0, 300),
      levels: arr(o.levels),
      patterns: arr(o.patterns),
      outlook: String(o.outlook ?? "").trim().slice(0, 300),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 40);
  const symbol = String(body.symbol ?? "").trim();
  const domestic = !!body.domestic;
  if (!name || !symbol) {
    return NextResponse.json({ ok: false, reason: "종목 정보가 없어요." }, { status: 400 });
  }

  // 차트 분석은 프로 전용
  const user = await getUser(req);
  if (!user?.isPro) {
    return NextResponse.json(
      { ok: false, reason: "AI 차트 분석은 프로 전용이에요.", code: "PRO_ONLY" },
      { status: 403 },
    );
  }

  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  const candles = await getChart({ symbol, domestic }, "day");
  if (!candles || candles.length < 20) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "차트 데이터를 불러오지 못했어요." },
      { status: 502 },
    );
  }

  const ind = indicators(candles);
  const out = await geminiRace(
    apiKey,
    JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPrompt(name, ind, candles) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        maxOutputTokens: 900,
      },
    }),
  );
  if (!out) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
  const parsed = parse(out);
  if (!parsed) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    analysis: { ...parsed, band: ind.band },
    indicators: ind,
    credits: charge.credits,
  });
}

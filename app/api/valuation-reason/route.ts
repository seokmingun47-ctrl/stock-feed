import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";
import { chargeAI } from "@/lib/credits";
import { getValuationContext, type ValuationContext } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface Reason {
  summary: string;
  points: string[];
}

function buildPrompt(
  name: string,
  price: string,
  mode: "under" | "over",
  c: ValuationContext,
): string {
  const label = mode === "under" ? "저평가(PER이 낮은 편)" : "고평가(PER이 높은 편)";
  const peers = c.peers.length
    ? c.peers.map((p) => `- ${p.name}: PER ${p.per ?? "N/A"}, PBR ${p.pbr ?? "N/A"}`).join("\n")
    : "(동종업계 데이터 없음)";
  return `당신은 '제공된 수치'만 비교·정리하는 도구입니다. 아래 [데이터]에 실제로 있는 숫자 외에는 어떤 사실·전망·뉴스도 쓰지 마세요. 인터넷 지식으로 보완하지 말고, 주관적 판단('싸다/비싸다/매력적/좋다')도 쓰지 마세요. 오직 숫자 비교만.

[종목] ${name} (현재가 ${price || "N/A"})
[밸류에이션 지표]
- PER: ${c.per ?? "N/A"}
- PBR: ${c.pbr ?? "N/A"}
- EPS: ${c.eps ?? "N/A"}
- 배당수익률: ${c.dividend ?? "N/A"}
- 시가총액: ${c.marketCap ?? "N/A"}
- 업종: ${c.industry ?? "N/A"}
- 52주 최고/최저: ${c.high52 ?? "N/A"} / ${c.low52 ?? "N/A"}
- 애널리스트 목표주가 평균: ${c.targetPrice ?? "N/A"}
- 애널리스트 투자의견 평균: ${c.recommMean ?? "N/A"} (1=강력매수, 3=중립, 5=강력매도)
[동종업계 비교]
${peers}

이 종목은 PER 기준으로 '${label}' 그룹으로 분류됐습니다.
위 [데이터]의 숫자만 근거로, 왜 그렇게 분류되는지 '객관적으로' 설명하세요.

규칙(반드시 지킬 것):
- 위에 나온 숫자만 인용. 없는 값·추정·뉴스·전망을 지어내지 말 것.
- 주관적 평가어 금지. "PER 8.16으로 동종업계 현대차 13.38보다 낮다" 처럼 숫자 비교로만 서술.
- 동종업계 PER/PBR 비교, 목표주가 대비 현재가, 52주 위치 등 '상대적' 근거 위주.
- N/A인 항목은 언급하지 말 것.

아래 JSON만 응답:
{"summary":"숫자를 포함한 1~2문장 요약","points":["숫자를 인용한 근거 문장", "..."]}`;
}

function parse(raw: string): Reason | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as { summary?: unknown; points?: unknown };
    const summary = String(o.summary ?? "").trim().slice(0, 400);
    const points = Array.isArray(o.points)
      ? o.points.map((p) => String(p).trim()).filter(Boolean).slice(0, 6)
      : [];
    if (!summary && !points.length) return null;
    return { summary, points };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });
  }
  let body: {
    name?: unknown;
    symbol?: unknown;
    domestic?: unknown;
    price?: unknown;
    mode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 40);
  const symbol = String(body.symbol ?? "").trim();
  const domestic = !!body.domestic;
  const price = String(body.price ?? "").trim();
  const mode: "under" | "over" = body.mode === "over" ? "over" : "under";
  if (!name || !symbol) {
    return NextResponse.json({ ok: false, reason: "종목 정보가 없어요." }, { status: 400 });
  }

  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  const ctx = await getValuationContext(symbol, domestic);
  if (!ctx) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "지표 데이터를 불러오지 못했어요." },
      { status: 502 },
    );
  }

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(name, price, mode, ctx) }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 900 },
  });
  const out = await geminiRace(apiKey, requestBody);
  if (!out) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." }, { status: 503 });
  }
  const reason = parse(out);
  if (!reason) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, mode, reason, context: ctx, credits: charge.credits });
}

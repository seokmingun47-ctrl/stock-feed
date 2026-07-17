import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";
import { chargeAI } from "@/lib/credits";
import { COUNTRY_KO } from "@/lib/econ";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface Explain {
  what: string; // 이게 뭔지
  why: string; // 왜 중요한지
  howToRead: string; // 숫자 읽는 법
  market: string; // 시장 영향
}

function buildPrompt(o: {
  titleEn: string;
  title: string;
  country: string;
  forecast: string;
  previous: string;
  actual: string;
}): string {
  const nation = COUNTRY_KO[o.country] || o.country || "해당 국가";
  const nums = [
    o.actual ? `- 실제 발표치: ${o.actual}` : "",
    o.forecast ? `- 시장 예상치: ${o.forecast}` : "",
    o.previous ? `- 직전 수치: ${o.previous}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `당신은 경제 지표를 처음 보는 사람에게 쉽게 설명하는 도우미입니다.

[지표] ${o.title} (원문: ${o.titleEn})
[국가] ${nation}
${nums || "(공개된 수치 없음)"}

위 지표를 초보 투자자도 이해할 수 있게 쉬운 한국어로 설명하세요.

규칙(반드시 지킬 것):
- 이 지표가 무엇을 측정하는지는 일반적인 경제 상식으로 설명해도 됩니다.
- 단, **숫자는 위에 주어진 것만 인용**하세요. 없는 수치·날짜·전망을 지어내지 마세요.
- "오를 것이다/사라/팔아라" 같은 투자 권유·단정적 예측은 금지.
- 각 항목은 1~2문장, 쉬운 말로. 전문용어를 쓰면 괄호로 풀어주세요.

아래 JSON만 응답:
{"what":"이 지표가 무엇인지","why":"왜 시장이 주목하는지","howToRead":"숫자가 높으면/낮으면 어떤 의미인지","market":"보통 주식·환율에 어떻게 연결되는지(일반론)"}`;
}

function parse(raw: string): Explain | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as Record<string, unknown>;
    const g = (k: string) => String(o[k] ?? "").trim().slice(0, 400);
    const e: Explain = {
      what: g("what"),
      why: g("why"),
      howToRead: g("howToRead"),
      market: g("market"),
    };
    if (!e.what && !e.why) return null;
    return e;
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
  const titleEn = String(body.titleEn ?? "").trim().slice(0, 120);
  const title = String(body.title ?? titleEn).trim().slice(0, 120);
  if (!titleEn && !title) {
    return NextResponse.json({ ok: false, reason: "지표 정보가 없어요." }, { status: 400 });
  }
  const opts = {
    titleEn,
    title,
    country: String(body.country ?? "").trim(),
    forecast: String(body.forecast ?? "").trim(),
    previous: String(body.previous ?? "").trim(),
    actual: String(body.actual ?? "").trim(),
  };

  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(opts) }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 800,
    },
  });
  const out = await geminiRace(apiKey, requestBody);
  if (!out) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
  const explain = parse(out);
  if (!explain) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, explain, credits: charge.credits });
}

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 속도 우선 (2.5-flash는 무료 한도 429로 즉시 실패해 느리게 함 → 뒤로)
const MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

const RETRY_DEADLINE_MS = 24000;
const PER_CALL_MS = 10000;

function buildPrompt(title: string, text: string): string {
  return `당신은 증권 애널리스트입니다. 아래 [본문]을 분석해, 이 뉴스와 직접 관련되거나 뚜렷하게 영향을 받을 상장 종목을 추립니다.

⚠️ 매우 중요:
- [본문]에 실제로 언급됐거나, 내용상 명확히 영향받는 종목만 포함하세요. 억지로 개수를 채우지 마세요(0~5개).
- 확실하지 않은 종목은 넣지 마세요. 추천 근거는 반드시 본문 내용에 기반해야 합니다.
- 본문에 없는 종목을 상상해서 만들지 마세요.

각 종목 필드:
- name: 한글 종목명 (예: 삼성전자, 엔비디아)
- ticker: 종목 코드/심볼 (알면. 국내는 6자리, 미국은 티커. 모르면 "")
- market: 시장 (KOSPI/KOSDAQ/NASDAQ/NYSE 등, 모르면 "")
- sentiment: 이 뉴스가 해당 종목에 호재면 "positive", 악재면 "negative", 불분명하면 "neutral"
- reason: 왜 관련되고 어떤 영향인지 한 문장(공백 포함 80자 이내)

반드시 아래 JSON만 응답:
{"stocks":[{"name":"","ticker":"","market":"","sentiment":"","reason":""}]}

[제목]
${title}

[본문]
${text}`;
}

type Stock = {
  name: string;
  ticker: string;
  market: string;
  sentiment: "positive" | "negative" | "neutral";
  reason: string;
};

function parseStocks(raw: string): Stock[] | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  let arr: unknown;
  try {
    const j = JSON.parse(clean);
    arr = Array.isArray(j) ? j : (j as { stocks?: unknown }).stocks;
  } catch {
    return null;
  }
  if (!Array.isArray(arr)) return null;
  const out: Stock[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = String(o.name ?? "").trim();
    if (!name) continue;
    const s = String(o.sentiment ?? "neutral").toLowerCase();
    const sentiment: Stock["sentiment"] =
      s === "positive" ? "positive" : s === "negative" ? "negative" : "neutral";
    out.push({
      name: name.slice(0, 40),
      ticker: String(o.ticker ?? "").trim().slice(0, 12),
      market: String(o.market ?? "").trim().slice(0, 12),
      sentiment,
      reason: String(o.reason ?? "").trim().slice(0, 120),
    });
    if (out.length >= 5) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "서버에 GEMINI_API_KEY가 설정되지 않았어요." },
      { status: 500 },
    );
  }

  let body: { title?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const title = String(body.title ?? "").slice(0, 300);
  const text = String(body.text ?? "").trim().slice(0, 4000);
  if (text.length < 120) {
    return NextResponse.json(
      { ok: false, reason: "분석할 본문이 충분하지 않아요." },
      { status: 400 },
    );
  }

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(title, text) }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 900,
    },
  });

  const startedAt = Date.now();
  let data: unknown = null;
  let lastStatus = 0;
  let authFailed = false;

  while (!data && !authFailed && Date.now() - startedAt < RETRY_DEADLINE_MS) {
    for (const model of MODELS) {
      if (Date.now() - startedAt >= RETRY_DEADLINE_MS) break;
      const ac = new AbortController();
      const tt = setTimeout(() => ac.abort(), PER_CALL_MS);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: requestBody,
            signal: ac.signal,
          },
        );
        lastStatus = res.status;
        if (res.ok) {
          data = await res.json();
          break;
        }
        if (res.status === 400 || res.status === 403) {
          authFailed = true;
          break;
        }
      } catch {
        /* 타임아웃/네트워크 → 다음 모델 */
      } finally {
        clearTimeout(tt);
      }
    }
    if (!data && !authFailed && Date.now() - startedAt < RETRY_DEADLINE_MS) {
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (!data) {
    const reason =
      lastStatus === 400 || lastStatus === 403
        ? "AI 키가 올바르지 않거나 권한이 없어요."
        : lastStatus === 429
          ? "AI 무료 사용량을 잠시 초과했어요. 1~2분 뒤 다시 시도해 주세요."
          : "AI 분석 중 오류가 났어요. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ ok: false, reason }, { status: lastStatus || 500 });
  }

  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const outText =
    d.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? "").join("") ?? "";
  const stocks = parseStocks(outText);
  if (stocks === null) {
    return NextResponse.json(
      { ok: false, reason: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, stocks });
}

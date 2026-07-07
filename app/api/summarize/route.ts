import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 무료 티어에서 텍스트가 되는 Gemini 모델들 (앞에서부터 시도).
// ⚠️ 요약 정확도를 위해 성능 좋은 2.5-flash를 먼저 — lite 모델은 짧은 본문에서
// 없는 내용을 지어내는(환각) 경향이 있어 뒤로 뺌. lite는 한도 초과 시 폴백용.
const MODELS = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
];

const RETRY_DEADLINE_MS = 20000;

function buildPrompt(title: string, text: string): string {
  return `당신은 증권·경제 뉴스 요약 도우미입니다. 아래 [본문]에 실제로 적힌 내용만 근거로 한국어 핵심 요약을 만드세요.

⚠️ 매우 중요 — 환각 금지:
- 오직 [본문]에 실제로 등장하는 사실만 사용하세요. 본문에 없는 기업명·인물·수치·사건은 절대 추가하지 마세요.
- 당신이 이미 알고 있는 외부 지식으로 내용을 보완하거나 추측하지 마세요.
- 기업명·숫자·날짜를 바꾸지 말고 본문 그대로 쓰세요. (예: 본문이 '삼성전자'면 다른 회사로 바꾸지 말 것)
- 본문이 짧으면 요약도 짧아도 됩니다. 억지로 늘리지 마세요.

작성 규칙:
- 본문에서 가장 중요한 사실 2~5개를 뽑아 각각 한 문장(공백 포함 90자 이내)으로.
- 숫자·기업명·핵심 원인/결과 위주. 광고·구독 안내·기자명·저작권 문구는 제외.
- 반드시 아래 JSON 형식으로만 응답: {"summary": ["첫 번째 핵심", "두 번째 핵심", ...]}

[제목]
${title}

[본문]
${text}`;
}

// 응답 텍스트에서 {"summary":[...]} 추출
function parseSummary(raw: string): string[] | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const j = JSON.parse(clean);
    const arr = Array.isArray(j) ? j : j.summary;
    if (Array.isArray(arr)) {
      const out = arr
        .map((x) => String(x).replace(/^[-•*\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 6);
      return out.length ? out : null;
    }
  } catch {
    /* fall through */
  }
  // JSON 실패 시: 줄 단위 폴백
  const lines = clean
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((l) => l.length > 5);
  return lines.length ? lines.slice(0, 6) : null;
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
  const text = String(body.text ?? "").trim().slice(0, 8000);
  if (text.length < 120) {
    return NextResponse.json(
      { ok: false, reason: "요약할 본문이 충분하지 않아요." },
      { status: 400 },
    );
  }

  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(title, text) }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const startedAt = Date.now();
  let data: unknown = null;
  let lastStatus = 0;
  let authFailed = false;

  while (!data && !authFailed && Date.now() - startedAt < RETRY_DEADLINE_MS) {
    for (const model of MODELS) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: requestBody,
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
      if (Date.now() - startedAt >= RETRY_DEADLINE_MS) break;
    }
    if (!data && !authFailed && Date.now() - startedAt < RETRY_DEADLINE_MS) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!data) {
    const reason =
      lastStatus === 400 || lastStatus === 403
        ? "AI 키가 올바르지 않거나 권한이 없어요."
        : lastStatus === 429
          ? "AI 무료 사용량을 잠시 초과했어요. 1~2분 뒤 다시 시도해 주세요."
          : "AI 요약 중 오류가 났어요. 잠시 후 다시 시도해 주세요.";
    return NextResponse.json({ ok: false, reason }, { status: lastStatus || 500 });
  }

  const d = data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const out =
    d.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? "").join("") ?? "";
  const summary = parseSummary(out);
  if (!summary) {
    return NextResponse.json(
      { ok: false, reason: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, summary });
}

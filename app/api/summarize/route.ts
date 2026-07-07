import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

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
  // 요약은 앞부분이 핵심 → 입력을 3500자로 제한(생성 속도↑)
  const text = String(body.text ?? "").trim().slice(0, 3500);
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
      maxOutputTokens: 800, // 짧은 불릿이라 출력 상한 → 생성 속도↑
    },
  });

  const out = await geminiRace(apiKey, requestBody);
  if (!out) {
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }

  const summary = parseSummary(out);
  if (!summary) {
    return NextResponse.json(
      { ok: false, reason: "AI 응답을 해석하지 못했어요. 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, summary });
}

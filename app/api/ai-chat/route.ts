import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

const SYSTEM =
  "당신은 증권·경제 뉴스 앱 'Newsync' 안의 친절한 AI 어시스턴트입니다. 한국어로 간결하고 정확하게 답하세요. 종목·증시·경제 질문을 잘 도와주되, 투자 관련 답변에는 참고용이며 최종 투자 판단·책임은 본인에게 있음을 필요할 때 안내하세요.";

// 인앱 AI 대화 (Gemini)
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "서버에 GEMINI_API_KEY가 설정되지 않았어요." },
      { status: 500 },
    );
  }
  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const raw = Array.isArray(body.messages) ? body.messages : [];
  // 최근 20턴, role=user|model
  const contents = raw
    .slice(-20)
    .map((m) => {
      const o = m as { role?: unknown; text?: unknown };
      const role = o.role === "model" ? "model" : "user";
      const text = String(o.text ?? "").slice(0, 4000);
      return { role, parts: [{ text }] };
    })
    .filter((c) => c.parts[0].text.trim());
  if (!contents.length) {
    return NextResponse.json({ ok: false, reason: "메시지가 없어요." }, { status: 400 });
  }

  const requestBody = JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: SYSTEM }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 1400 },
  });

  const reply = await geminiRace(apiKey, requestBody);
  if (!reply) {
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, reply });
}

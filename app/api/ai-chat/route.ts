import { NextRequest, NextResponse } from "next/server";
import { geminiRace, GEMINI3_MODELS } from "@/lib/gemini";
import { groqChat, type GroqMsg } from "@/lib/groq";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

const SYSTEM =
  "당신은 증권·경제 뉴스 앱 'Newsync' 안의 친절한 AI 어시스턴트입니다. 한국어로 간결하고 정확하게 답하세요. 종목·증시·경제 질문을 잘 도와주되, 투자 관련 답변에는 참고용이며 최종 투자 판단·책임은 본인에게 있음을 필요할 때 안내하세요.";

interface Turn {
  role: "user" | "model";
  text: string;
}

// 요청 메시지를 안전하게 파싱(최근 20턴, 빈 텍스트 제거)
function parseTurns(raw: unknown): Turn[] {
  return (Array.isArray(raw) ? raw : [])
    .slice(-20)
    .map((m) => {
      const o = m as { role?: unknown; text?: unknown };
      const role: "user" | "model" = o.role === "model" ? "model" : "user";
      return { role, text: String(o.text ?? "").slice(0, 4000) };
    })
    .filter((t) => t.text.trim());
}

// 인앱 AI 대화 — app 별로 모델 라우팅 (gemini / gemini3 = 구글, llama = Groq)
export async function POST(req: NextRequest) {
  let body: { messages?: unknown; app?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const app = String(body.app ?? "gemini");
  const turns = parseTurns(body.messages);
  if (!turns.length) {
    return NextResponse.json({ ok: false, reason: "메시지가 없어요." }, { status: 400 });
  }

  // --- Llama (Groq) ---
  if (app === "llama") {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({
        ok: false,
        reason:
          "라마(Llama)는 무료 Groq API 키가 필요해요. console.groq.com/keys 에서 카드 없이 발급받아 알려주시면 바로 대화할 수 있어요! 그전까지는 재미나이·제미나이 3를 이용해 주세요 😊",
      });
    }
    const messages: GroqMsg[] = [
      { role: "system", content: SYSTEM },
      ...turns.map<GroqMsg>((t) => ({
        role: t.role === "model" ? "assistant" : "user",
        content: t.text,
      })),
    ];
    const reply = await groqChat(groqKey, messages);
    if (!reply) {
      return NextResponse.json(
        { ok: false, reason: "라마가 잠시 혼잡해요. 다시 시도해 주세요." },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, reply });
  }

  // --- Gemini / Gemini 3 (Google) ---
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, reason: "서버에 GEMINI_API_KEY가 설정되지 않았어요." },
      { status: 500 },
    );
  }
  const contents = turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
  const requestBody = JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: SYSTEM }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 1400 },
  });

  const reply = await geminiRace(
    apiKey,
    requestBody,
    app === "gemini3" ? GEMINI3_MODELS : undefined,
  );
  if (!reply) {
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, reply });
}

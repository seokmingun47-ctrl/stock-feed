// Groq — 메타 Llama 오픈모델을 무료로 초고속 서빙(OpenAI 호환 API).
// 무료 키(카드 불필요): https://console.groq.com/keys → 환경변수 GROQ_API_KEY.
// 키가 없으면 호출부에서 안내 메시지를 보여줌.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// 1순위 고성능, 실패 시 초경량으로 폴백.
const GROQ_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
const PER_CALL_MS = 18000;

export interface GroqMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

// messages(시스템 포함)로 Llama 답변 텍스트 반환. 실패 시 null.
export async function groqChat(
  apiKey: string,
  messages: GroqMsg[],
): Promise<string | null> {
  for (const model of GROQ_MODELS) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), PER_CALL_MS);
    try {
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1400,
        }),
        signal: ac.signal,
      });
      if (!res.ok) continue; // 다음 모델로 폴백
      const d = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = d.choices?.[0]?.message?.content ?? "";
      if (text.trim()) return text;
    } catch {
      /* 타임아웃·네트워크 → 다음 모델 */
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

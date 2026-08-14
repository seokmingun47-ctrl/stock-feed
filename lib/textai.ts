import "server-only";
import { geminiRace } from "./gemini";

/**
 * 텍스트 AI 통합 창구.
 * ⚠️ 유튜브 '영상' 이해는 여기 못 쓴다 — NVIDIA/Gemini-text 둘 다 영상 입력 불가.
 *    영상은 link-summary가 Gemini 멀티모달을 직접 호출한다.
 *
 * 정책: NVIDIA(무료·별도 한도)를 먼저 쓰고, 실패하면 Gemini로 폴백한다.
 *   → 텍스트 작업을 NVIDIA로 넘겨 Gemini의 하루 한도를 '영상 전용'으로 아낀다.
 */
const NV_KEY = process.env.NVIDIA_API_KEY || "";
// 실측: 한국어 요약·JSON 출력 정확, 6~7초. (llama-3.3-70b는 130초로 탈락, qwen2.5 이름은 404)
const NV_MODEL = "deepseek-ai/deepseek-v4-pro";
const NV_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

async function nvidiaChat(
  prompt: string,
  opts: { maxTokens?: number; timeoutMs?: number },
): Promise<string | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), opts.timeoutMs ?? 30000);
  try {
    const r = await fetch(NV_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NV_KEY}`,
      },
      body: JSON.stringify({
        model: NV_MODEL,
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: opts.maxTokens ?? 1200,
        // DeepSeek의 reasoning은 시간을 크게 늘리므로 끈다(요약/분석엔 불필요).
        extra_body: { chat_template_kwargs: { thinking: false } },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: ac.signal,
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = j.choices?.[0]?.message?.content ?? "";
    return text.trim() ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * 프롬프트 텍스트를 넣으면 모델 출력(문자열)을 돌려준다.
 * json=true면 JSON을 기대(코드펜스는 호출부에서 벗겨 파싱).
 */
export async function aiText(
  prompt: string,
  opts: { maxTokens?: number; json?: boolean; timeoutMs?: number } = {},
): Promise<string | null> {
  // 1) NVIDIA 우선
  if (NV_KEY) {
    const out = await nvidiaChat(prompt, {
      maxTokens: opts.maxTokens,
      timeoutMs: opts.timeoutMs,
    });
    if (out) return out;
  }
  // 2) Gemini 폴백
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
      maxOutputTokens: opts.maxTokens ?? 1000,
    },
  });
  return geminiRace(apiKey, body, undefined, opts.timeoutMs);
}

/**
 * 기존 라우트들이 만들어 둔 Gemini 형식 requestBody를 그대로 받아 처리하는 어댑터.
 * `geminiRace(apiKey, requestBody)` → `aiFromGeminiBody(requestBody)` 한 줄 교체용.
 * NVIDIA면 requestBody에서 프롬프트·maxTokens만 뽑아 쓰고, 폴백은 원본 body로 Gemini 호출.
 */
export async function aiFromGeminiBody(requestBody: string): Promise<string | null> {
  if (NV_KEY) {
    try {
      const b = JSON.parse(requestBody) as {
        contents?: { parts?: { text?: string }[] }[];
        generationConfig?: { maxOutputTokens?: number };
      };
      const prompt = (b.contents ?? [])
        .flatMap((c) => (c.parts ?? []).map((p) => p.text ?? ""))
        .join("\n")
        .trim();
      if (prompt) {
        const out = await nvidiaChat(prompt, {
          maxTokens: b.generationConfig?.maxOutputTokens,
        });
        if (out) return out;
      }
    } catch {
      /* 파싱 실패 시 그냥 Gemini로 */
    }
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return geminiRace(apiKey, requestBody);
}

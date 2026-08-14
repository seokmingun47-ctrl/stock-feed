// Gemini 호출 — 여러 모델을 동시에 쏴서 가장 먼저 성공한 응답을 씀(꼬리 지연 감소).
// 무료 티어가 혼잡할 때 순차 폴백(느림·타임아웃)을 피하려는 목적.

// 빠르고 요약/분석에 충분한 모델들. (gemini-2.5-flash는 이 계정 무료 한도 429라 제외)
const RACE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
];
// 최신 3세대 — 더 똑똑하고 이 계정 무료 한도 안에서 빠름(측정: <1s). '제미나이 3' 어시스턴트용.
export const GEMINI3_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
];
const PER_CALL_MS = 14000;

// requestBody(JSON 문자열)를 여러 모델에 병렬 요청 → 첫 성공 응답의 텍스트 반환(없으면 null)
export async function geminiRace(
  apiKey: string,
  requestBody: string,
  models: string[] = RACE_MODELS,
  // 유튜브 영상 이해처럼 오래 걸리는 작업은 기본 14초로는 반드시 타임아웃 난다.
  timeoutMs: number = PER_CALL_MS,
  // 실패 사유를 알아야 할 때 배열을 넘기면 모델별 에러가 담긴다.
  // (예: 429 한도 초과인지, 단순 지연인지 구분해 사용자에게 정확히 안내)
  errorsOut?: string[],
): Promise<string | null> {
  const call = async (model: string): Promise<string> => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
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
      if (!res.ok) {
        errorsOut?.push(`${model}:${res.status}`);
        throw new Error(`status ${res.status}`);
      }
      const d = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text =
        d.candidates?.[0]?.content?.parts?.map((p) => p?.text ?? "").join("") ?? "";
      if (!text.trim()) throw new Error("empty");
      return text;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    // 첫 번째로 성공(fulfilled)하는 모델의 결과. 전부 실패해야 reject.
    return await Promise.any(models.map(call));
  } catch {
    return null;
  }
}

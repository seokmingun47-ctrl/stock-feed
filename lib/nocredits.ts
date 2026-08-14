// AI 기능이 402(NO_CREDITS)를 받으면 어디서든 광고 보상 모달을 띄우기 위한 신호.
// AI 호출 지점이 8곳이라 props로 내려주면 배선이 지저분해져 전역 이벤트로 처리한다.
export const NO_CREDITS_EVENT = "newsync:no-credits";

/** 응답이 크레딧 부족이면 모달을 띄우고 true를 반환 */
export function handleNoCredits(d: unknown): boolean {
  const code = (d as { code?: unknown } | null | undefined)?.code;
  if (code !== "NO_CREDITS") return false;
  try {
    window.dispatchEvent(new CustomEvent(NO_CREDITS_EVENT));
  } catch {
    /* SSR 등에서는 무시 */
  }
  return true;
}

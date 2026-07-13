// 앱 테마 (라이트/다크) — <html data-theme> + localStorage.
export type Theme = "light" | "dark";
const KEY = "stockfeed:theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* noop */
  }
  // 모바일 브라우저 상단바 색도 맞춤
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#ffffff" : "#0a0e17");
}

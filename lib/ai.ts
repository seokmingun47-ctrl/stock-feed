import type { Source } from "./types";

// AI 앱 — 팔로우하면 상단 칩으로 뜨고, 탭하면 대화(gemini) 또는 웹앱(외부)로.
// Source 형태를 만족시켜 SourceAvatar/Chip 재사용. (뉴스 SOURCES와는 별개 — 피드 fetch 안 함)
export interface AiApp extends Source {
  mode: "chat" | "web"; // chat=인앱 대화(Gemini), web=웹앱 열기
  webUrl?: string;
  desc: string;
}

export const AI_APPS: AiApp[] = [
  {
    id: "gemini",
    name: "Gemini",
    handle: "@GoogleGemini",
    category: "AI",
    region: "global",
    url: "",
    domain: "gemini.google.com",
    color: "#1a73e8",
    mode: "chat",
    desc: "인앱에서 바로 대화",
  },
  {
    id: "gemini3",
    name: "Gemini 3",
    handle: "@GoogleDeepMind",
    category: "AI",
    region: "global",
    url: "",
    domain: "deepmind.google",
    color: "#8b3dff",
    mode: "chat",
    desc: "최신 3세대 · 더 똑똑함",
  },
  {
    id: "llama",
    name: "Llama",
    handle: "@MetaAI",
    category: "AI",
    region: "global",
    url: "",
    domain: "meta.ai",
    color: "#0866ff",
    mode: "chat",
    desc: "메타 오픈모델 · 초고속",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    handle: "@OpenAI",
    category: "AI",
    region: "global",
    url: "",
    domain: "chatgpt.com",
    color: "#0d8f6f",
    mode: "web",
    webUrl: "https://chatgpt.com/",
    desc: "웹앱 열기",
  },
  {
    id: "claude",
    name: "Claude",
    handle: "@AnthropicAI",
    category: "AI",
    region: "global",
    url: "",
    domain: "claude.ai",
    color: "#d97757",
    mode: "web",
    webUrl: "https://claude.ai/",
    desc: "웹앱 열기",
  },
];

export const AI_MAP: Record<string, AiApp> = Object.fromEntries(
  AI_APPS.map((a) => [a.id, a]),
);

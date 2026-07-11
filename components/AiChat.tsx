"use client";

import { useEffect, useRef, useState } from "react";
import type { AiApp } from "@/lib/ai";
import SourceAvatar from "./SourceAvatar";

interface Msg {
  id: number;
  role: "user" | "model";
  text: string;
}

const SUGGESTIONS = [
  "오늘 증시 흐름 요약해줘",
  "삼성전자 요즘 어때?",
  "초보 투자자 포트폴리오 짜줘",
  "금리와 주가 관계 쉽게 설명해줘",
];

// **bold** 정도만 가볍게 렌더
function renderText(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export default function AiChat({
  app,
  onClose,
}: {
  app: AiApp;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 0,
      role: "model",
      text: `안녕하세요! ${app.name} AI 어시스턴트예요. 증시·종목·경제 무엇이든 물어보세요 😊`,
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  const scrollToBottom = (smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, busy]);

  const send = async (preset?: string) => {
    const t = (preset ?? text).trim();
    if (!t || busy) return;
    const userMsg: Msg = { id: idRef.current++, role: "user", text: t };
    const next = [...messages, userMsg];
    setMessages(next);
    setText("");
    setBusy(true);
    try {
      const d = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: app.id,
          messages: next
            .filter((m) => m.id !== 0)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      }).then((r) => r.json());
      setMessages((cur) => [
        ...cur,
        {
          id: idRef.current++,
          role: "model",
          text: d.ok ? d.reply : d.reason || "답변을 가져오지 못했어요.",
        },
      ]);
    } catch {
      setMessages((cur) => [
        ...cur,
        { id: idRef.current++, role: "model", text: "네트워크 오류예요. 다시 시도해 주세요." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text hover:bg-bg-soft"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <SourceAvatar source={app} size={32} />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-text">{app.name}</div>
            <div className="text-[11px] text-muted">AI 어시스턴트 · 인앱 대화</div>
          </div>
        </header>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.map((m) => {
            const mine = m.role === "user";
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && <SourceAvatar source={app} size={30} />}
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${
                    mine
                      ? "rounded-br-md bg-accent text-white"
                      : "rounded-bl-md bg-bg-soft text-text"
                  }`}
                >
                  {renderText(m.text)}
                </div>
              </div>
            );
          })}
          {busy && (
            <div className="flex gap-2">
              <SourceAvatar source={app} size={30} />
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-bg-soft px-4 py-3">
                <Dot d={0} />
                <Dot d={0.15} />
                <Dot d={0.3} />
              </div>
            </div>
          )}

          {messages.length <= 1 && !busy && (
            <div className="flex flex-wrap gap-2 px-1 pt-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-border bg-bg-soft px-3 py-1.5 text-[13px] font-medium text-muted hover:border-accent hover:text-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-bg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={2000}
              placeholder={`${app.name}에게 물어보기…`}
              className="min-w-0 flex-1 rounded-full border border-border bg-bg-soft px-4 py-2.5 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              onClick={() => send()}
              disabled={!text.trim() || busy}
              aria-label="보내기"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted">
            AI가 생성한 답변이며 부정확할 수 있어요. 투자 판단은 본인 책임.
          </p>
        </div>
      </div>
    </div>
  );
}

function Dot({ d }: { d: number }) {
  return (
    <span
      className="h-2 w-2 rounded-full bg-muted"
      style={{ animation: "aiblink 1s infinite", animationDelay: `${d}s` }}
    />
  );
}

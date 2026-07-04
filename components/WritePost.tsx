"use client";

import { useState } from "react";
import type { Post, PostKind } from "@/lib/community";

export default function WritePost({
  username,
  initialKind = "post",
  onClose,
  onCreated,
}: {
  username: string;
  initialKind?: PostKind;
  onClose: () => void;
  onCreated: (p: Post) => void;
}) {
  const [kind, setKind] = useState<PostKind>(initialKind);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagText, setTagText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isNews = kind === "news";

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const tags = tagText
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean);
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, tags, kind }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErr(d.reason || "등록에 실패했어요.");
        setBusy(false);
        return;
      }
      onCreated(d.post);
    } catch {
      setErr("네트워크 오류예요.");
      setBusy(false);
    }
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <button
            onClick={onClose}
            className="text-[15px] text-muted hover:text-text"
          >
            취소
          </button>
          <span className="text-[16px] font-bold text-text">
            {isNews ? "뉴스 작성" : "글쓰기"}
          </span>
          <button
            onClick={submit}
            disabled={!title.trim() || busy}
            className="rounded-full bg-accent px-4 py-1.5 text-[14px] font-bold text-white disabled:opacity-40"
          >
            {busy ? "등록 중…" : "등록"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* 글 유형 선택 — 뉴스는 팔로우한 사람의 뉴스 피드에 노출됨 */}
          <div className="mb-4 inline-flex rounded-full bg-bg-soft p-1">
            {(
              [
                ["post", "자유글"],
                ["news", "뉴스"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
                  kind === k ? "bg-accent text-white" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder={isNews ? "뉴스 제목" : "제목"}
            className="w-full bg-transparent text-[20px] font-bold text-text outline-none placeholder:text-muted"
          />
          <div className="mt-1 text-[12px] text-muted">
            {username}님으로 {isNews ? "뉴스 발행" : "작성"}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            placeholder={
              isNews
                ? "뉴스 내용을 작성하세요. 팔로워들이 뉴스 피드에서 보게 됩니다."
                : "자유롭게 이야기를 나눠보세요. (증시 전망, 종목 토론 등)"
            }
            className="mt-4 min-h-[240px] w-full resize-none bg-transparent text-[16px] leading-relaxed text-text outline-none placeholder:text-muted"
          />
          <input
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            placeholder="태그 (예: 삼성전자 반도체 코스피) — 띄어쓰기로 구분"
            className="mt-2 w-full border-t border-border bg-transparent pt-3 text-[14px] text-accent outline-none placeholder:text-muted"
          />
          {err && <p className="mt-3 text-[13px] text-[var(--down)]">{err}</p>}
        </div>
      </div>
    </div>
  );
}

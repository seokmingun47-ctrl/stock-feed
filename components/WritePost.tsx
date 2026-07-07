"use client";

import { useRef, useState } from "react";
import type { Post, PostKind } from "@/lib/community";
import { uploadImage } from "@/lib/upload";

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
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const isNews = kind === "news";

  const pickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setErr("");
    setUploading(true);
    try {
      const room = 4 - images.length;
      const list = Array.from(files).slice(0, Math.max(0, room));
      const urls: string[] = [];
      for (const f of list) urls.push(await uploadImage(f, "post"));
      setImages((cur) => [...cur, ...urls].slice(0, 4));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!title.trim() || busy || uploading) return;
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
        body: JSON.stringify({ title, body, tags, kind, images }),
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
            className="mt-4 min-h-[180px] w-full resize-none bg-transparent text-[16px] leading-relaxed text-text outline-none placeholder:text-muted"
          />

          {/* 사진 첨부 */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => pickFiles(e.target.files)}
          />
          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {images.map((url, i) => (
                <div key={url} className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full rounded-xl object-cover" />
                  <button
                    onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
                    aria-label="사진 삭제"
                    className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length < 4 && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 flex items-center gap-2 rounded-full bg-bg-soft px-4 py-2 text-[13.5px] font-semibold text-muted hover:text-text disabled:opacity-60"
            >
              {uploading ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              )}
              {uploading ? "올리는 중…" : `사진 추가 (${images.length}/4)`}
            </button>
          )}

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

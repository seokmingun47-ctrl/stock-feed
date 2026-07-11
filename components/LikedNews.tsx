"use client";

import { useEffect, useState } from "react";
import { SOURCE_MAP } from "@/lib/sources";
import type { NewsItem } from "@/lib/community";
import SourceAvatar from "./SourceAvatar";

// 기록 — 하트(좋아요) 누른 뉴스 모아보기
export default function LikedNews({
  onOpenArticle,
  onClose,
}: {
  onOpenArticle: (item: NewsItem) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    const c = new AbortController();
    fetch("/api/news/liked", { signal: c.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(d.ok ? d.items : []))
      .catch(() => setItems([]));
    return () => c.abort();
  }, []);

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

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-text hover:bg-bg-soft"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="flex-1 text-[16px] font-bold text-text">기록</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          {items === null ? (
            <SkeletonList />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <span className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-bg-soft">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
                </svg>
              </span>
              <p className="text-[17px] font-bold text-text">아직 저장한 뉴스가 없어요</p>
              <p className="mt-2 text-[14px] text-muted">
                뉴스를 읽다가 <span className="font-semibold text-[#f6465d]">하트</span>를 누르면 여기에 모여요.
              </p>
            </div>
          ) : (
            items.map((n) => (
              <LikedCard key={n.url} item={n} onOpen={() => onOpenArticle(n)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LikedCard({ item, onOpen }: { item: NewsItem; onOpen: () => void }) {
  const s = SOURCE_MAP[item.sourceId];
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-bg-soft active:bg-bg-soft"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          {s && <SourceAvatar source={s} size={20} />}
          <span className="font-semibold text-text">{s?.name ?? "뉴스"}</span>
        </div>
        <h3 className="mt-1.5 text-[16px] font-bold leading-snug text-text">
          {item.title}
        </h3>
        <div className="mt-2 flex items-center gap-4 text-[12px]">
          <span className="flex items-center gap-1 font-semibold text-[#f6465d]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f6465d" stroke="#f6465d" strokeWidth="2" strokeLinejoin="round">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </svg>
            {item.likeCount}
          </span>
          <span className="flex items-center gap-1 text-muted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z" />
            </svg>
            {item.commentCount}
          </span>
        </div>
      </div>
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className="h-[76px] w-[76px] shrink-0 rounded-xl object-cover"
        />
      )}
    </button>
  );
}

function SkeletonList() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b border-border px-4 py-4">
          <div className="mb-2 h-3 w-24 rounded bg-bg-soft" />
          <div className="mb-2 h-4 w-[85%] rounded bg-bg-soft" />
          <div className="h-3 w-16 rounded bg-bg-soft" />
        </div>
      ))}
    </div>
  );
}

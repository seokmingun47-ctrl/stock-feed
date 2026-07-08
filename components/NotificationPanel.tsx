"use client";

import { useEffect } from "react";
import { SOURCE_MAP } from "@/lib/sources";
import type { Article } from "@/lib/types";
import SourceAvatar from "./SourceAvatar";
import { timeAgo } from "@/lib/format";

// 알림 목록 — 관심 종목·키워드 관련 새 뉴스
export default function NotificationPanel({
  items,
  seen,
  hasInterests,
  onOpenArticle,
  onOpenInterests,
  onClose,
}: {
  items: Article[];
  seen: Set<string>;
  hasInterests: boolean;
  onOpenArticle: (a: Article) => void;
  onOpenInterests: () => void;
  onClose: () => void;
}) {
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
          <span className="flex-1 text-[16px] font-bold text-text">알림</span>
          <button
            onClick={onOpenInterests}
            className="rounded-full bg-bg-soft px-3 py-1.5 text-[13px] font-semibold text-text hover:bg-card-hover"
          >
            관심 설정
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {!hasInterests ? (
            <Empty
              title="관심을 설정하면 알림을 받아요"
              desc="관심 종목·키워드를 추가하면 관련 새 뉴스를 여기서 알려드려요."
              action={onOpenInterests}
              actionLabel="관심 종목·키워드 추가"
            />
          ) : items.length === 0 ? (
            <Empty
              title="새 알림이 없어요"
              desc="관심 종목·키워드에 새 뉴스가 뜨면 여기에 표시돼요."
            />
          ) : (
            items.map((a) => {
              const s = SOURCE_MAP[a.sourceId];
              const unread = !seen.has(a.link);
              return (
                <button
                  key={a.id}
                  onClick={() => onOpenArticle(a)}
                  className={`flex w-full items-start gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-bg-soft ${
                    unread ? "bg-accent/[0.06]" : ""
                  }`}
                >
                  {unread ? (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  ) : (
                    <span className="mt-1.5 h-2 w-2 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[12px] text-muted">
                      {s && <SourceAvatar source={s} size={18} />}
                      <span className="font-semibold text-text">
                        {s?.name ?? "뉴스"}
                      </span>
                      <span>· {timeAgo(a.publishedAt)}</span>
                    </div>
                    <p
                      className={`mt-1 text-[15px] leading-snug ${
                        unread ? "font-bold text-text" : "font-medium text-muted"
                      }`}
                    >
                      {a.title}
                    </p>
                  </div>
                  {a.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.image}
                      alt=""
                      loading="lazy"
                      className="h-[54px] w-[54px] shrink-0 rounded-lg object-cover"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function Empty({
  title,
  desc,
  action,
  actionLabel,
}: {
  title: string;
  desc: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
      <span className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-bg-soft text-muted">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </span>
      <p className="text-[17px] font-bold text-text">{title}</p>
      <p className="mt-2 text-[14px] text-muted">{desc}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="mt-5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

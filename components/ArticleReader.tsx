"use client";

import { useEffect, useState } from "react";
import type { Article, Source } from "@/lib/types";
import SourceAvatar from "./SourceAvatar";
import { timeAgo } from "@/lib/format";

interface ReaderData {
  ok: boolean;
  title?: string;
  image?: string | null;
  paragraphs?: string[];
  reason?: string;
}

export default function ArticleReader({
  article,
  source,
  onClose,
}: {
  article: Article;
  source: Source;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/article?url=${encodeURIComponent(article.link)}`, {
      signal: c.signal,
    })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ ok: false, reason: "error" }));
    return () => c.abort();
  }, [article.link]);

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

  const title = data?.ok ? data.title : article.title;
  const image = data?.ok ? data.image : article.image;
  const showImg = image && imgOk;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[600px]">
        {/* 헤더 */}
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-bg/95 px-3 py-2.5 backdrop-blur">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-text hover:bg-bg-soft"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SourceAvatar source={source} size={24} />
            <span className="truncate text-[14px] font-semibold text-text">
              {source.name}
            </span>
            <span className="shrink-0 text-[12px] text-muted">
              · {timeAgo(article.publishedAt)}
            </span>
          </div>
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-full bg-bg-soft px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text"
          >
            원문 ↗
          </a>
        </header>

        <article className="px-5 pb-24 pt-4">
          <h1 className="text-[22px] font-extrabold leading-snug text-text">
            {title}
          </h1>
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-accent">
            <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold">
              한국어 번역
            </span>
          </div>

          {showImg && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image as string}
              alt=""
              onError={() => setImgOk(false)}
              className="mt-4 w-full rounded-xl object-cover"
            />
          )}

          {/* 본문 */}
          {!data ? (
            <Loading />
          ) : data.ok ? (
            <div className="mt-5 space-y-4">
              {data.paragraphs!.map((p, i) => (
                <p key={i} className="text-[16px] leading-[1.75] text-text">
                  {p}
                </p>
              ))}
              <p className="pt-2 text-[12px] text-muted">
                자동 번역된 내용으로, 원문과 다를 수 있어요.
              </p>
            </div>
          ) : (
            <Fallback summary={article.summary} link={article.link} />
          )}
        </article>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 py-10 text-muted">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="spin">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      </svg>
      <span className="text-[14px]">본문을 가져와 한국어로 번역하는 중…</span>
    </div>
  );
}

function Fallback({ summary, link }: { summary: string; link: string }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-bg-soft p-5 text-center">
      <p className="text-[15px] font-semibold text-text">
        이 매체는 앱 안에서 본문을 불러올 수 없어요
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        (유료 구독이거나 외부 접근을 막은 사이트예요)
      </p>
      {summary && (
        <p className="mt-4 text-left text-[14px] leading-relaxed text-muted">
          {summary}
        </p>
      )}
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
      >
        원문에서 보기 ↗
      </a>
    </div>
  );
}

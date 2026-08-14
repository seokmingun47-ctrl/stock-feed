"use client";

import { useState } from "react";
import type { Article, Source } from "@/lib/types";
import SourceAvatar from "./SourceAvatar";
import { timeAgo } from "@/lib/format";

export default function ArticleCard({
  article,
  source,
  translate,
  onRead,
  onQuickSummary,
}: {
  article: Article;
  source: Source;
  translate: boolean;
  onRead: (a: Article) => void;
  onQuickSummary?: (a: Article) => void; // 'AI 요약' 칩 — 리더를 열며 자동 요약
}) {
  const [imgOk, setImgOk] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const showImg = article.image && imgOk;

  // 해외 기사 + 번역 켜짐이면 "한국어로 보기" 뱃지 표시
  const viaTranslate = translate && source.region === "global";

  return (
    <div className="border-b border-border">
      <a
        href={article.link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // 모든 기사를 앱 안 리더로 부드럽게 열기 (사이트 이동 X)
          e.preventDefault();
          onRead(article);
        }}
        className="block px-4 pb-2 pt-3.5 transition-colors active:bg-bg-soft hover:bg-bg-soft"
      >
        <div className="flex items-center gap-2">
          <SourceAvatar source={source} size={28} />
          <span className="text-[15px] font-semibold text-text">
            {source.name}
          </span>
          <span className="truncate text-[13px] text-muted">
            {source.handle}
          </span>
          <span className="text-[13px] text-muted">·</span>
          <span className="shrink-0 text-[13px] text-muted">
            {timeAgo(article.publishedAt)}
          </span>
          {viaTranslate && (
            <span className="ml-auto shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
              한국어로 보기
            </span>
          )}
        </div>

        <div className="mt-2 flex gap-3">
          <div className="min-w-0 flex-1">
            <h3
              className={`text-[16px] font-bold leading-snug text-text ${
                source.id === "truthsocial" ? "line-clamp-4" : ""
              }`}
            >
              {article.title}
            </h3>
            {article.summary && source.id !== "truthsocial" && (
              <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-muted">
                {article.summary}
              </p>
            )}
          </div>
          {showImg && (
            // 썸네일 자리를 미리 확보하고(레이아웃 안 튐), 로딩 전엔 카드색과
            // 거의 같은 은은한 상자만 두었다가 이미지가 준비되면 페이드인.
            // → 스크롤할 때마다 빈 상자(실루엣)가 툭 튀는 현상 제거.
            <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-bg-soft/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.image as string}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgOk(false)}
                className={`h-full w-full object-cover transition-opacity duration-300 ${
                  imgLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </div>
          )}
        </div>
      </a>

      {/* 목록에서 바로 보이는 AI 진입점 — 대부분의 사용자가 기사를 열지 않아
          이 칩이 없으면 AI 기능을 영영 발견하지 못한다(가입자 76%가 미사용이었음). */}
      {onQuickSummary && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <button
            onClick={() => onQuickSummary(article)}
            className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-2.5 py-1 text-[12px] font-bold text-accent transition-colors hover:bg-accent/20"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.9 5.5L19.5 9l-4.6 3.3 1.6 5.7L12 14.8 7.5 18l1.6-5.7L4.5 9l5.6-1.5z" />
            </svg>
            AI 요약
          </button>
        </div>
      )}
    </div>
  );
}

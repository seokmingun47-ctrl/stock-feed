"use client";

import { useState } from "react";
import type { Article, Source } from "@/lib/types";
import SourceAvatar from "./SourceAvatar";
import { timeAgo, googleTranslateUrl } from "@/lib/format";

export default function ArticleCard({
  article,
  source,
  translate,
}: {
  article: Article;
  source: Source;
  translate: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const showImg = article.image && imgOk;

  // 번역 켜짐 + 해외 기사면 누를 때 구글 번역(한국어) 페이지로 열기
  const viaTranslate = translate && source.region === "global";
  const href = viaTranslate ? googleTranslateUrl(article.link) : article.link;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block border-b border-border px-4 py-3.5 transition-colors active:bg-bg-soft hover:bg-bg-soft"
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
            한국어로 열기
          </span>
        )}
      </div>

      <div className="mt-2 flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold leading-snug text-text">
            {article.title}
          </h3>
          {article.summary && (
            <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-muted">
              {article.summary}
            </p>
          )}
        </div>
        {showImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.image as string}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-[76px] w-[76px] shrink-0 rounded-xl object-cover"
          />
        )}
      </div>
    </a>
  );
}

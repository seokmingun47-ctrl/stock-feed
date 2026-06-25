"use client";

import { useState } from "react";
import type { Article, Source } from "@/lib/types";
import SourceAvatar from "./SourceAvatar";
import { timeAgo } from "@/lib/format";

export default function ArticleCard({
  article,
  source,
}: {
  article: Article;
  source: Source;
}) {
  const [imgOk, setImgOk] = useState(true);
  const showImg = article.image && imgOk;

  return (
    <a
      href={article.link}
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

"use client";

import { useState } from "react";
import type { Source } from "@/lib/types";
import { faviconUrl } from "@/lib/format";

interface Props {
  source: Source;
  size?: number;
  ring?: boolean;
}

export default function SourceAvatar({ source, size = 56, ring }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = source.name.replace(/[^A-Za-z가-힣]/g, "").slice(0, 1) || "?";

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: source.color,
        boxShadow: ring ? `0 0 0 2px var(--bg), 0 0 0 4px ${source.color}` : undefined,
      }}
    >
      {failed ? (
        <span
          className="font-bold text-white"
          style={{ fontSize: size * 0.4 }}
        >
          {initial}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faviconUrl(source.domain)}
          alt={source.name}
          width={size * 0.62}
          height={size * 0.62}
          loading="lazy"
          onError={() => setFailed(true)}
          className="rounded-[5px] bg-white"
          style={{ width: size * 0.62, height: size * 0.62 }}
        />
      )}
    </span>
  );
}

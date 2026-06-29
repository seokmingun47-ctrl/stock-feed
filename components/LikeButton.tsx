"use client";

import { useState } from "react";

export default function LikeButton({
  targetType,
  targetId,
  meta,
  initialLiked,
  initialCount,
  size = "md",
}: {
  targetType: "post" | "news";
  targetId: string;
  meta?: { title?: string; sourceId?: string; image?: string | null };
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const prevLiked = liked;
    const prevCount = count;
    const nl = !prevLiked;
    setLiked(nl);
    setCount(prevCount + (nl ? 1 : -1));
    try {
      const r = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, meta }),
      });
      const d = await r.json();
      if (d.ok) {
        setLiked(d.liked);
        setCount(d.count);
      } else {
        setLiked(prevLiked);
        setCount(prevCount);
      }
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setBusy(false);
    }
  };

  const px = size === "sm" ? 14 : 18;
  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 ${
        size === "sm" ? "text-[12px]" : "text-[13px]"
      } font-semibold transition-colors ${liked ? "text-[#f6465d]" : "text-muted hover:text-text"}`}
      aria-label="좋아요"
    >
      <svg width={px} height={px} viewBox="0 0 24 24" fill={liked ? "#f6465d" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
      {count}
    </button>
  );
}

"use client";

import { useState } from "react";

export default function FollowButton({
  authorId,
  initialFollowing,
  onChange,
  size = "md",
}: {
  authorId: string;
  initialFollowing: boolean;
  onChange?: (following: boolean) => void;
  size?: "sm" | "md";
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    const next = !following;
    setFollowing(next); // 낙관적
    setBusy(true);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId }),
      });
      const d = await res.json();
      if (!d.ok) {
        setFollowing(!next); // 롤백
        if (res.status === 401) alert("로그인이 필요해요.");
      } else {
        setFollowing(d.following);
        onChange?.(d.following);
      }
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  };

  const pad = size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`shrink-0 rounded-full font-bold transition-colors disabled:opacity-60 ${pad} ${
        following
          ? "border border-border bg-transparent text-muted hover:border-[#f6465d] hover:text-[#f6465d]"
          : "bg-accent text-white"
      }`}
    >
      {following ? "팔로잉" : "팔로우"}
    </button>
  );
}

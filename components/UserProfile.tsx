"use client";

import { useEffect, useState } from "react";
import type { Post, User } from "@/lib/community";
import NewsPostCard from "./NewsPostCard";
import FollowButton from "./FollowButton";
import PostDetail from "./PostDetail";

// 유저 프로필/채널 — 작성자 이름을 누르면 열림. 그 유저의 뉴스 + 팔로우.
export default function UserProfile({
  authorId,
  username,
  user,
  onClose,
  onFollowChange,
}: {
  authorId: string;
  username: string;
  user: User;
  onClose: () => void;
  onFollowChange?: () => void;
}) {
  const [news, setNews] = useState<Post[] | null>(null);
  const [name, setName] = useState(username);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [detail, setDetail] = useState<Post | null>(null);
  const isMe = authorId === user.id;

  const load = () => {
    fetch(`/api/authors/${authorId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setNews(d.news ?? []);
          setName(d.author?.username ?? username);
          setFollowing(!!d.following);
          setFollowerCount(Number(d.author?.followerCount ?? 0));
        } else {
          setNews([]);
        }
      })
      .catch(() => setNews([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorId]);

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

  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="reader-enter fixed inset-0 z-[55] flex flex-col bg-bg">
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
          <span className="flex-1 text-[16px] font-bold text-text">프로필</span>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* 프로필 카드 */}
          <div className="flex items-center gap-3.5 border-b-[6px] border-bg-soft px-4 py-5">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7b5cff] to-[#18b6e6] text-[26px] font-black text-white">
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[19px] font-extrabold text-text">
                {name}
                {isMe && (
                  <span className="ml-1.5 text-[12px] font-semibold text-muted">
                    (나)
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[13px] text-muted">
                유저 뉴스 {news?.length ?? 0}건 · 팔로워 {followerCount}
              </div>
            </div>
            {!isMe && (
              <FollowButton
                authorId={authorId}
                initialFollowing={following}
                onChange={(f) => {
                  setFollowing(f);
                  setFollowerCount((c) => Math.max(0, c + (f ? 1 : -1)));
                  onFollowChange?.();
                }}
              />
            )}
          </div>

          {/* 뉴스 목록 */}
          {news === null ? (
            <SkeletonList />
          ) : news.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
              <p className="text-[16px] font-bold text-text">
                아직 발행한 뉴스가 없어요
              </p>
              <p className="mt-2 text-[14px] text-muted">
                {isMe
                  ? "자유게시판 글쓰기에서 '뉴스'로 발행하면 여기에 모여요."
                  : `${name}님이 뉴스를 올리면 여기에 표시돼요.`}
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 pt-3 pb-1 text-[13px] font-bold text-muted">
                발행한 뉴스
              </div>
              {news.map((p) => (
                <NewsPostCard key={p.id} post={p} onOpen={() => setDetail(p)} />
              ))}
            </>
          )}
        </div>
      </div>

      {detail && (
        <PostDetail
          post={detail}
          user={user}
          onClose={() => setDetail(null)}
          onFollowChange={onFollowChange}
          onChanged={load}
          onDeleted={(id) => {
            setDetail(null);
            setNews((cur) => (cur ? cur.filter((p) => p.id !== id) : cur));
          }}
        />
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border-b border-border px-4 py-4">
          <div className="mb-2 h-3 w-20 rounded bg-bg-soft" />
          <div className="mb-2 h-4 w-[80%] rounded bg-bg-soft" />
          <div className="h-3 w-[60%] rounded bg-bg-soft" />
        </div>
      ))}
    </div>
  );
}

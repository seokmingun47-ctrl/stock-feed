"use client";

import { useCallback, useEffect, useState } from "react";
import type { Post, User } from "@/lib/community";
import { timeAgo } from "@/lib/format";
import PostDetail from "./PostDetail";
import WritePost from "./WritePost";
import LikeButton from "./LikeButton";

export default function Community({
  user,
  onFollowChange,
}: {
  user: User;
  onFollowChange?: () => void;
}) {
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<Post | null>(null);
  const [writing, setWriting] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await fetch(`/api/posts?sort=${sort}`, { cache: "no-store" });
      const d = await r.json();
      if (!d.ok) {
        setErr(d.reason || "불러오지 못했어요.");
        setPosts([]);
        return;
      }
      setPosts(d.posts);
    } catch {
      setErr("네트워크 오류예요.");
      setPosts([]);
    }
  }, [sort]);

  useEffect(() => {
    load();
  }, [load]);

  const dbMissing = err && /community_posts|relation|table|no-db/i.test(err);

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pb-1 pt-3">
          <h1 className="text-[19px] font-extrabold tracking-tight text-text">
            자유게시판
          </h1>
        </div>
        <div className="flex gap-1 px-3 pb-1">
          {(
            [
              ["latest", "최신"],
              ["popular", "인기"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`relative px-3 py-2 text-[14px] font-semibold ${
                sort === key ? "text-text" : "text-muted"
              }`}
            >
              {label}
              {sort === key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1">
        {posts === null ? (
          <SkeletonList />
        ) : dbMissing ? (
          <Notice
            title="게시판 준비 중"
            desc="DB 테이블을 아직 만들지 않았어요. 설정이 끝나면 바로 이용할 수 있어요."
          />
        ) : err ? (
          <Notice title="불러오지 못했어요" desc={err} onRetry={load} />
        ) : posts.length === 0 ? (
          <Notice
            title="아직 글이 없어요"
            desc="첫 글을 남겨 커뮤니티를 시작해보세요!"
          />
        ) : (
          posts.map((p) => (
            <PostCard key={p.id} post={p} onOpen={() => setDetail(p)} />
          ))
        )}
      </main>

      {/* 글쓰기 FAB (중앙 정렬 컨테이너 오른쪽 하단) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-40 mx-auto max-w-[600px] px-4">
        <button
          onClick={() => setWriting(true)}
          aria-label="글쓰기"
          className="pointer-events-auto ml-auto grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {detail && (
        <PostDetail
          post={detail}
          user={user}
          onClose={() => setDetail(null)}
          onChanged={load}
          onFollowChange={onFollowChange}
          onDeleted={(id) => {
            setDetail(null);
            setPosts((cur) => (cur ? cur.filter((p) => p.id !== id) : cur));
          }}
        />
      )}
      {writing && (
        <WritePost
          username={user.username}
          onClose={() => setWriting(false)}
          onCreated={(p) => {
            setWriting(false);
            setPosts((cur) => (cur ? [p, ...cur] : [p]));
            setDetail(p);
          }}
        />
      )}
    </div>
  );
}

function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      className="block w-full cursor-pointer border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-bg-soft active:bg-bg-soft"
    >
      <div className="flex items-center justify-between">
        {post.kind === "news" ? (
          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-bold text-accent">
            📰 뉴스
          </span>
        ) : (
          <span className="rounded bg-[#14c38e]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#14c38e]">
            자유게시판
          </span>
        )}
        <span className="text-[12px] text-muted">{timeAgo(post.createdAt)}</span>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-bg-soft">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z" />
          </svg>
        </span>
        <span className="font-medium text-text">{post.nickname}</span>
      </div>
      <h3 className="mt-1.5 text-[16px] font-bold leading-snug text-text">
        {post.title}
      </h3>
      {post.body && (
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">
          {post.body}
        </p>
      )}
      {post.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {post.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border px-2 py-0.5 text-[12px] text-muted"
            >
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-4 text-[12px] text-muted">
        <LikeButton
          targetType="post"
          targetId={post.id}
          initialLiked={post.liked}
          initialCount={post.likeCount}
          size="sm"
        />
        <span className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z" />
          </svg>
          {post.commentCount}
        </span>
        <span className="flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {post.views}
        </span>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-b border-border px-4 py-4">
          <div className="mb-2 h-3 w-20 rounded bg-bg-soft" />
          <div className="mb-2 h-4 w-[80%] rounded bg-bg-soft" />
          <div className="h-3 w-[60%] rounded bg-bg-soft" />
        </div>
      ))}
    </div>
  );
}

function Notice({
  title,
  desc,
  onRetry,
}: {
  title: string;
  desc: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
      <p className="text-[17px] font-bold text-text">{title}</p>
      <p className="mt-2 text-[14px] text-muted">{desc}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

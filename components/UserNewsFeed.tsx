"use client";

import { useEffect, useState } from "react";
import type { Author, Post, User } from "@/lib/community";
import { timeAgo } from "@/lib/format";
import FollowButton from "./FollowButton";
import LikeButton from "./LikeButton";
import PostDetail from "./PostDetail";

// 팔로우한 유저의 뉴스만 모아 보는 채널 화면 (뉴스탭에서 유저 칩 선택 시)
export default function UserNewsFeed({
  author,
  user,
  onFollowChange,
}: {
  author: Author;
  user: User;
  onFollowChange: () => void;
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [detail, setDetail] = useState<Post | null>(null);

  const load = () => {
    setPosts(null);
    fetch(`/api/posts?kind=news&author=${author.id}&sort=latest`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => setPosts(d.ok ? d.posts : []))
      .catch(() => setPosts([]));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author.id]);

  const initial = author.username.slice(0, 1).toUpperCase();

  return (
    <div>
      {/* 채널 헤더 */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#7b5cff] to-[#18b6e6] text-[19px] font-black text-white">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-extrabold text-text">
            {author.username}
          </div>
          <div className="text-[12px] text-muted">
            유저 뉴스 · {posts?.length ?? author.newsCount}건
          </div>
        </div>
        <FollowButton
          authorId={author.id}
          initialFollowing={true}
          onChange={onFollowChange}
        />
      </div>

      {posts === null ? (
        <SkeletonList />
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
          <p className="text-[17px] font-bold text-text">
            아직 작성한 뉴스가 없어요
          </p>
          <p className="mt-2 text-[14px] text-muted">
            {author.username}님이 뉴스를 올리면 여기에 표시돼요.
          </p>
        </div>
      ) : (
        posts.map((p) => (
          <UserNewsCard key={p.id} post={p} onOpen={() => setDetail(p)} />
        ))
      )}

      {detail && (
        <PostDetail
          post={detail}
          user={user}
          onClose={() => setDetail(null)}
          onFollowChange={onFollowChange}
          onChanged={load}
          onDeleted={(id) => {
            setDetail(null);
            setPosts((cur) => (cur ? cur.filter((p) => p.id !== id) : cur));
          }}
        />
      )}
    </div>
  );
}

function UserNewsCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      className="block w-full cursor-pointer border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-bg-soft active:bg-bg-soft"
    >
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <span className="font-medium text-text">{post.nickname}</span>
        <span>·</span>
        <span>{timeAgo(post.createdAt)}</span>
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

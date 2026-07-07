"use client";

import type { Post } from "@/lib/community";
import { timeAgo } from "@/lib/format";
import LikeButton from "./LikeButton";
import Avatar from "./Avatar";

// 유저 뉴스 카드 (유저 채널 / 프로필 공용)
export default function NewsPostCard({
  post,
  onOpen,
}: {
  post: Post;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      className="block w-full cursor-pointer border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-bg-soft active:bg-bg-soft"
    >
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <Avatar
          name={post.nickname}
          avatarUrl={post.authorAvatar}
          color={post.authorColor}
          size={20}
        />
        <span className="font-medium text-text">{post.nickname}</span>
        <span>·</span>
        <span>{timeAgo(post.createdAt)}</span>
      </div>
      <div className="mt-1.5 flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold leading-snug text-text">
            {post.title}
          </h3>
          {post.body && (
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[14px] leading-relaxed text-muted">
              {post.body}
            </p>
          )}
        </div>
        {post.images.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.images[0]}
            alt=""
            loading="lazy"
            className="h-[76px] w-[76px] shrink-0 rounded-xl object-cover"
          />
        )}
      </div>
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

"use client";

import { useEffect, useState } from "react";
import type { Post, User } from "@/lib/community";
import NewsPostCard from "./NewsPostCard";
import FollowButton from "./FollowButton";
import PostDetail from "./PostDetail";
import Avatar from "./Avatar";
import ReportDialog from "./ReportDialog";

// 유저 프로필/채널 — 작성자 이름을 누르면 열림. 그 유저의 뉴스 + 팔로우.
export default function UserProfile({
  authorId,
  username,
  user,
  onClose,
  onFollowChange,
  onEditProfile,
}: {
  authorId: string;
  username: string;
  user: User;
  onClose: () => void;
  onFollowChange?: () => void;
  onEditProfile?: () => void;
}) {
  const [news, setNews] = useState<Post[] | null>(null);
  const [name, setName] = useState(username);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileColor, setProfileColor] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [detail, setDetail] = useState<Post | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const isMe = authorId === user.id;

  useEffect(() => {
    if (isMe) return;
    fetch("/api/blocks", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBlocked(!!d.blocked?.includes(authorId)))
      .catch(() => {});
  }, [authorId, isMe]);

  const toggleBlock = async () => {
    setMenuOpen(false);
    const next = !blocked;
    setBlocked(next);
    try {
      await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: authorId, block: next }),
      });
    } catch {
      setBlocked(!next);
    }
  };

  const load = () => {
    fetch(`/api/authors/${authorId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setNews(d.news ?? []);
          setName(d.author?.username ?? username);
          setAvatarUrl(d.author?.avatarUrl ?? null);
          setProfileColor(d.author?.profileColor ?? null);
          setBio(d.author?.bio ?? null);
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
          {!isMe && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="더보기"
                className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg-soft hover:text-text"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <button
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="닫기"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-10 z-20 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setReporting(true);
                      }}
                      className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold text-text hover:bg-bg-soft"
                    >
                      신고하기
                    </button>
                    <button
                      onClick={toggleBlock}
                      className="block w-full border-t border-border px-4 py-2.5 text-left text-[14px] font-semibold text-[#f6465d] hover:bg-bg-soft"
                    >
                      {blocked ? "차단 해제" : "차단하기"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </header>

        {blocked && (
          <div className="border-b border-border bg-bg-soft px-4 py-2 text-center text-[13px] text-muted">
            차단한 사용자예요. 이 사용자의 글·댓글·메시지가 숨겨집니다.
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* 프로필 카드 */}
          <div className="border-b-[6px] border-bg-soft">
            {/* 대표 색상 배너 */}
            <div
              className="h-16 w-full"
              style={{
                background:
                  profileColor ||
                  "linear-gradient(135deg,#7b5cff33,#18b6e633)",
              }}
            />
            <div className="px-4 pb-5">
              <div className="-mt-9 flex items-end justify-between">
                <span className="rounded-full border-4 border-bg">
                  <Avatar
                    name={name}
                    avatarUrl={avatarUrl}
                    color={profileColor}
                    size={72}
                  />
                </span>
                <div className="mb-1">
                  {isMe ? (
                    onEditProfile && (
                      <button
                        onClick={onEditProfile}
                        className="rounded-full border border-border px-4 py-1.5 text-[13px] font-bold text-text hover:bg-bg-soft"
                      >
                        프로필 편집
                      </button>
                    )
                  ) : (
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
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="text-[19px] font-extrabold text-text">{name}</span>
                {isMe && (
                  <span className="text-[12px] font-semibold text-muted">(나)</span>
                )}
              </div>
              {bio && (
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-text">
                  {bio}
                </p>
              )}
              <div className="mt-1.5 text-[13px] text-muted">
                유저 뉴스 {news?.length ?? 0}건 · 팔로워 {followerCount}
              </div>
            </div>
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

      {reporting && (
        <ReportDialog
          targetType="user"
          targetId={authorId}
          targetLabel={`${name} 사용자`}
          onClose={() => setReporting(false)}
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

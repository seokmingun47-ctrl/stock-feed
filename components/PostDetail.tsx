"use client";

import { useEffect, useRef, useState } from "react";
import type { Post, Comment, User } from "@/lib/community";
import { timeAgo } from "@/lib/format";

function PersonIcon({ size = 28 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-bg-soft text-muted"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z" />
      </svg>
    </span>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

export default function PostDetail({
  post,
  user,
  onClose,
  onChanged,
  onDeleted,
}: {
  post: Post;
  user: User;
  onClose: () => void;
  onChanged?: () => void;
  onDeleted: (id: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [views, setViews] = useState(post.views);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);

  const canManagePost = user.isAdmin || (!!post.userId && post.userId === user.id);

  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/posts/${post.id}`, { signal: c.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setComments(d.comments ?? []);
          setViews(d.post?.views ?? post.views);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => c.abort();
  }, [post.id]);

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

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const d = await res.json();
      if (d.ok) {
        setComments((c) => [...c, d.comment]);
        setText("");
        onChanged?.();
        setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else {
        alert(d.reason || "댓글 등록 실패");
      }
    } finally {
      setBusy(false);
    }
  };

  const deletePost = async () => {
    if (!window.confirm("이 글을 삭제할까요?")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) onDeleted(post.id);
    else alert(d.reason || "삭제 실패");
  };

  const deleteComment = async (cid: string) => {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/comments/${cid}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) {
      setComments((c) => c.filter((x) => x.id !== cid));
      onChanged?.();
    } else alert(d.reason || "삭제 실패");
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
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
          <span className="flex-1 text-[16px] font-bold text-text">자유게시판</span>
          {canManagePost && (
            <button
              onClick={deletePost}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#f6465d] hover:bg-[#f6465d]/10"
            >
              <TrashIcon /> 삭제
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          <article className="border-b-[6px] border-bg-soft px-4 py-4">
            <div className="flex items-center gap-2">
              <PersonIcon size={32} />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-semibold text-text">
                    {post.nickname}
                  </span>
                  {post.userId === null && (
                    <span className="text-[11px] text-muted">·</span>
                  )}
                </div>
                <div className="text-[12px] text-muted">
                  {timeAgo(post.createdAt)}
                </div>
              </div>
            </div>
            <h1 className="mt-3 text-[20px] font-extrabold leading-snug text-text">
              {post.title}
            </h1>
            {post.body && (
              <p className="mt-2 whitespace-pre-wrap text-[16px] leading-[1.7] text-text">
                {post.body}
              </p>
            )}
            {post.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
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
            <div className="mt-3 text-[12px] text-muted">조회 {views}</div>
          </article>

          <div className="px-4 py-3">
            <div className="mb-2 text-[14px] font-bold text-text">
              댓글 {comments.length}
            </div>
            {!loaded ? (
              <div className="py-6 text-center text-[13px] text-muted">불러오는 중…</div>
            ) : comments.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted">
                첫 댓글을 남겨보세요.
              </div>
            ) : (
              comments.map((c) => {
                const canDel =
                  user.isAdmin || (!!c.userId && c.userId === user.id);
                return (
                  <div key={c.id} className="flex gap-2 border-b border-border py-3">
                    <PersonIcon size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-text">
                          {c.nickname}
                        </span>
                        <span className="text-[11px] text-muted">
                          {timeAgo(c.createdAt)}
                        </span>
                        {canDel && (
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="ml-auto shrink-0 text-muted hover:text-[#f6465d]"
                            aria-label="댓글 삭제"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-text">
                        {c.body}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={listEnd} />
          </div>
        </div>

        <div className="border-t border-border bg-bg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={2000}
              placeholder="댓글 달기…"
              className="min-w-0 flex-1 rounded-full border border-border bg-bg-soft px-4 py-2.5 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              onClick={send}
              disabled={!text.trim() || busy}
              className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40"
            >
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Article, Source } from "@/lib/types";
import type { User, Comment } from "@/lib/community";
import SourceAvatar from "./SourceAvatar";
import LikeButton from "./LikeButton";
import { timeAgo } from "@/lib/format";

interface ReaderData {
  ok: boolean;
  title?: string;
  image?: string | null;
  paragraphs?: string[];
  reason?: string;
}

function PersonIcon({ size = 26 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-bg-soft text-muted" style={{ width: size, height: size }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z" />
      </svg>
    </span>
  );
}

export default function ArticleReader({
  article,
  source,
  translate,
  user,
  onClose,
}: {
  article: Article;
  source: Source;
  translate: boolean;
  user: User;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [imgOk, setImgOk] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listEnd = useRef<HTMLDivElement>(null);

  const translated = translate && source.region === "global";
  const meta = { title: article.title, sourceId: source.id, image: article.image };

  // 본문(번역)
  useEffect(() => {
    const c = new AbortController();
    const lang = translated ? "&lang=ko" : "";
    fetch(`/api/article?url=${encodeURIComponent(article.link)}${lang}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ ok: false, reason: "error" }));
    return () => c.abort();
  }, [article.link, translated]);

  // 좋아요/댓글 상태
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/news/state?url=${encodeURIComponent(article.link)}`, { signal: c.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setLikeCount(d.likeCount ?? 0);
          setLiked(!!d.liked);
          setComments(d.comments ?? []);
        }
        setStateLoaded(true);
      })
      .catch(() => setStateLoaded(true));
    return () => c.abort();
  }, [article.link]);

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

  const title = data?.ok ? data.title : article.title;
  const image = data?.ok ? data.image : article.image;
  const showImg = image && imgOk;

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/news/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: article.link, body: text, meta }),
      });
      const d = await res.json();
      if (d.ok) {
        setComments((c) => [...c, d.comment]);
        setText("");
        setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else alert(d.reason || "댓글 등록 실패");
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (cid: string) => {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/news/comments/${cid}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) setComments((c) => c.filter((x) => x.id !== cid));
    else alert(d.reason || "삭제 실패");
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button onClick={onClose} aria-label="닫기" className="grid h-9 w-9 place-items-center rounded-full text-text hover:bg-bg-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SourceAvatar source={source} size={24} />
            <span className="truncate text-[14px] font-semibold text-text">{source.name}</span>
            <span className="shrink-0 text-[12px] text-muted">· {timeAgo(article.publishedAt)}</span>
          </div>
          <a href={article.link} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-bg-soft px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text">
            원문 ↗
          </a>
        </header>

        <div className="flex-1 overflow-y-auto">
          <article className="px-5 pt-4">
            <h1 className="text-[22px] font-extrabold leading-snug text-text">{title}</h1>
            {translated && (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-accent">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold">한국어 번역</span>
              </div>
            )}
            {showImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image as string} alt="" onError={() => setImgOk(false)} className="mt-4 w-full rounded-xl object-cover" />
            )}
            {!data ? (
              <Loading message={translated ? "본문을 가져와 한국어로 번역하는 중…" : "본문을 가져오는 중…"} />
            ) : data.ok ? (
              <div className="mt-5 space-y-4">
                {data.paragraphs!.map((p, i) => (
                  <p key={i} className="text-[16px] leading-[1.75] text-text">{p}</p>
                ))}
              </div>
            ) : (
              <Fallback summary={article.summary} link={article.link} />
            )}
          </article>

          {/* 좋아요 / 댓글 요약 바 */}
          <div className="mt-5 flex items-center gap-5 border-y border-border px-5 py-3">
            <LikeButton
              targetType="news"
              targetId={article.link}
              meta={meta}
              initialLiked={liked}
              initialCount={likeCount}
            />
            <span className="flex items-center gap-1 text-[13px] font-semibold text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z" />
              </svg>
              {comments.length}
            </span>
          </div>

          {/* 댓글 */}
          <div className="px-5 py-3">
            <div className="mb-2 text-[14px] font-bold text-text">
              이 뉴스에 대한 의견 {comments.length}
            </div>
            {!stateLoaded ? (
              <div className="py-6 text-center text-[13px] text-muted">불러오는 중…</div>
            ) : comments.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted">첫 의견을 남겨보세요.</div>
            ) : (
              comments.map((c) => {
                const canDel = user.isAdmin || (!!c.userId && c.userId === user.id);
                return (
                  <div key={c.id} className="flex gap-2 border-b border-border py-3">
                    <PersonIcon size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-text">{c.nickname}</span>
                        <span className="text-[11px] text-muted">{timeAgo(c.createdAt)}</span>
                        {canDel && (
                          <button onClick={() => deleteComment(c.id)} className="ml-auto shrink-0 text-muted hover:text-[#f6465d]" aria-label="댓글 삭제">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-text">{c.body}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={listEnd} />
          </div>
        </div>

        {/* 의견 입력 */}
        <div className="border-t border-border bg-bg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={2000}
              placeholder="이 뉴스에 대한 의견을 남겨보세요…"
              className="min-w-0 flex-1 rounded-full border border-border bg-bg-soft px-4 py-2.5 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
            />
            <button onClick={send} disabled={!text.trim() || busy} className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">
              등록
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Loading({ message }: { message: string }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 py-10 text-muted">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="spin">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      </svg>
      <span className="text-[14px]">{message}</span>
    </div>
  );
}

function Fallback({ summary, link }: { summary: string; link: string }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-bg-soft p-5 text-center">
      <p className="text-[15px] font-semibold text-text">이 매체는 앱 안에서 본문을 불러올 수 없어요</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">(유료 구독이거나 외부 접근을 막은 사이트예요)</p>
      {summary && <p className="mt-4 text-left text-[14px] leading-relaxed text-muted">{summary}</p>}
      <a href={link} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white">
        원문에서 보기 ↗
      </a>
    </div>
  );
}

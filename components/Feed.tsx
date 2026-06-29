"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOURCES, SOURCE_MAP, MIN_FOLLOW } from "@/lib/sources";
import type { Article } from "@/lib/types";
import type { User } from "@/lib/community";
import SourceAvatar from "@/components/SourceAvatar";
import ArticleCard from "@/components/ArticleCard";
import ManageSheet from "@/components/ManageSheet";
import ArticleReader from "@/components/ArticleReader";
import { LogoMark } from "@/components/Logo";
import { timeAgo } from "@/lib/format";

const STORE_KEY = "stockfeed:followed";

const TR_KEY = "stockfeed:translate";

export default function Feed({
  user,
  initialFollowed,
  initialTranslate,
  onLogout,
}: {
  user: User;
  initialFollowed: string[];
  initialTranslate: boolean;
  onLogout: () => void;
}) {
  const nickname = user.username;
  const [followed, setFollowed] = useState<string[]>(initialFollowed);
  const [active, setActive] = useState<string>("all");
  const [articles, setArticles] = useState<Article[]>([]);
  const [okSources, setOkSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [manage, setManage] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [translate, setTranslate] = useState(initialTranslate);
  const [reader, setReader] = useState<Article | null>(null);
  const trRef = useRef(initialTranslate); // fetchFeed가 최신 값을 읽도록
  const first = useRef(true);

  const fetchFeed = useCallback(async (ids: string[]) => {
    if (!ids.length) {
      setArticles([]);
      setOkSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const lang = trRef.current ? "&lang=ko" : "";
      const res = await fetch(`/api/feed?sources=${ids.join(",")}${lang}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      setArticles(data.articles ?? []);
      setOkSources(data.okSources ?? []);
      setUpdatedAt(Date.now());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // 최초 로드
  useEffect(() => {
    fetchFeed(followed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 팔로우 변경 시 저장 + 재조회 (최초 마운트는 건너뜀)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    localStorage.setItem(STORE_KEY, JSON.stringify(followed));
    if (active !== "all" && !followed.includes(active)) setActive("all");
    fetchFeed(followed);
  }, [followed, fetchFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // 90초마다 자동 새로고침
  useEffect(() => {
    const t = setInterval(() => fetchFeed(followed), 90_000);
    return () => clearInterval(t);
  }, [followed, fetchFeed]);

  const toggleTranslate = () => {
    const v = !translate;
    setTranslate(v);
    trRef.current = v;
    try {
      localStorage.setItem(TR_KEY, v ? "1" : "0");
    } catch {
      /* noop */
    }
    fetchFeed(followed);
  };

  const followedSources = useMemo(
    () => followed.map((id) => SOURCE_MAP[id]).filter(Boolean),
    [followed],
  );

  const shown = useMemo(() => {
    const base = (
      active === "all"
        ? articles
        : articles.filter((a) => a.sourceId === active)
    ).filter((a) => SOURCE_MAP[a.sourceId]); // 알 수 없는 소스 방어

    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return base;
    // 제목+요약에 모든 검색어가 들어간 기사만
    return base.filter((a) => {
      const text = `${a.title} ${a.summary || ""}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [articles, active, query]);

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <div className="flex items-center gap-2">
            <LogoMark size={28} />
            <h1 className="text-[19px] font-extrabold tracking-tight">
              <span className="text-text">New</span>
              <span className="text-accent">sync</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="검색"
              className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
                searchOpen || query
                  ? "bg-accent text-white"
                  : "text-muted hover:bg-bg-soft"
              }`}
            >
              <SearchIcon />
            </button>
            <button
              onClick={toggleTranslate}
              aria-label="해외 뉴스 한국어 번역"
              title={translate ? "번역 켜짐 (해외 뉴스 한국어)" : "번역 꺼짐 (원문)"}
              className={`flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-bold transition-colors ${
                translate
                  ? "bg-accent text-white"
                  : "bg-bg-soft text-muted"
              }`}
            >
              <span>한</span>
              <span className="text-[10px] opacity-80">A문</span>
            </button>
            <button
              onClick={() => fetchFeed(followed)}
              aria-label="새로고침"
              className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg-soft"
            >
              <RefreshIcon spinning={loading} />
            </button>
            <button
              onClick={() => setManage(true)}
              aria-label="내 소스 관리"
              className="grid h-8 w-8 place-items-center rounded-full bg-accent text-[14px] font-bold text-white"
              title={nickname}
            >
              {nickname.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 rounded-full border border-border bg-bg-soft px-3.5 py-2">
              <SearchIcon className="text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 미국 이란 전쟁, 삼성전자, 금리"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="지우기"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-border text-[12px] text-text"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-3 pt-1">
          <Chip
            active={active === "all"}
            onClick={() => setActive("all")}
            label="전체"
          >
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-accent to-[#14c38e] text-[18px] font-black text-white">
              All
            </span>
          </Chip>

          {followedSources.map((s) => (
            <Chip
              key={s.id}
              active={active === s.id}
              onClick={() => setActive(s.id)}
              label={s.name}
              dim={okSources.length > 0 && !okSources.includes(s.id)}
            >
              <SourceAvatar source={s} size={52} ring={active === s.id} />
            </Chip>
          ))}

          <button
            onClick={() => setManage(true)}
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full border border-dashed border-border text-[24px] text-muted">
              +
            </span>
            <span className="text-[11px] text-muted">추가</span>
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between px-4 py-2 text-[12px] text-muted">
        <span>
          {query.trim()
            ? `'${query.trim()}' 검색 · ${shown.length}건`
            : active === "all"
              ? `팔로우 ${followedSources.length}곳 · 통합 피드`
              : SOURCE_MAP[active]?.name}
        </span>
        {updatedAt > 0 && <span>업데이트 {timeAgo(updatedAt)}</span>}
      </div>

      <main className="flex-1 pb-16">
        {loading && articles.length === 0 ? (
          <SkeletonList />
        ) : error ? (
          <EmptyState
            title="불러오지 못했어요"
            desc="네트워크를 확인하고 다시 시도해 주세요."
            action={() => fetchFeed(followed)}
            actionLabel="다시 시도"
          />
        ) : shown.length === 0 ? (
          query.trim() ? (
            <EmptyState
              title={`'${query.trim()}' 검색 결과가 없어요`}
              desc="다른 키워드로 검색하거나 더 많은 소스를 팔로우해 보세요."
              action={() => setQuery("")}
              actionLabel="검색 지우기"
            />
          ) : (
            <EmptyState
              title="기사가 없어요"
              desc="이 소스에서 가져온 기사가 아직 없습니다."
            />
          )
        ) : (
          shown.map((a) => (
            <ArticleCard
              key={a.id}
              article={a}
              source={SOURCE_MAP[a.sourceId]}
              translate={translate}
              onRead={setReader}
            />
          ))
        )}
      </main>

      {manage && (
        <ManageSheet
          followed={followed}
          minFollow={MIN_FOLLOW}
          nickname={nickname}
          onChange={setFollowed}
          onClose={() => setManage(false)}
          onLogout={onLogout}
        />
      )}

      {reader && (
        <ArticleReader
          article={reader}
          source={SOURCE_MAP[reader.sourceId]}
          translate={translate}
          onClose={() => setReader(null)}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  children,
  dim,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1.5"
      style={{ opacity: dim ? 0.4 : 1 }}
    >
      {children}
      <span
        className={`max-w-[60px] truncate text-[11px] ${
          active ? "font-bold text-text" : "text-muted"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "spin" : ""}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function SkeletonList() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border-b border-border px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-bg-soft" />
            <div className="h-3 w-24 rounded bg-bg-soft" />
          </div>
          <div className="mb-2 h-4 w-[90%] rounded bg-bg-soft" />
          <div className="h-3 w-[70%] rounded bg-bg-soft" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  title,
  desc,
  action,
  actionLabel,
}: {
  title: string;
  desc: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
      <p className="text-[17px] font-bold text-text">{title}</p>
      <p className="mt-2 text-[14px] text-muted">{desc}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="mt-5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SOURCES, SOURCE_MAP, MIN_FOLLOW } from "@/lib/sources";
import type { Article } from "@/lib/types";
import type { User, Author, NewsItem } from "@/lib/community";
import SourceAvatar from "@/components/SourceAvatar";
import Avatar from "@/components/Avatar";
import ArticleCard from "@/components/ArticleCard";
import ManageSheet from "@/components/ManageSheet";
import ArticleReader from "@/components/ArticleReader";
import UserNewsFeed from "@/components/UserNewsFeed";
import InterestSheet from "@/components/InterestSheet";
import NotificationPanel from "@/components/NotificationPanel";
import LikedNews from "@/components/LikedNews";
import HScroll from "@/components/HScroll";
import AiChat from "@/components/AiChat";
import { AI_MAP, type AiApp } from "@/lib/ai";
import { getStoredTheme, applyTheme, type Theme } from "@/lib/theme";
import AdminUsers, { type Signup } from "@/components/AdminUsers";
import { LogoMark } from "@/components/Logo";
import { timeAgo } from "@/lib/format";
import {
  type Interest,
  loadInterests,
  saveInterests,
  matchesInterests,
} from "@/lib/interests";
import { loadSeen, saveSeen } from "@/lib/notifications";

const TR_KEY = "stockfeed:translate";

// 토픽 빠른 필터 — 라벨 + 매칭어(한/영 변형 모두). 제목·요약에 하나라도 들어가면 매칭.
const TOPICS: { label: string; terms: string[] }[] = [
  { label: "속보", terms: ["속보", "breaking"] },
  { label: "분석", terms: ["분석", "전망", "outlook"] },
  { label: "코스피", terms: ["코스피", "kospi"] },
  { label: "삼성전자", terms: ["삼성전자", "삼전", "samsung"] },
  { label: "엔비디아", terms: ["엔비디아", "nvidia"] },
  { label: "금리", terms: ["금리", "연준", "fed", "rate"] },
  { label: "환율", terms: ["환율", "원/달러", "달러", "dollar"] },
  { label: "비트코인", terms: ["비트코인", "코인", "bitcoin", "crypto"] },
  { label: "이란", terms: ["이란", "호르무즈", "iran"] },
  { label: "트럼프", terms: ["트럼프", "trump", "djt"] },
  { label: "스페이스X", terms: ["스페이스x", "spacex"] },
];

export default function Feed({
  user,
  initialFollowed,
  initialTranslate,
  authors,
  reloadAuthors,
  onLogout,
  onEditProfile,
}: {
  user: User;
  initialFollowed: string[];
  initialTranslate: boolean;
  authors: Author[];
  reloadAuthors: () => void;
  onLogout: () => void;
  onEditProfile: () => void;
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
  const [topic, setTopic] = useState<string | null>(null);
  const [breaking, setBreaking] = useState<Article[] | null>(null);
  const topicRef = useRef<string | null>(null);
  const [translate, setTranslate] = useState(initialTranslate);
  const [reader, setReader] = useState<Article | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);
  const [interestSheet, setInterestSheet] = useState(false);
  const [interestGnews, setInterestGnews] = useState<Article[] | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [notifOpen, setNotifOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aiFollowed, setAiFollowed] = useState<string[]>([]);
  const [aiChat, setAiChat] = useState<AiApp | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");
  const [adminUsers, setAdminUsers] = useState<Signup[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSeen, setAdminSeen] = useState(0);
  const trRef = useRef(initialTranslate); // fetchFeed가 최신 값을 읽도록
  const first = useRef(true);
  const sourceSetRef = useRef<"none" | "base" | "hidden">("none");
  const interestsRef = useRef<Interest[]>([]);

  // 관심 목록 + 알림 읽음 + AI 팔로우 로드(계정별) — 최초 마운트
  useEffect(() => {
    setInterests(loadInterests(user.username));
    setSeen(loadSeen(user.username));
    try {
      const raw = localStorage.getItem(`stockfeed:ai:${user.username}`);
      setAiFollowed(raw ? JSON.parse(raw) : []);
    } catch {
      /* noop */
    }
  }, [user.username]);

  // 테마(라이트/다크) — 저장값 반영 (기기 공용)
  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const changeTheme = useCallback((t: Theme) => {
    setTheme(t);
    applyTheme(t);
  }, []);

  // 관리자: 가입자 목록 로드 + 새 가입 알림 (관리자만)
  const adminSeenKey = `stockfeed:adminSeen:${user.username}`;
  useEffect(() => {
    if (!user.isAdmin) return;
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(adminSeenKey) || "0");
    } catch {
      /* noop */
    }
    setAdminSeen(seen);
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAdminUsers(d.users as Signup[]);
      })
      .catch(() => {});
  }, [user.isAdmin, adminSeenKey]);

  const adminNew = adminUsers.filter((u) => u.createdAt > adminSeen).length;

  const openAdmin = useCallback(() => {
    setManage(false);
    setAdminOpen(true);
    const now = Date.now();
    try {
      localStorage.setItem(adminSeenKey, String(now));
    } catch {
      /* noop */
    }
    setAdminSeen(now);
  }, [adminSeenKey]);

  const updateAiFollowed = useCallback(
    (next: string[]) => {
      setAiFollowed(next);
      try {
        localStorage.setItem(`stockfeed:ai:${user.username}`, JSON.stringify(next));
      } catch {
        /* noop */
      }
    },
    [user.username],
  );

  const openAi = (app: AiApp) => {
    if (app.mode === "web" && app.webUrl) {
      window.open(app.webUrl, "_blank", "noopener");
      return;
    }
    setAiChat(app);
  };

  useEffect(() => {
    interestsRef.current = interests;
  }, [interests]);

  // 관심 종목·키워드로 외부 뉴스(구글뉴스, 인앱에 없는 매체 포함) 로드
  const loadInterestGnews = useCallback(async () => {
    const labels = interestsRef.current.map((i) => i.label);
    if (!labels.length) {
      setInterestGnews([]);
      return;
    }
    try {
      const res = await fetch("/api/interest-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: labels }),
      });
      const d = await res.json();
      setInterestGnews(d.ok ? d.articles : []);
    } catch {
      setInterestGnews([]);
    }
  }, []);

  const updateInterests = useCallback(
    (next: Interest[]) => {
      setInterests(next);
      saveInterests(user.username, next);
    },
    [user.username],
  );

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

  // 토픽 데이터 로드 — 전체 소스. '속보'면 외부 집계(숨김) 소스까지 포함.
  const loadBreaking = useCallback(async () => {
    try {
      const list =
        topicRef.current === "속보" ? SOURCES : SOURCES.filter((s) => !s.hidden);
      const ids = list.map((s) => s.id).join(",");
      const lang = trRef.current ? "&lang=ko" : "";
      const res = await fetch(`/api/feed?sources=${ids}${lang}`, {
        cache: "no-store",
      });
      const d = await res.json();
      setBreaking(
        (d.articles ?? []).filter((a: Article) => SOURCE_MAP[a.sourceId]),
      );
    } catch {
      setBreaking([]);
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
    localStorage.setItem(
      `stockfeed:followed:${user.username}`,
      JSON.stringify(followed),
    );
    if (
      active !== "all" &&
      active !== "interests" &&
      !active.startsWith("user:") &&
      !followed.includes(active)
    )
      setActive("all");
    fetchFeed(followed);
  }, [followed, fetchFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // 90초마다 자동 새로고침 (토픽/관심 보고 있으면 전체 소스도 갱신)
  useEffect(() => {
    const t = setInterval(() => {
      fetchFeed(followed);
      if (sourceSetRef.current !== "none") loadBreaking();
      if (interestsRef.current.length) loadInterestGnews();
    }, 90_000);
    return () => clearInterval(t);
  }, [followed, fetchFeed, loadBreaking, loadInterestGnews]);

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

  // 유저 뉴스 채널 (active === "user:<id>")
  const activeAuthorId = active.startsWith("user:") ? active.slice(5) : null;
  const activeAuthor = useMemo(
    () =>
      activeAuthorId
        ? authors.find((a) => a.id === activeAuthorId) ?? null
        : null,
    [authors, activeAuthorId],
  );
  // 보고 있던 유저를 팔로우 해제하면 전체 피드로 복귀
  useEffect(() => {
    if (activeAuthorId && !authors.some((a) => a.id === activeAuthorId)) {
      setActive("all");
    }
  }, [authors, activeAuthorId]);

  // 팔로우 피드 (소스 + 검색어) — 토픽은 별도(전체 소스)로 처리
  const shown = useMemo(() => {
    const base = (
      active === "all"
        ? articles
        : articles.filter((a) => a.sourceId === active)
    ).filter((a) => SOURCE_MAP[a.sourceId]);
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return base;
    return base.filter((a) => {
      const text = `${a.title} ${a.summary || ""}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [articles, active, query]);

  // 토픽 결과 — 전체 소스(breaking)를 토픽 키워드로 필터. '속보'는 전체 최신.
  const topicArticles = useMemo(() => {
    if (breaking === null) return null;
    let base = breaking;
    if (topic && topic !== "속보") {
      const tc = TOPICS.find((t) => t.label === topic);
      if (tc) {
        base = base.filter((a) => {
          const text = `${a.title} ${a.summary || ""}`.toLowerCase();
          return tc.terms.some((term) => text.includes(term.toLowerCase()));
        });
      }
    }
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return base;
    return base.filter((a) => {
      const text = `${a.title} ${a.summary || ""}`.toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [breaking, topic, query]);

  // 관심 뉴스 — 전체 소스(breaking)를 관심 종목·키워드로 필터
  const interestArticles = useMemo(() => {
    if (active !== "interests") return null;
    if (breaking === null) return null;
    let base = breaking.filter((a) =>
      matchesInterests(a.title, a.summary || "", interests),
    );
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length) {
      base = base.filter((a) => {
        const text = `${a.title} ${a.summary || ""}`.toLowerCase();
        return terms.every((t) => text.includes(t));
      });
    }
    return base;
  }, [breaking, active, interests, query]);

  // 관심이 있으면 백그라운드로 외부 뉴스 로드(알림 벨용, 탭 무관) — 관심 변경 시 갱신
  const interestKey = interests.map((i) => i.label).join("|");
  useEffect(() => {
    if (!interestKey) {
      setInterestGnews([]);
      return;
    }
    setInterestGnews(null);
    loadInterestGnews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestKey]);

  // 관심 피드 = 인앱 필터 결과 + 외부(구글뉴스) 병합 (링크 중복 제거·최신순)
  const interestMerged = useMemo(() => {
    if (active !== "interests") return null;
    const inApp = interestArticles ?? [];
    let ext = interestGnews ?? [];
    // 검색어가 있으면 외부 결과에도 적용
    const q = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (q.length) {
      ext = ext.filter((a) => {
        const text = `${a.title} ${a.summary || ""}`.toLowerCase();
        return q.every((t) => text.includes(t));
      });
    }
    const seen = new Set<string>();
    const out: Article[] = [];
    for (const a of [...ext, ...inApp]) {
      if (seen.has(a.link)) continue;
      seen.add(a.link);
      out.push(a);
    }
    out.sort((a, b) => b.publishedAt - a.publishedAt);
    return out;
  }, [active, interestArticles, interestGnews, query]);

  // 전체 소스(breaking)가 필요한 모드: 토픽 또는 관심 뉴스.
  // 소스셋(속보=숨김포함 / 그외=base)이 바뀔 때만 재로드, 같으면 재사용(클라 필터).
  const sourceSetKey: "none" | "base" | "hidden" =
    topic === "속보"
      ? "hidden"
      : topic || active === "interests"
        ? "base"
        : "none";
  useEffect(() => {
    topicRef.current = topic;
    sourceSetRef.current = sourceSetKey;
    if (sourceSetKey === "none") {
      setBreaking(null);
      return;
    }
    setBreaking(null);
    loadBreaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceSetKey]);


  // 알림: 안읽음 = 외부 관심 뉴스 중 아직 안 본 것
  const unreadCount = useMemo(
    () => (interestGnews ?? []).filter((a) => !seen.has(a.link)).length,
    [interestGnews, seen],
  );
  // 알림 패널 닫으면 현재 항목 모두 읽음 처리 (배지 클리어)
  const closeNotif = () => {
    setNotifOpen(false);
    const links = new Set<string>([
      ...seen,
      ...(interestGnews ?? []).map((a) => a.link),
    ]);
    setSeen(links);
    saveSeen(user.username, [...links]);
  };

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
              onClick={() => {
                fetchFeed(followed);
                if (topic) loadBreaking();
                if (active === "interests") {
                  loadBreaking();
                  loadInterestGnews();
                }
              }}
              aria-label="새로고침"
              className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg-soft"
            >
              <RefreshIcon spinning={loading} />
            </button>
            <button
              onClick={() => setNotifOpen(true)}
              aria-label="알림"
              className="relative grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg-soft"
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full border-2 border-bg bg-[#f6465d] px-1 text-[9px] font-black leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setManage(true)}
              aria-label="내 계정"
              className="relative ml-0.5"
              title={nickname}
            >
              <Avatar
                name={nickname}
                avatarUrl={user.avatarUrl}
                color={user.profileColor}
                size={32}
              />
              {user.isAdmin && adminNew > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-[16px] min-w-[16px] place-items-center rounded-full border-2 border-bg bg-[#f6465d] px-1 text-[9px] font-black leading-none text-white">
                  {adminNew > 99 ? "99+" : adminNew}
                </span>
              )}
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

        <HScroll className="flex gap-3 px-4 pb-3 pt-1">
          <Chip
            active={active === "all" && !topic}
            onClick={() => {
              setActive("all");
              setTopic(null);
            }}
            label="전체"
          >
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-accent to-[#14c38e] text-[18px] font-black text-white">
              All
            </span>
          </Chip>
          <Chip
            active={active === "interests"}
            onClick={() => {
              setActive("interests");
              setTopic(null);
            }}
            label="관심"
          >
            <span className="relative grid h-[52px] w-[52px] place-items-center rounded-full bg-gradient-to-br from-[#f7b500] to-[#ff8a3d] text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
              </svg>
              {interests.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-bg bg-[#f6465d] px-1 text-[10px] font-black text-white">
                  {interests.length}
                </span>
              )}
            </span>
          </Chip>

          {/* 팔로우한 AI 앱 */}
          {aiFollowed
            .map((id) => AI_MAP[id])
            .filter(Boolean)
            .map((app) => (
              <Chip
                key={`ai:${app.id}`}
                active={false}
                onClick={() => openAi(app)}
                label={app.name}
              >
                <span className="relative">
                  <SourceAvatar source={app} size={52} />
                  <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-bg bg-gradient-to-br from-[#7b5cff] to-[#18b6e6] px-1 text-[8px] font-black leading-[14px] text-white">
                    AI
                  </span>
                </span>
              </Chip>
            ))}

          {followedSources.map((s) => (
            <Chip
              key={s.id}
              active={active === s.id && !topic}
              onClick={() => {
                setActive(s.id);
                setTopic(null);
              }}
              label={s.name}
              dim={okSources.length > 0 && !okSources.includes(s.id)}
            >
              <SourceAvatar
                source={s}
                size={52}
                ring={active === s.id && !topic}
              />
            </Chip>
          ))}

          {/* 팔로우한 유저 채널 */}
          {authors.map((a) => (
            <Chip
              key={`user:${a.id}`}
              active={active === `user:${a.id}`}
              onClick={() => {
                setActive(`user:${a.id}`);
                setTopic(null);
              }}
              label={a.username}
            >
              <Avatar
                name={a.username}
                avatarUrl={a.avatarUrl}
                color={a.profileColor}
                size={52}
                ring={active === `user:${a.id}`}
                badge
              />
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
        </HScroll>

        {/* 토픽 빠른 필터 칩 */}
        <HScroll className="flex gap-2 border-t border-border/60 px-4 py-2.5">
          {TOPICS.map((t) => {
            const on = topic === t.label;
            return (
              <button
                key={t.label}
                onClick={() => {
                  const next = on ? null : t.label;
                  setTopic(next);
                  // 토픽 선택 시 소스(위 앱)는 항상 "전체" — 둘은 독립
                  if (next) setActive("all");
                }}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  on
                    ? "bg-text text-bg"
                    : "bg-bg-soft text-muted hover:text-text"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </HScroll>
      </header>

      {!activeAuthorId && active === "interests" ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
          <div className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
            {interests.length === 0 ? (
              <span className="py-1 text-[12px] text-muted">
                관심 종목·키워드를 추가해보세요
              </span>
            ) : (
              interests.map((it) => (
                <span
                  key={it.id}
                  className="shrink-0 rounded-full bg-bg-soft px-2.5 py-1 text-[12px] font-semibold text-text"
                >
                  {it.kind === "ticker" ? "" : "#"}
                  {it.label}
                </span>
              ))
            )}
          </div>
          <button
            onClick={() => setInterestSheet(true)}
            className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-white"
          >
            {interests.length ? "편집" : "추가"}
          </button>
        </div>
      ) : !activeAuthorId ? (
        <div className="flex items-center justify-between px-4 py-2 text-[12px] text-muted">
          <span>
            {topic === "속보"
              ? `속보 · 전체 앱 실시간 최신 ${topicArticles?.length ?? 0}건`
              : topic
                ? `'${topic}' · 전체 앱 관련 ${topicArticles?.length ?? 0}건`
                : query.trim()
                  ? `'${query.trim()}' 검색 · ${shown.length}건`
                  : active === "all"
                    ? `팔로우 ${followedSources.length}곳 · 통합 피드`
                    : SOURCE_MAP[active]?.name}
          </span>
          {!topic && updatedAt > 0 && (
            <span>업데이트 {timeAgo(updatedAt)}</span>
          )}
        </div>
      ) : null}

      <main className="flex-1 pb-16">
        {activeAuthorId ? (
          activeAuthor ? (
            <UserNewsFeed
              author={activeAuthor}
              user={user}
              onFollowChange={reloadAuthors}
            />
          ) : (
            <SkeletonList />
          )
        ) : topic ? (
          topicArticles === null ? (
            <SkeletonList />
          ) : topicArticles.length === 0 ? (
            topic === "속보" ? (
              <EmptyState
                title="속보를 불러오지 못했어요"
                desc="잠시 후 다시 시도해 주세요."
                action={loadBreaking}
                actionLabel="다시 시도"
              />
            ) : (
              <EmptyState
                title={`'${topic}' 관련 뉴스가 없어요`}
                desc="전체 뉴스에서도 관련 기사를 찾지 못했어요. 다른 토픽을 눌러보세요."
                action={() => setTopic(null)}
                actionLabel="토픽 해제"
              />
            )
          ) : (
            topicArticles.map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                source={SOURCE_MAP[a.sourceId]}
                translate={translate}
                onRead={setReader}
              />
            ))
          )
        ) : active === "interests" ? (
          interests.length === 0 ? (
            <EmptyState
              title="관심 뉴스를 설정해보세요"
              desc="관심 종목·키워드를 추가하면 인앱 소스는 물론 외부 뉴스까지 모아서 봐요."
              action={() => setInterestSheet(true)}
              actionLabel="관심 종목·키워드 추가"
            />
          ) : interestArticles === null && interestGnews === null ? (
            <SkeletonList />
          ) : (interestMerged ?? []).length === 0 ? (
            <EmptyState
              title="관심 관련 뉴스가 없어요"
              desc="지금은 관련 기사가 없어요. 관심을 편집하거나 잠시 후 다시 확인해보세요."
              action={() => setInterestSheet(true)}
              actionLabel="관심 편집"
            />
          ) : (
            (interestMerged ?? []).map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                source={SOURCE_MAP[a.sourceId]}
                translate={translate}
                onRead={setReader}
              />
            ))
          )
        ) : loading && articles.length === 0 ? (
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
          onEditProfile={() => {
            setManage(false);
            onEditProfile();
          }}
          onOpenHistory={() => {
            setManage(false);
            setHistoryOpen(true);
          }}
          aiFollowed={aiFollowed}
          onAiChange={updateAiFollowed}
          theme={theme}
          onThemeChange={changeTheme}
          isAdmin={user.isAdmin}
          adminNew={adminNew}
          onOpenAdmin={openAdmin}
        />
      )}

      {adminOpen && (
        <AdminUsers users={adminUsers} onClose={() => setAdminOpen(false)} />
      )}

      {aiChat && <AiChat app={aiChat} onClose={() => setAiChat(null)} />}

      {historyOpen && (
        <LikedNews
          onOpenArticle={(item: NewsItem) => {
            setHistoryOpen(false);
            setReader({
              id: `news:${item.url}`,
              sourceId: item.sourceId,
              title: item.title,
              link: item.url,
              summary: "",
              image: item.image,
              publishedAt: 0,
            });
          }}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {interestSheet && (
        <InterestSheet
          interests={interests}
          onChange={updateInterests}
          onClose={() => setInterestSheet(false)}
        />
      )}

      {notifOpen && (
        <NotificationPanel
          items={interestGnews ?? []}
          seen={seen}
          hasInterests={interests.length > 0}
          onOpenArticle={(a) => {
            setReader(a);
            closeNotif();
          }}
          onOpenInterests={() => {
            closeNotif();
            setActive("interests");
            setTopic(null);
            setInterestSheet(true);
          }}
          onClose={closeNotif}
        />
      )}

      {reader && SOURCE_MAP[reader.sourceId] && (
        <ArticleReader
          article={reader}
          source={SOURCE_MAP[reader.sourceId]}
          translate={translate}
          user={user}
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

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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

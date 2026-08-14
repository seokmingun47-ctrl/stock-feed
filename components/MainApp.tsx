"use client";

import { useCallback, useEffect, useState } from "react";
import type { Author, User } from "@/lib/community";
import Feed from "./Feed";
import Community from "./Community";
import GroupRooms from "./GroupRooms";
import Market from "./Market";
import EditProfile from "./EditProfile";
import AdRewardModal from "./AdRewardModal";
import DesktopSidebar from "./DesktopSidebar";
import { NO_CREDITS_EVENT } from "@/lib/nocredits";

type Tab = "news" | "market" | "group" | "board";

export default function MainApp({
  user,
  isGuest = false,
  onRequireLogin,
  initialFollowed,
  initialTranslate,
  onLogout,
  onUserUpdated,
}: {
  user: User;
  isGuest?: boolean;
  onRequireLogin: () => void;
  initialFollowed: string[];
  initialTranslate: boolean;
  onLogout: () => void;
  onUserUpdated: (u: User) => void;
}) {
  const [tab, setTab] = useState<Tab>("news");
  const [authors, setAuthors] = useState<Author[]>([]);
  const [editing, setEditing] = useState(false);
  // AI 크레딧은 여기서 한 곳으로 관리 (탭마다 따로 들고 있으면 값이 어긋남)
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsUnlimited, setCreditsUnlimited] = useState(false);

  const refreshCredits = useCallback(() => {
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? null);
        setCreditsUnlimited(!!d.unlimited);
      })
      .catch(() => {});
  }, []);

  // 탭을 옮길 때마다 최신 잔액 반영 (시장에서 쓴 크레딧이 뉴스탭에도 보이도록)
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits, tab]);

  // 크레딧 부족(402) 신호를 받으면 광고 보상 모달을 띄운다
  const [adOpen, setAdOpen] = useState(false);
  useEffect(() => {
    const onNoCredits = () => {
      if (isGuest) onRequireLogin();
      else setAdOpen(true);
    };
    window.addEventListener(NO_CREDITS_EVENT, onNoCredits);
    return () => window.removeEventListener(NO_CREDITS_EVENT, onNoCredits);
  }, [isGuest, onRequireLogin]);

  // 게스트도 '보는' 탭은 열어준다 — 앱이 뭘 할 수 있는지 실제로 겪어봐야
  // 가입할 마음이 생긴다. 글을 쓰는 곳(그룹방·자유게시판)만 로그인을 요구한다.
  // AI 기능은 각 화면에서 따로 막으므로(크레딧 소모) 여기서 막을 필요가 없다.
  const GUEST_OK: Tab[] = ["news", "market"];
  const go = (t: Tab) => {
    if (isGuest && !GUEST_OK.includes(t)) {
      onRequireLogin();
      return;
    }
    setTab(t);
  };

  // 내가 팔로우한 유저(뉴스 채널) 목록 — 뉴스탭 상단 칩
  const reloadAuthors = useCallback(() => {
    fetch("/api/follows", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAuthors(d.ok ? d.authors : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadAuthors();
  }, [reloadAuthors]);

  const openEdit = useCallback(() => setEditing(true), []);

  return (
    <div>
      {/* 데스크톱(xl+)에서는 본문 + 사이드바를 가운데 정렬로 배치해 화면을 채운다.
          모바일은 xl 미만이라 래퍼가 아무 영향 없이 기존과 동일. */}
      <div className="xl:mx-auto xl:flex xl:max-w-[1180px] xl:justify-center xl:gap-6">
        <aside className="sticky top-[56px] hidden h-[calc(100vh-72px)] w-[190px] shrink-0 self-start pt-3 xl:block">
          <DeskNav tab={tab} go={go} />
        </aside>
        <div className="w-full xl:w-[600px] xl:shrink-0">
          {/* 뉴스 피드는 상태 보존 위해 항상 마운트, 숨김 처리 */}
          <div className={tab === "news" ? "" : "hidden"}>
        <Feed
          user={user}
          isGuest={isGuest}
          onRequireLogin={onRequireLogin}
          initialFollowed={initialFollowed}
          initialTranslate={initialTranslate}
          authors={authors}
          reloadAuthors={reloadAuthors}
          credits={credits}
          creditsUnlimited={creditsUnlimited}
          refreshCredits={refreshCredits}
          onLogout={onLogout}
          onEditProfile={openEdit}
        />
      </div>
      {tab === "market" && (
        <Market
          user={user}
          translate={initialTranslate}
          credits={credits}
          creditsUnlimited={creditsUnlimited}
          refreshCredits={refreshCredits}
        />
      )}
      {tab === "group" && <GroupRooms user={user} />}
      {tab === "board" && (
        <Community
          user={user}
          onFollowChange={reloadAuthors}
          onEditProfile={openEdit}
        />
      )}
        </div>
        <aside className="sticky top-[60px] hidden h-[calc(100vh-84px)] w-[340px] shrink-0 self-start overflow-y-auto py-4 xl:block">
          <DesktopSidebar />
        </aside>
      </div>

      {editing && (
        <EditProfile
          user={user}
          onClose={() => setEditing(false)}
          onSaved={(u) => {
            onUserUpdated(u);
            reloadAuthors();
            setEditing(false);
          }}
        />
      )}

      <AdRewardModal
        open={adOpen}
        onClose={() => setAdOpen(false)}
        onGranted={refreshCredits}
      />

      {/* 하단 탭 네비게이션 (모바일). 데스크톱은 좌측 DeskNav가 대신하므로 숨김 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur xl:hidden">
        <div className="mx-auto flex max-w-[600px]">
          <NavItem
            active={tab === "news"}
            onClick={() => go("news")}
            label="뉴스"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v16H4z" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          </NavItem>
          <NavItem
            active={tab === "market"}
            onClick={() => go("market")}
            label="시장"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l3-3 3 3 5-6" />
            </svg>
          </NavItem>
          <NavItem
            active={tab === "group"}
            onClick={() => go("group")}
            label="그룹방"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </NavItem>
          <NavItem
            active={tab === "board"}
            onClick={() => go("board")}
            label="자유게시판"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z" />
            </svg>
          </NavItem>
          <a
            href="/pricing"
            className="flex flex-1 flex-col items-center gap-1 py-2.5 pb-3 text-[11px] font-semibold text-accent"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <span>요금제</span>
          </a>
        </div>
      </nav>
    </div>
  );
}

// 데스크톱 좌측 네비 (xl+ 전용) — 화면을 채우고 데스크톱 탐색 제공
function DeskNav({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const items: [Tab, string][] = [
    ["news", "뉴스"],
    ["market", "시장"],
    ["group", "그룹방"],
    ["board", "자유게시판"],
  ];
  return (
    <div>
      <div className="mb-4 px-3 text-[20px] font-extrabold tracking-tight">
        <span className="text-text">New</span>
        <span className="text-accent">sync</span>
      </div>
      <nav className="space-y-1">
        {items.map(([t, label]) => (
          <button
            key={t}
            onClick={() => go(t)}
            className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[14.5px] font-bold transition-colors ${
              tab === t ? "bg-accent/12 text-accent" : "text-muted hover:bg-bg-soft"
            }`}
          >
            {label}
          </button>
        ))}
        <a
          href="/pricing"
          className="flex w-full items-center rounded-xl px-3 py-2.5 text-[14.5px] font-bold text-muted transition-colors hover:bg-bg-soft"
        >
          요금제
        </a>
      </nav>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 pb-3 text-[11px] font-semibold transition-colors ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

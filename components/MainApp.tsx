"use client";

import { useCallback, useEffect, useState } from "react";
import type { Author, User } from "@/lib/community";
import Feed from "./Feed";
import Community from "./Community";
import GroupRooms from "./GroupRooms";
import Market from "./Market";
import EditProfile from "./EditProfile";

type Tab = "news" | "market" | "group" | "board";

export default function MainApp({
  user,
  initialFollowed,
  initialTranslate,
  onLogout,
  onUserUpdated,
}: {
  user: User;
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
      {/* 뉴스 피드는 상태 보존 위해 항상 마운트, 숨김 처리 */}
      <div className={tab === "news" ? "" : "hidden"}>
        <Feed
          user={user}
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

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[600px]">
          <NavItem
            active={tab === "news"}
            onClick={() => setTab("news")}
            label="뉴스"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v16H4z" />
              <path d="M8 8h8M8 12h8M8 16h5" />
            </svg>
          </NavItem>
          <NavItem
            active={tab === "market"}
            onClick={() => setTab("market")}
            label="시장"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l3-3 3 3 5-6" />
            </svg>
          </NavItem>
          <NavItem
            active={tab === "group"}
            onClick={() => setTab("group")}
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
            onClick={() => setTab("board")}
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

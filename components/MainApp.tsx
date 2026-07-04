"use client";

import { useCallback, useEffect, useState } from "react";
import type { Author, User } from "@/lib/community";
import Feed from "./Feed";
import Community from "./Community";

type Tab = "news" | "board";

export default function MainApp({
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
  const [tab, setTab] = useState<Tab>("news");
  const [authors, setAuthors] = useState<Author[]>([]);

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
          onLogout={onLogout}
        />
      </div>
      {tab === "board" && (
        <Community user={user} onFollowChange={reloadAuthors} />
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
            active={tab === "board"}
            onClick={() => setTab("board")}
            label="자유게시판"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z" />
            </svg>
          </NavItem>
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

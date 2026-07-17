"use client";

import { useEffect, useState } from "react";
import { SOURCE_MAP, MIN_FOLLOW } from "@/lib/sources";
import type { User } from "@/lib/community";
import Auth from "@/components/Auth";
import Onboarding from "@/components/Onboarding";
import MainApp from "@/components/MainApp";

const K_TRANSLATE = "stockfeed:translate";
// 팔로우/온보딩은 계정(아이디)별로 저장 — 새 계정은 반드시 온보딩
const fKey = (u: string) => `stockfeed:followed:${u}`;
const oKey = (u: string) => `stockfeed:onboarded:${u}`;
const aiKey = (u: string) => `stockfeed:ai:${u}`;

// 비로그인(게스트) — 로그인 없이 뉴스는 볼 수 있게. 저장 네임스페이스 겸 표시 이름.
const GUEST = "게스트";
const GUEST_USER: User = { id: "", username: GUEST, isAdmin: false, isPro: false };

type Screen = "loading" | "onboarding" | "app";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<User | null>(null); // null = 게스트
  const [followed, setFollowed] = useState<string[]>([]);
  const [translate, setTranslate] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);

  // 팔로우/온보딩은 계정별 localStorage, 번역은 기기 설정, 로그인은 세션
  function readPrefs(username: string) {
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(fKey(username)) || "[]").filter(
        (id: string) => SOURCE_MAP[id],
      );
      setTranslate(localStorage.getItem(K_TRANSLATE) !== "0");
    } catch {
      /* noop */
    }
    setFollowed(ids);
    return {
      ids,
      onboarded:
        localStorage.getItem(oKey(username)) === "1" && ids.length >= MIN_FOLLOW,
    };
  }

  // 첫 진입: 로그인했으면 그 계정으로, 아니면 게스트로 바로 시작(로그인 창 안 띄움)
  useEffect(() => {
    (async () => {
      let me: User | null = null;
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        const d = await r.json();
        me = d.user ?? null;
      } catch {
        /* noop */
      }
      setUser(me);
      const { onboarded } = readPrefs(me ? me.username : GUEST);
      setScreen(onboarded ? "app" : "onboarding");
    })();
  }, []);

  // 로그인/가입 완료 → 게스트로 고른 팔로우를 계정으로 이어받음
  const handleAuth = (u: User) => {
    setUser(u);
    setAuthOpen(false);
    const mine = readPrefs(u.username);
    if (mine.onboarded) {
      setScreen("app");
      return;
    }
    try {
      const gIds: string[] = JSON.parse(
        localStorage.getItem(fKey(GUEST)) || "[]",
      ).filter((id: string) => SOURCE_MAP[id]);
      if (gIds.length >= MIN_FOLLOW) {
        localStorage.setItem(fKey(u.username), JSON.stringify(gIds));
        localStorage.setItem(oKey(u.username), "1");
        const gAi = localStorage.getItem(aiKey(GUEST));
        if (gAi) localStorage.setItem(aiKey(u.username), gAi);
        setFollowed(gIds);
        setScreen("app");
        return;
      }
    } catch {
      /* noop */
    }
    setScreen("onboarding");
  };

  const handleOnboardDone = (ids: string[], aiIds: string[] = []) => {
    const name = user ? user.username : GUEST;
    localStorage.setItem(fKey(name), JSON.stringify(ids));
    localStorage.setItem(oKey(name), "1");
    if (aiIds.length) {
      localStorage.setItem(aiKey(name), JSON.stringify(aiIds));
    }
    setFollowed(ids);
    setScreen("app");
  };

  // 로그아웃 → 로그인 창이 아니라 게스트 상태로 되돌아감
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* noop */
    }
    setUser(null);
    const { onboarded } = readPrefs(GUEST);
    setScreen(onboarded ? "app" : "onboarding");
  };

  const authOverlay = authOpen && (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-bg">
      <Auth onAuth={handleAuth} onClose={() => setAuthOpen(false)} />
    </div>
  );

  if (screen === "loading") {
    return <div className="min-h-screen bg-bg" />;
  }
  if (screen === "onboarding") {
    return (
      <>
        <Onboarding username={user?.username} onDone={handleOnboardDone} />
        {authOverlay}
      </>
    );
  }
  return (
    <>
      <MainApp
        key={user?.username ?? GUEST}
        user={user ?? GUEST_USER}
        isGuest={!user}
        onRequireLogin={() => setAuthOpen(true)}
        initialFollowed={followed}
        initialTranslate={translate}
        onLogout={handleLogout}
        onUserUpdated={setUser}
      />
      {authOverlay}
    </>
  );
}

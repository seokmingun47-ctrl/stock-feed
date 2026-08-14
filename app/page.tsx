"use client";

import { useEffect, useState } from "react";
import { SOURCE_MAP, MIN_FOLLOW } from "@/lib/sources";
import type { User } from "@/lib/community";
import Auth from "@/components/Auth";
import Onboarding from "@/components/Onboarding";
import Landing from "@/components/Landing";
import MainApp from "@/components/MainApp";

const K_TRANSLATE = "stockfeed:translate";
// 팔로우/온보딩은 계정(아이디)별로 저장 — 새 계정은 반드시 온보딩
const fKey = (u: string) => `stockfeed:followed:${u}`;
const oKey = (u: string) => `stockfeed:onboarded:${u}`;
const aiKey = (u: string) => `stockfeed:ai:${u}`;

// 비로그인(게스트) — 로그인 없이 뉴스는 볼 수 있게. 저장 네임스페이스 겸 표시 이름.
const GUEST = "게스트";
const GUEST_USER: User = { id: "", username: GUEST, isAdmin: false, isPro: false };

type Screen = "loading" | "landing" | "onboarding" | "app";

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

  // 첫 진입 흐름:
  //   로그인 안 함 → 랜딩(소개) → 시작하기 → 로그인 → 소스 팔로우 → 앱
  //   로그인 함    → (온보딩 했으면) 앱 / (아니면) 소스 팔로우
  // ⚠️ 비로그인 상태에서 앱으로 바로 들어가지 않게 할 것. 랜딩이 항상 첫 화면이다.
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
      if (me) {
        const { onboarded } = readPrefs(me.username);
        setScreen(onboarded ? "app" : "onboarding");
      } else {
        setScreen("landing");
      }

      // /?login=1 로 들어오면 (요금제 페이지에서 넘어온 경우) 로그인 창을 바로 띄움
      try {
        const p = new URLSearchParams(window.location.search);
        if (p.get("login") === "1") {
          if (!me) setAuthOpen(true);
          // 새로고침해도 다시 뜨지 않게 쿼리 정리
          window.history.replaceState({}, "", window.location.pathname);
        }
      } catch {
        /* noop */
      }
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

  // 로그아웃 → 소개(랜딩) 화면으로. 비로그인으로 앱에 남아 있으면 안 된다.
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* noop */
    }
    setUser(null);
    setAuthOpen(false);
    setScreen("landing");
  };

  const authOverlay = authOpen && (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-bg">
      <Auth onAuth={handleAuth} onClose={() => setAuthOpen(false)} />
    </div>
  );

  if (screen === "loading") {
    return <div className="min-h-screen bg-bg" />;
  }
  if (screen === "landing") {
    return (
      <>
        {/* '시작하기' → 로그인. '둘러보기' → 진짜 앱을 게스트로 체험(가짜 데모가 아니라 실제 뉴스·시세).
            게스트는 AI·글쓰기에서 막히고, 그 순간이 가입 유도 지점이 된다. */}
        <Landing
          onStart={() => setAuthOpen(true)}
          onExplore={() => {
            const { onboarded } = readPrefs(GUEST);
            setScreen(onboarded ? "app" : "onboarding");
          }}
        />
        {authOpen && (
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-white">
            <Auth onAuth={handleAuth} onClose={() => setAuthOpen(false)} />
          </div>
        )}
      </>
    );
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

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

type Screen = "loading" | "auth" | "onboarding" | "app";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [followed, setFollowed] = useState<string[]>([]);
  const [translate, setTranslate] = useState(true);

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

  // 첫 진입: 세션으로 로그인 여부 확인
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
      if (!me) {
        setScreen("auth");
        return;
      }
      setUser(me);
      const { onboarded } = readPrefs(me.username);
      setScreen(onboarded ? "app" : "onboarding");
    })();
  }, []);

  const handleAuth = (u: User) => {
    setUser(u);
    const { onboarded } = readPrefs(u.username);
    setScreen(onboarded ? "app" : "onboarding");
  };

  const handleOnboardDone = (ids: string[]) => {
    if (!user) return;
    localStorage.setItem(fKey(user.username), JSON.stringify(ids));
    localStorage.setItem(oKey(user.username), "1");
    setFollowed(ids);
    setScreen("app");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* noop */
    }
    setUser(null);
    setScreen("auth");
  };

  if (screen === "loading") {
    return <div className="min-h-screen bg-bg" />;
  }
  if (screen === "auth" || !user) {
    return <Auth onAuth={handleAuth} />;
  }
  if (screen === "onboarding") {
    return <Onboarding username={user.username} onDone={handleOnboardDone} />;
  }
  return (
    <MainApp
      user={user}
      initialFollowed={followed}
      initialTranslate={translate}
      onLogout={handleLogout}
      onUserUpdated={setUser}
    />
  );
}

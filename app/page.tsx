"use client";

import { useEffect, useState } from "react";
import { SOURCE_MAP, MIN_FOLLOW } from "@/lib/sources";
import type { User } from "@/lib/community";
import Auth from "@/components/Auth";
import Onboarding from "@/components/Onboarding";
import MainApp from "@/components/MainApp";

const K_ONBOARDED = "stockfeed:onboarded";
const K_FOLLOWED = "stockfeed:followed";
const K_TRANSLATE = "stockfeed:translate";

type Screen = "loading" | "auth" | "onboarding" | "app";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [followed, setFollowed] = useState<string[]>([]);
  const [translate, setTranslate] = useState(true);

  // 디바이스 설정(팔로우/번역/온보딩)은 localStorage, 로그인 상태는 세션
  function readPrefs() {
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(K_FOLLOWED) || "[]").filter(
        (id: string) => SOURCE_MAP[id],
      );
      setTranslate(localStorage.getItem(K_TRANSLATE) !== "0");
    } catch {
      /* noop */
    }
    setFollowed(ids);
    return {
      ids,
      onboarded: localStorage.getItem(K_ONBOARDED) === "1" && ids.length >= MIN_FOLLOW,
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
      const { onboarded } = readPrefs();
      setScreen(onboarded ? "app" : "onboarding");
    })();
  }, []);

  const handleAuth = (u: User) => {
    setUser(u);
    const { onboarded } = readPrefs();
    setScreen(onboarded ? "app" : "onboarding");
  };

  const handleOnboardDone = (ids: string[]) => {
    localStorage.setItem(K_FOLLOWED, JSON.stringify(ids));
    localStorage.setItem(K_ONBOARDED, "1");
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
    />
  );
}

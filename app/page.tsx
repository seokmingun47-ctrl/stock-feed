"use client";

import { useEffect, useState } from "react";
import { SOURCE_MAP, MIN_FOLLOW } from "@/lib/sources";
import Welcome from "@/components/Welcome";
import Onboarding from "@/components/Onboarding";
import Feed from "@/components/Feed";

const K_USER = "stockfeed:user";
const K_ONBOARDED = "stockfeed:onboarded";
const K_FOLLOWED = "stockfeed:followed";
const K_TRANSLATE = "stockfeed:translate";

type Screen = "loading" | "welcome" | "onboarding" | "feed";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [nickname, setNickname] = useState("");
  const [followed, setFollowed] = useState<string[]>([]);
  // 해외 뉴스 한국어 번역 — 기본 켜짐 (사용자가 끄면 '0' 저장)
  const [translate, setTranslate] = useState(true);

  // 첫 진입: localStorage로 어느 화면인지 결정
  useEffect(() => {
    try {
      const user = localStorage.getItem(K_USER);
      const onboarded = localStorage.getItem(K_ONBOARDED) === "1";
      const ids = JSON.parse(localStorage.getItem(K_FOLLOWED) || "[]").filter(
        (id: string) => SOURCE_MAP[id],
      );
      setTranslate(localStorage.getItem(K_TRANSLATE) !== "0");
      if (user && onboarded && ids.length >= MIN_FOLLOW) {
        setNickname(user);
        setFollowed(ids);
        setScreen("feed");
        return;
      }
      if (user) {
        setNickname(user);
        setScreen("onboarding");
        return;
      }
    } catch {
      /* noop */
    }
    setScreen("welcome");
  }, []);

  const handleStart = (nick: string) => {
    localStorage.setItem(K_USER, nick);
    setNickname(nick);
    setScreen("onboarding");
  };

  const handleOnboardDone = (ids: string[]) => {
    localStorage.setItem(K_FOLLOWED, JSON.stringify(ids));
    localStorage.setItem(K_ONBOARDED, "1");
    setFollowed(ids);
    setScreen("feed");
  };

  const handleLogout = () => {
    localStorage.removeItem(K_USER);
    localStorage.removeItem(K_ONBOARDED);
    localStorage.removeItem(K_FOLLOWED);
    setNickname("");
    setFollowed([]);
    setScreen("welcome");
  };

  if (screen === "loading") {
    return <div className="min-h-screen bg-bg" />;
  }
  if (screen === "welcome") {
    return <Welcome onStart={handleStart} />;
  }
  if (screen === "onboarding") {
    return <Onboarding nickname={nickname} onDone={handleOnboardDone} />;
  }
  return (
    <Feed
      nickname={nickname}
      initialFollowed={followed}
      initialTranslate={translate}
      onLogout={handleLogout}
    />
  );
}

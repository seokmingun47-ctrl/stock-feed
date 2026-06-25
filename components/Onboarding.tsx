"use client";

import { useState } from "react";
import { SOURCES, MIN_FOLLOW } from "@/lib/sources";
import type { Source } from "@/lib/types";
import SourceAvatar from "@/components/SourceAvatar";

function Card({
  source,
  selected,
  onToggle,
}: {
  source: Source;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-accent bg-accent/10"
          : "border-border bg-bg-soft hover:bg-card"
      }`}
    >
      <SourceAvatar source={source} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-text">
          {source.name}
        </div>
        <div className="truncate text-[12px] text-muted">{source.category}</div>
      </div>
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] ${
          selected
            ? "border-accent bg-accent text-white"
            : "border-border text-transparent"
        }`}
      >
        ✓
      </span>
    </button>
  );
}

export default function Onboarding({
  nickname,
  onDone,
}: {
  nickname: string;
  onDone: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  const need = Math.max(0, MIN_FOLLOW - picked.length);
  const ready = picked.length >= MIN_FOLLOW;
  const kr = SOURCES.filter((s) => s.region === "kr");
  const global = SOURCES.filter((s) => s.region === "global");

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg">
      <div className="px-5 pb-2 pt-8">
        <p className="text-[13px] font-semibold text-accent">
          {nickname}님, 환영해요 👋
        </p>
        <h1 className="mt-1.5 text-[22px] font-extrabold leading-snug text-text">
          관심 있는 증권 소스를
          <br />
          {MIN_FOLLOW}개 이상 팔로우하세요
        </h1>
        <p className="mt-2 text-[14px] text-muted">
          선택한 소스의 실시간 뉴스가 하나의 피드로 모여요.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28">
        <SectionLabel>🇰🇷 국내</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {kr.map((s) => (
            <Card
              key={s.id}
              source={s}
              selected={picked.includes(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
        </div>

        <SectionLabel>🌐 해외</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {global.map((s) => (
            <Card
              key={s.id}
              source={s}
              selected={picked.includes(s.id)}
              onToggle={() => toggle(s.id)}
            />
          ))}
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[600px] border-t border-border bg-bg/95 px-5 pb-7 pt-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-center gap-1.5">
          {SOURCES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i < picked.length ? "w-5 bg-accent" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => ready && onDone(picked)}
          disabled={!ready}
          className="w-full rounded-xl bg-accent py-3.5 text-[16px] font-bold text-white transition-opacity disabled:opacity-40"
        >
          {ready ? `시작하기 (${picked.length}개 팔로우)` : `${need}개 더 선택하세요`}
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-2 pt-5 text-[12px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </div>
  );
}

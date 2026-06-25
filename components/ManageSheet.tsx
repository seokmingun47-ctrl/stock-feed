"use client";

import { useState } from "react";
import { SOURCES } from "@/lib/sources";
import type { Source } from "@/lib/types";
import SourceAvatar from "./SourceAvatar";

function Row({
  source,
  followed,
  locked,
  onToggle,
}: {
  source: Source;
  followed: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <SourceAvatar source={source} size={40} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-text">
          {source.name}
        </div>
        <div className="truncate text-[13px] text-muted">
          {source.handle} · {source.category}
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${
          followed
            ? `border border-border bg-transparent text-muted ${
                locked ? "opacity-50" : ""
              }`
            : "bg-accent text-white"
        }`}
      >
        {followed ? "팔로잉" : "팔로우"}
      </button>
    </div>
  );
}

export default function ManageSheet({
  followed,
  minFollow = 0,
  nickname,
  onChange,
  onClose,
  onLogout,
}: {
  followed: string[];
  minFollow?: number;
  nickname?: string;
  onChange: (next: string[]) => void;
  onClose: () => void;
  onLogout?: () => void;
}) {
  const [warn, setWarn] = useState(false);
  const atMin = followed.length <= minFollow;

  const toggle = (id: string) => {
    if (followed.includes(id)) {
      if (atMin) {
        setWarn(true);
        setTimeout(() => setWarn(false), 2200);
        return;
      }
      onChange(followed.filter((x) => x !== id));
    } else {
      onChange([...followed, id]);
    }
  };

  const kr = SOURCES.filter((s) => s.region === "kr");
  const global = SOURCES.filter((s) => s.region === "global");

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <button aria-label="닫기" onClick={onClose} className="flex-1" />
      <div className="max-h-[82vh] overflow-y-auto rounded-t-2xl border-t border-border bg-bg pb-4">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-4 py-3.5">
          <div>
            <h2 className="text-[17px] font-bold text-text">증권 소스 팔로우</h2>
            <p className="text-[12px] text-muted">
              최소 {minFollow}개 유지 · 현재 {followed.length}개
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-bg-soft px-4 py-1.5 text-[14px] font-semibold text-text"
          >
            완료
          </button>
        </div>

        {warn && (
          <div className="mx-4 mt-3 rounded-lg bg-accent/15 px-3 py-2 text-center text-[13px] font-medium text-accent">
            최소 {minFollow}개는 팔로우해야 해요
          </div>
        )}

        <div className="px-4 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide text-muted">
          🇰🇷 국내
        </div>
        {kr.map((s) => (
          <Row
            key={s.id}
            source={s}
            followed={followed.includes(s.id)}
            locked={atMin}
            onToggle={() => toggle(s.id)}
          />
        ))}

        <div className="px-4 pb-1 pt-4 text-[13px] font-semibold uppercase tracking-wide text-muted">
          🌐 해외
        </div>
        {global.map((s) => (
          <Row
            key={s.id}
            source={s}
            followed={followed.includes(s.id)}
            locked={atMin}
            onToggle={() => toggle(s.id)}
          />
        ))}

        {onLogout && (
          <div className="mt-4 border-t border-border px-4 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted">
                {nickname ? `${nickname}님으로 이용 중` : "이용 중"}
              </span>
              <button
                onClick={onLogout}
                className="rounded-full border border-border px-4 py-1.5 text-[13px] font-semibold text-muted hover:text-text"
              >
                로그아웃
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

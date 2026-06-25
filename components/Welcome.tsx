"use client";

import { useState } from "react";

export default function Welcome({
  onStart,
}: {
  onStart: (nickname: string) => void;
}) {
  const [nick, setNick] = useState("");
  const valid = nick.trim().length >= 1;

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col items-center justify-center px-7 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-2xl bg-accent text-[40px] font-black text-white shadow-lg shadow-accent/30">
        ₩
      </div>
      <h1 className="mt-6 text-[30px] font-extrabold tracking-tight text-text">
        증권피드
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        팔로우한 증권 뉴스를 앱 하나에서.
        <br />
        국내외 실시간 피드를 한 곳에서 보세요.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onStart(nick.trim());
        }}
        className="mt-9 w-full"
      >
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          maxLength={16}
          autoFocus
          placeholder="닉네임을 입력하세요"
          className="w-full rounded-xl border border-border bg-bg-soft px-4 py-3.5 text-center text-[16px] text-text outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={!valid}
          className="mt-3 w-full rounded-xl bg-accent py-3.5 text-[16px] font-bold text-white transition-opacity disabled:opacity-40"
        >
          시작하기
        </button>
      </form>

      <p className="mt-6 text-[12px] leading-relaxed text-muted">
        계정·비밀번호 없이 바로 시작해요.
        <br />
        선택한 소스는 이 기기에만 저장됩니다.
      </p>
    </div>
  );
}

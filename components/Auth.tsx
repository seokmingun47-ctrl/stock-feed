"use client";

import { useState } from "react";
import { SOURCE_MAP } from "@/lib/sources";
import type { User } from "@/lib/community";
import SourceAvatar from "@/components/SourceAvatar";
import { LogoMark } from "@/components/Logo";

const PREVIEW: { id: string; text: string; trend?: "up" | "down" }[] = [
  { id: "hankyung", text: "코스피 2,800 돌파…외국인 순매수 행진", trend: "up" },
  { id: "bloomberg", text: "Fed, 금리 동결 시사…나스닥 사상 최고치 마감", trend: "up" },
  { id: "yna", text: "삼성전자 신고가 경신, 반도체 슈퍼사이클 기대감" },
  { id: "cnbc", text: "엔비디아 시총 4조 달러 첫 돌파", trend: "up" },
  { id: "edaily", text: "2차전지株 급등…개인 매수세 집중", trend: "up" },
  { id: "ft", text: "유가 급락에 정유주 약세 전환", trend: "down" },
  { id: "chosunbiz", text: "비트코인 1억 재돌파, 코인 관련주 강세" },
  { id: "fnnews", text: "외국인·기관 동반 매수에 증시 훈풍" },
  { id: "nasdaq", text: "테슬라, 로보택시 기대에 7% 급등", trend: "up" },
  { id: "marketwatch", text: "S&P500 4거래일 연속 상승 마감", trend: "up" },
  { id: "seekingalpha", text: "고배당 ETF로 자금 유입…배당주 재평가" },
  { id: "yahoo", text: "애플, 신제품 공개 앞두고 강세", trend: "up" },
  { id: "fool", text: "AI 반도체株 일제히 신고가 경신", trend: "up" },
  { id: "businessinsider", text: "원/달러 환율 하락에 수출주 반등", trend: "down" },
];

export default function Auth({ onAuth }: { onAuth: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErr(d.reason || "실패했어요.");
        setBusy(false);
        return;
      }
      onAuth(d.user);
    } catch {
      setErr("네트워크 오류예요.");
      setBusy(false);
    }
  };

  const colA = PREVIEW.filter((_, i) => i % 2 === 0);
  const colB = PREVIEW.filter((_, i) => i % 2 === 1);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-white via-[#fdf2f8] to-[#ece9fe]">
      <div className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col md:grid md:grid-cols-2">
        {/* 브랜딩 + 인증 폼 */}
        <div className="flex flex-col justify-start px-7 pb-6 pt-12 sm:px-12 md:justify-center md:py-14">
          <div className="mb-8 flex items-center gap-2.5">
            <LogoMark size={40} />
            <span className="text-[25px] font-extrabold tracking-tight">
              <span className="text-zinc-900">New</span>
              <span className="text-indigo-600">sync</span>
            </span>
          </div>

          <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight text-zinc-900 sm:text-[46px]">
            당신의 증시.
            <br />
            당신의 피드.
          </h1>

          {/* 로그인 / 회원가입 토글 */}
          <div className="mt-7 inline-flex w-full max-w-sm rounded-full bg-zinc-100 p-1">
            {(
              [
                ["login", "로그인"],
                ["signup", "회원가입"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setMode(key);
                  setErr("");
                }}
                className={`flex-1 rounded-full py-2 text-[14px] font-bold transition-colors ${
                  mode === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-3 w-full max-w-sm">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoComplete="username"
              placeholder="아이디"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              maxLength={100}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="비밀번호"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            {err && <p className="mt-2 text-[13px] font-medium text-[#e0245e]">{err}</p>}
            <button
              type="submit"
              disabled={busy || !username.trim() || !password}
              className="mt-3 w-full rounded-xl bg-indigo-600 py-3.5 text-[16px] font-bold text-white shadow-lg shadow-indigo-300/40 transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:shadow-none"
            >
              {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 시작하기"}
            </button>
          </form>

          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-zinc-400">
            {mode === "signup"
              ? "아이디는 영문/숫자/_/- 3~20자, 비밀번호는 4자 이상이에요."
              : "계정으로 어디서든 내 글·댓글을 관리할 수 있어요."}
          </p>
        </div>

        {/* 미리보기 피드 */}
        <div className="relative min-h-[40vh] flex-1 md:min-h-0">
          <div className="pointer-events-none absolute inset-0 flex gap-4 overflow-hidden px-6 pb-6 md:pb-0 [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]">
            <div className="h-full w-1/2 overflow-hidden">
              <div className="marquee-up flex flex-col">
                {[...colA, ...colA].map((p, i) => (
                  <PreviewCard key={i} post={p} />
                ))}
              </div>
            </div>
            <div className="h-full w-1/2 overflow-hidden">
              <div className="marquee-down flex flex-col">
                {[...colB, ...colB].map((p, i) => (
                  <PreviewCard key={i} post={p} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  post,
}: {
  post: { id: string; text: string; trend?: "up" | "down" };
}) {
  const s = SOURCE_MAP[post.id];
  if (!s) return null;
  return (
    <div className="mb-4 rounded-2xl border border-zinc-200/80 bg-white/85 p-3.5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <SourceAvatar source={s} size={26} />
        <span className="text-[13px] font-bold text-zinc-900">{s.name}</span>
        <span className="truncate text-[12px] text-zinc-400">{s.handle}</span>
      </div>
      <p className="mt-2 text-[13.5px] font-medium leading-snug text-zinc-800">
        {post.text}
      </p>
      {post.trend && <Sparkline up={post.trend === "up"} />}
    </div>
  );
}

function Sparkline({ up }: { up: boolean }) {
  const color = up ? "#14c38e" : "#f6465d";
  const d = up
    ? "0 26 18 20 34 23 52 12 70 15 88 5 106 8"
    : "0 6 18 12 34 9 52 18 70 15 88 24 106 22";
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <svg width="106" height="30" viewBox="0 0 106 30" fill="none">
        <polyline points={d} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[12px] font-bold" style={{ color }}>
        {up ? "▲" : "▼"} {up ? "+2.4%" : "-1.8%"}
      </span>
    </div>
  );
}

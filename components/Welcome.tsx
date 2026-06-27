"use client";

import { useState } from "react";
import { SOURCE_MAP } from "@/lib/sources";
import SourceAvatar from "@/components/SourceAvatar";
import { LogoMark } from "@/components/Logo";

// 오른쪽 미리보기 피드 샘플 (장식용)
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

export default function Welcome({
  onStart,
}: {
  onStart: (nickname: string) => void;
}) {
  const [nick, setNick] = useState("");
  const valid = nick.trim().length >= 1;

  const colA = PREVIEW.filter((_, i) => i % 2 === 0);
  const colB = PREVIEW.filter((_, i) => i % 2 === 1);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-white via-[#fdf2f8] to-[#ece9fe]">
      {/* 은은한 컬러 블롭 */}
      <div className="pointer-events-none absolute -right-32 top-1/4 h-96 w-96 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-pink-300/30 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col md:grid md:grid-cols-2">
        {/* ── 브랜딩 + 시작 폼 (모바일: 위 / 데스크톱: 왼쪽) ── */}
        <div className="flex flex-col justify-start px-7 pb-6 pt-12 sm:px-12 md:justify-center md:py-14">
          <div className="mb-9 flex items-center gap-2.5">
            <LogoMark size={40} />
            <span className="text-[25px] font-extrabold tracking-tight">
              <span className="text-zinc-900">New</span>
              <span className="text-indigo-600">sync</span>
            </span>
          </div>

          <h1 className="text-[38px] font-extrabold leading-[1.05] tracking-tight text-zinc-900 sm:text-[52px]">
            당신의 증시.
            <br />
            당신의 피드.
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-zinc-500">
            국내·해외 증권 뉴스를 한 곳에서. 흩어진 증시 소식을 하나의 피드로
            모아보세요.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) onStart(nick.trim());
            }}
            className="mt-8 w-full max-w-sm"
          >
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={16}
              autoFocus
              placeholder="닉네임을 입력하세요"
              className="w-full rounded-full border border-zinc-300 bg-white px-5 py-3.5 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="submit"
              disabled={!valid}
              className="mt-3 w-full rounded-full bg-indigo-600 py-3.5 text-[16px] font-bold text-white shadow-lg shadow-indigo-300/40 transition-colors hover:bg-indigo-700 disabled:opacity-40 disabled:shadow-none"
            >
              시작하기
            </button>
          </form>

          <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-zinc-400">
            계정·비밀번호 없이 바로 시작해요. 선택한 소스는 이 기기에만
            저장됩니다.
          </p>
        </div>

        {/* ── 미리보기 피드 (모바일: 아래 / 데스크톱: 오른쪽, 무한 세로 스크롤) ── */}
        <div className="relative min-h-[44vh] flex-1 md:min-h-0">
          <div className="pointer-events-none absolute inset-0 flex gap-4 overflow-hidden px-6 pb-6 md:pb-0 [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]">
            <div className="h-full w-1/2 overflow-hidden">
              {/* 카드 2벌 복제 → -50% 이동 시 끊김 없이 무한 루프
                  (간격은 카드 mb-4로 균일하게 — gap을 쓰면 복제 경계가 어긋남) */}
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
        <VerifiedBadge />
        <span className="truncate text-[12px] text-zinc-400">{s.handle}</span>
      </div>
      <p className="mt-2 text-[13.5px] font-medium leading-snug text-zinc-800">
        {post.text}
      </p>
      {post.trend && <Sparkline up={post.trend === "up"} />}
    </div>
  );
}

function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
      <path
        fill="#2f81f7"
        d="M12 1l2.4 1.8 3 .2.9 2.9 2.2 2-1 2.9 1 2.9-2.2 2-.9 2.9-3 .2L12 23l-2.4-1.8-3-.2-.9-2.9-2.2-2 1-2.9-1-2.9 2.2-2 .9-2.9 3-.2z"
      />
      <path
        fill="#fff"
        d="M10.6 14.6l-2.2-2.2-1.1 1.1 3.3 3.3 5.8-5.8-1.1-1.1z"
      />
    </svg>
  );
}

function Sparkline({ up }: { up: boolean }) {
  const color = up ? "#14c38e" : "#f6465d";
  const d = up
    ? "M0 26 L18 20 L34 23 L52 12 L70 15 L88 5 L106 8"
    : "M0 6 L18 12 L34 9 L52 18 L70 15 L88 24 L106 22";
  return (
    <div className="mt-2.5 flex items-center gap-2">
      <svg width="106" height="30" viewBox="0 0 106 30" fill="none">
        <polyline
          points={d.replace(/[ML]/g, " ").trim()}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="text-[12px] font-bold"
        style={{ color }}
      >
        {up ? "▲" : "▼"} {up ? "+2.4%" : "-1.8%"}
      </span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import SiteFooter from "@/components/SiteFooter";

interface Plan {
  name: string;
  tagline: string;
  price: number;
  credits: string;
  period?: string; // 있으면 "크레딧 / 월" 처럼 붙음
  per?: string; // 크레딧 줄 아래 보조 설명
  uses: string;
  recommend: boolean;
  highlight?: { title: string; desc: string };
  features: string[];
  cta: string;
  free?: boolean;
}

const PLANS: Plan[] = [
  {
    name: "무료",
    tagline: "가볍게 시작하고 싶은 분께.",
    price: 0,
    credits: "2,000",
    per: "가입 시 지급",
    uses: "AI 약 80회",
    recommend: false,
    free: true,
    features: [
      "국내외 뉴스 · 기사별 원문↔한국어 전환",
      "시장 시세 · 차트 · 급등락 · 종목 검색",
      "경제 캘린더 (다음 달 일정까지)",
      "커뮤니티 · 그룹방",
      "AI 요약 · 종목분석 · 시장분석 (1회 25크레딧)",
    ],
    cta: "현재 이용 중",
  },
  {
    name: "프로",
    tagline: "AI를 마음껏 쓰고 싶은 분께.",
    price: 4900,
    credits: "10,000",
    period: "월",
    uses: "AI 약 400회",
    recommend: true,
    highlight: {
      title: "AI 종목 추천 · 저평가/고평가 분석",
      desc: "실제 뉴스와 지표만 근거로 종목을 골라주고, 추천 이유까지 자세히 (프로 전용)",
    },
    features: [
      "무료 플랜의 모든 기능",
      "AI 종목 추천 · 추천 이유 상세 설명",
      "저평가·고평가 종목 잠금 해제",
      "급등·급락 사유 AI 분석",
      "AI 포트폴리오 진단 (업종 쏠림·분산)",
      "AI 차트 분석 · 예측",
      "10,000 크레딧 자동 충전",
      "우선 응답",
    ],
    cta: "프로 시작하기",
  },
];

export default function PricingPage() {
  // 게스트는 무료 플랜을 '이용 중'이 아님 (계정이 없어 크레딧도 없음) → 로그인 유도
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null=확인 중
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => setLoggedIn(false));
  }, []);

  return (
    <main className="min-h-screen bg-bg text-text">
      {/* 상단 바 */}
      <header className="mx-auto flex max-w-[1000px] items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="text-[18px] font-extrabold tracking-tight">
            <span className="text-text">New</span>
            <span className="text-accent">sync</span>
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-full border border-border px-4 py-1.5 text-[13px] font-semibold text-muted hover:text-text"
        >
          앱으로
        </Link>
      </header>

      {/* 헤드라인 */}
      <div className="px-5 pb-6 pt-8 text-center">
        <h1 className="text-[30px] font-extrabold leading-tight sm:text-[38px]">
          AI 분석을 <span className="text-accent">마음껏</span>.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
          뉴스 요약, 종목 분석, 시장 전망까지.
          <br />
          크레딧이 부족하면 프로로 넉넉하게 이어가세요.
        </p>
      </div>

      {/* 요금제 카드 */}
      <div className="mx-auto grid max-w-[820px] gap-4 px-5 pb-16 sm:grid-cols-2">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
              p.recommend ? "border-accent" : "border-border"
            }`}
          >
            {p.recommend && (
              <span className="absolute right-5 top-5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-white">
                추천
              </span>
            )}
            <div className="text-[20px] font-extrabold">{p.name}</div>
            <p className="mt-1 text-[13.5px] text-muted">{p.tagline}</p>

            <div className="mt-5 flex items-end gap-1">
              <span className="text-[34px] font-extrabold leading-none">
                {p.price === 0 ? "0원" : `${p.price.toLocaleString()}원`}
              </span>
              {!p.free && (
                <span className="mb-1 text-[14px] text-muted"> / 월</span>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-y border-border py-3">
              <span className="text-[18px] font-extrabold text-accent">
                {p.credits}
                <span className="ml-1 text-[13px] font-semibold text-muted">
                  크레딧{p.period ? ` / ${p.period}` : ""}
                </span>
              </span>
              <span className="text-[12px] text-muted">{p.uses}</span>
            </div>
            {p.per && <div className="mt-1 text-[11.5px] text-muted">{p.per}</div>}

            {p.highlight && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/35 bg-accent/[0.08] px-3 py-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10.5" width="16" height="10" rx="2.2" />
                    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-extrabold text-accent">
                    {p.highlight.title}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-snug text-muted">
                    {p.highlight.desc}
                  </div>
                </div>
              </div>
            )}

            <ul className="mt-4 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-[13.5px] leading-snug">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={p.recommend ? "var(--accent)" : "var(--muted)"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mt-0.5 shrink-0"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            {p.free ? (
              loggedIn === false ? (
                // 비로그인 → 무료 플랜도 가입해야 크레딧이 나옴
                <Link
                  href="/?login=1"
                  className="mt-6 block w-full rounded-xl border border-accent py-3 text-center text-[15px] font-bold text-accent transition-colors hover:bg-accent/10"
                >
                  무료로 시작하기
                </Link>
              ) : (
                <button
                  disabled
                  className="mt-6 w-full cursor-default rounded-xl border border-border py-3 text-[15px] font-bold text-muted"
                >
                  {loggedIn === null ? " " : p.cta}
                </button>
              )
            ) : (
              <Link
                href={loggedIn === false ? "/?login=1" : "/checkout"}
                className="mt-6 block w-full rounded-xl bg-accent py-3 text-center text-[15px] font-bold text-white transition-opacity hover:opacity-90"
              >
                {p.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* 결제 안내 */}
      <p className="mx-auto max-w-md px-5 pb-12 text-center text-[12px] leading-relaxed text-muted">
        언제든 해지할 수 있어요. 카드결제는 토스페이먼츠로 안전하게 처리됩니다.
      </p>

      <SiteFooter />
    </main>
  );
}

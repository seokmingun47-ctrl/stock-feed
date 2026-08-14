"use client";

import { useState } from "react";
import { SOURCES } from "@/lib/sources";
import SourceAvatar from "@/components/SourceAvatar";
import { LogoMark } from "@/components/Logo";
import LandingDemo from "@/components/LandingDemo";
import { faviconUrl } from "@/lib/format";

/**
 * 랜딩(첫 방문) 페이지.
 * ⚠️ 앱 본체는 다크 테마지만 이 페이지는 '항상 밝은' 마케팅 페이지다.
 *    그래서 CSS 변수(--bg 등)를 쓰지 않고 색을 직접 지정한다.
 *    변수로 두면 사용자의 앱 테마 설정에 따라 랜딩 색이 같이 뒤집힌다.
 */
const BRAND = "linear-gradient(135deg,#5b54f0,#18b6e6)";

const KR = SOURCES.filter((s) => !s.hidden && s.region === "kr");
const GLOBAL = SOURCES.filter((s) => !s.hidden && s.region === "global");
// 흐르는 띠에는 전 언론사를 넣는다(멈춰 있는 목록이 아니라 지나가므로 개수가 많을수록 좋다)
const ALL_SOURCES = [...KR, ...GLOBAL];
const LOGOS = [...KR.slice(0, 5)]; // 히어로 목업 안 소스 칩용

const FEATURES = [
  {
    id: "summary",
    tab: "AI 요약",
    title: "긴 기사, 3줄이면 끝",
    desc: "기사 목록에서 바로 요약해요. 본문에 있는 내용만 정리하고, 없는 말은 지어내지 않아요.",
    bullets: [
      "핵심만 불릿으로 정리",
      "해외 기사도 한국어로",
      "근거 문단을 함께 표시",
    ],
  },
  {
    id: "stock",
    tab: "종목 분석",
    title: "이 뉴스, 어떤 종목에 영향 있지?",
    desc: "기사에서 실제로 언급되거나 영향받는 상장 종목을 호재·악재로 나눠 보여줘요.",
    bullets: ["호재·악재 방향 표시", "현재가·등락률 함께", "탭하면 앱 안에서 차트"],
  },
  {
    id: "value",
    tab: "저평가·고평가",
    title: "지표로 걸러낸 종목",
    desc: "PER·ROE·PBR을 코드가 직접 계산해 추려냅니다. AI는 그 숫자를 설명할 뿐이에요.",
    bullets: ["코스피·코스닥·나스닥", "동종업계 대비 비교", "실적 발표일까지 확인"],
  },
  {
    id: "link",
    tab: "링크 요약",
    title: "유튜브 영상도 요약",
    desc: "경제 유튜브나 기사 주소를 붙여넣으면 핵심만 뽑아드려요.",
    bullets: ["유튜브 영상 내용 요약", "외부 기사 본문 요약", "10분 단위로 이어보기"],
  },
];

export default function Landing({
  onStart,
  onExplore,
}: {
  onStart: () => void;
  onExplore: () => void; // 로그인 없이 진짜 앱을 둘러보게 한다
}) {
  const [tab, setTab] = useState(FEATURES[0].id);
  const active = FEATURES.find((f) => f.id === tab) ?? FEATURES[0];

  return (
    <div className="min-h-screen bg-white text-[#111725]">
      {/* 상단 바 */}
      <header className="sticky top-0 z-30 border-b border-[#eef1f6] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1080px] items-center gap-2 px-5 py-3.5">
          <LogoMark size={30} />
          <span className="text-[18px] font-extrabold tracking-tight">
            New<span className="text-[#2f81f7]">sync</span>
          </span>
          <button
            onClick={onStart}
            className="ml-auto rounded-full px-4 py-2 text-[13.5px] font-bold text-white transition-transform active:scale-95"
            style={{ background: BRAND }}
          >
            시작하기
          </button>
        </div>
      </header>

      {/* 히어로 */}
      <section className="px-5 pb-14 pt-16 text-center sm:pt-24">
        <div className="mx-auto max-w-[720px]">
          <span className="inline-block rounded-full bg-[#f1f4f9] px-3 py-1.5 text-[12.5px] font-bold text-[#5f6b7d]">
            국내외 {KR.length + GLOBAL.length}개 언론사 · 실시간
          </span>
          <h1 className="mt-5 text-[34px] font-extrabold leading-[1.25] tracking-tight sm:text-[48px]">
            증권 뉴스 보려고
            <br />
            앱 여러 개 켜지 마세요
          </h1>
          <p className="mx-auto mt-5 max-w-[520px] text-[15.5px] leading-relaxed text-[#5f6b7d] sm:text-[17px]">
            흩어진 증권 뉴스를 하나의 피드로 모으고,
            <br className="hidden sm:block" /> AI가 핵심만 정리해 드려요.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <button
              onClick={onStart}
              className="w-full rounded-full px-8 py-4 text-[16px] font-extrabold text-white shadow-lg shadow-[#5b54f0]/25 transition-transform active:scale-95 sm:w-auto"
              style={{ background: BRAND }}
            >
              무료로 시작하기
            </button>
            <button
              onClick={onExplore}
              className="w-full rounded-full border border-[#e2e7ef] bg-white px-8 py-4 text-[16px] font-bold text-[#111725] transition-colors hover:bg-[#f8fafc] sm:w-auto"
            >
              앱 둘러보기 →
            </button>
          </div>
          <p className="mt-3 text-[12.5px] text-[#8b96ad]">
            둘러보기는 로그인 없이 · 설치 없이 바로
          </p>
        </div>

        {/* 만져보는 데모 — 글로 읽는 것보다 직접 눌러보는 게 이해가 빠르다 */}
        <div className="mx-auto mt-14 max-w-[880px]">
          <LandingDemo />
        </div>

        {/* 데모 밑 간단 설명 */}
        <div className="mx-auto mt-10 max-w-[560px]">
          <p className="text-[14.5px] leading-relaxed text-[#5f6b7d] sm:text-[15.5px]">
            Newsync는 <b className="text-[#111725]">국내외 {KR.length + GLOBAL.length}개 언론사</b>의
            증권 뉴스를 하나의 피드로 모아주는 앱이에요. 원하는 언론사만 골라 보고, 해외 기사는
            한국어로 읽고, 긴 기사는 <b className="text-[#111725]">AI 요약</b>으로 핵심만 확인할 수
            있어요.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {["실시간 통합 피드", "해외 기사 한국어", "AI 요약·종목 분석", "시세·차트", "경제 캘린더"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full bg-[#f1f4f9] px-3 py-1.5 text-[12.5px] font-bold text-[#5f6b7d]"
                >
                  {t}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* 언론사 로고 월 */}
      <section className="border-y border-[#eef1f6] bg-[#fafbfd] px-5 py-10">
        <p className="text-center text-[13px] font-bold text-[#8b96ad]">
          한국경제 · 연합뉴스 · CNBC 등 {KR.length + GLOBAL.length}개 언론사
        </p>
        {/* 흐르는 로고 띠 — 양옆은 그라데이션으로 자연스럽게 사라지게 */}
        <div
          className="marquee-pause relative mt-5 overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)",
            WebkitMaskImage:
              "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)",
          }}
        >
          <div className="marquee-left flex items-center gap-x-9">
            {/* ⚠️ 같은 목록을 정확히 2벌 — 한 벌만 두면 -50%에서 끊겨 보인다 */}
            {[...ALL_SOURCES, ...ALL_SOURCES].map((s, i) => (
              <span
                key={`${s.id}-${i}`}
                aria-hidden={i >= ALL_SOURCES.length}
                className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
                title={s.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={faviconUrl(s.domain)}
                  alt={i < ALL_SOURCES.length ? s.name : ""}
                  width={28}
                  height={28}
                  loading="lazy"
                  className="rounded-md"
                />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 문제 제기 */}
      <section className="px-5 py-20 text-center sm:py-28">
        <h2 className="text-[26px] font-extrabold leading-snug tracking-tight sm:text-[34px]">
          이런 적, 있지 않나요?
        </h2>
        <div className="mx-auto mt-7 max-w-[480px] space-y-3.5 text-[15px] leading-relaxed text-[#5f6b7d] sm:text-[16.5px]">
          <p>뉴스 보려고 앱 세 개를 번갈아 켜는</p>
          <p>해외 기사는 영어라 그냥 넘기는</p>
          <p>급등한 종목을 보고도 이유를 모르는</p>
          <p>긴 경제 유튜브를 끝까지 볼 시간이 없는</p>
        </div>
      </section>

      {/* 기능 탭 */}
      <section className="border-t border-[#eef1f6] bg-[#fafbfd] px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-[880px]">
          <h2 className="text-center text-[26px] font-extrabold leading-snug tracking-tight sm:text-[34px]">
            뉴스만 모아주는 게 아니에요
          </h2>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {FEATURES.map((f) => (
              <button
                key={f.id}
                onClick={() => setTab(f.id)}
                className={`rounded-full px-4 py-2 text-[13.5px] font-bold transition-colors ${
                  tab === f.id
                    ? "bg-[#111725] text-white"
                    : "bg-white text-[#5f6b7d] ring-1 ring-[#e2e7ef] hover:bg-[#f1f4f9]"
                }`}
              >
                {f.tab}
              </button>
            ))}
          </div>

          <div className="mt-9 rounded-3xl border border-[#e8ecf3] bg-white p-7 shadow-sm sm:p-10">
            <h3 className="text-[21px] font-extrabold leading-snug tracking-tight sm:text-[25px]">
              {active.title}
            </h3>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#5f6b7d] sm:text-[15.5px]">
              {active.desc}
            </p>
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-3">
              {active.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-center gap-2 rounded-xl bg-[#f6f8fb] px-3.5 py-3 text-[13.5px] font-semibold text-[#374151]"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f81f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 마무리 CTA */}
      <section className="px-5 py-20 text-center sm:py-28">
        <h2 className="text-[26px] font-extrabold leading-snug tracking-tight sm:text-[34px]">
          지금 바로 시작해 보세요
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[#5f6b7d]">
          관심 있는 언론사를 고르면 나만의 피드가 만들어져요.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <button
            onClick={onStart}
            className="w-full rounded-full px-8 py-4 text-[16px] font-extrabold text-white shadow-lg shadow-[#5b54f0]/25 transition-transform active:scale-95 sm:w-auto"
            style={{ background: BRAND }}
          >
            무료로 시작하기
          </button>
          <button
            onClick={onExplore}
            className="w-full rounded-full border border-[#e2e7ef] bg-white px-8 py-4 text-[16px] font-bold text-[#111725] transition-colors hover:bg-[#f8fafc] sm:w-auto"
          >
            앱 둘러보기 →
          </button>
        </div>
      </section>

      <footer className="border-t border-[#eef1f6] px-5 py-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12.5px] text-[#8b96ad]">
          <a href="/about" className="hover:text-[#111725]">서비스 소개</a>
          <a href="/pricing" className="hover:text-[#111725]">요금제</a>
          <a href="/privacy" className="hover:text-[#111725]">개인정보처리방침</a>
          <a href="/terms" className="hover:text-[#111725]">이용약관</a>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-[#a3adbd]">
          뉴스·시세 정보와 AI 분석을 제공하며, 투자 권유가 아닙니다.
          <br />© {new Date().getFullYear()} Newsync
        </p>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { SOURCES } from "@/lib/sources";
import SourceAvatar from "@/components/SourceAvatar";
import { LogoMark } from "@/components/Logo";

/**
 * 랜딩 히어로의 '만져지는' 데모.
 * 진짜 앱을 축소해 넣는 대신, 앱의 핵심 흐름(소스 고르기 → 뉴스 → AI 요약)만
 * 3단계로 재현한다. 방문자가 직접 눌러봐야 어떤 앱인지 이해가 빠르다.
 *
 * ⚠️ 여기 뉴스·요약 문구는 데모용 예시다. 실제 기사가 아니므로
 *    "예시" 라벨을 화면에 반드시 남겨 둘 것(진짜 기사로 오해하면 안 됨).
 */
const KR = SOURCES.filter((s) => !s.hidden && s.region === "kr");
const GL = SOURCES.filter((s) => !s.hidden && s.region === "global");
const PICKABLE = [...KR.slice(0, 4), ...GL.slice(0, 2)];

const ARTICLES = [
  {
    src: KR[0],
    title: "코스피, 외국인 순매수 전환에 반등 시도",
    ago: "3분 전",
    summary: [
      "외국인이 코스피에서 5,161억원을 순매수하며 매도세가 멈췄습니다.",
      "매수는 SK하이닉스·삼성전자 두 종목에 집중됐습니다.",
      "이번 주 후반 빅테크 실적 발표를 앞두고 관망세가 이어지고 있습니다.",
    ],
  },
  {
    src: KR[1],
    title: "SK하이닉스, HBM4 양산 일정 앞당긴다",
    ago: "12분 전",
    summary: [
      "HBM4 양산 시점을 기존 계획보다 1개 분기 앞당기기로 했습니다.",
      "주요 고객사와의 공급 협의가 마무리 단계인 것으로 전해졌습니다.",
    ],
  },
];

type Step = 0 | 1 | 2;

export default function LandingDemo() {
  const [step, setStep] = useState<Step>(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [done, setDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 언마운트 시 진행 중인 타이머 정리 (요약 연출 도중 이탈해도 setState 안 나게)
  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (next.length >= 3) {
        timers.current.push(setTimeout(() => setStep(1), 350));
      }
      return next;
    });
  };

  const openArticle = (i: number) => {
    setOpenIdx(i);
    setStep(2);
  };

  const runSummary = () => {
    if (summarizing || done) return;
    setSummarizing(true);
    timers.current.push(
      setTimeout(() => {
        setSummarizing(false);
        setDone(true);
      }, 1100),
    );
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStep(0);
    setPicked([]);
    setOpenIdx(null);
    setSummarizing(false);
    setDone(false);
  };

  const hint =
    step === 0
      ? "관심 있는 언론사를 3개 눌러보세요"
      : step === 1
        ? "기사를 하나 눌러보세요"
        : done
          ? "이렇게 핵심만 정리해 드려요"
          : "‘AI 요약’을 눌러보세요";

  return (
    <div className="mx-auto w-full max-w-[380px]">
      {/* 안내 문구 */}
      <div className="mb-3 flex items-center justify-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5b54f0] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5b54f0]" />
        </span>
        <p className="text-[13.5px] font-bold text-[#5b54f0]">{hint}</p>
      </div>

      <div className="overflow-hidden rounded-[28px] border border-[#e8ecf3] bg-[#0a0e17] p-3 shadow-2xl shadow-[#0a0e17]/20">
        <div className="overflow-hidden rounded-[20px] bg-[#0a0e17]">
          {/* 앱 헤더 */}
          <div className="flex items-center gap-2 border-b border-[#232c42] px-3.5 py-3">
            {step === 2 ? (
              <button
                onClick={() => {
                  setOpenIdx(null);
                  setStep(1);
                  setSummarizing(false);
                  setDone(false);
                }}
                className="text-[#8b96ad]"
                aria-label="뒤로"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            ) : (
              <LogoMark size={22} />
            )}
            <span className="text-[13.5px] font-extrabold text-white">
              {step === 2 ? "기사" : (<>New<span className="text-[#2f81f7]">sync</span></>)}
            </span>
            <span className="ml-auto rounded-full bg-[#161d2e] px-2 py-1 text-[10px] font-bold text-[#8b96ad]">
              크레딧 1,000
            </span>
          </div>

          {/* 1단계 — 소스 고르기 */}
          {step === 0 && (
            <div className="p-3.5">
              <p className="text-[12px] leading-relaxed text-[#8b96ad]">
                보고 싶은 언론사를 고르면
                <br />그 기사만 모아서 보여드려요.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {PICKABLE.map((s) => {
                  const on = picked.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => togglePick(s.id)}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left transition-colors ${
                        on
                          ? "border-[#2f81f7] bg-[#2f81f7]/12"
                          : "border-[#232c42] bg-[#121826]"
                      }`}
                    >
                      <SourceAvatar source={s} size={26} />
                      <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-[#f2f5fa]">
                        {s.name}
                      </span>
                      {on && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f81f7" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-[11px] font-bold text-[#8b96ad]">
                {picked.length}/3 선택
              </p>
            </div>
          )}

          {/* 2단계 — 피드 */}
          {step === 1 && (
            <div>
              <div className="flex gap-2 border-b border-[#232c42] px-3.5 py-2.5">
                {PICKABLE.filter((s) => picked.includes(s.id)).map((s) => (
                  <SourceAvatar key={s.id} source={s} size={30} />
                ))}
              </div>
              <div className="space-y-px bg-[#232c42]">
                {ARTICLES.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => openArticle(i)}
                    className="block w-full bg-[#0a0e17] px-3.5 py-3 text-left transition-colors hover:bg-[#121826]"
                  >
                    <div className="flex items-center gap-1.5">
                      <SourceAvatar source={a.src} size={15} />
                      <span className="text-[10.5px] font-semibold text-[#f2f5fa]">
                        {a.src.name}
                      </span>
                      <span className="text-[10px] text-[#8b96ad]">· {a.ago}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] font-bold leading-snug text-[#f2f5fa]">
                      {a.title}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#2f81f7]/15 px-2 py-0.5 text-[9.5px] font-bold text-[#2f81f7]">
                      ✦ AI 요약
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3단계 — 기사 + AI 요약 */}
          {step === 2 && openIdx !== null && (
            <div className="p-3.5">
              <div className="flex items-center gap-1.5">
                <SourceAvatar source={ARTICLES[openIdx].src} size={15} />
                <span className="text-[10.5px] font-semibold text-[#f2f5fa]">
                  {ARTICLES[openIdx].src.name}
                </span>
                <span className="text-[10px] text-[#8b96ad]">
                  · {ARTICLES[openIdx].ago}
                </span>
              </div>
              <h4 className="mt-2 text-[14px] font-extrabold leading-snug text-[#f2f5fa]">
                {ARTICLES[openIdx].title}
              </h4>

              {!done && (
                <button
                  onClick={runSummary}
                  disabled={summarizing}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-70"
                  style={{ background: "linear-gradient(135deg,#5b54f0,#18b6e6)" }}
                >
                  {summarizing ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      </svg>
                      읽는 중…
                    </>
                  ) : (
                    <>✦ AI 요약</>
                  )}
                </button>
              )}

              {done && (
                <div className="mt-3 rounded-xl border border-[#2f81f7]/25 bg-[#2f81f7]/8 p-3">
                  <p className="text-[10.5px] font-bold text-[#2f81f7]">AI 요약</p>
                  <ul className="mt-2 space-y-2">
                    {ARTICLES[openIdx].summary.map((s, i) => (
                      <li
                        key={i}
                        className="flex gap-1.5 text-[11.5px] leading-relaxed text-[#f2f5fa]"
                        style={{
                          animation: `demoIn .34s ease-out ${i * 0.11}s both`,
                        }}
                      >
                        <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#2f81f7]" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-3 text-[9.5px] leading-relaxed text-[#5f6b7d]">
                ※ 화면은 예시예요. 실제로는 그때그때의 진짜 기사를 요약해 드려요.
              </p>
            </div>
          )}
        </div>
      </div>

      {done && (
        <button
          onClick={reset}
          className="mx-auto mt-3 block text-[12.5px] font-bold text-[#8b96ad] underline underline-offset-2 hover:text-[#5f6b7d]"
        >
          처음부터 다시 해보기
        </button>
      )}

      <style>{`
        @keyframes demoIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="demoIn"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

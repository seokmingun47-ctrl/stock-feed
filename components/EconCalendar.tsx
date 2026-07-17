"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRY_KO } from "@/lib/econ";

interface EconEvent {
  id: string;
  date: string;
  country: string;
  title: string;
  titleEn: string;
  impact: number;
  forecast: string;
  previous: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const IMPACT_COLOR: Record<number, string> = {
  3: "#f6465d",
  2: "#f7b500",
  1: "#8b96ad",
  0: "#8b96ad",
};

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function Stars({ impact }: { impact: number }) {
  if (impact <= 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-[1px]" aria-label={`중요도 ${impact}`}>
      {[1, 2, 3].map((i) => (
        <svg
          key={i}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill={i <= impact ? "#f7b500" : "var(--border)"}
        >
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 18l-6.2 3.3L7 14.2l-5-4.9 6.9-1z" />
        </svg>
      ))}
    </span>
  );
}

export default function EconCalendar({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<EconEvent[] | null>(null);
  const [cursor, setCursor] = useState(() => new Date()); // 보고 있는 달
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [minImpact, setMinImpact] = useState(0); // 0=전체

  useEffect(() => {
    fetch("/api/econ-calendar", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // 중요도 필터 적용 후 날짜별 그룹
  const byDay = useMemo(() => {
    const m = new Map<string, EconEvent[]>();
    for (const e of events ?? []) {
      if (minImpact && e.impact < minImpact) continue;
      const k = dayKey(new Date(e.date));
      const arr = m.get(k);
      if (arr) arr.push(e);
      else m.set(k, [e]);
    }
    for (const arr of m.values())
      arr.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return m;
  }, [events, minImpact]);

  // 달력 격자 (앞뒤 달 채우기)
  const cells = useMemo(() => {
    const y = cursor.getFullYear();
    const mo = cursor.getMonth();
    const first = new Date(y, mo, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // 그 주 일요일부터
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const todayKey = dayKey(new Date());
  const dayEvents = byDay.get(selected) ?? [];
  const selDate = new Date(`${selected}T00:00:00`);
  const moveMonth = (n: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(dayKey(now));
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        {/* 헤더 */}
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button onClick={onClose} aria-label="닫기" className="grid h-9 w-9 place-items-center rounded-full text-text hover:bg-bg-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="flex-1 text-[16px] font-extrabold text-text">경제 캘린더</h1>
          <button onClick={goToday} className="rounded-full border border-border px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text">
            오늘
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* 월 이동 */}
          <div className="flex items-center justify-center gap-4 px-4 py-3">
            <button onClick={() => moveMonth(-1)} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-bg-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-[15.5px] font-extrabold text-text">
              {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
            </span>
            <button onClick={() => moveMonth(1)} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-bg-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          {/* 중요도 필터 */}
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
            {([[0, "전체"], [3, "★★★"], [2, "★★☆"], [1, "★☆☆"]] as [number, string][]).map(
              ([v, label]) => (
                <button
                  key={v}
                  onClick={() => setMinImpact(v)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                    minImpact === v ? "bg-accent text-white" : "bg-bg-soft text-muted"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {/* 요일 */}
          <div className="grid grid-cols-7 border-b border-border px-1 pb-1.5">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`text-center text-[11.5px] font-bold ${
                  i === 0 ? "text-[#f6465d]" : i === 6 ? "text-[#4b91f7]" : "text-muted"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 날짜 격자 */}
          <div className="grid grid-cols-7 px-1 pt-1">
            {cells.map((d) => {
              const k = dayKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const evts = byDay.get(k) ?? [];
              const isSel = k === selected;
              const isToday = k === todayKey;
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  className="flex h-[52px] flex-col items-center justify-start gap-1 rounded-lg pt-1.5 transition-colors hover:bg-bg-soft"
                >
                  <span
                    className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[12.5px] font-bold ${
                      isSel
                        ? "bg-accent text-white"
                        : isToday
                          ? "text-accent"
                          : inMonth
                            ? "text-text"
                            : "text-muted/40"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="flex h-[6px] items-center gap-[2px]">
                    {evts.slice(0, 5).map((e) => (
                      <span
                        key={e.id}
                        className="h-[3px] w-[3px] rounded-full"
                        style={{ backgroundColor: IMPACT_COLOR[e.impact] }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="px-4 py-3 text-center text-[11px] text-muted">
            시간 기준: 사용자 현지 시간 · 이번 주 일정이 제공돼요
          </p>

          {/* 선택한 날짜 일정 */}
          <div className="border-t border-border">
            <div className="bg-bg-soft px-4 py-2 text-[12.5px] font-bold text-text">
              {selDate.getMonth() + 1}월 {selDate.getDate()}일{" "}
              {WEEKDAYS[selDate.getDay()]}요일
            </div>

            {events === null ? (
              <div className="py-12 text-center text-[13px] text-muted">불러오는 중…</div>
            ) : dayEvents.length === 0 ? (
              <div className="px-8 py-14 text-center">
                <p className="text-[14px] font-bold text-text">이 날은 일정이 없어요</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  이번 주 날짜를 선택해 보세요.
                </p>
              </div>
            ) : (
              dayEvents.map((e) => (
                <div key={e.id} className="flex gap-3 border-b border-border px-4 py-3">
                  <span className="w-[42px] shrink-0 pt-0.5 text-[12.5px] font-bold text-muted">
                    {new Date(e.date).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Stars impact={e.impact} />
                      {e.country && (
                        <span className="rounded bg-bg-soft px-1.5 py-0.5 text-[10px] font-bold text-muted">
                          {COUNTRY_KO[e.country] || e.country}
                        </span>
                      )}
                    </div>
                    <div className="text-[14px] font-bold leading-snug text-text">
                      {e.title}
                    </div>
                    {(e.forecast || e.previous) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted">
                        {e.forecast && (
                          <span>
                            예상 <b className="text-accent">{e.forecast}</b>
                          </span>
                        )}
                        {e.previous && (
                          <span>
                            이전 <b className="text-text/70">{e.previous}</b>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

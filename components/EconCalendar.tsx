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
  actual: string;
}
interface Explain {
  what: string;
  why: string;
  howToRead: string;
  market: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const IMPACT_COLOR: Record<number, string> = {
  3: "#f6465d",
  2: "#f7b500",
  1: "#8b96ad",
  0: "#8b96ad",
};

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function Stars({ impact }: { impact: number }) {
  if (impact <= 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-[1px]">
      {[1, 2, 3].map((i) => (
        <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={i <= impact ? "#f7b500" : "var(--border)"}>
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 18l-6.2 3.3L7 14.2l-5-4.9 6.9-1z" />
        </svg>
      ))}
    </span>
  );
}

function Nums({ e }: { e: EconEvent }) {
  if (!e.actual && !e.forecast && !e.previous) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-muted">
      {e.actual && (
        <span>
          실제 <b className="text-accent">{e.actual}</b>
        </span>
      )}
      {e.forecast && (
        <span>
          예상 <b className={e.actual ? "text-text/70" : "text-accent"}>{e.forecast}</b>
        </span>
      )}
      {e.previous && (
        <span>
          이전 <b className="text-text/70">{e.previous}</b>
        </span>
      )}
    </div>
  );
}

export default function EconCalendar({
  isGuest = false,
  onRequireLogin,
  refreshCredits,
  onClose,
}: {
  isGuest?: boolean;
  onRequireLogin?: () => void;
  refreshCredits?: () => void;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<EconEvent[] | null>(null);
  const [source, setSource] = useState<"fmp" | "ff">("ff");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dayKey(new Date()));
  const [minImpact, setMinImpact] = useState(0);
  const [open, setOpen] = useState<EconEvent | null>(null);

  // 보고 있는 달 범위
  const y = cursor.getFullYear();
  const mo = cursor.getMonth();
  const from = `${y}-${pad(mo + 1)}-01`;
  const to = `${y}-${pad(mo + 1)}-${pad(new Date(y, mo + 1, 0).getDate())}`;

  useEffect(() => {
    let alive = true;
    setEvents(null);
    fetch(`/api/econ-calendar?from=${from}&to=${to}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setEvents(d.events ?? []);
        setSource(d.source === "fmp" ? "fmp" : "ff");
      })
      .catch(() => alive && setEvents([]));
    return () => {
      alive = false;
    };
  }, [from, to]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (open ? setOpen(null) : onClose());
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, open]);

  const byDay = useMemo(() => {
    const m = new Map<string, EconEvent[]>();
    for (const e of events ?? []) {
      if (minImpact && e.impact < minImpact) continue;
      const k = dayKey(new Date(e.date));
      const arr = m.get(k);
      if (arr) arr.push(e);
      else m.set(k, [e]);
    }
    for (const arr of m.values()) arr.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return m;
  }, [events, minImpact]);

  const cells = useMemo(() => {
    const first = new Date(y, mo, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [y, mo]);

  const todayKey = dayKey(new Date());
  const dayEvents = byDay.get(selected) ?? [];
  const selDate = new Date(`${selected}T00:00:00`);
  const moveMonth = (n: number) => setCursor(new Date(y, mo + n, 1));
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(dayKey(now));
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
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
          <div className="flex items-center justify-center gap-4 px-4 py-3">
            <button onClick={() => moveMonth(-1)} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-bg-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-[15.5px] font-extrabold text-text">
              {y}년 {mo + 1}월
            </span>
            <button onClick={() => moveMonth(1)} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-bg-soft">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
            {([[0, "전체"], [3, "★★★"], [2, "★★☆"], [1, "★☆☆"]] as [number, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setMinImpact(v)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                  minImpact === v ? "bg-accent text-white" : "bg-bg-soft text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-7 border-b border-border px-1 pb-1.5">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`text-center text-[11.5px] font-bold ${i === 0 ? "text-[#f6465d]" : i === 6 ? "text-[#4b91f7]" : "text-muted"}`}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 px-1 pt-1">
            {cells.map((d) => {
              const k = dayKey(d);
              const inMonth = d.getMonth() === mo;
              const evts = byDay.get(k) ?? [];
              const isSel = k === selected;
              const isToday = k === todayKey;
              return (
                <button key={k} onClick={() => setSelected(k)} className="flex h-[52px] flex-col items-center justify-start gap-1 rounded-lg pt-1.5 transition-colors hover:bg-bg-soft">
                  <span
                    className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[12.5px] font-bold ${
                      isSel ? "bg-accent text-white" : isToday ? "text-accent" : inMonth ? "text-text" : "text-muted/40"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className="flex h-[6px] items-center gap-[2px]">
                    {evts.slice(0, 5).map((e) => (
                      <span key={e.id} className="h-[3px] w-[3px] rounded-full" style={{ backgroundColor: IMPACT_COLOR[e.impact] }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="px-4 py-3 text-center text-[11px] text-muted">
            시간 기준: 사용자 현지 시간
            {source === "ff" && " · 이번 주 일정이 제공돼요"}
          </p>

          <div className="border-t border-border">
            <div className="bg-bg-soft px-4 py-2 text-[12.5px] font-bold text-text">
              {selDate.getMonth() + 1}월 {selDate.getDate()}일 {WEEKDAYS[selDate.getDay()]}요일
            </div>

            {events === null ? (
              <div className="py-12 text-center text-[13px] text-muted">불러오는 중…</div>
            ) : dayEvents.length === 0 ? (
              <div className="px-8 py-14 text-center">
                <p className="text-[14px] font-bold text-text">이 날은 일정이 없어요</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                  {source === "ff" ? "이번 주 날짜를 선택해 보세요." : "다른 날짜를 선택해 보세요."}
                </p>
              </div>
            ) : (
              dayEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setOpen(e)}
                  className="flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-bg-soft"
                >
                  <span className="w-[42px] shrink-0 pt-0.5 text-[12.5px] font-bold text-muted">
                    {new Date(e.date).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}
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
                    <div className="text-[14px] font-bold leading-snug text-text">{e.title}</div>
                    <Nums e={e} />
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-1 shrink-0 text-muted">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {open && (
        <ExplainSheet
          event={open}
          isGuest={isGuest}
          onRequireLogin={onRequireLogin}
          refreshCredits={refreshCredits}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

// 일정 상세 + AI 설명
function ExplainSheet({
  event,
  isGuest = false,
  onRequireLogin,
  refreshCredits,
  onClose,
}: {
  event: EconEvent;
  isGuest?: boolean;
  onRequireLogin?: () => void;
  refreshCredits?: () => void;
  onClose: () => void;
}) {
  const [explain, setExplain] = useState<Explain | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const run = async () => {
    if (isGuest) return onRequireLogin?.(); // AI는 로그인 필요
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const d = await fetch("/api/econ-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          titleEn: event.titleEn,
          country: event.country,
          forecast: event.forecast,
          previous: event.previous,
          actual: event.actual,
        }),
      }).then((r) => r.json());
      if (d.ok) setExplain(d.explain);
      else setErr(d.reason || "설명을 가져오지 못했어요.");
      // 성공이든 크레딧 부족이든 잔액이 바뀌었을 수 있으니 헤더 표시 갱신
      refreshCredits?.();
    } catch {
      setErr("네트워크 오류가 생겼어요.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="sheet-up max-h-[85vh] w-full max-w-[600px] overflow-y-auto rounded-t-2xl border-t border-border bg-bg p-5"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="flex items-center gap-1.5">
          <Stars impact={event.impact} />
          {event.country && (
            <span className="rounded bg-bg-soft px-1.5 py-0.5 text-[10px] font-bold text-muted">
              {COUNTRY_KO[event.country] || event.country}
            </span>
          )}
          <span className="text-[11.5px] text-muted">
            {new Date(event.date).toLocaleString("ko-KR", {
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </span>
        </div>
        <h2 className="mt-1.5 text-[18px] font-extrabold leading-snug text-text">{event.title}</h2>
        {event.titleEn !== event.title && (
          <p className="mt-0.5 text-[12px] text-muted">{event.titleEn}</p>
        )}
        <Nums e={event} />

        {!explain && (
          <button
            onClick={run}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent/15 px-4 py-3 text-[14px] font-bold text-accent transition-colors hover:bg-accent/25 disabled:opacity-70"
          >
            {busy ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
              </svg>
            )}
            {busy ? "AI가 설명을 만드는 중…" : "AI 설명 · 이게 무슨 지표예요?"}
          </button>
        )}
        {err && (
          <p className="mt-3 text-center text-[13px] text-[#f6465d]">
            {err}{" "}
            <button onClick={run} className="font-semibold underline">
              다시 시도
            </button>
          </p>
        )}

        {explain && (
          <div className="mt-4 space-y-3">
            {([
              ["이게 뭐예요?", explain.what],
              ["왜 중요해요?", explain.why],
              ["숫자 읽는 법", explain.howToRead],
              ["시장에 미치는 영향", explain.market],
            ] as [string, string][])
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <div key={k} className="rounded-xl border border-border bg-bg-soft/60 p-3.5">
                  <div className="mb-1 text-[12.5px] font-bold text-accent">{k}</div>
                  <p className="text-[14px] leading-relaxed text-text">{v}</p>
                </div>
              ))}
            <p className="text-[11px] leading-relaxed text-muted">
              AI가 생성한 설명이라 실제와 다를 수 있어요. 투자 권유가 아니며 판단·책임은 본인에게 있어요.
            </p>
          </div>
        )}

        <button onClick={onClose} className="mt-4 w-full rounded-xl border border-border py-3 text-[14px] font-bold text-muted">
          닫기
        </button>
      </div>
    </div>
  );
}

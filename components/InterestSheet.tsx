"use client";

import { useEffect, useRef, useState } from "react";
import { type Interest, makeInterest } from "@/lib/interests";

const SUGGESTED = [
  "금리",
  "실적",
  "배당",
  "환율",
  "반도체",
  "2차전지",
  "AI",
  "M&A",
  "공매도",
  "유상증자",
];

interface Hit {
  name: string;
  code: string;
  market: string;
}

export default function InterestSheet({
  interests,
  onChange,
  onClose,
}: {
  interests: Interest[];
  onChange: (next: Interest[]) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [kw, setKw] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 종목 검색 (디바운스)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 1) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const d = await fetch(`/api/stock-search?q=${encodeURIComponent(query)}`).then(
          (r) => r.json(),
        );
        setHits(d.ok ? d.hits : []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const has = (id: string) => interests.some((i) => i.id === id);

  const add = (it: Interest | null) => {
    if (!it || has(it.id)) return;
    onChange([...interests, it]);
  };
  const remove = (id: string) => onChange(interests.filter((i) => i.id !== id));

  const addStock = (h: Hit) => {
    add(makeInterest(h.name, "ticker", [h.code]));
    setQ("");
    setHits([]);
  };
  const addKeyword = (word: string) => {
    add(makeInterest(word, "keyword"));
    setKw("");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <button aria-label="닫기" onClick={onClose} className="flex-1" />
      <div className="sheet-up max-h-[86vh] overflow-y-auto rounded-t-2xl border-t border-border bg-bg pb-6">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-4 py-3.5">
          <div>
            <h2 className="text-[17px] font-bold text-text">관심 뉴스 설정</h2>
            <p className="text-[12px] text-muted">
              종목·키워드를 추가하면 관련 뉴스만 모아봐요
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-bg-soft px-4 py-1.5 text-[14px] font-semibold text-text"
          >
            완료
          </button>
        </div>

        {/* 내 관심 목록 */}
        {interests.length > 0 && (
          <div className="border-b border-border px-4 py-3">
            <div className="mb-2 text-[12px] font-bold text-muted">
              내 관심 {interests.length}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {interests.map((it) => (
                <span
                  key={it.id}
                  className="flex items-center gap-1 rounded-full bg-bg-soft px-2.5 py-1 text-[13px] font-semibold text-text"
                >
                  {it.kind === "ticker" ? "📈" : "#"}
                  {it.label}
                  <button
                    onClick={() => remove(it.id)}
                    aria-label="삭제"
                    className="grid h-4 w-4 place-items-center rounded-full text-muted hover:text-[#f6465d]"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 종목 추가 */}
        <div className="px-4 pt-4">
          <div className="mb-2 text-[13px] font-bold text-text">종목 추가</div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-bg-soft px-3.5 py-2">
            <SearchIcon />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="예: 삼성전자, 엔비디아, TSLA"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-text outline-none placeholder:text-muted"
            />
            {searching && <Spinner />}
          </div>
          {hits.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              {hits.map((h) => {
                const it = makeInterest(h.name, "ticker", [h.code]);
                const added = it ? has(it.id) : false;
                return (
                  <button
                    key={h.code + h.name}
                    onClick={() => addStock(h)}
                    disabled={added}
                    className="flex w-full items-center gap-2 border-b border-border px-3.5 py-2.5 text-left last:border-0 hover:bg-bg-soft disabled:opacity-50"
                  >
                    <span className="text-[15px]">📈</span>
                    <span className="flex-1 text-[15px] font-semibold text-text">
                      {h.name}
                    </span>
                    <span className="text-[12px] text-muted">
                      {h.code} {h.market && `· ${h.market}`}
                    </span>
                    <span className="text-[13px] font-bold text-accent">
                      {added ? "추가됨" : "+ 추가"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 키워드 추가 */}
        <div className="px-4 pt-5">
          <div className="mb-2 text-[13px] font-bold text-text">키워드 추가</div>
          <div className="flex items-center gap-2">
            <input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword(kw)}
              maxLength={30}
              placeholder="예: 금리, 배당, 반도체"
              className="min-w-0 flex-1 rounded-full border border-border bg-bg-soft px-3.5 py-2 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              onClick={() => addKeyword(kw)}
              disabled={!kw.trim()}
              className="shrink-0 rounded-full bg-accent px-4 py-2 text-[14px] font-bold text-white disabled:opacity-40"
            >
              추가
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {SUGGESTED.map((s) => {
              const it = makeInterest(s, "keyword");
              const added = it ? has(it.id) : false;
              return (
                <button
                  key={s}
                  onClick={() => addKeyword(s)}
                  disabled={added}
                  className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors ${
                    added
                      ? "border-border bg-bg-soft text-muted opacity-50"
                      : "border-border text-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  #{s}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round" className="spin">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    </svg>
  );
}

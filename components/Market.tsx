"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/community";
import StockDetail, { type QuotedStock } from "./StockDetail";

const UP = "#f6465d";
const DOWN = "#4b91f7";

type Region = "kr" | "us";

function fmtPrice(price: string, currency: string): string {
  if (currency === "KRW") return `${price}원`;
  if (currency === "USD") return `$${price}`;
  return price;
}

export default function Market({
  user,
  translate,
}: {
  user: User;
  translate: boolean;
}) {
  const [region, setRegion] = useState<Region>("kr");
  const [stocks, setStocks] = useState<QuotedStock[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<QuotedStock | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuotedStock[] | null>(null);
  const searching = query.trim().length > 0;

  const load = useCallback(async (r: Region) => {
    setErr(false);
    try {
      const d = await fetch(`/api/market-quotes?region=${r}`, {
        cache: "no-store",
      }).then((res) => res.json());
      if (d.ok) setStocks(d.stocks);
      else setErr(true);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => {
    setStocks(null);
    load(region);
    const t = setInterval(() => load(region), 30000);
    return () => clearInterval(t);
  }, [region, load]);

  // AI 크레딧 잔액 (마운트 + 상세 열고닫을 때 갱신 → 분석 후 차감 반영)
  useEffect(() => {
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCredits(d.credits ?? null))
      .catch(() => {});
  }, [open]);

  // 종목 검색 (네이버 자동완성, 디바운스)
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    let alive = true;
    setResults(null);
    const t = setTimeout(async () => {
      try {
        const d = await fetch(`/api/market-search?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        }).then((r) => r.json());
        if (alive) setResults(d.ok ? d.stocks : []);
      } catch {
        if (alive) setResults([]);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-[19px] font-extrabold tracking-tight text-text">시장</h1>
          {credits !== null && (
            <a
              href="/pricing"
              title="AI 크레딧 · 요금제"
              className="flex h-8 items-center gap-1 rounded-full bg-bg-soft px-2.5 text-[12.5px] font-black text-accent hover:bg-card"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
              {credits.toLocaleString()}
            </a>
          )}
        </div>
        <p className="mb-2.5 text-[12px] text-muted">
          국내·해외 종목 시세 · 탭하면 AI 분석
        </p>

        {/* 종목 검색 */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-bg-soft px-3.5 py-2">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="종목 검색 (예: 카카오, 애플, 팔란티어)"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-text outline-none placeholder:text-muted"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="검색어 지우기"
              className="shrink-0 text-muted hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 국내/해외 세그먼트 — 검색 중엔 숨김 */}
        {!searching && (
          <div className="mt-2.5 flex gap-1 rounded-full bg-bg-soft p-1">
            {(
              [
                ["kr", "국내"],
                ["us", "해외"],
              ] as const
            ).map(([r, label]) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`flex-1 rounded-full py-2 text-[14px] font-bold transition-colors ${
                  region === r ? "bg-accent text-white" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-[11px] font-semibold text-muted">
          <span className="w-6">{searching ? "" : "#"}</span>
          <span className="flex-1">종목</span>
          <span className="text-right">현재가 · 등락</span>
        </div>

        {searching ? (
          results === null ? (
            <SkeletonRows />
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
              <p className="text-[15px] font-bold text-text">검색 결과가 없어요</p>
              <p className="mt-1.5 text-[13px] text-muted">
                종목명이나 티커로 다시 검색해보세요.
              </p>
            </div>
          ) : (
            results.map((s) => (
              <Row key={s.symbol} stock={s} onOpen={() => setOpen(s)} />
            ))
          )
        ) : stocks === null ? (
          <SkeletonRows />
        ) : err ? (
          <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
            <p className="text-[15px] font-bold text-text">시세를 불러오지 못했어요</p>
            <button
              onClick={() => load(region)}
              className="mt-4 rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white"
            >
              다시 시도
            </button>
          </div>
        ) : (
          stocks.map((s, i) => (
            <Row key={s.symbol} rank={i + 1} stock={s} onOpen={() => setOpen(s)} />
          ))
        )}
      </main>

      {open && (
        <StockDetail
          stock={open}
          translate={translate}
          user={user}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function Row({
  rank,
  stock,
  onOpen,
}: {
  rank?: number;
  stock: QuotedStock;
  onOpen: () => void;
}) {
  const up = (stock.changeRate ?? 0) > 0;
  const down = (stock.changeRate ?? 0) < 0;
  const color = up ? UP : down ? DOWN : "var(--muted)";
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-bg-soft active:bg-bg-soft"
    >
      <span className="w-6 text-[13px] font-bold text-muted">{rank ?? ""}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-text">{stock.name}</div>
        <div className="text-[11px] text-muted">
          {stock.ticker} · {stock.market}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-bold text-text">
          {stock.price ? fmtPrice(stock.price, stock.currency) : "—"}
        </div>
        {stock.changeRate != null && (
          <div className="text-[12px] font-bold" style={{ color }}>
            {up ? "▲" : down ? "▼" : ""}
            {stock.changeRate > 0 ? "+" : ""}
            {stock.changeRate.toFixed(2)}%
          </div>
        )}
      </div>
    </button>
  );
}

function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <div className="h-3 w-4 rounded bg-bg-soft" />
          <div className="flex-1">
            <div className="mb-2 h-4 w-28 rounded bg-bg-soft" />
            <div className="h-2.5 w-20 rounded bg-bg-soft" />
          </div>
          <div className="h-4 w-16 rounded bg-bg-soft" />
        </div>
      ))}
    </div>
  );
}

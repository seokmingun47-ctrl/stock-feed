"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/community";
import StockDetail, { type QuotedStock } from "./StockDetail";

const UP = "#f6465d";
const DOWN = "#4b91f7";

type Region = "kr" | "us";
type View = "quote" | "watch" | "movers" | "value";

interface WatchItem {
  name: string;
  ticker: string;
  symbol: string;
  market: string;
  domestic: boolean;
}
interface ValRow extends QuotedStock {
  per: number | null;
  pbr: number | null;
}

const VIEWS: [View, string][] = [
  ["quote", "시세"],
  ["watch", "관심"],
  ["movers", "급등락"],
  ["value", "저평가·고평가"],
];

function fmtPrice(price: string, currency: string): string {
  if (currency === "KRW") return `${price}원`;
  if (currency === "USD") return `$${price}`;
  return price;
}
function loadWatch(u: string): WatchItem[] {
  try {
    return JSON.parse(localStorage.getItem(`stockfeed:watchstocks:${u}`) || "[]");
  } catch {
    return [];
  }
}

export default function Market({
  user,
  translate,
}: {
  user: User;
  translate: boolean;
}) {
  const [view, setView] = useState<View>("quote");
  const [region, setRegion] = useState<Region>("kr");
  const [stocks, setStocks] = useState<QuotedStock[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<QuotedStock | null>(null);
  const [openMode, setOpenMode] = useState<"under" | "over" | undefined>(undefined);
  const [credits, setCredits] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(!!user.isPro);

  const openStock = (s: QuotedStock, mode?: "under" | "over") => {
    setOpenMode(mode);
    setOpen(s);
  };

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuotedStock[] | null>(null);

  const [movers, setMovers] = useState<{
    gainers: QuotedStock[];
    losers: QuotedStock[];
  } | null>(null);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [watchStocks, setWatchStocks] = useState<QuotedStock[] | null>(null);
  const [valuation, setValuation] = useState<{
    undervalued: ValRow[];
    overvalued: ValRow[];
  } | null>(null);

  const searching = query.trim().length > 0;

  useEffect(() => {
    setWatch(loadWatch(user.username));
  }, [user.username]);

  const isStarred = (symbol: string) => watch.some((w) => w.symbol === symbol);
  const toggleStar = (s: QuotedStock) => {
    setWatch((cur) => {
      const exists = cur.some((w) => w.symbol === s.symbol);
      const next = exists
        ? cur.filter((w) => w.symbol !== s.symbol)
        : [
            ...cur,
            {
              name: s.name,
              ticker: s.ticker,
              symbol: s.symbol,
              market: s.market,
              domestic: s.domestic,
            },
          ];
      try {
        localStorage.setItem(
          `stockfeed:watchstocks:${user.username}`,
          JSON.stringify(next),
        );
      } catch {
        /* noop */
      }
      return next;
    });
  };

  // 시세/급등락용 목록
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
    if (view !== "quote") return;
    setStocks(null);
    load(region);
    const t = setInterval(() => load(region), 30000);
    return () => clearInterval(t);
  }, [region, view, load]);

  // 급등/급락 (실제 순위)
  useEffect(() => {
    if (view !== "movers") return;
    setMovers(null);
    const go = () =>
      fetch(`/api/market-movers?region=${region}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) =>
          setMovers(d.ok ? { gainers: d.gainers, losers: d.losers } : { gainers: [], losers: [] }),
        )
        .catch(() => setMovers({ gainers: [], losers: [] }));
    go();
    const t = setInterval(go, 30000);
    return () => clearInterval(t);
  }, [region, view]);

  // 저평가/고평가 (프로 전용 — 비프로는 조회하지 않음)
  useEffect(() => {
    if (view !== "value") return;
    if (!isPro) {
      setValuation(null);
      return;
    }
    setValuation(null);
    fetch(`/api/market-valuation?region=${region}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setValuation(d.ok ? d : { undervalued: [], overvalued: [] }))
      .catch(() => setValuation({ undervalued: [], overvalued: [] }));
  }, [region, view, isPro]);

  // 관심종목 시세
  useEffect(() => {
    if (view !== "watch") return;
    if (!watch.length) {
      setWatchStocks([]);
      return;
    }
    setWatchStocks(null);
    fetch("/api/watch-quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: watch }),
    })
      .then((r) => r.json())
      .then((d) => setWatchStocks(d.ok ? d.stocks : []))
      .catch(() => setWatchStocks([]));
  }, [view, watch]);

  // 크레딧 + 프로 여부
  useEffect(() => {
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setCredits(d.credits ?? null);
        setIsPro(!!d.isPro);
      })
      .catch(() => {});
  }, [open]);

  // 검색
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

  const showRegion = !searching && view !== "watch";

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-[19px] font-extrabold tracking-tight text-text">시장</h1>
          {credits !== null && (
            <a
              href="/pricing"
              className="flex h-8 items-center gap-1 rounded-full bg-bg-soft px-2.5 text-[12.5px] font-black text-accent hover:bg-card"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
              </svg>
              {credits.toLocaleString()}
            </a>
          )}
        </div>

        <div className="mb-2.5 mt-2 flex items-center gap-2 rounded-full border border-border bg-bg-soft px-3.5 py-2">
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
            <button onClick={() => setQuery("")} aria-label="지우기" className="shrink-0 text-muted hover:text-text">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {!searching && (
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {VIEWS.map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-bold transition-colors ${
                  view === v ? "bg-accent text-white" : "bg-bg-soft text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {showRegion && (
          <div className="mt-2 flex gap-1 rounded-full bg-bg-soft p-1">
            {(
              [
                ["kr", "국내"],
                ["us", "해외"],
              ] as const
            ).map(([r, label]) => (
              <button
                key={r}
                onClick={() => setRegion(r)}
                className={`flex-1 rounded-full py-1.5 text-[13.5px] font-bold transition-colors ${
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
        {searching ? (
          results === null ? (
            <SkeletonRows />
          ) : results.length === 0 ? (
            <Empty title="검색 결과가 없어요" desc="종목명이나 티커로 다시 검색해보세요." />
          ) : (
            results.map((s) => (
              <Row
                key={s.symbol}
                stock={s}
                starred={isStarred(s.symbol)}
                onStar={() => toggleStar(s)}
                onOpen={() => setOpen(s)}
              />
            ))
          )
        ) : view === "watch" ? (
          watchStocks === null ? (
            <SkeletonRows />
          ) : watchStocks.length === 0 ? (
            <Empty
              title="관심 종목이 없어요"
              desc="종목 옆 별(☆)을 눌러 관심 종목을 추가하세요."
            />
          ) : (
            watchStocks.map((s) => (
              <Row
                key={s.symbol}
                stock={s}
                starred={isStarred(s.symbol)}
                onStar={() => toggleStar(s)}
                onOpen={() => setOpen(s)}
              />
            ))
          )
        ) : view === "movers" ? (
          movers === null ? (
            <SkeletonRows />
          ) : (
            <>
              <SectionHeader>📈 급등 TOP</SectionHeader>
              {movers.gainers.length === 0 ? (
                <p className="px-4 py-4 text-center text-[13px] text-muted">상승 종목이 없어요.</p>
              ) : (
                movers.gainers.map((s) => (
                  <Row key={"u" + s.symbol} stock={s} starred={isStarred(s.symbol)} onStar={() => toggleStar(s)} onOpen={() => setOpen(s)} />
                ))
              )}
              <SectionHeader>📉 급락 TOP</SectionHeader>
              {movers.losers.length === 0 ? (
                <p className="px-4 py-4 text-center text-[13px] text-muted">하락 종목이 없어요.</p>
              ) : (
                movers.losers.map((s) => (
                  <Row key={"d" + s.symbol} stock={s} starred={isStarred(s.symbol)} onStar={() => toggleStar(s)} onOpen={() => setOpen(s)} />
                ))
              )}
            </>
          )
        ) : view === "value" ? (
          !isPro ? (
            <ProLockedValue />
          ) : valuation === null ? (
            <SkeletonRows />
          ) : (
            <>
              <SectionHeader>저평가 · PER 낮은 순</SectionHeader>
              {valuation.undervalued.length === 0 ? (
                <Empty title="데이터를 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />
              ) : (
                valuation.undervalued.map((s) => (
                  <Row key={s.symbol} stock={s} starred={isStarred(s.symbol)} onStar={() => toggleStar(s)} onOpen={() => openStock(s, "under")} per={s.per} pbr={s.pbr} />
                ))
              )}
              <SectionHeader>고평가 · PER 높은 순</SectionHeader>
              {valuation.overvalued.map((s) => (
                <Row key={s.symbol} stock={s} starred={isStarred(s.symbol)} onStar={() => toggleStar(s)} onOpen={() => openStock(s, "over")} per={s.per} pbr={s.pbr} />
              ))}
              <p className="px-4 py-4 text-center text-[11px] text-muted">
                PER·PBR은 참고용 지표예요. 업종·성장성에 따라 적정 밸류는 달라집니다.
              </p>
            </>
          )
        ) : stocks === null ? (
          <SkeletonRows />
        ) : err ? (
          <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
            <p className="text-[15px] font-bold text-text">시세를 불러오지 못했어요</p>
            <button onClick={() => load(region)} className="mt-4 rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white">
              다시 시도
            </button>
          </div>
        ) : (
          stocks.map((s, i) => (
            <Row key={s.symbol} rank={i + 1} stock={s} starred={isStarred(s.symbol)} onStar={() => toggleStar(s)} onOpen={() => setOpen(s)} />
          ))
        )}
      </main>

      {open && (
        <StockDetail
          stock={open}
          translate={translate}
          user={user}
          valuationMode={openMode}
          onClose={() => {
            setOpen(null);
            setOpenMode(undefined);
          }}
        />
      )}
    </div>
  );
}

function Row({
  rank,
  stock,
  starred,
  onStar,
  onOpen,
  per,
  pbr,
}: {
  rank?: number;
  stock: QuotedStock;
  starred: boolean;
  onStar: () => void;
  onOpen: () => void;
  per?: number | null;
  pbr?: number | null;
}) {
  const up = (stock.changeRate ?? 0) > 0;
  const down = (stock.changeRate ?? 0) < 0;
  const color = up ? UP : down ? DOWN : "var(--muted)";
  return (
    <div className="flex w-full items-center gap-2 border-b border-border px-3 py-3 transition-colors hover:bg-bg-soft">
      <button
        onClick={onStar}
        aria-label="관심"
        className="grid h-8 w-8 shrink-0 place-items-center"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={starred ? "#f7b500" : "none"} stroke={starred ? "#f7b500" : "var(--muted)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 18l-6.2 3.3L7 14.2l-5-4.9 6.9-1z" />
        </svg>
      </button>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {rank != null && <span className="w-5 text-[12px] font-bold text-muted">{rank}</span>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold text-text">{stock.name}</div>
          <div className="text-[11px] text-muted">
            {stock.ticker} · {stock.market}
            {per != null && ` · PER ${per}${pbr != null ? ` · PBR ${pbr}` : ""}`}
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
    </div>
  );
}

// 저평가·고평가 프로 잠금 (Investing 스타일 모자이크)
function ProLockedValue() {
  // 뒤에 흐릿하게 깔리는 가짜 미리보기 행들
  const teaser = [
    { badge: "저평가", per: "8.1", chg: "+3.24%", up: true },
    { badge: "저평가", per: "6.4", chg: "+1.87%", up: true },
    { badge: "저평가", per: "9.2", chg: "-0.53%", up: false },
    { badge: "저평가", per: "7.5", chg: "+2.10%", up: true },
    { badge: "고평가", per: "88.0", chg: "-1.42%", up: false },
    { badge: "고평가", per: "142.6", chg: "+0.31%", up: true },
    { badge: "고평가", per: "76.3", chg: "-2.05%", up: false },
    { badge: "고평가", per: "302.9", chg: "+4.12%", up: true },
  ];
  return (
    <div className="relative">
      {/* 흐릿한 미리보기 */}
      <div
        className="select-none blur-[6px]"
        style={{ filter: "blur(6px)" }}
        aria-hidden
      >
        <SectionHeader>저평가 · PER 낮은 순</SectionHeader>
        {teaser.slice(0, 4).map((t, i) => (
          <TeaserRow key={"u" + i} {...t} />
        ))}
        <SectionHeader>고평가 · PER 높은 순</SectionHeader>
        {teaser.slice(4).map((t, i) => (
          <TeaserRow key={"o" + i} {...t} />
        ))}
      </div>

      {/* 잠금 오버레이 */}
      <div className="absolute inset-0 flex items-start justify-center px-6 pt-16">
        <div className="w-full max-w-[340px] rounded-2xl border border-border bg-card/95 p-6 text-center shadow-xl backdrop-blur">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent/12 text-accent">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="10.5" width="16" height="10" rx="2.2" />
              <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
            </svg>
          </div>
          <h3 className="text-[16px] font-extrabold text-text">저평가·고평가 종목</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
            객관적 지표(PER·PBR·동종업계 비교)로 가려낸<br />
            저평가·고평가 종목은 <b className="text-text">프로 전용</b>이에요.
          </p>
          <a
            href="/pricing"
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[14px] font-black text-white hover:opacity-90"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            프로로 업그레이드
          </a>
          <p className="mt-2.5 text-[11px] text-muted">월 4,900원 · 10,000 크레딧 충전</p>
        </div>
      </div>
    </div>
  );
}

function TeaserRow({
  badge,
  per,
  chg,
  up,
}: {
  badge: string;
  per: string;
  chg: string;
  up: boolean;
}) {
  return (
    <div className="flex w-full items-center gap-2 border-b border-border px-3 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 18l-6.2 3.3L7 14.2l-5-4.9 6.9-1z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 h-4 w-24 rounded bg-bg-soft" />
        <div className="text-[11px] text-muted">●●●● · {badge} · PER {per}</div>
      </div>
      <div className="text-right">
        <div className="mb-1 ml-auto h-4 w-16 rounded bg-bg-soft" />
        <div className="text-[12px] font-bold" style={{ color: up ? UP : DOWN }}>
          {up ? "▲" : "▼"} {chg}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-border bg-bg-soft px-4 py-2 text-[12.5px] font-bold text-text">
      {children}
    </div>
  );
}

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
      <p className="text-[15px] font-bold text-text">{title}</p>
      <p className="mt-1.5 text-[13px] text-muted">{desc}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <div className="h-4 w-4 rounded bg-bg-soft" />
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

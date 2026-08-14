"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { handleNoCredits } from "@/lib/nocredits";
import type { User } from "@/lib/community";
import StockDetail, { type QuotedStock, overLabel } from "./StockDetail";
import CreditCoin from "./CreditCoin";

const UP = "#f6465d";
const DOWN = "#4b91f7";

// 무료 플랜 관심종목 한도 (프로는 무제한)
const FREE_WATCH_LIMIT = 20;

type Region = "kr" | "us";
type View =
  | "quote"
  | "index"
  | "volume"
  | "exchange"
  | "watch"
  | "movers"
  | "value"
  | "picks";

// 지수·거래량·환율 공용 행
interface OverviewRow {
  name: string;
  symbol: string;
  price: string;
  changeRate: number | null;
  domestic: boolean;
  currency: string;
  market?: string; // 해외 거래소(NASDAQ/NYSE). 국내는 생략.
}

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
  score?: number; // 저평가/고평가 정도 % (시장 PER 중앙값 대비)
}

const VIEWS: [View, string][] = [
  ["quote", "시세"],
  ["index", "지수"],
  ["volume", "거래량"],
  ["exchange", "환율"],
  ["watch", "관심"],
  ["movers", "급등락"],
  ["picks", "AI 추천"],
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
  credits,
  creditsUnlimited,
  refreshCredits,
}: {
  user: User;
  translate: boolean;
  credits: number | null;
  creditsUnlimited: boolean;
  refreshCredits: () => void;
}) {
  const [view, setView] = useState<View>("quote");
  const [region, setRegion] = useState<Region>("kr");
  const [stocks, setStocks] = useState<QuotedStock[] | null>(null);
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState<QuotedStock | null>(null);
  const [openMode, setOpenMode] = useState<"under" | "over" | undefined>(undefined);
  const [openMover, setOpenMover] = useState<"up" | "down" | undefined>(undefined);
  const [isPro, setIsPro] = useState(!!user.isPro);
  // 지수·거래량·환율 (인베스팅닷컴식 개요)
  const [overview, setOverview] = useState<OverviewRow[] | null>(null);
  const [volMarket, setVolMarket] = useState<"kospi" | "kosdaq" | "us">("kospi");
  const [valTab, setValTab] = useState<"under" | "over">("under");

  const openStock = (s: QuotedStock, mode?: "under" | "over") => {
    setOpenMode(mode);
    setOpenMover(undefined);
    setOpen(s);
  };
  // 급등락 목록에서 열면 '급등/급락 이유' 모드
  const openMoverStock = (s: QuotedStock, dir: "up" | "down") => {
    setOpenMode(undefined);
    setOpenMover(dir);
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

  const [briefOn, setBriefOn] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  useEffect(() => {
    const local = loadWatch(user.username);
    setWatch(local);
    // 서버 관심종목과 동기화: 서버에 있으면 그걸 쓰고, 없고 로컬만 있으면 서버로 이전.
    fetch("/api/watchlist", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setBriefOn(!!d.briefOn);
        const server = Array.isArray(d.watchlist) ? d.watchlist : null;
        if (server && server.length) {
          setWatch(server);
          try {
            localStorage.setItem(
              `stockfeed:watchstocks:${user.username}`,
              JSON.stringify(server),
            );
          } catch {
            /* noop */
          }
        } else if (server && !server.length && local.length) {
          fetch("/api/watchlist", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ watchlist: local }),
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, [user.username]);

  const isStarred = (symbol: string) => watch.some((w) => w.symbol === symbol);
  const toggleStar = (s: QuotedStock) => {
    const exists = watch.some((w) => w.symbol === s.symbol);
    // 무료 플랜은 관심종목 20개까지. 초과하면 추가 대신 업그레이드 안내.
    if (!exists && !isPro && watch.length >= FREE_WATCH_LIMIT) {
      setLimitHit(true);
      return;
    }
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
      // 서버에도 저장(크론 알림이 관심종목을 알아야 함).
      // 게스트/미로그인은 서버가 401로 무시 → 로컬만 유지되고 문제 없음.
      fetch("/api/watchlist", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchlist: next }),
      }).catch(() => {});
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
    const t = setInterval(() => load(region), 10000);
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
    const t = setInterval(go, 10000);
    return () => clearInterval(t);
  }, [region, view]);

  // 지수 · 거래량 · 환율 — 30초 주기 갱신 (시세라 실시간성 필요)
  useEffect(() => {
    if (view !== "index" && view !== "volume" && view !== "exchange") return;
    setOverview(null);
    const q =
      view === "volume" ? `tab=volume&market=${volMarket}` : `tab=${view}`;
    const go = () =>
      fetch(`/api/market-overview?${q}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setOverview(d.ok ? d.rows : []))
        .catch(() => setOverview([]));
    go();
    const t = setInterval(go, 30000);
    return () => clearInterval(t);
  }, [view, volMarket]);

  // 저평가/고평가 (프로 전용) — 무료 유저는 요청조차 안 함
  useEffect(() => {
    if (view !== "value" || !isPro) return;
    setValuation(null);
    // 시세가 움직이면 PER/순위도 바뀌므로 주기적으로 갱신 (다른 뷰와 동일)
    const go = () =>
      fetch(`/api/market-valuation?region=${region}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setValuation(d.ok ? d : { undervalued: [], overvalued: [] }))
        .catch(() => setValuation({ undervalued: [], overvalued: [] }));
    go();
    const t = setInterval(go, 30000);
    return () => clearInterval(t);
  }, [region, view, isPro]);

  // 관심종목 시세
  useEffect(() => {
    if (view !== "watch") return;
    if (!watch.length) {
      setWatchStocks([]);
      return;
    }
    setWatchStocks(null);
    const go = () =>
      fetch("/api/watch-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks: watch }),
      })
        .then((r) => r.json())
        .then((d) => setWatchStocks(d.ok ? d.stocks : []))
        .catch(() => setWatchStocks([]));
    go();
    const t = setInterval(go, 10000);
    return () => clearInterval(t);
  }, [view, watch]);

  // 크레딧은 MainApp이 보유 — 종목 상세를 닫을 때(AI 사용 후) 최신화 요청
  useEffect(() => {
    refreshCredits();
  }, [refreshCredits, open]);

  // 프로 여부
  useEffect(() => {
    fetch("/api/credits", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setIsPro(!!d.isPro))
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

  // 지수·환율은 국내/해외 구분이 없고, 거래량은 코스피/코스닥 자체 토글을 쓴다
  const showRegion =
    !searching &&
    view !== "watch" &&
    view !== "index" &&
    view !== "volume" &&
    view !== "exchange";

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-[19px] font-extrabold tracking-tight text-text">시장</h1>
          {(creditsUnlimited || credits !== null) && (
            <a
              href="/pricing"
              title={creditsUnlimited ? "AI 크레딧 무제한 (관리자)" : "AI 크레딧 · 요금제"}
              className="flex h-8 items-center gap-1 rounded-full bg-bg-soft px-2.5 text-[12.5px] font-black text-accent hover:bg-card"
            >
              <CreditCoin size={14} />
              {creditsUnlimited ? "∞" : credits!.toLocaleString()}
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
          <HRow className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
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
          </HRow>
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
        ) : view === "index" || view === "exchange" ? (
          overview === null ? (
            <SkeletonRows />
          ) : overview.length === 0 ? (
            <Empty title="데이터를 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />
          ) : (
            overview.map((r) => <OverviewRowView key={r.symbol} row={r} />)
          )
        ) : view === "volume" ? (
          <>
            <div className="flex gap-1 border-b border-border bg-bg px-4 py-2">
              {(
                [
                  ["kospi", "코스피"],
                  ["kosdaq", "코스닥"],
                  ["us", "미국"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setVolMarket(m)}
                  className={`rounded-full px-3 py-1 text-[12.5px] font-bold transition-colors ${
                    volMarket === m ? "bg-accent text-white" : "bg-bg-soft text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto self-center text-[11px] text-muted">거래량 많은 순</span>
            </div>
            {overview === null ? (
              <SkeletonRows />
            ) : overview.length === 0 ? (
              <Empty title="데이터를 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />
            ) : (
              overview.map((r, i) => {
                const isUs = volMarket === "us";
                const q: QuotedStock = {
                  name: r.name,
                  ticker: r.symbol,
                  symbol: r.symbol,
                  market: isUs
                    ? (r.market ?? "USA")
                    : volMarket === "kospi"
                      ? "KOSPI"
                      : "KOSDAQ",
                  domestic: !isUs,
                  price: r.price,
                  changeRate: r.changeRate,
                  currency: isUs ? "USD" : "KRW",
                };
                return (
                  <Row
                    key={r.symbol}
                    stock={q}
                    rank={i + 1}
                    starred={isStarred(r.symbol)}
                    onStar={() => toggleStar(q)}
                    onOpen={() => setOpen(q)}
                  />
                );
              })
            )}
          </>
        ) : view === "watch" ? (
          watchStocks === null ? (
            <SkeletonRows />
          ) : (
            <>
              {/* 브리핑 설정은 관심종목이 없어도 항상 보이게 (프로가 바로 켤 수 있도록) */}
              <BriefBanner isPro={isPro} briefOn={briefOn} setBriefOn={setBriefOn} />
              {watchStocks.length === 0 ? (
                <Empty
                  title="관심 종목이 없어요"
                  desc="종목 옆 별(☆)을 눌러 관심 종목을 추가하세요."
                />
              ) : (
                <>
                  <PortfolioReview stocks={watch} isPro={isPro} onSpend={refreshCredits} />
                  {watchStocks.map((s) => (
                    <Row
                      key={s.symbol}
                      stock={s}
                      starred={isStarred(s.symbol)}
                      onStar={() => toggleStar(s)}
                      onOpen={() => setOpen(s)}
                    />
                  ))}
                </>
              )}
            </>
          )
        ) : view === "picks" ? (
          <StockPicks region={region} isPro={isPro} onSpend={refreshCredits} onOpen={(s) => setOpen(s)} />
        ) : view === "movers" ? (
          movers === null ? (
            <SkeletonRows />
          ) : (
            <>
              <SectionHeader>📈 급등 TOP</SectionHeader>
              {movers.gainers.length === 0 ? (
                <p className="px-4 py-4 text-center text-[13px] text-muted">
                  크게 오른 종목이 아직 없어요.
                </p>
              ) : (
                movers.gainers.map((s) => (
                  <Row key={"u" + s.symbol} stock={s} starred={isStarred(s.symbol)} onStar={() => toggleStar(s)} onOpen={() => openMoverStock(s, "up")} />
                ))
              )}
              <SectionHeader>📉 급락 TOP</SectionHeader>
              {movers.losers.length === 0 ? (
                <p className="px-4 py-4 text-center text-[13px] text-muted">
                  크게 내린 종목이 아직 없어요.
                </p>
              ) : (
                movers.losers.map((s) => (
                  <Row key={"d" + s.symbol} stock={s} starred={isStarred(s.symbol)} onStar={() => toggleStar(s)} onOpen={() => openMoverStock(s, "down")} />
                ))
              )}
            </>
          )
        ) : view === "value" ? (
          !isPro ? (
            <ProBlurGate />
          ) : valuation === null ? (
            <SkeletonRows />
          ) : (
            <>
              {/* 저평가/고평가 토글 */}
              <div className="flex gap-1 border-b border-border bg-bg px-4 py-2">
                {(
                  [
                    ["under", "저평가"],
                    ["over", "고평가"],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setValTab(m)}
                    className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
                      valTab === m ? "bg-accent text-white" : "bg-bg-soft text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <span className="ml-auto self-center text-[11px] text-muted">시장 PER 대비</span>
              </div>
              {(valTab === "under" ? valuation.undervalued : valuation.overvalued).length === 0 ? (
                <Empty title="데이터를 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요." />
              ) : (
                (valTab === "under" ? valuation.undervalued : valuation.overvalued).map((s) => (
                  <ValueRow
                    key={s.symbol}
                    s={s}
                    kind={valTab}
                    onOpen={() => openStock(s, valTab)}
                  />
                ))
              )}
              <p className="px-4 py-4 text-center text-[11px] leading-relaxed text-muted">
                저평가/고평가 %는 <b className="text-muted">시장 PER 중앙값 대비</b> 상대 수치예요.
                PER·PBR은 참고용이며 업종·성장성에 따라 적정 밸류는 달라집니다.
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
          moverMode={openMover}
          onClose={() => {
            setOpen(null);
            setOpenMode(undefined);
            setOpenMover(undefined);
          }}
        />
      )}

      {/* 무료 관심종목 한도 초과 안내 */}
      {limitHit && (
        <div className="fixed inset-x-0 bottom-[84px] z-[80] mx-auto max-w-[600px] px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-card px-4 py-3 shadow-lg">
            <div className="min-w-0 flex-1 text-[12.5px] text-text">
              무료 플랜은 관심종목 {FREE_WATCH_LIMIT}개까지예요. 프로는 무제한이에요.
            </div>
            <a
              href="/pricing"
              className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-white"
            >
              프로 보기
            </a>
            <button
              onClick={() => setLimitHit(false)}
              aria-label="닫기"
              className="shrink-0 text-muted"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 가로 칩 줄 — 데스크톱에서 마우스 휠·드래그로 좌우 스크롤.
// 모바일은 원래 손가락 스와이프가 되므로 그대로 둔다.
function HRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 세로 휠 → 가로 스크롤 (스크롤 여지가 있을 때만 페이지 스크롤을 막는다)
    const onWheel = (e: WheelEvent) => {
      if (!e.deltaY || el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // 마우스 드래그로도 밀 수 있게. 살짝 움직인 건 클릭으로 인정(버튼 안 깨지게).
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  return (
    <div
      ref={ref}
      className={className}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") return; // 터치는 기본 스와이프 사용
        drag.current = { x: e.clientX, left: ref.current?.scrollLeft ?? 0, moved: false };
      }}
      onPointerMove={(e) => {
        if (!drag.current || !ref.current) return;
        const dx = e.clientX - drag.current.x;
        if (Math.abs(dx) > 3) drag.current.moved = true;
        ref.current.scrollLeft = drag.current.left - dx;
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerLeave={() => {
        drag.current = null;
      }}
      // 드래그로 밀었으면 그 위의 클릭은 무시(원치 않는 탭 전환 방지)
      onClickCapture={(e) => {
        if (drag.current?.moved) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      style={{ cursor: "grab" }}
    >
      {children}
    </div>
  );
}

// 지수·환율 행 — 종목이 아니라 클릭·관심별이 없다. 시세만 보여준다.
function OverviewRowView({ row }: { row: OverviewRow }) {
  const up = (row.changeRate ?? 0) > 0;
  const down = (row.changeRate ?? 0) < 0;
  const color = up ? UP : down ? DOWN : "var(--muted)";
  return (
    <div className="flex w-full items-center gap-2 border-b border-border px-4 py-3.5">
      <div className="min-w-0 flex-1 truncate text-[15px] font-bold text-text">{row.name}</div>
      <div className="shrink-0 text-right">
        <div className="text-[15px] font-bold text-text">
          {row.price}
          {row.currency === "원" ? "원" : ""}
        </div>
        {row.changeRate != null && (
          <div className="text-[12px] font-bold" style={{ color }}>
            {up ? "▲" : down ? "▼" : ""}
            {row.changeRate > 0 ? "+" : ""}
            {row.changeRate.toFixed(2)}%
          </div>
        )}
      </div>
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
        <div className="shrink-0 text-right">
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
          {/* 본장 외 거래 — 프리마켓/애프터마켓/시간외 */}
          {stock.over && (
            <div className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px]">
              <span className="rounded bg-accent/15 px-1 py-px font-bold text-accent">
                {overLabel(stock.over, stock.domestic)}
              </span>
              <span className="font-bold text-muted">
                {fmtPrice(stock.over.price, stock.currency)}
              </span>
              <span
                className="font-bold"
                style={{
                  color:
                    stock.over.changeRate > 0
                      ? UP
                      : stock.over.changeRate < 0
                        ? DOWN
                        : "var(--muted)",
                }}
              >
                {stock.over.changeRate > 0 ? "+" : ""}
                {stock.over.changeRate.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </button>
    </div>
  );
}

// AI 종목 추천 (프로 전용) — 정량 스크리닝 + 실제 뉴스 근거
interface PickItem {
  name: string;
  ticker: string;
  symbol?: string;
  market: string;
  domestic?: boolean;
  currency?: string;
  per: number | null;
  roe: number | null;
  price: string | null;
  changeRate: number | null;
  score: number;
  reasons: string[];
  newsPoints: string[];
  risk?: string[];
  news?: { title: string; link: string }[];
}

function StockPicks({
  region,
  isPro,
  onSpend,
  onOpen,
}: {
  region: Region;
  isPro: boolean;
  onSpend?: () => void;
  onOpen: (s: QuotedStock) => void;
}) {
  const [picks, setPicks] = useState<PickItem[] | null>(null);
  const [criteria, setCriteria] = useState("");
  const [screened, setScreened] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 국내/해외를 바꾸면 이전 추천은 무효 (섞이면 안 됨)
  useEffect(() => {
    setPicks(null);
    setErr("");
  }, [region]);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const d = await fetch("/api/stock-picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region }),
      }).then((r) => r.json());
      if (d.ok) {
        setPicks(d.picks ?? []);
        setCriteria(d.criteria ?? "");
        setScreened(d.screened ?? 0);
      } else if (!handleNoCredits(d)) setErr(d.reason || "추천을 가져오지 못했어요.");
    } catch {
      setErr("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
      onSpend?.();
    }
  };

  if (busy) {
    return (
      <div className="flex flex-col items-center gap-2 py-16">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" className="spin">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        </svg>
        <p className="text-[13px] text-muted">시총 상위 종목 스크리닝 + 뉴스 분석 중…</p>
        <p className="text-[11.5px] text-muted">10초 정도 걸려요</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="px-8 py-16 text-center">
        <p className="text-[14px] font-bold text-text">{err}</p>
        <button onClick={run} className="mt-3 rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white">
          다시 시도
        </button>
      </div>
    );
  }

  if (!picks) {
    return (
      <div className="px-5 py-8">
        <div className="rounded-2xl border border-border bg-bg-soft/40 p-5">
          <h3 className="text-[18px] font-extrabold text-text">종목 추천</h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            수익성(ROE)이 높은 경쟁력 있는 기업을 먼저 추린 뒤, 실제 보도된 뉴스로
            기술력·시장 점유율·성장 잠재력을 정리해 드려요.
          </p>
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {["수익성(ROE) 우선", "기술력·점유율", "성장 잠재력", "뉴스 근거"].map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-bg px-2.5 py-1 text-[12px] font-semibold text-muted"
              >
                {t}
              </span>
            ))}
          </div>
          <button
            onClick={run}
            className="mt-4 w-full rounded-xl bg-accent py-3 text-[14.5px] font-bold text-white"
          >
            {region === "us" ? "미국" : "국내"} 추천 종목 보기
          </button>
        </div>
        <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted">
          정량 지표와 실제 보도된 뉴스에 근거하며, 없는 내용을 지어내지 않아요. 투자 참고용이며
          투자 권유가 아닙니다.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-border bg-bg-soft px-4 py-2.5">
        <div className="text-[12px] font-bold text-text">선별 기준</div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          {criteria} · 검토 {screened}종목
        </div>
      </div>
      {picks.map((p, i) => (
        <div key={p.ticker} className="border-b border-border px-4 py-3.5">
          <button
            onClick={() =>
              onOpen({
                name: p.name,
                ticker: p.ticker,
                symbol: p.symbol ?? p.ticker,
                market: p.market,
                domestic: p.domestic ?? true,
                price: p.price,
                changeRate: p.changeRate,
                currency: p.currency ?? "KRW",
              })
            }
            className="flex w-full items-center gap-2 text-left"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[12px] font-black text-accent">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold text-text">{p.name}</div>
              <div className="text-[11px] text-muted">
                {p.ticker} · {p.market} · PER {p.per} · ROE {p.roe}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-bold text-text">
                {p.price ? fmtPrice(p.price, p.currency ?? "KRW") : "—"}
              </div>
              {p.changeRate != null && (
                <div
                  className="text-[12px] font-bold"
                  style={{ color: p.changeRate > 0 ? UP : p.changeRate < 0 ? DOWN : "var(--muted)" }}
                >
                  {p.changeRate > 0 ? "+" : ""}
                  {p.changeRate.toFixed(2)}%
                </div>
              )}
            </div>
          </button>

          <ul className="mt-2.5 space-y-1">
            {p.reasons.map((r, k) => (
              <li key={k} className="flex gap-1.5 text-[12.5px] leading-snug text-muted">
                <span className="text-accent">지표</span>
                <span>{r}</span>
              </li>
            ))}
            {p.newsPoints.map((r, k) => (
              <li key={`n${k}`} className="flex gap-1.5 text-[12.5px] leading-snug text-text">
                <span className="shrink-0 text-[#14c38e]">뉴스</span>
                <span>{r.replace(/\s*\[뉴스\s*\d+\]/g, "")}</span>
              </li>
            ))}
            {p.newsPoints.length === 0 && (
              <li className="text-[12px] text-muted">
                최근 뉴스에서 사업·실적 근거를 찾지 못해 지표만 표시했어요.
              </li>
            )}
            {(p.risk ?? []).map((r, k) => (
              <li key={`r${k}`} className="flex gap-1.5 text-[12.5px] leading-snug text-[#f7b500]">
                <span className="shrink-0">주의</span>
                {/* [뉴스N]·[지표] 같은 내부 인용 태그는 화면에선 숨김 */}
                <span>{r.replace(/\s*\[(뉴스\s*\d+|지표)\]/g, "")}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="px-4 py-4 text-center text-[11px] leading-relaxed text-muted">
        ※ 정량 지표로 걸러낸 뒤 보도된 뉴스만 정리한 결과예요. 매수·매도 권유가 아니며 투자
        판단과 책임은 본인에게 있어요.
      </p>
      <div className="px-4 pb-4">
        <button onClick={run} className="w-full rounded-xl border border-border py-2.5 text-[13px] font-bold text-muted">
          다시 추천받기
        </button>
      </div>
    </div>
  );
}

// 밸류에이션 게이지 — 싼쪽(초록)↔비싼쪽(빨강) 스펙트럼에 종목 위치 표시
function ValMeter({ pos }: { pos: number }) {
  const left = Math.max(4, Math.min(96, pos));
  return (
    <div
      className="relative mt-1 h-1.5 w-full rounded-full"
      style={{ background: "linear-gradient(90deg,#14c38e,#f7b500,#f6465d)" }}
    >
      <div
        className="absolute -top-[5px] h-0 w-0"
        style={{
          left: `${left}%`,
          transform: "translateX(-50%)",
          borderLeft: "4px solid transparent",
          borderRight: "4px solid transparent",
          borderTop: "6px solid var(--text)",
        }}
      />
    </div>
  );
}

// 저평가/고평가 행 — 종목·가격(좌) + 저평가% + 게이지 + 라벨(우)
function ValueRow({
  s,
  kind,
  onOpen,
}: {
  s: ValRow;
  kind: "under" | "over";
  onOpen: () => void;
}) {
  const score = s.score ?? 0;
  const pos = kind === "under" ? 100 - score : score; // 저평가=왼쪽, 고평가=오른쪽
  const scoreColor = kind === "under" ? "#14c38e" : "#f6465d";
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors active:bg-bg-soft hover:bg-bg-soft"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-text">{s.name}</div>
        <div className="mt-0.5 text-[11.5px] text-muted">
          {s.ticker} · {s.market}
        </div>
        <div className="mt-1 text-[15px] font-bold text-text">
          {fmtPrice(s.price ?? "", s.currency)}
          {s.changeRate != null && (
            <span
              className="ml-1.5 text-[12.5px] font-bold"
              style={{ color: s.changeRate < 0 ? DOWN : s.changeRate > 0 ? UP : "var(--muted)" }}
            >
              {s.changeRate > 0 ? "+" : ""}
              {s.changeRate}%
            </span>
          )}
        </div>
      </div>
      <div className="w-[110px] shrink-0">
        <div className="text-right text-[16px] font-extrabold" style={{ color: scoreColor }}>
          {score}%
        </div>
        <ValMeter pos={pos} />
        <div className="mt-1 text-right text-[11px] font-bold" style={{ color: scoreColor }}>
          {kind === "under" ? "저평가" : "고평가"}
        </div>
      </div>
    </button>
  );
}

// 프로 전용 잠금 — 실제 목록처럼 보이되 흐리게 + 가운데 안내(레퍼런스형 페이월).
// 흐린 배경은 실데이터가 아니라 플레이스홀더(비프로는 API가 403이라 실데이터가 없음).
const BLUR_ROWS = [
  { n: "○○전자", c: "0059●● · KOSPI", p: "94,600", r: -1.2, score: 79 },
  { n: "○○화학", c: "0510●● · KOSPI", p: "134,200", r: 0.8, score: 75 },
  { n: "○○바이오", c: "2079●● · KOSPI", p: "61,400", r: -2.4, score: 73 },
  { n: "○○에너지", c: "3732●● · KOSPI", p: "1,170,000", r: 1.1, score: 71 },
  { n: "○○금융", c: "1055●● · KOSPI", p: "21,300", r: -0.5, score: 70 },
  { n: "○○중공업", c: "0091●● · KOSPI", p: "16,660", r: 2.0, score: 68 },
];

function FakeRow({ s }: { s: (typeof BLUR_ROWS)[number] }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-text">{s.n}</div>
        <div className="mt-0.5 text-[11.5px] text-muted">{s.c}</div>
        <div className="mt-1 text-[15px] font-bold text-text">
          {s.p}원
          <span className="ml-1.5 text-[12.5px] font-bold" style={{ color: s.r < 0 ? DOWN : UP }}>
            {s.r > 0 ? "+" : ""}
            {s.r}%
          </span>
        </div>
      </div>
      <div className="w-[110px] shrink-0">
        <div className="text-right text-[16px] font-extrabold text-[#14c38e]">{s.score}%</div>
        <ValMeter pos={100 - s.score} />
        <div className="mt-1 text-right text-[11px] font-bold text-[#14c38e]">저평가</div>
      </div>
    </div>
  );
}

function ProBlurGate() {
  return (
    <div className="relative min-h-[440px]">
      {/* 흐린 목록 (플레이스홀더) */}
      <div className="pointer-events-none select-none blur-[6px] opacity-70">
        <div className="flex gap-1 border-b border-border bg-bg px-4 py-2">
          <span className="rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white">저평가</span>
          <span className="rounded-full bg-bg-soft px-4 py-1.5 text-[13px] font-bold text-muted">고평가</span>
        </div>
        {BLUR_ROWS.map((s, i) => (
          <FakeRow key={i} s={s} />
        ))}
      </div>

      {/* 가운데 잠금 안내 */}
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="w-full max-w-[300px] rounded-2xl border border-border bg-bg/95 px-6 py-6 text-center shadow-xl backdrop-blur-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-bg-soft text-muted">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
          </div>
          <div className="mt-3 text-[17px] font-extrabold text-text">프로 전용입니다</div>
          <p className="mx-auto mt-1.5 text-[13px] leading-relaxed text-muted">
            PER·PBR 기준 저평가·고평가 종목 스크리닝은 프로에서 볼 수 있어요.
          </p>
          <a
            href="/pricing"
            className="mt-4 inline-block w-full rounded-xl bg-accent py-2.5 text-[14px] font-bold text-white"
          >
            프로 보기
          </a>
        </div>
      </div>
    </div>
  );
}

// 아침 브리핑 배너 — 매일 아침 메일 (프로 전용)
function BriefBanner({
  isPro,
  briefOn,
  setBriefOn,
}: {
  isPro: boolean;
  briefOn: boolean;
  setBriefOn: (v: boolean) => void;
}) {
  const [briefBusy, setBriefBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggleBrief = async () => {
    setBriefBusy(true);
    setMsg(null);
    try {
      const next = !briefOn;
      const r = await fetch("/api/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on: next }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setBriefOn(next);
        if (next) setMsg("매일 아침 7시에 메일로 브리핑을 보내드려요.");
      } else setMsg(d.reason || "브리핑 설정에 실패했어요.");
    } finally {
      setBriefBusy(false);
    }
  };

  if (!isPro) {
    return (
      <a
        href="/pricing"
        className="mx-3 mt-3 flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-text">아침 브리핑 메일</div>
          <div className="text-[12px] text-muted">
            프로로 업그레이드하면 매일 아침 관심종목·미국장·경제일정 요약을 메일로 받아요.
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-[11.5px] font-bold text-white">
          프로
        </span>
      </a>
    );
  }

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-border bg-bg-soft px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-text">아침 브리핑 메일</div>
          <div className="text-[12px] text-muted">
            매일 아침 7시, 관심종목이 왜 움직였는지·미국장·경제일정을 메일로 받아요.
          </div>
        </div>
        <button
          onClick={toggleBrief}
          disabled={briefBusy}
          aria-pressed={briefOn}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            briefOn ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
              briefOn ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {msg && <p className="mt-2 text-[12px] text-muted">{msg}</p>}
    </div>
  );
}

// 관심종목 전체를 묶어 구성 진단 (프로 전용)
function PortfolioReview({
  stocks,
  isPro,
  onSpend,
}: {
  stocks: WatchItem[];
  isPro: boolean;
  onSpend?: () => void;
}) {
  const [review, setReview] = useState<{
    summary: string;
    concentration: string[];
    balance: string[];
    notes?: { name: string; text: string }[];
  } | null>(null);
  const [charts, setCharts] = useState<PfCharts | null>(null);
  const [holdings, setHoldings] = useState<PfHolding[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 관심종목이 바뀌면 이전 진단은 무효
  useEffect(() => {
    setReview(null);
    setCharts(null);
    setHoldings([]);
    setErr("");
  }, [stocks]);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const d = await fetch("/api/portfolio-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks }),
      }).then((r) => r.json());
      if (d.ok) {
        setReview(d.review);
        setCharts(d.charts ?? null);
        setHoldings(d.holdings ?? []);
      } else if (!handleNoCredits(d)) setErr(d.reason || "진단에 실패했어요.");
    } catch {
      setErr("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
      onSpend?.();
    }
  };

  if (stocks.length < 2) return null;

  return (
    <div className="border-b border-border px-4 py-3">
      {!review && !busy && (
        <button
          onClick={run}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-[#7b3fe4] py-3 text-[14.5px] font-bold text-white"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <circle cx="9" cy="14" r="2.5" />
            <circle cx="16" cy="9" r="2.5" />
          </svg>
          AI 포트폴리오 진단 · 내 관심종목 {stocks.length}개
        </button>
      )}
      {busy && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg-soft py-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" className="spin">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          </svg>
          <p className="text-[13px] text-muted">업종 구성 분석 중…</p>
        </div>
      )}
      {err && !busy && (
        <div className="rounded-xl border border-border bg-bg-soft p-3.5 text-center">
          <p className="text-[13px] text-[var(--down)]">{err}</p>
          <button onClick={run} className="mt-2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white">
            다시 시도
          </button>
        </div>
      )}
      {review && (
        <div className="overflow-hidden rounded-2xl border border-border bg-bg-soft">
          <div className="border-b border-border p-4">
            <div className="text-[12px] font-bold text-accent">포트폴리오 진단</div>
            <p className="mt-1.5 text-[14px] leading-relaxed text-text">{review.summary}</p>
          </div>
          {review.concentration.length > 0 && (
            <div className="border-b border-border p-4">
              <div className="mb-1.5 text-[12px] font-bold text-[#f7b500]">쏠림</div>
              <ul className="space-y-1.5">
                {review.concentration.map((c, i) => (
                  <li key={i} className="flex gap-1.5 text-[13.5px] leading-snug text-text">
                    <span className="text-[#f7b500]">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {charts && <PfCharts charts={charts} />}

          {(review.notes?.length ?? 0) > 0 && (
            <div className="border-b border-border p-4">
              <div className="mb-2 text-[12px] font-bold text-accent">
                종목별 관찰 <span className="font-normal text-muted">· 실제 지표 근거</span>
              </div>
              <div className="space-y-3">
                {review.notes!.map((n) => {
                  const h = holdings.find((x) => x.name === n.name);
                  return (
                    <div key={n.name} className="rounded-xl bg-bg p-3">
                      <div className="text-[13.5px] font-extrabold text-text">{n.name}</div>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">{n.text}</p>
                      {h?.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {h.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-accent/12 px-2 py-0.5 text-[10.5px] font-semibold text-accent"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {review.balance.length > 0 && (
            <div className="p-4">
              <div className="mb-1.5 text-[12px] font-bold text-[#14c38e]">분산 관점</div>
              <ul className="space-y-1.5">
                {review.balance.map((c, i) => (
                  <li key={i} className="flex gap-1.5 text-[13.5px] leading-snug text-text">
                    <span className="text-[#14c38e]">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="bg-bg px-4 py-2.5 text-[11px] leading-relaxed text-muted">
            ※ 관심종목 구성만 본 것이며 특정 종목 매수·매도 권유가 아니에요. 지표는 조회 시점
            기준입니다.
          </p>
        </div>
      )}
    </div>
  );
}

interface PfSlice {
  label: string;
  count: number;
  pct: number;
  names: string[];
}
interface PfCharts {
  basis: string;
  byMarket: PfSlice[];
  bySector: PfSlice[];
}
interface PfHolding {
  name: string;
  tags?: string[];
}

// 구성 비중은 색이 반복되지 않아야 한 눈에 구분된다
const PIE = ["#5b54f0", "#14c38e", "#f7b500", "#f6465d", "#18b6e6", "#a855f7", "#ff8a3d", "#8b96ad"];

/** 도넛 + 막대로 비중을 보여준다. 값은 서버가 센 것이라 화면에서 다시 계산하지 않는다. */
function PfCharts({ charts }: { charts: PfCharts }) {
  // 9개 이상이면 범례가 넘치므로 상위 7개만 두고 나머지는 '기타'로 합친다.
  // (그냥 잘라내면 도넛 합이 100%가 안 돼서 빈 구간이 생긴다)
  const top = charts.bySector.slice(0, 7);
  const rest = charts.bySector.slice(7);
  const sectors: PfSlice[] = rest.length
    ? [
        ...top,
        {
          label: `기타 ${rest.length}개 업종`,
          count: rest.reduce((s, x) => s + x.count, 0),
          pct: Math.round((100 - top.reduce((s, x) => s + x.pct, 0)) * 10) / 10,
          names: rest.flatMap((x) => x.names),
        },
      ]
    : top;

  // 도넛: 각 조각의 시작 각도를 누적해서 conic-gradient 문자열을 만든다.
  // 마지막 조각은 반올림 오차와 무관하게 100%로 닫아야 틈이 안 생긴다.
  let acc = 0;
  const stops = sectors
    .map((s, i) => {
      const from = acc;
      acc = i === sectors.length - 1 ? 100 : acc + s.pct;
      return `${PIE[i % PIE.length]} ${from}% ${acc}%`;
    })
    .join(", ");

  return (
    <div className="border-b border-border p-4">
      <div className="mb-3 flex items-baseline gap-1.5">
        <span className="text-[12px] font-bold text-accent">구성 비중</span>
        <span className="text-[10.5px] text-muted">· {charts.basis}</span>
      </div>

      <div className="flex items-center gap-4">
        <div
          className="relative h-[104px] w-[104px] shrink-0 rounded-full"
          style={{ background: `conic-gradient(${stops})` }}
        >
          <div className="absolute inset-[26px] grid place-items-center rounded-full bg-bg-soft">
            <div className="text-center leading-none">
              <div className="text-[17px] font-extrabold text-text">{charts.bySector.reduce((s, x) => s + x.count, 0)}</div>
              <div className="mt-0.5 text-[9.5px] text-muted">종목</div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {sectors.map((s, i) => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: PIE[i % PIE.length] }}
              />
              <span className="truncate text-[11.5px] text-muted" title={s.names.join(", ")}>
                {s.label}
              </span>
              <span className="ml-auto shrink-0 text-[11.5px] font-bold text-text">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 국내/해외는 두 갈래뿐이라 막대가 더 읽기 쉽다 */}
      <div className="mt-4">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-bg">
          {charts.byMarket.map((m, i) => (
            <div
              key={m.label}
              style={{ width: `${m.pct}%`, background: i === 0 ? "#5b54f0" : "#18b6e6" }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex gap-3">
          {charts.byMarket.map((m, i) => (
            <span key={m.label} className="flex items-center gap-1 text-[11px] text-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: i === 0 ? "#5b54f0" : "#18b6e6" }}
              />
              {m.label} {m.pct}% ({m.count}종목)
            </span>
          ))}
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

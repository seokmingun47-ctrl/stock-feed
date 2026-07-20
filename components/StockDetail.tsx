"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/community";
import type { Article, Source } from "@/lib/types";
import { SOURCE_MAP } from "@/lib/sources";
import { timeAgo } from "@/lib/format";
import ProChart from "./ProChart";
import ArticleReader from "./ArticleReader";
import SourceAvatar from "./SourceAvatar";

const UP = "#f6465d";
const DOWN = "#4b91f7";

// 본장 외 거래(프리마켓/애프터마켓/시간외) — 진행 중일 때만 옴
export interface OverQuote {
  session: "PRE" | "AFTER";
  price: string;
  changeRate: number;
}

export interface QuotedStock {
  name: string;
  ticker: string;
  symbol: string;
  market: string;
  domestic: boolean;
  price: string | null;
  changeRate: number | null;
  currency: string;
  marketOpen?: boolean;
  over?: OverQuote | null;
}

export const overLabel = (o: OverQuote, domestic: boolean): string =>
  domestic ? "시간외" : o.session === "AFTER" ? "애프터마켓" : "프리마켓";

type Period = "day" | "week" | "month";
interface Candle {
  d: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface Analysis {
  outlook: "상승" | "하락" | "중립";
  upsidePercent: number;
  horizon: string;
  confidence: "높음" | "보통" | "낮음";
  summary: string;
  reasons: string[];
  risks: string[];
}

function fmtPrice(price: string, currency: string): string {
  if (currency === "KRW") return `${price}원`;
  if (currency === "USD") return `$${price}`;
  return `${price} ${currency}`;
}

// "296,000" / "193.13" → 숫자
function parsePrice(p: string | null): number | null {
  if (!p) return null;
  const n = Number(p.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fmtTarget(n: number, currency: string): string {
  const s =
    currency === "KRW"
      ? Math.round(n).toLocaleString()
      : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return fmtPrice(s, currency);
}

export default function StockDetail({
  stock,
  translate,
  user,
  onClose,
  valuationMode,
  moverMode,
}: {
  stock: QuotedStock;
  translate: boolean;
  user: User;
  onClose: () => void;
  valuationMode?: "under" | "over";
  moverMode?: "up" | "down"; // 급등락 목록에서 열었을 때
}) {
  const [period, setPeriod] = useState<Period>("day");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [chartErr, setChartErr] = useState(false);

  const [metrics, setMetrics] = useState<Record<string, string> | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [news, setNews] = useState<Article[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiErr, setAiErr] = useState("");
  const [reader, setReader] = useState<Article | null>(null);
  const [valReason, setValReason] = useState<{
    summary: string;
    points: string[];
    tech?: string[];
  } | null>(null);
  const [valNews, setValNews] = useState<Article[]>([]); // 기술력 설명의 근거 기사
  // AI 차트 분석
  const [chartAi, setChartAi] = useState<{
    trend: string;
    summary: string;
    levels: string[];
    patterns: string[];
    outlook: string;
    band: { low: number; high: number } | null;
  } | null>(null);
  const [chartBusy, setChartBusy] = useState(false);
  const [chartAiErr, setChartAiErr] = useState("");

  const runChartAi = async () => {
    if (chartBusy) return;
    setChartBusy(true);
    setChartAiErr("");
    try {
      const d = await fetch("/api/chart-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stock.name,
          symbol: stock.symbol,
          domestic: stock.domestic,
        }),
      }).then((r) => r.json());
      if (d.ok) setChartAi(d.analysis);
      else setChartAiErr(d.reason || "분석에 실패했어요.");
    } catch {
      setChartAiErr("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setChartBusy(false);
    }
  };

  // 급등락 사유
  const [movReason, setMovReason] = useState<{ summary: string; points: string[] } | null>(null);
  const [movNews, setMovNews] = useState<Article[]>([]);
  const [movBusy, setMovBusy] = useState(false);
  const [movErr, setMovErr] = useState("");

  const runMover = async () => {
    if (movBusy || !moverMode) return;
    setMovBusy(true);
    setMovErr("");
    try {
      const d = await fetch("/api/mover-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stock.name,
          dir: moverMode,
          changeRate: q.changeRate ?? stock.changeRate ?? 0,
        }),
      }).then((r) => r.json());
      if (!d.ok) {
        setMovErr(d.reason || "분석에 실패했어요.");
        return;
      }
      setMovReason(d.reason);
      setMovNews(d.news ?? []);
    } catch {
      setMovErr("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setMovBusy(false);
    }
  };
  const [valBusy, setValBusy] = useState(false);
  const [valErr, setValErr] = useState("");
  const [live, setLive] = useState<QuotedStock | null>(null);

  // 실시간 시세 — 본장 + 프리/애프터마켓 모두. 10초마다 갱신.
  useEffect(() => {
    let alive = true;
    const go = () =>
      fetch("/api/watch-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stocks: [
            {
              name: stock.name,
              ticker: stock.ticker,
              symbol: stock.symbol,
              market: stock.market,
              domestic: stock.domestic,
            },
          ],
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok && d.stocks?.[0]) setLive(d.stocks[0] as QuotedStock);
        })
        .catch(() => {});
    go();
    const t = setInterval(go, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [stock.name, stock.ticker, stock.symbol, stock.market, stock.domestic]);

  // 실시간 값 우선, 없으면 넘겨받은 값
  const q: QuotedStock = live ?? stock;

  const runValuation = async () => {
    if (valBusy) return;
    setValBusy(true);
    setValErr("");
    try {
      const d = await fetch("/api/valuation-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stock.name,
          symbol: stock.symbol,
          domestic: stock.domestic,
          price: stock.price ?? "",
          mode: valuationMode,
        }),
      }).then((r) => r.json());
      if (!d.ok) {
        setValErr(d.reason || "분석에 실패했어요.");
        return;
      }
      setValReason(d.reason);
      setValNews(d.news ?? []);
    } catch {
      setValErr("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setValBusy(false);
    }
  };

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

  // 주요 지표 (시총·거래량·52주·PER·PBR·배당)
  useEffect(() => {
    let alive = true;
    setMetrics(null);
    fetch(
      `/api/stock-detail?symbol=${encodeURIComponent(stock.symbol)}&domestic=${
        stock.domestic ? 1 : 0
      }`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok && d.detail?.info) setMetrics(d.detail.info);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stock.symbol, stock.domestic]);

  // 차트
  useEffect(() => {
    let alive = true;
    setCandles(null);
    setChartErr(false);
    fetch(
      `/api/stock-chart?symbol=${encodeURIComponent(stock.symbol)}&domestic=${
        stock.domestic ? 1 : 0
      }&tf=${period}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok && d.candles?.length) setCandles(d.candles);
        else setChartErr(true);
      })
      .catch(() => alive && setChartErr(true));
    return () => {
      alive = false;
    };
  }, [period, stock.symbol, stock.domestic]);

  const runAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAiErr("");
    try {
      const d = await fetch("/api/stock-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stock.name,
          ticker: stock.ticker,
          market: stock.market,
          price: stock.price ?? "",
          currency: stock.currency,
        }),
      }).then((r) => r.json());
      if (d.news) setNews(d.news);
      if (!d.ok) {
        setAiErr(d.reason || "분석에 실패했어요.");
        return;
      }
      setAnalysis(d.analysis);
    } catch {
      setAiErr("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setAnalyzing(false);
    }
  };

  const up = (q.changeRate ?? 0) > 0;
  const down = (q.changeRate ?? 0) < 0;
  const changeColor = up ? UP : down ? DOWN : "var(--muted)";

  const cur = parsePrice(q.price);
  const target =
    analysis && cur != null
      ? cur * (1 + analysis.upsidePercent / 100)
      : null;
  const gnewsSource = SOURCE_MAP["gnews_kr"] as Source | undefined;

  return (
    <div className="reader-enter fixed inset-0 z-[60] flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        {/* 헤더 */}
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text hover:bg-bg-soft"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[17px] font-extrabold text-text">
                {stock.name}
              </span>
              {q.price && (
                <span className="text-[15px] font-bold text-text">
                  {fmtPrice(q.price, q.currency)}
                </span>
              )}
              {q.changeRate != null && (
                <span className="text-[13px] font-bold" style={{ color: changeColor }}>
                  {up ? "▲" : down ? "▼" : ""}
                  {q.changeRate > 0 ? "+" : ""}
                  {q.changeRate.toFixed(2)}%
                </span>
              )}
              {q.marketOpen && (
                <span className="flex items-center gap-1 text-[10.5px] font-bold text-[#14c38e]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#14c38e]" />
                  실시간
                </span>
              )}
            </div>

            {/* 본장 외 거래 (프리마켓 / 애프터마켓 / 시간외) */}
            {q.over && (
              <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                  {overLabel(q.over, q.domestic)}
                </span>
                <span className="text-[13px] font-bold text-text">
                  {fmtPrice(q.over.price, q.currency)}
                </span>
                <span
                  className="text-[12px] font-bold"
                  style={{
                    color:
                      q.over.changeRate > 0 ? UP : q.over.changeRate < 0 ? DOWN : "var(--muted)",
                  }}
                >
                  {q.over.changeRate > 0 ? "▲" : q.over.changeRate < 0 ? "▼" : ""}
                  {q.over.changeRate > 0 ? "+" : ""}
                  {q.over.changeRate.toFixed(2)}%
                </span>
              </div>
            )}

            <div className="text-[11px] text-muted">
              {stock.ticker} · {stock.market} · 네이버 증권
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-8">
          {/* 차트 */}
          <div className="flex gap-1 px-4 pt-3">
            {(
              [
                ["day", "일"],
                ["week", "주"],
                ["month", "월"],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
                  period === p ? "bg-accent text-white" : "bg-bg-soft text-muted hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="px-3 py-3">
            {chartErr ? (
              <div className="flex h-[240px] flex-col items-center justify-center text-center">
                <p className="text-[14px] font-semibold text-text">차트를 불러오지 못했어요</p>
              </div>
            ) : !candles ? (
              <div className="flex h-[240px] items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" className="spin">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                </svg>
              </div>
            ) : (
              <ProChart
                data={candles}
                prediction={
                  chartAi?.band
                    ? { band: chartAi.band, trend: chartAi.trend }
                    : null
                }
              />
            )}
          </div>

          {/* AI 차트 분석 */}
          <div className="mb-4 px-4">
            {!chartAi && !chartBusy && (
              <button
                onClick={runChartAi}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-[13.5px] font-bold text-accent hover:bg-accent/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3v18h18" />
                  <path d="M7 14l3-3 3 3 5-6" />
                </svg>
                AI 차트 분석 · 추세와 지지·저항
              </button>
            )}
            {chartBusy && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-bg-soft py-4 text-[13px] text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" className="spin">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                </svg>
                차트 지표 계산 중…
              </div>
            )}
            {chartAiErr && !chartBusy && (
              <div className="rounded-xl border border-border bg-bg-soft p-3.5 text-center">
                <p className="text-[13px] text-[var(--down)]">{chartAiErr}</p>
                {/프로/.test(chartAiErr) ? (
                  <a href="/pricing" className="mt-2 inline-block rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white">
                    프로 보러가기
                  </a>
                ) : (
                  <button onClick={runChartAi} className="mt-2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white">
                    다시 시도
                  </button>
                )}
              </div>
            )}
            {chartAi && <ChartAnalysisCard a={chartAi} currency={stock.currency} />}
          </div>

          {/* 주요 지표 */}
          {metrics && (
            <div className="mb-4 px-4">
              <h3 className="mb-2 text-[14px] font-bold text-text">주요 지표</h3>
              <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 rounded-xl border border-border bg-bg-soft p-4">
                {["시총", "거래량", "52주 최고", "52주 최저", "PER", "PBR", "EPS", "배당수익률"]
                  .filter((k) => metrics[k])
                  .map((k) => (
                    <div key={k} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="shrink-0 text-muted">{k}</span>
                      <span className="truncate text-right font-semibold text-text">
                        {metrics[k]}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* AI 분석 — 급등락 사유 / 밸류에이션 이유 / 주가 전망 */}
          <div className="px-4">
            {moverMode ? (
              <>
                {!movReason && !movBusy && (
                  <button
                    onClick={runMover}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-bold text-white"
                    style={{
                      background:
                        moverMode === "up"
                          ? "linear-gradient(90deg,#f6465d,#c3253a)"
                          : "linear-gradient(90deg,#4b91f7,#2a63b8)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                    </svg>
                    AI 분석 · {moverMode === "up" ? "급등" : "급락"}하는 이유
                  </button>
                )}
                {movBusy && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg-soft py-8">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" className="spin">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    </svg>
                    <p className="text-[13px] text-muted">
                      {stock.name} {moverMode === "up" ? "급등" : "급락"} 관련 뉴스 확인 중…
                    </p>
                  </div>
                )}
                {movErr && !movBusy && (
                  <div className="rounded-xl border border-border bg-bg-soft p-4 text-center">
                    <p className="text-[13px] text-[var(--down)]">{movErr}</p>
                    <button onClick={runMover} className="mt-2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white">
                      다시 시도
                    </button>
                  </div>
                )}
                {movReason && (
                  <MoverReasonCard
                    reason={movReason}
                    dir={moverMode}
                    news={movNews}
                    onOpenNews={setReader}
                  />
                )}
              </>
            ) : valuationMode ? (
              <>
                {!valReason && !valBusy && (
                  <button
                    onClick={runValuation}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#14c38e] to-[#0d8f6f] py-3.5 text-[15px] font-bold text-white"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                    </svg>
                    AI 분석 · {valuationMode === "under" ? "저평가" : "고평가"}인 이유
                  </button>
                )}
                {valBusy && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg-soft py-8">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" className="spin">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    </svg>
                    <p className="text-[13px] text-muted">객관적 지표 비교 분석 중…</p>
                  </div>
                )}
                {valErr && !valBusy && (
                  <div className="rounded-xl border border-border bg-bg-soft p-4 text-center">
                    <p className="text-[13px] text-[var(--down)]">{valErr}</p>
                    <button onClick={runValuation} className="mt-2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white">
                      다시 시도
                    </button>
                  </div>
                )}
                {valReason && (
                  <ValuationReasonCard
                    reason={valReason}
                    mode={valuationMode}
                    news={valNews}
                    onOpenNews={setReader}
                  />
                )}
              </>
            ) : (
              <>
                {!analysis && !analyzing && (
                  <button
                    onClick={runAnalysis}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#14c38e] to-[#0d8f6f] py-3.5 text-[15px] font-bold text-white"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
                    </svg>
                    AI 분석 · 주가 전망 보기
                  </button>
                )}
                {analyzing && (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-bg-soft py-8">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" className="spin">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    </svg>
                    <p className="text-[13px] text-muted">{stock.name} 관련 뉴스와 전망 분석 중…</p>
                  </div>
                )}
                {aiErr && !analyzing && (
                  <div className="rounded-xl border border-border bg-bg-soft p-4 text-center">
                    <p className="text-[13px] text-[var(--down)]">{aiErr}</p>
                    <button onClick={runAnalysis} className="mt-2 rounded-full bg-accent px-4 py-1.5 text-[13px] font-bold text-white">
                      다시 시도
                    </button>
                  </div>
                )}
                {analysis && <AnalysisCard a={analysis} target={target} currency={stock.currency} />}
              </>
            )}
          </div>

          {/* 관련 뉴스 (전망 모드에서만) */}
          {!valuationMode && news.length > 0 && (
            <div className="mt-5 px-4">
              <h3 className="mb-2 text-[14px] font-bold text-text">관련 뉴스</h3>
              <div className="space-y-2">
                {news.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setReader(a)}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-bg-soft p-3 text-left hover:bg-card"
                  >
                    {gnewsSource && <SourceAvatar source={gnewsSource} size={20} />}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-text">
                        {a.title}
                      </p>
                      <span className="text-[11px] text-muted">{timeAgo(a.publishedAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {reader && gnewsSource && (
        <ArticleReader
          article={reader}
          source={gnewsSource}
          translate={translate}
          user={user}
          onClose={() => setReader(null)}
        />
      )}
    </div>
  );
}

// AI 차트 분석 — 지표는 서버가 계산, AI는 해석만
function ChartAnalysisCard({
  a,
  currency,
}: {
  a: {
    trend: string;
    summary: string;
    levels: string[];
    patterns: string[];
    outlook: string;
    band: { low: number; high: number } | null;
  };
  currency: string;
}) {
  const color = a.trend === "상승" ? UP : a.trend === "하락" ? DOWN : "var(--muted)";
  const fmt = (n: number) =>
    currency === "KRW" ? `${Math.round(n).toLocaleString()}원` : `$${n.toFixed(2)}`;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-soft">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <span
          className="rounded-full px-2 py-0.5 text-[12px] font-black"
          style={{ color, backgroundColor: `${color}22` }}
        >
          {a.trend}
        </span>
        <p className="flex-1 text-[13.5px] leading-relaxed text-text">{a.summary}</p>
      </div>

      {a.band && (
        <div className="border-b border-border px-4 py-3">
          <div className="mb-1 text-[12px] font-bold text-accent">1주일 통계적 변동 범위</div>
          <div className="text-[15px] font-extrabold text-text">
            {fmt(a.band.low)} ~ {fmt(a.band.high)}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            최근 20일 변동성으로 계산한 범위예요. 예측이 아니라 통계값입니다.
          </p>
        </div>
      )}

      {a.levels.length > 0 && (
        <div className="border-b border-border p-4">
          <div className="mb-1.5 text-[12px] font-bold text-[#f7b500]">지지 · 저항</div>
          <ul className="space-y-1.5">
            {a.levels.map((x, i) => (
              <li key={i} className="flex gap-1.5 text-[13.5px] leading-snug text-text">
                <span className="text-[#f7b500]">•</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.patterns.length > 0 && (
        <div className="border-b border-border p-4">
          <div className="mb-1.5 text-[12px] font-bold text-muted">관찰된 패턴</div>
          <ul className="space-y-1.5">
            {a.patterns.map((x, i) => (
              <li key={i} className="flex gap-1.5 text-[13.5px] leading-snug text-text">
                <span className="text-muted">•</span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.outlook && (
        <div className="p-4">
          <div className="mb-1.5 text-[12px] font-bold text-accent">시나리오</div>
          <p className="text-[13.5px] leading-relaxed text-text">{a.outlook}</p>
        </div>
      )}

      <p className="bg-bg px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        ※ 이동평균·RSI·변동성 등 <b>계산된 지표</b>만 해석한 결과예요. 미래 주가를 맞히는 것이
        아니며 투자 권유가 아닙니다.
      </p>
    </div>
  );
}

// 급등/급락 사유 — 실제 뉴스 근거만
function MoverReasonCard({
  reason,
  dir,
  news,
  onOpenNews,
}: {
  reason: { summary: string; points: string[] };
  dir: "up" | "down";
  news?: Article[];
  onOpenNews?: (a: Article) => void;
}) {
  const color = dir === "up" ? UP : DOWN;
  const title = dir === "up" ? "급등 사유" : "급락 사유";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-soft">
      <div className="border-b border-border p-4">
        <div className="text-[12px] font-bold" style={{ color }}>
          {title} · 실제 뉴스 근거
        </div>
        {reason.summary && (
          <p className="mt-1.5 text-[14px] leading-relaxed text-text">{reason.summary}</p>
        )}
      </div>
      {reason.points.length > 0 ? (
        <ul className="space-y-2 p-4">
          {reason.points.map((p, i) => {
            const m = p.match(/\[뉴스\s*(\d+)\]/);
            const idx = m ? Number(m[1]) - 1 : -1;
            const art = news && idx >= 0 ? news[idx] : undefined;
            return (
              <li key={i} className="flex gap-1.5 text-[13.5px] leading-snug text-text">
                <span style={{ color }}>•</span>
                <span>
                  {p.replace(/\s*\[뉴스\s*\d+\]\s*$/, "")}
                  {art && (
                    <button
                      onClick={() => onOpenNews?.(art)}
                      className="ml-1 whitespace-nowrap rounded bg-accent/15 px-1.5 py-px align-middle text-[10.5px] font-bold text-accent hover:bg-accent/25"
                    >
                      근거 기사 ↗
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          관련 뉴스에서 뚜렷한 사유를 찾지 못했어요. <b className="text-text">추측으로 채우지 않습니다.</b>
        </p>
      )}
      <p className="bg-bg px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        ※ 보도된 뉴스만 근거로 정리했어요. 주가 변동 원인은 복합적일 수 있고, 투자 권유가 아닙니다.
      </p>
    </div>
  );
}

function ValuationReasonCard({
  reason,
  mode,
  news,
  onOpenNews,
}: {
  reason: { summary: string; points: string[]; tech?: string[] };
  mode: "under" | "over";
  news?: Article[];
  onOpenNews?: (a: Article) => void;
}) {
  const color = mode === "under" ? "#14c38e" : "#f6465d";
  const title = mode === "under" ? "저평가 근거" : "고평가 근거";
  const tech = reason.tech ?? [];

  // "…[뉴스2]" → 해당 기사로 연결 (근거를 직접 눌러 확인 가능)
  const renderTech = (t: string, i: number) => {
    const m = t.match(/\[뉴스\s*(\d+)\]/);
    const idx = m ? Number(m[1]) - 1 : -1;
    const art = news && idx >= 0 ? news[idx] : undefined;
    const text = t.replace(/\s*\[뉴스\s*\d+\]\s*$/, "");
    return (
      <li key={i} className="flex gap-1.5 text-[13.5px] leading-snug text-text">
        <span className="text-accent">•</span>
        <span>
          {text}
          {art && (
            <button
              onClick={() => onOpenNews?.(art)}
              className="ml-1 whitespace-nowrap rounded bg-accent/15 px-1.5 py-px align-middle text-[10.5px] font-bold text-accent hover:bg-accent/25"
            >
              근거 기사 ↗
            </button>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-soft">
      <div className="border-b border-border p-4">
        <div className="text-[12px] font-bold" style={{ color }}>
          {title} · 객관적 지표 기준
        </div>
        {reason.summary && (
          <p className="mt-1.5 text-[14px] leading-relaxed text-text">{reason.summary}</p>
        )}
      </div>
      {reason.points.length > 0 && (
        <ul className="space-y-2 p-4">
          {reason.points.map((p, i) => (
            <li key={i} className="flex gap-1.5 text-[13.5px] leading-snug text-text">
              <span style={{ color }}>•</span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 기술력·사업 — 실제 뉴스에 나온 내용만 */}
      {tech.length > 0 && (
        <div className="border-t border-border">
          <div className="px-4 pt-3.5 text-[12px] font-bold text-accent">
            기술력 · 사업 (실제 뉴스 근거)
          </div>
          <ul className="space-y-2 p-4 pt-2">{tech.map(renderTech)}</ul>
        </div>
      )}
      {tech.length === 0 && (
        <p className="border-t border-border px-4 py-3 text-[12.5px] leading-relaxed text-muted">
          최근 뉴스에서 이 기업의 기술·사업 관련 내용을 찾지 못해 기술력 설명은 생략했어요.
          <b className="text-text"> 추측으로 채우지 않습니다.</b>
        </p>
      )}

      <p className="bg-bg px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        ※ 지표는 PER·PBR·애널리스트 컨센서스, 기술력은 <b>실제 보도된 뉴스</b>만 근거로 했어요.
        AI 추측·전망은 넣지 않았고, 투자 권유가 아닙니다.
      </p>
    </div>
  );
}

function AnalysisCard({
  a,
  target,
  currency,
}: {
  a: Analysis;
  target: number | null;
  currency: string;
}) {
  const upPos = a.upsidePercent > 0;
  const upNeg = a.upsidePercent < 0;
  const upColor = upPos ? UP : upNeg ? DOWN : "var(--muted)";
  const outlookColor =
    a.outlook === "상승" ? UP : a.outlook === "하락" ? DOWN : "var(--muted)";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-soft">
      {/* 상승여력 헤드라인 */}
      <div className="flex items-center gap-4 border-b border-border p-4">
        <div className="flex-1">
          <div className="text-[12px] font-semibold text-muted">AI 예상 상승여력</div>
          <div className="text-[34px] font-black leading-tight" style={{ color: upColor }}>
            {a.upsidePercent > 0 ? "+" : ""}
            {a.upsidePercent}%
          </div>
          {target != null && (
            <div className="text-[12px] text-muted">
              목표가 약 {fmtTarget(target, currency)} · {a.horizon}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className="rounded-full px-3 py-1 text-[13px] font-bold text-white"
            style={{ background: outlookColor }}
          >
            {a.outlook}
          </span>
          <span className="text-[11px] text-muted">신뢰도 {a.confidence}</span>
        </div>
      </div>

      {a.summary && (
        <p className="border-b border-border p-4 text-[13.5px] leading-relaxed text-text">
          {a.summary}
        </p>
      )}

      {a.reasons.length > 0 && (
        <div className="border-b border-border p-4">
          <div className="mb-1.5 text-[12px] font-bold text-[#14c38e]">상승 근거</div>
          <ul className="space-y-1.5">
            {a.reasons.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-[13px] leading-snug text-text">
                <span className="text-[#14c38e]">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.risks.length > 0 && (
        <div className="p-4">
          <div className="mb-1.5 text-[12px] font-bold text-[#f6465d]">리스크</div>
          <ul className="space-y-1.5">
            {a.risks.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-[13px] leading-snug text-text">
                <span className="text-[#f6465d]">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="bg-bg px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        ※ AI가 뉴스·일반 정보로 생성한 <b>참고용 추정</b>이며 정확하지 않을 수 있어요. 투자 권유가 아니며, 최종 판단·책임은 본인에게 있습니다.
      </p>
    </div>
  );
}

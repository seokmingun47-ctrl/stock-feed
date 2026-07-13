"use client";

import { useEffect, useMemo, useState } from "react";

type Period = "day" | "week" | "month";
interface Candle {
  d: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// 한국 관례: 상승=빨강, 하락=파랑
const UP = "#f6465d";
const DOWN = "#4b91f7";

function fmtPrice(price: string, currency: string): string {
  if (currency === "KRW") return `${price}원`;
  if (currency === "USD") return `$${price}`;
  return `${price} ${currency}`;
}

export default function StockChart({
  name,
  ticker,
  market,
  symbol,
  domestic,
  price,
  changeRate,
  currency,
  onClose,
}: {
  name: string;
  ticker: string;
  market: string;
  symbol?: string;
  domestic?: boolean;
  price?: string;
  changeRate?: number;
  currency?: string;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>("day");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [err, setErr] = useState(false);

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

  useEffect(() => {
    let alive = true;
    setCandles(null);
    setErr(false);
    const q =
      symbol && domestic !== undefined
        ? `symbol=${encodeURIComponent(symbol)}&domestic=${domestic ? 1 : 0}`
        : `ticker=${encodeURIComponent(ticker)}&name=${encodeURIComponent(name)}`;
    fetch(`/api/stock-chart?${q}&tf=${period}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok && d.candles?.length) setCandles(d.candles);
        else setErr(true);
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [period, symbol, domestic, ticker, name]);

  const up = (changeRate ?? 0) > 0;
  const down = (changeRate ?? 0) < 0;
  const changeColor = up ? UP : down ? DOWN : "var(--muted)";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="sheet-up mx-auto flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[17px] font-extrabold text-text">{name}</span>
              {price ? (
                <span className="text-[16px] font-bold text-text">
                  {fmtPrice(price, currency || "")}
                </span>
              ) : null}
              {typeof changeRate === "number" && (price || changeRate !== 0) && (
                <span
                  className="text-[13px] font-bold"
                  style={{ color: changeColor }}
                >
                  {up ? "▲" : down ? "▼" : ""}
                  {changeRate > 0 ? "+" : ""}
                  {changeRate.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
              {ticker && <span>{ticker}</span>}
              {market && <span>· {market}</span>}
              <span>· 네이버 증권</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-bg-soft hover:text-text"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

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
                period === p
                  ? "bg-accent text-white"
                  : "bg-bg-soft text-muted hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-3 py-3">
          {err ? (
            <div className="flex h-[260px] flex-col items-center justify-center text-center">
              <p className="text-[14px] font-semibold text-text">
                차트를 불러오지 못했어요
              </p>
              <p className="mt-1 text-[12px] text-muted">잠시 후 다시 시도해 주세요.</p>
            </div>
          ) : !candles ? (
            <div className="flex h-[260px] items-center justify-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              </svg>
            </div>
          ) : (
            <Candles data={candles} period={period} />
          )}
        </div>

        <div className="mt-auto px-4 pb-3 pt-1 text-center text-[11px] text-muted">
          네이버 증권 시세 · 실시간과 다소 차이가 있을 수 있어요
        </div>
      </div>
    </div>
  );
}

function fmtNum(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "조";
  if (n >= 1e8) return (n / 1e8).toFixed(1) + "억";
  if (n >= 1e4) return Math.round(n).toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function Candles({ data, period }: { data: Candle[]; period: Period }) {
  const cap = period === "day" ? 90 : 120;
  const candles = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.d.localeCompare(b.d));
    return sorted.slice(-cap);
  }, [data, cap]);

  const W = 720;
  const priceTop = 6;
  const priceH = 236;
  const volTop = 250;
  const volH = 66;
  const padL = 6;
  const padR = 58; // 오른쪽 가격 라벨 공간
  const innerW = W - padL - padR;
  const n = candles.length;
  const step = innerW / Math.max(n, 1);
  const bodyW = Math.max(1, Math.min(step * 0.66, 12));

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  let pMax = Math.max(...highs);
  let pMin = Math.min(...lows);
  const padP = (pMax - pMin) * 0.04 || pMax * 0.02 || 1;
  pMax += padP;
  pMin -= padP;
  const volMax = Math.max(...candles.map((c) => c.v), 1);

  const yP = (p: number) => priceTop + ((pMax - p) / (pMax - pMin)) * priceH;
  const cx = (i: number) => padL + step * i + step / 2;

  const last = candles[n - 1];
  const lastUp = last.c >= last.o;

  // x축 날짜 라벨 (처음/중간/끝)
  const fmtDate = (d: string) =>
    d.length === 8 ? `${d.slice(4, 6)}/${d.slice(6, 8)}` : d;
  const ticks = [0, Math.floor(n / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} 336`} className="w-full" preserveAspectRatio="none">
      {/* 가로 그리드 + 가격 라벨 */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const p = pMax - f * (pMax - pMin);
        const y = priceTop + f * priceH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={W - padR + 4} y={y + 3} fill="var(--muted)" fontSize="10">
              {fmtNum(p)}
            </text>
          </g>
        );
      })}

      {/* 캔들 + 거래량 */}
      {candles.map((c, i) => {
        const color = c.c >= c.o ? UP : DOWN;
        const bx = cx(i);
        const yHi = yP(c.h);
        const yLo = yP(c.l);
        const yO = yP(c.o);
        const yC = yP(c.c);
        const bodyTop = Math.min(yO, yC);
        const bodyH = Math.max(1, Math.abs(yO - yC));
        const vh = (c.v / volMax) * volH;
        return (
          <g key={i}>
            <line x1={bx} y1={yHi} x2={bx} y2={yLo} stroke={color} strokeWidth="1" />
            <rect x={bx - bodyW / 2} y={bodyTop} width={bodyW} height={bodyH} fill={color} />
            <rect
              x={bx - bodyW / 2}
              y={volTop + (volH - vh)}
              width={bodyW}
              height={vh}
              fill={color}
              opacity="0.45"
            />
          </g>
        );
      })}

      {/* 최근 종가 기준선 */}
      <line
        x1={padL}
        y1={yP(last.c)}
        x2={W - padR}
        y2={yP(last.c)}
        stroke={lastUp ? UP : DOWN}
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.6"
      />

      {/* x축 날짜 */}
      {ticks.map((i, k) => (
        <text
          key={k}
          x={Math.min(Math.max(cx(i), 14), W - padR - 14)}
          y={332}
          fill="var(--muted)"
          fontSize="10"
          textAnchor="middle"
        >
          {fmtDate(candles[i].d)}
        </text>
      ))}
    </svg>
  );
}

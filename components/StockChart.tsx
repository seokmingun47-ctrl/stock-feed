"use client";

import { useEffect, useState } from "react";

type Period = "day" | "week" | "month";

// 티커로 시장 판별 (6자리 숫자=국내, 영문=미국)
function classify(ticker: string): { type: "kr" | "us" | "none"; key: string } {
  const t = ticker.trim().toUpperCase();
  if (/^\d{6}$/.test(t)) return { type: "kr", key: t };
  if (/^[A-Z][A-Z.\-]{0,5}$/.test(t)) return { type: "us", key: t };
  return { type: "none", key: "" };
}

// 네이버 금융 차트 이미지 (국내)
function naverChart(code: string, period: Period, cb: number): string {
  return `https://ssl.pstatic.net/imgfinance/chart/item/candle/${period}/${code}.png?sidcode=${cb}`;
}

// Finviz 차트 이미지 (미국)
function finvizChart(sym: string, period: Period, cb: number): string {
  const p = period === "day" ? "d" : period === "week" ? "w" : "m";
  return `https://charts2.finviz.com/chart.ashx?t=${sym}&ty=c&ta=1&p=${p}&s=l&cb=${cb}`;
}

// 외부 금융 사이트 링크 (국내=네이버, 해외=야후)
function externalLink(
  type: "kr" | "us" | "none",
  key: string,
  name: string,
): { label: string; url: string } {
  if (type === "kr")
    return {
      label: "네이버 금융에서 자세히 보기",
      url: `https://finance.naver.com/item/main.naver?code=${key}`,
    };
  if (type === "us")
    return {
      label: "Yahoo Finance에서 자세히 보기",
      url: `https://finance.yahoo.com/quote/${key}`,
    };
  return {
    label: "검색으로 보기",
    url: `https://www.google.com/search?q=${encodeURIComponent(name + " 주가")}`,
  };
}

export default function StockChart({
  name,
  ticker,
  market,
  onClose,
}: {
  name: string;
  ticker: string;
  market: string;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<Period>("day");
  const [imgErr, setImgErr] = useState(false);
  const [cb] = useState(() => Date.now()); // 열 때마다 최신 이미지
  const cls = classify(ticker);
  const link = externalLink(cls.type, cls.key, name);

  const src =
    cls.type === "kr"
      ? naverChart(cls.key, period, cb)
      : cls.type === "us"
        ? finvizChart(cls.key, period, cb)
        : null;

  useEffect(() => setImgErr(false), [period]);

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

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/60"
      onClick={onClose}
    >
      <div
        className="sheet-up mx-auto flex max-h-[88vh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-3xl border-t border-border bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[17px] font-extrabold text-text">{name}</span>
              {ticker && (
                <span className="text-[13px] font-medium text-muted">{ticker}</span>
              )}
              {market && (
                <span className="rounded bg-bg-soft px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {market}
                </span>
              )}
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

        {src ? (
          <>
            {/* 기간 탭 */}
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

            {/* 차트 이미지 */}
            <div className="px-4 py-3">
              {imgErr ? (
                <div className="flex h-[220px] flex-col items-center justify-center rounded-xl bg-bg-soft text-center">
                  <p className="text-[14px] font-semibold text-text">
                    차트를 불러오지 못했어요
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    아래 링크에서 확인해 주세요.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`${name} 차트`}
                    onError={() => setImgErr(true)}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <p className="text-[15px] font-semibold text-text">
              이 종목의 차트를 찾지 못했어요
            </p>
            <p className="mt-1.5 text-[13px] text-muted">
              티커 정보가 없어 외부에서 확인해 주세요.
            </p>
          </div>
        )}

        <div className="mt-auto border-t border-border px-4 py-2.5">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-full bg-bg-soft py-2.5 text-[13.5px] font-semibold text-text hover:bg-card-hover"
          >
            {link.label} ↗
          </a>
        </div>
      </div>
    </div>
  );
}

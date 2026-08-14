"use client";

import { useEffect, useState } from "react";
import type { MarketRow } from "@/lib/naver";

const UP = "#f6465d";
const DOWN = "#4b91f7";

function color(v: number | null): string {
  if (v == null) return "var(--muted)";
  return v > 0 ? UP : v < 0 ? DOWN : "var(--muted)";
}
function pct(v: number | null): string {
  if (v == null) return "-";
  return `${v > 0 ? "+" : ""}${v}%`;
}

// 데스크톱 전용 사이드바 — 넓은 화면에서 화면을 채우고 실시간 시장 정보 제공.
export default function DesktopSidebar() {
  const [indices, setIndices] = useState<MarketRow[] | null>(null);
  const [volume, setVolume] = useState<MarketRow[] | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/market-overview?tab=index", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setIndices(d.ok ? d.rows : []))
        .catch(() => setIndices([]));
      fetch("/api/market-overview?tab=volume&market=kospi", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setVolume(d.ok ? (d.rows as MarketRow[]).slice(0, 7) : []))
        .catch(() => setVolume([]));
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <Panel title="주요 지수">
        {indices === null ? (
          <Skeleton rows={6} />
        ) : indices.length === 0 ? (
          <Muted />
        ) : (
          indices.slice(0, 8).map((r) => (
            <div key={r.symbol || r.name} className="flex items-center justify-between py-1.5 text-[13px]">
              <span className="truncate pr-2 text-text">{r.name}</span>
              <span className="shrink-0 text-right">
                <span className="font-bold text-text">{r.price}</span>
                <span className="ml-1.5 font-bold" style={{ color: color(r.changeRate) }}>
                  {pct(r.changeRate)}
                </span>
              </span>
            </div>
          ))
        )}
      </Panel>

      <Panel title="거래량 상위">
        {volume === null ? (
          <Skeleton rows={5} />
        ) : volume.length === 0 ? (
          <Muted />
        ) : (
          volume.map((r, i) => (
            <div key={r.symbol || i} className="flex items-center gap-2 py-1.5 text-[13px]">
              <span className="w-4 shrink-0 text-[11px] font-bold text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-text">{r.name}</span>
              <span className="shrink-0 text-right">
                <span className="font-bold text-text">{r.price}</span>
                <span className="ml-1.5 font-bold" style={{ color: color(r.changeRate) }}>
                  {pct(r.changeRate)}
                </span>
              </span>
            </div>
          ))
        )}
      </Panel>

      <a
        href="/pricing"
        className="block rounded-2xl border border-accent/25 bg-accent/[0.06] p-4 text-center"
      >
        <div className="text-[14px] font-bold text-text">프로로 더 많은 기능</div>
        <div className="mt-1 text-[12px] leading-relaxed text-muted">
          아침 브리핑 · 종목 심층 리포트 · 저평가·고평가 스크리닝
        </div>
        <div className="mt-3 rounded-xl bg-accent py-2 text-[13px] font-bold text-white">
          프로 보기
        </div>
      </a>

      <p className="px-1 text-[11px] leading-relaxed text-muted">
        시세는 네이버 실데이터이며 투자 참고용입니다.
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-soft/40 p-4">
      <h3 className="mb-1.5 text-[13.5px] font-bold text-text">{title}</h3>
      {children}
    </div>
  );
}
function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 py-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3.5 rounded bg-bg-soft" />
      ))}
    </div>
  );
}
function Muted() {
  return <p className="py-2 text-[12px] text-muted">불러오지 못했어요.</p>;
}

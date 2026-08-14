"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Candle {
  d: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}
export interface Prediction {
  band: { low: number; high: number } | null;
  trend: string; // 상승 | 하락 | 횡보
}
type Tool = "none" | "trend" | "hline";
// 봉 종류. 렌코·카기·P&F 같은 비시간축 변형은 리테일 사용이 드물어 제외하고,
// 실용적인 5종만 지원한다.
type ChartType = "candle" | "hollow" | "heikin" | "line" | "area";
const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "candle", label: "캔들" },
  { id: "hollow", label: "할로우 캔들" },
  { id: "heikin", label: "하이킨 아시" },
  { id: "line", label: "라인" },
  { id: "area", label: "영역" },
];

// 하이킨 아시: 노이즈를 줄여 추세를 부드럽게 보여주는 변형 캔들.
//   HA종가 = (O+H+L+C)/4,  HA시가 = (앞 HA시가 + 앞 HA종가)/2
//   HA고가 = max(H, HA시,HA종),  HA저가 = min(L, HA시,HA종)
function toHeikin(src: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const close = (c.o + c.h + c.l + c.c) / 4;
    const open = i === 0 ? (c.o + c.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2;
    out.push({
      d: c.d,
      o: open,
      c: close,
      h: Math.max(c.h, open, close),
      l: Math.min(c.l, open, close),
      v: c.v,
    });
  }
  return out;
}
// 드로잉은 '데이터 좌표'로 저장한다 (x=캔들 인덱스, y=가격).
// 화면 좌표로 저장하면 확대/이동할 때 선이 따로 논다.
interface Line {
  id: number;
  kind: Tool;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const UP = "#f6465d";
const DOWN = "#4b91f7";

// 네이버 차트와 동일한 이동평균 구성
const MAS: { p: number; color: string }[] = [
  { p: 5, color: "#22c55e" },
  { p: 20, color: "#f6465d" },
  { p: 60, color: "#f59e0b" },
  { p: 120, color: "#a855f7" },
];

// ⚠️ 이동평균은 '전체 데이터'로 먼저 계산해야 한다.
// 보이는 구간만 잘라서 계산하면 화면 왼쪽 60·120일선이 통째로 비거나 값이 틀어진다.
function movingAverages(all: Candle[]): Map<number, (number | null)[]> {
  const closes = all.map((c) => c.c);
  const out = new Map<number, (number | null)[]>();
  for (const { p } of MAS) {
    const line: (number | null)[] = [];
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= p) sum -= closes[i - p];
      line.push(i >= p - 1 ? sum / p : null);
    }
    out.set(p, line);
  }
  return out;
}

export default function ProChart({
  data,
  prediction,
}: {
  data: Candle[];
  prediction?: Prediction | null;
}) {
  const all = useMemo(
    () => [...data].sort((a, b) => a.d.localeCompare(b.d)),
    [data],
  );
  const N = all.length;

  // 보이는 구간 [start, end) — 확대/이동의 단일 소스
  const [range, setRange] = useState<{ s: number; e: number }>(() => ({
    s: Math.max(0, N - 90),
    e: N,
  }));
  const [tool, setTool] = useState<Tool>("none");
  const [showMa, setShowMa] = useState(true);
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [typeOpen, setTypeOpen] = useState(false);
  // 크로스헤어 — 차트 위에서 손/마우스를 움직이면 그 지점의 날짜·가격을 표시
  const [hover, setHover] = useState<number | null>(null); // view 배열 기준 인덱스
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<Line | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; s: number; e: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // 두 손가락(핀치) 줌 — 활성 포인터와 시작 시점의 벌어진 거리를 기억한다
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; s: number; e: number; anchor: number } | null>(null);

  // 전체화면일 때 뒤 스크롤 잠그고, 뒤로가기/ESC로 닫히게
  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const W = 720;
  const priceTop = 6;
  const priceH = 236;
  const volTop = 250;
  const volH = 66;
  const padL = 6;
  const padR = 58;
  const innerW = W - padL - padR;

  // 예측을 그릴 때 오른쪽에 미래 공간을 확보
  const FUTURE = prediction?.band ? 12 : 0;

  // 전체 기준으로 계산해두고, 화면엔 보이는 구간만 잘라 쓴다
  const maAll = useMemo(() => movingAverages(all), [all]);

  const view = useMemo(() => {
    const s = Math.max(0, Math.min(range.s, N - 5));
    const e = Math.max(s + 5, Math.min(range.e, N));
    return all.slice(s, e);
  }, [all, range, N]);

  // 하이킨 아시는 전체 시계열로 계산한 뒤 보이는 구간만 잘라야 값이 맞다.
  const heikinAll = useMemo(
    () => (chartType === "heikin" ? toHeikin(all) : null),
    [all, chartType],
  );

  // 실제 렌더에 쓰는 봉 — 하이킨이면 변형본, 아니면 원본
  const bars = useMemo(() => {
    if (chartType === "heikin" && heikinAll) {
      const s = Math.max(0, Math.min(range.s, N - 5));
      const e = Math.max(s + 5, Math.min(range.e, N));
      return heikinAll.slice(s, e);
    }
    return view;
  }, [chartType, heikinAll, view, range, N]);

  // 보이는 구간의 이동평균 (null = 아직 기간이 안 찬 구간)
  const maView = useMemo(() => {
    const s = Math.max(0, Math.min(range.s, N - 5));
    const e = Math.max(s + 5, Math.min(range.e, N));
    const out = new Map<number, (number | null)[]>();
    for (const { p } of MAS) out.set(p, (maAll.get(p) ?? []).slice(s, e));
    return out;
  }, [maAll, range, N]);

  const n = view.length;
  const step = innerW / Math.max(n + FUTURE, 1);
  const bodyW = Math.max(1, Math.min(step * 0.66, 14));

  const { pMin, pMax } = useMemo(() => {
    const highs = bars.map((c) => c.h);
    const lows = bars.map((c) => c.l);
    let hi = Math.max(...highs);
    let lo = Math.min(...lows);
    // 이동평균선이 화면 밖으로 잘리지 않게 범위에 포함
    if (showMa) {
      for (const { p } of MAS) {
        for (const v of maView.get(p) ?? []) {
          if (v == null) continue;
          hi = Math.max(hi, v);
          lo = Math.min(lo, v);
        }
      }
    }
    // 예측 범위도 화면에 들어오게
    if (prediction?.band) {
      hi = Math.max(hi, prediction.band.high);
      lo = Math.min(lo, prediction.band.low);
    }
    const pad = (hi - lo) * 0.06 || hi * 0.02 || 1;
    return { pMin: lo - pad, pMax: hi + pad };
  }, [bars, prediction, showMa, maView]);

  const volMax = Math.max(...view.map((c) => c.v), 1);
  const yP = useCallback(
    (p: number) => priceTop + ((pMax - p) / (pMax - pMin || 1)) * priceH,
    [pMax, pMin],
  );
  const cx = useCallback((i: number) => padL + step * i + step / 2, [step]);

  // 화면 좌표 → 데이터 좌표 (드로잉 저장용)
  const toData = useCallback(
    (clientX: number, clientY: number) => {
      const el = svgRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const sx = ((clientX - r.left) / r.width) * W;
      const sy = ((clientY - r.top) / r.height) * (volTop + volH);
      const idx = (sx - padL) / step - 0.5 + range.s; // 전체 배열 기준 인덱스
      const price = pMax - ((sy - priceTop) / priceH) * (pMax - pMin);
      return { x: idx, y: price };
    },
    [step, range.s, pMax, pMin],
  );
  // 데이터 좌표 → 화면
  const dx = useCallback((idx: number) => cx(idx - range.s), [cx, range.s]);

  const zoom = (factor: number, anchor = 0.5) => {
    setRange((r) => {
      const len = r.e - r.s;
      const next = Math.max(10, Math.min(N, Math.round(len * factor)));
      const pivot = r.s + len * anchor;
      let s = Math.round(pivot - next * anchor);
      s = Math.max(0, Math.min(s, N - next));
      return { s, e: s + next };
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = svgRef.current;
    const r = el?.getBoundingClientRect();
    const anchor = r ? (e.clientX - r.left) / r.width : 0.5;
    zoom(e.deltaY > 0 ? 1.15 : 0.87, anchor);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // 손가락 두 개 = 핀치 시작. 그리기/드래그는 취소하고 확대 모드로.
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const el = svgRef.current;
      const r = el?.getBoundingClientRect();
      const mid = (a.x + b.x) / 2;
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        s: range.s,
        e: range.e,
        anchor: r ? (mid - r.left) / r.width : 0.5,
      };
      drag.current = null;
      setDraft(null);
      return;
    }
    if (tool === "none") {
      drag.current = { x: e.clientX, s: range.s, e: range.e };
      return;
    }
    const p = toData(e.clientX, e.clientY);
    if (!p) return;
    setDraft({ id: Date.now(), kind: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    // 핀치 확대: 두 손가락이 벌어진 비율만큼 보이는 구간을 줄인다
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0 && pinch.current.dist > 0) {
        const len0 = pinch.current.e - pinch.current.s;
        const next = Math.max(10, Math.min(N, Math.round(len0 * (pinch.current.dist / dist))));
        let s = Math.round(pinch.current.s + len0 * pinch.current.anchor - next * pinch.current.anchor);
        s = Math.max(0, Math.min(s, N - next));
        setRange({ s, e: s + next });
      }
      return;
    }
    if (drag.current) {
      const el = svgRef.current;
      const r = el?.getBoundingClientRect();
      if (!r) return;
      const len = drag.current.e - drag.current.s;
      const shift = Math.round(((drag.current.x - e.clientX) / r.width) * len);
      let s = drag.current.s + shift;
      s = Math.max(0, Math.min(s, N - len));
      setRange({ s, e: s + len });
      return;
    }
    // 크로스헤어: 드래그·그리기 중이 아니면 가장 가까운 봉을 짚어 날짜·가격 표시
    if (!draft) {
      const el = svgRef.current;
      const r = el?.getBoundingClientRect();
      if (r) {
        const sx = ((e.clientX - r.left) / r.width) * W;
        const idx = Math.round((sx - padL) / step - 0.5);
        setHover(idx >= 0 && idx < n ? idx : null);
      }
      return;
    }
    const p = toData(e.clientX, e.clientY);
    if (!p) return;
    setDraft((d) =>
      d ? { ...d, x2: p.x, y2: d.kind === "hline" ? d.y1 : p.y } : d,
    );
  };

  const onPointerUp = (e?: React.PointerEvent) => {
    if (e) pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
    if (draft) {
      // 점만 찍은 건 무시
      const moved = Math.abs(draft.x2 - draft.x1) > 0.5 || Math.abs(draft.y2 - draft.y1) > 0;
      if (moved || draft.kind === "hline") setLines((l) => [...l, draft]);
      setDraft(null);
    }
  };

  // 가격 눈금
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i <= 4; i++) out.push(pMin + ((pMax - pMin) * i) / 4);
    return out;
  }, [pMin, pMax]);

  const last = view[n - 1];
  const fmt = (v: number) =>
    v >= 1000 ? Math.round(v).toLocaleString() : v.toFixed(2);

  // AI 예측 콘: 마지막 종가에서 band 범위로 벌어지는 형태
  const cone = useMemo(() => {
    if (!prediction?.band || !last) return null;
    const x0 = cx(n - 1);
    const x1 = cx(n - 1 + FUTURE);
    const y0 = yP(last.c);
    const yHi = yP(prediction.band.high);
    const yLo = yP(prediction.band.low);
    const mid = prediction.trend === "상승" ? yHi : prediction.trend === "하락" ? yLo : (yHi + yLo) / 2;
    return { x0, x1, y0, yHi, yLo, mid };
  }, [prediction, last, cx, yP, n, FUTURE]);

  const visibleLines = [...lines, ...(draft ? [draft] : [])];

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[90] flex flex-col justify-center overflow-hidden bg-bg px-3 py-3 select-none"
          : "select-none"
      }
    >
      {/* 도구 모음 */}
      <div className="mb-1.5 flex items-center gap-1 px-1">
        {(
          [
            ["none", "이동", "M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"],
            ["trend", "추세선", "M3 18L21 6"],
            ["hline", "수평선", "M3 12h18"],
          ] as [Tool, string, string][]
        ).map(([t, label, d]) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            title={label}
            className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11.5px] font-bold transition-colors ${
              tool === t ? "bg-accent text-white" : "bg-bg-soft text-muted"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={d} />
            </svg>
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {/* 봉 종류 선택 */}
          <div className="relative">
            <button
              onClick={() => setTypeOpen((v) => !v)}
              title="봉 종류"
              className="flex h-8 items-center gap-1 rounded-lg bg-bg-soft px-2 text-[11.5px] font-bold text-muted"
            >
              {CHART_TYPES.find((t) => t.id === chartType)?.label}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {typeOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTypeOpen(false)} />
                <div className="absolute right-0 top-9 z-20 w-32 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  {CHART_TYPES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setChartType(t.id);
                        setTypeOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-[12.5px] font-semibold transition-colors hover:bg-bg-soft ${
                        chartType === t.id ? "text-accent" : "text-text"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowMa((v) => !v)}
            title="이동평균선"
            className={`h-8 rounded-lg px-2 text-[11.5px] font-bold transition-colors ${
              showMa ? "bg-accent/15 text-accent" : "bg-bg-soft text-muted"
            }`}
          >
            이평
          </button>
          <button onClick={() => zoom(1.3)} title="축소" className="grid h-8 w-8 place-items-center rounded-lg bg-bg-soft text-muted">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <button onClick={() => zoom(0.75)} title="확대" className="grid h-8 w-8 place-items-center rounded-lg bg-bg-soft text-muted">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
          {lines.length > 0 && (
            <button onClick={() => setLines([])} title="선 지우기" className="grid h-8 w-8 place-items-center rounded-lg bg-bg-soft text-[#f6465d]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "전체화면 닫기" : "전체화면"}
            className="grid h-8 w-8 place-items-center rounded-lg bg-bg-soft text-muted"
          >
            {fullscreen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3v6H3M21 9h-6V3M3 15h6v6M15 21v-6h6" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 이동평균 범례 — 각 선의 현재값 */}
      {showMa && (
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 text-[10.5px]">
          <span className="font-bold text-muted">이동평균</span>
          {MAS.map(({ p, color }) => {
            const vals = maView.get(p) ?? [];
            const v = [...vals].reverse().find((x) => x != null) ?? null;
            return (
              <span key={p} className="flex items-center gap-1" style={{ color }}>
                <span className="inline-block h-[2px] w-3 rounded" style={{ backgroundColor: color }} />
                {p}
                {v != null && <span className="text-muted">{fmt(v)}</span>}
              </span>
            );
          })}
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${volTop + volH}`}
        preserveAspectRatio="xMidYMid meet"
        className={fullscreen ? "mx-auto h-full max-h-full w-full touch-none" : "w-full touch-none"}
        style={{ cursor: tool === "none" ? "grab" : "crosshair" }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={(e) => {
          setHover(null);
          onPointerUp(e);
        }}
        onPointerCancel={onPointerUp}
      >
        {/* 가격 눈금 */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={yP(t)} x2={W - padR} y2={yP(t)} stroke="var(--border)" strokeWidth="0.5" />
            <text x={W - padR + 4} y={yP(t) + 3} fontSize="9.5" fill="var(--muted)">
              {fmt(t)}
            </text>
          </g>
        ))}

        {/* AI 예측 영역 */}
        {cone && (
          <g>
            <path
              d={`M${cone.x0} ${cone.y0} L${cone.x1} ${cone.yHi} L${cone.x1} ${cone.yLo} Z`}
              fill="var(--accent)"
              opacity="0.13"
            />
            <line x1={cone.x0} y1={cone.y0} x2={cone.x1} y2={cone.mid} stroke="var(--accent)" strokeWidth="1.6" strokeDasharray="5 4" />
            <text x={cone.x1 - 2} y={cone.yHi - 4} fontSize="9" fill="var(--accent)" textAnchor="end">
              AI 예상 범위
            </text>
          </g>
        )}

        {/* 이동평균선 — 캔들 아래에 깔아 캔들이 가려지지 않게 */}
        {showMa &&
          MAS.map(({ p, color }) => {
            const vals = maView.get(p) ?? [];
            // null 구간에서 선이 이어지지 않도록 연속 구간별로 끊어 그린다
            const segs: string[] = [];
            let cur: string[] = [];
            vals.forEach((v, i) => {
              if (v == null) {
                if (cur.length > 1) segs.push(cur.join(" "));
                cur = [];
                return;
              }
              cur.push(`${cx(i).toFixed(1)},${yP(v).toFixed(1)}`);
            });
            if (cur.length > 1) segs.push(cur.join(" "));
            return segs.map((pts, k) => (
              <polyline
                key={`ma${p}-${k}`}
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth="1.2"
                strokeLinejoin="round"
                opacity="0.9"
              />
            ));
          })}

        {/* 거래량 막대 (봉 종류와 무관하게 항상 표시) */}
        {bars.map((c, i) => {
          const up = c.c >= c.o;
          return (
            <rect
              key={`v${c.d}`}
              x={cx(i) - bodyW / 2}
              y={volTop + volH - (c.v / volMax) * volH}
              width={bodyW}
              height={(c.v / volMax) * volH}
              fill={up ? UP : DOWN}
              opacity="0.4"
            />
          );
        })}

        {/* 가격: 라인·영역이면 종가 선/면, 아니면 캔들 */}
        {chartType === "line" || chartType === "area" ? (
          (() => {
            const pts = bars.map((c, i) => `${cx(i).toFixed(1)},${yP(c.c).toFixed(1)}`);
            const line = pts.join(" ");
            const area =
              `${cx(0).toFixed(1)},${(priceTop + priceH).toFixed(1)} ` +
              line +
              ` ${cx(bars.length - 1).toFixed(1)},${(priceTop + priceH).toFixed(1)}`;
            return (
              <g>
                {chartType === "area" && (
                  <polygon points={area} fill="var(--accent)" opacity="0.12" />
                )}
                <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })()
        ) : (
          bars.map((c, i) => {
            const up = c.c >= c.o;
            const col = up ? UP : DOWN;
            const x = cx(i);
            const top = Math.min(yP(c.o), yP(c.c));
            const h = Math.max(Math.abs(yP(c.c) - yP(c.o)), 1);
            // 할로우 캔들: 상승봉은 속을 비운다(테두리만)
            const hollow = chartType === "hollow" && up;
            return (
              <g key={c.d}>
                <line x1={x} y1={yP(c.h)} x2={x} y2={yP(c.l)} stroke={col} strokeWidth="1" />
                <rect
                  x={x - bodyW / 2}
                  y={top}
                  width={bodyW}
                  height={h}
                  fill={hollow ? "none" : col}
                  stroke={col}
                  strokeWidth={hollow ? 1 : 0}
                />
              </g>
            );
          })
        )}

        {/* 현재가 라인 */}
        {last && (
          <g>
            <line x1={padL} y1={yP(last.c)} x2={W - padR} y2={yP(last.c)} stroke="var(--accent)" strokeWidth="0.8" strokeDasharray="3 3" />
            <rect x={W - padR + 1} y={yP(last.c) - 7} width={padR - 3} height={14} rx="3" fill="var(--accent)" />
            <text x={W - padR + 4} y={yP(last.c) + 3.5} fontSize="9.5" fill="#fff" fontWeight="700">
              {fmt(last.c)}
            </text>
          </g>
        )}

        {/* 사용자가 그린 선 */}
        {visibleLines.map((l) => (
          <g key={l.id}>
            <line
              x1={dx(l.x1)}
              y1={yP(l.y1)}
              x2={l.kind === "hline" ? W - padR : dx(l.x2)}
              y2={yP(l.kind === "hline" ? l.y1 : l.y2)}
              stroke="#f7b500"
              strokeWidth="1.6"
            />
            {l.kind === "hline" && (
              <text x={padL + 2} y={yP(l.y1) - 4} fontSize="9" fill="#f7b500">
                {fmt(l.y1)}
              </text>
            )}
          </g>
        ))}

        {/* 크로스헤어 — 손/마우스로 짚은 봉의 날짜·종가 표시 */}
        {hover != null && bars[hover] && (() => {
          const c = bars[hover];
          const x = cx(hover);
          const yc = yP(c.c);
          const dateLabel = `${c.d.slice(0, 4)}.${c.d.slice(4, 6)}.${c.d.slice(6, 8)}`;
          const boxW = 62;
          const bx = Math.max(padL, Math.min(x - boxW / 2, W - padR - boxW));
          return (
            <g pointerEvents="none">
              <line x1={x} y1={priceTop} x2={x} y2={volTop + volH} stroke="var(--muted)" strokeWidth="0.7" strokeDasharray="3 3" />
              <line x1={padL} y1={yc} x2={W - padR} y2={yc} stroke="var(--muted)" strokeWidth="0.7" strokeDasharray="3 3" />
              {/* 가격 라벨(오른쪽) */}
              <rect x={W - padR + 1} y={yc - 7} width={padR - 3} height={14} rx="3" fill="var(--text)" />
              <text x={W - padR + 4} y={yc + 3.5} fontSize="9.5" fill="var(--bg)" fontWeight="700">
                {fmt(c.c)}
              </text>
              {/* 날짜 라벨(하단) */}
              <rect x={bx} y={volTop + volH - 15} width={boxW} height={14} rx="3" fill="var(--text)" />
              <text x={bx + boxW / 2} y={volTop + volH - 5} fontSize="8.5" fill="var(--bg)" fontWeight="700" textAnchor="middle">
                {dateLabel}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* 짚은 봉의 OHLC — 크로스헤어 이동 시 상단에 시가/고가/저가/종가 */}
      {hover != null && bars[hover] && (
        <div className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 px-1 text-[10.5px] text-muted">
          {(
            [
              ["시", bars[hover].o],
              ["고", bars[hover].h],
              ["저", bars[hover].l],
              ["종", bars[hover].c],
            ] as [string, number][]
          ).map(([k, v]) => (
            <span key={k}>
              {k} <b className="text-text">{fmt(v)}</b>
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex items-center justify-between px-1 text-[10.5px] text-muted">
        <span>{view[0]?.d.slice(4, 6)}/{view[0]?.d.slice(6, 8)}</span>
        <span>
          {tool === "none"
            ? "드래그 이동 · 휠·두 손가락으로 확대"
            : "차트를 드래그해 선을 그으세요"}
          {" · "}
          {n}봉
        </span>
        <span>{last?.d.slice(4, 6)}/{last?.d.slice(6, 8)}</span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

// 가로 스크롤 스트립 — 데스크톱에서 좌우 화살표 + 마우스 휠(세로→가로) 지원.
export default function HScroll({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  // 렌더/리사이즈 시 화살표 표시 갱신
  useEffect(() => {
    update();
  });
  useEffect(() => {
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 세로 휠 → 가로 스크롤 (non-passive라 preventDefault 가능)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const scrollByX = (d: number) =>
    ref.current?.scrollBy({ left: d, behavior: "smooth" });

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className={`no-scrollbar overflow-x-auto ${className}`}>
        {children}
      </div>
      {canL && (
        <button
          onClick={() => scrollByX(-260)}
          aria-label="왼쪽으로"
          className="hscroll-arrow absolute left-1 top-1/2 z-10 h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-bg/95 text-text shadow-md backdrop-blur hover:bg-bg-soft"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {canR && (
        <button
          onClick={() => scrollByX(260)}
          aria-label="오른쪽으로"
          className="hscroll-arrow absolute right-1 top-1/2 z-10 h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-border bg-bg/95 text-text shadow-md backdrop-blur hover:bg-bg-soft"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { handleNoCredits } from "@/lib/nocredits";

interface StockBrief {
  name: string;
  symbol: string;
  price: string | null;
  changeRate: number | null;
  per: string | null;
  pbr: string | null;
  targetPrice: string | null;
  targetGap: number | null;
  peers: { name: string; per: string | null }[];
  valuation: "under" | "over" | "fair" | "unknown";
  about: string;
  points: string[];
  news: { title: string; link: string }[];
}

interface Result {
  kind: "youtube" | "article";
  url: string;
  title?: string;
  image?: string | null;
  thumbnail?: string;
  points: string[];
  briefs?: StockBrief[];
  scope?: string;
  segment?: number;
  duration?: number | null;
  hasMore?: boolean;
}

/** 구간별 요약 묶음 — 영상이 길면 10분씩 이어서 본다 */
interface Chunk {
  scope: string;
  points: string[];
}

export default function LinkSummary({
  isGuest = false,
  onRequireLogin,
  onSpend,
  onClose,
}: {
  isGuest?: boolean;
  onRequireLogin?: () => void;
  onSpend?: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [moreBusy, setMoreBusy] = useState(false);

  // segment를 지정하면 그 구간만 추가로 요약해 이어붙인다
  const run = async (segment = 0) => {
    if (isGuest) return onRequireLogin?.();
    const v = url.trim();
    if (!v || busy || moreBusy) return;
    const more = segment > 0;
    if (more) setMoreBusy(true);
    else {
      setBusy(true);
      setResult(null);
      setChunks([]);
    }
    setErr("");
    try {
      const d = await fetch("/api/link-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: v, segment }),
      }).then((r) => r.json());
      if (d.ok) {
        setResult(d as Result);
        setChunks((prev) => [
          ...prev,
          { scope: d.scope ?? "", points: (d.points ?? []) as string[] },
        ]);
      } else if (!handleNoCredits(d)) setErr(d.reason || "요약하지 못했어요.");
    } catch {
      setErr("네트워크 오류예요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
      setMoreBusy(false);
      onSpend?.();
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setUrl(t.trim());
    } catch {
      /* 권한 없으면 직접 입력하면 된다 */
    }
  };

  return (
    <div className="reader-enter fixed inset-0 z-[60] flex flex-col bg-bg">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <button
          onClick={onClose}
          aria-label="닫기"
          className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-bg-soft"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h2 className="text-[16px] font-extrabold text-text">링크 요약</h2>
        <span className="ml-auto text-[11.5px] text-muted">1회 25크레딧</span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <p className="text-[13.5px] leading-relaxed text-muted">
          유튜브 경제 영상이나 뉴스 기사 링크를 넣으면 핵심만 정리해 드려요.
        </p>

        <div className="mt-3 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run(0)}
            placeholder="https://youtube.com/... 또는 기사 주소"
            inputMode="url"
            className="min-w-0 flex-1 rounded-xl border border-border bg-bg-soft px-3.5 py-3 text-[14px] text-text outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            onClick={paste}
            className="shrink-0 rounded-xl border border-border px-3 text-[12.5px] font-bold text-muted hover:bg-bg-soft"
          >
            붙여넣기
          </button>
        </div>

        <button
          onClick={() => run(0)}
          disabled={busy || !url.trim()}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent to-[#7b3fe4] py-3 text-[14.5px] font-extrabold text-white disabled:opacity-50"
        >
          {busy ? (
            <>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              </svg>
              읽는 중… 영상은 30초쯤 걸려요
            </>
          ) : (
            "AI로 핵심 요약하기"
          )}
        </button>

        {err && !busy && (
          <div className="mt-3 rounded-xl border border-border bg-bg-soft p-3.5">
            <p className="text-[13px] leading-relaxed text-[var(--down)]">{err}</p>
            <p className="mt-1.5 text-[11.5px] text-muted">크레딧은 차감되지 않았어요.</p>
          </div>
        )}

        {result && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-bg-soft">
            {(result.thumbnail || result.image) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.thumbnail || (result.image as string)}
                alt=""
                className="h-[150px] w-full object-cover"
              />
            )}
            <div className="border-b border-border p-4">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10.5px] font-bold text-accent">
                  {result.kind === "youtube" ? "유튜브 영상" : "기사"}
                </span>
                {result.duration != null && (
                  <span className="text-[10.5px] text-muted">
                    총 {Math.floor(result.duration / 60)}분
                  </span>
                )}
              </div>
              {result.title && (
                <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-text">
                  {result.title}
                </h3>
              )}
            </div>

            {/* 구간별로 나눠 본 결과를 순서대로 이어붙인다 */}
            {chunks.map((c, ci) => (
              <div key={ci} className={ci > 0 ? "border-t border-border" : ""}>
                {c.scope && (
                  <div className="px-4 pt-3 text-[11px] font-bold text-muted">{c.scope}</div>
                )}
                <ul className="space-y-2.5 p-4 pt-2">
                  {c.points.map((p, i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-text">
                      <span className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {/* 영상에서 언급된 종목 분석 */}
            {result.kind === "youtube" && (result.segment ?? 0) === 0 && (
              result.briefs && result.briefs.length > 0 ? (
                <div className="border-t border-border p-4">
                  <div className="mb-2.5 text-[12px] font-bold text-accent">
                    영상에서 언급된 종목 <span className="font-normal text-muted">· 실제 지표·뉴스 근거</span>
                  </div>
                  <div className="space-y-3">
                    {result.briefs.map((b) => (
                      <BriefCard key={b.symbol} b={b} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-t border-border px-4 py-3.5">
                  <p className="text-[12px] leading-relaxed text-muted">
                    이 영상에서 <b className="text-text">분석할 상장 종목</b>을 찾지 못했어요.
                    시장·기술 위주이거나, 언급된 회사가 비상장(예: 오픈AI·딥시크)일 수 있어요.
                    개별 종목을 다룬 영상이면 관련 종목·PER·저평가/고평가까지 함께 보여드려요.
                  </p>
                </div>
              )
            )}

            {/* 뒤에 남은 구간이 있으면 이어서 볼 수 있다(구간마다 25크레딧) */}
            {result.hasMore && (
              <button
                onClick={() => run((result.segment ?? 0) + 1)}
                disabled={moreBusy}
                className="flex w-full items-center justify-center gap-2 border-t border-border py-3 text-[13px] font-bold text-accent disabled:opacity-50"
              >
                {moreBusy ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="spin">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    </svg>
                    다음 10분 읽는 중…
                  </>
                ) : (
                  `다음 10분 이어서 보기 · 25크레딧`
                )}
              </button>
            )}

            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-t border-border px-4 py-3 text-center text-[13px] font-bold text-accent"
            >
              원본 보기 ↗
            </a>
            <p className="bg-bg px-4 py-2.5 text-[11px] leading-relaxed text-muted">
              ※ 원본에 나온 내용만 정리했어요. 투자 권유가 아니며, 판단은 본인 책임입니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const UP = "#f6465d";
const DOWN = "#4b91f7";

function BriefCard({ b }: { b: StockBrief }) {
  const up = (b.changeRate ?? 0) > 0;
  const down = (b.changeRate ?? 0) < 0;
  const val =
    b.valuation === "under"
      ? { label: "저평가 신호", color: "#14c38e" }
      : b.valuation === "over"
        ? { label: "고평가 신호", color: "#f6465d" }
        : b.valuation === "fair"
          ? { label: "중립", color: "#8b96ad" }
          : null;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-extrabold text-text">{b.name}</span>
            <span className="shrink-0 text-[10.5px] text-muted">{b.symbol}</span>
          </div>
          {b.about && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted line-clamp-2">{b.about}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {b.price && (
            <div className="text-[13.5px] font-bold text-text">
              {b.price}
              {b.symbol.match(/^\d/) ? "원" : ""}
            </div>
          )}
          {b.changeRate != null && (
            <div className="text-[11.5px] font-bold" style={{ color: up ? UP : down ? DOWN : "var(--muted)" }}>
              {up ? "▲" : down ? "▼" : ""}
              {b.changeRate > 0 ? "+" : ""}
              {b.changeRate.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* 밸류에이션 지표 (전부 실데이터) */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 text-[11px]">
        {val && (
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: val.color + "22", color: val.color }}>
            {val.label}
          </span>
        )}
        {b.per && <span className="text-muted">PER <b className="text-text">{b.per}</b></span>}
        {b.pbr && <span className="text-muted">PBR <b className="text-text">{b.pbr}</b></span>}
        {b.targetGap != null && (
          <span className="text-muted">
            목표가 괴리 <b className="text-text">{b.targetGap > 0 ? "+" : ""}{b.targetGap.toFixed(0)}%</b>
          </span>
        )}
      </div>

      {b.points.length > 0 && (
        <ul className="space-y-1.5 p-3">
          {b.points.map((p, i) => {
            // [뉴스N-M] → 해당 기사로 연결
            const m = p.match(/\[뉴스\s*\d+-(\d+)\]/);
            const idx = m ? Number(m[1]) - 1 : -1;
            const art = idx >= 0 ? b.news[idx] : undefined;
            return (
              <li key={i} className="flex gap-1.5 text-[12.5px] leading-relaxed text-text">
                <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span>
                  {p.replace(/\s*\[뉴스\s*\d+-\d+\]\s*/g, " ").trim()}
                  {art && (
                    <a
                      href={art.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 whitespace-nowrap rounded bg-accent/15 px-1.5 py-px align-middle text-[10px] font-bold text-accent"
                    >
                      근거 ↗
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Article, Source } from "@/lib/types";
import type { User, Comment } from "@/lib/community";
import SourceAvatar from "./SourceAvatar";
import LikeButton from "./LikeButton";
import StockChart from "./StockChart";
import { timeAgo } from "@/lib/format";

interface ReaderData {
  ok: boolean;
  title?: string;
  image?: string | null;
  paragraphs?: string[];
  reason?: string;
}

// 타임아웃 있는 POST (AI 호출이 오래 걸리면 끊고 재시도 유도)
async function postJson(
  url: string,
  payload: unknown,
  ms = 33000,
): Promise<{ ok: boolean; reason?: string; timeout?: boolean; [k: string]: unknown }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ac.signal,
    });
    return await res.json();
  } catch (e) {
    const timeout = e instanceof DOMException && e.name === "AbortError";
    return { ok: false, timeout, reason: timeout ? "timeout" : "network" };
  } finally {
    clearTimeout(t);
  }
}

interface StockPick {
  name: string;
  ticker: string;
  market: string;
  sentiment: "positive" | "negative" | "neutral";
  reason: string;
  // 네이버 시세(분석 후 별도 로드)
  symbol?: string;
  domestic?: boolean;
  price?: string;
  changeRate?: number;
  currency?: string;
}

// 시세 색상 (한국 관례: 상승=빨강, 하락=파랑)
const PRICE_UP = "#f6465d";
const PRICE_DOWN = "#4b91f7";
function fmtStockPrice(price: string, currency: string): string {
  if (currency === "KRW") return `${price}원`;
  if (currency === "USD") return `$${price}`;
  return price;
}

function PersonIcon({ size = 26 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-bg-soft text-muted" style={{ width: size, height: size }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z" />
      </svg>
    </span>
  );
}

export default function ArticleReader({
  article,
  source,
  translate,
  user,
  onClose,
}: {
  article: Article;
  source: Source;
  translate: boolean;
  user: User;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReaderData | null>(null);
  const [imgOk, setImgOk] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [stateLoaded, setStateLoaded] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [koTitle, setKoTitle] = useState(article.title);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryErr, setSummaryErr] = useState("");
  const [stocks, setStocks] = useState<StockPick[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stocksErr, setStocksErr] = useState("");
  const [chartStock, setChartStock] = useState<StockPick | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);

  const isSocial = source.id === "truthsocial";
  const isAggregator = !!source.hidden; // 구글뉴스 등 집계 — 실제 URL 해석 후 추출 시도
  // 한/A 토글: 해외(영문 원문 ↔ 한국어)에만 노출. 국내·소셜·집계는 없음.
  const showLangToggle = source.region === "global" && !isSocial && !isAggregator;
  const [showKo, setShowKo] = useState(translate); // 리더별 번역 상태 (기본=피드 설정)
  const wantKo = isAggregator || (showLangToggle && showKo); // 본문을 한국어로 가져올지
  const translated = wantKo && source.region === "global" && !isAggregator;

  // 안전장치: 집계(구글뉴스) 헤드라인이 영어면 즉시 한국어로 번역
  useEffect(() => {
    if (isAggregator && !/[가-힣]/.test(article.title)) {
      const c = new AbortController();
      fetch(`/api/translate?q=${encodeURIComponent(article.title)}`, {
        signal: c.signal,
      })
        .then((r) => r.json())
        .then((d) => d.text && setKoTitle(d.text))
        .catch(() => {});
      return () => c.abort();
    }
    setKoTitle(article.title);
  }, [article.title, isAggregator]);
  const meta = { title: article.title, sourceId: source.id, image: article.image };

  // 본문(번역) — 소셜은 추출 없이 텍스트 그대로. 집계(구글뉴스)는 실제 URL 해석 후 추출.
  useEffect(() => {
    if (isSocial) {
      setData({ ok: true, paragraphs: [] });
      return;
    }
    const c = new AbortController();
    setData(null); // 언어 전환 시 로딩 표시
    // 집계는 항상 한국어, 그 외엔 한/A 토글에 따라
    const lang = wantKo ? "&lang=ko" : "";
    fetch(`/api/article?url=${encodeURIComponent(article.link)}${lang}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ ok: false, reason: "error" }));
    return () => c.abort();
  }, [article.link, wantKo, isSocial, isAggregator]);

  // 좋아요/댓글 상태
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/news/state?url=${encodeURIComponent(article.link)}`, { signal: c.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setLikeCount(d.likeCount ?? 0);
          setLiked(!!d.liked);
          setComments(d.comments ?? []);
        }
        setStateLoaded(true);
      })
      .catch(() => setStateLoaded(true));
    return () => c.abort();
  }, [article.link]);

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

  const title = (data?.ok && data.title) || article.title;
  const image = data?.ok ? data.image : article.image;
  const showImg = image && imgOk;

  // AI 요약 대상 본문 (소셜은 글 자체, 일반 기사는 추출된 본문)
  const bodyText = isSocial
    ? article.title
    : data?.ok && data.paragraphs
      ? data.paragraphs.join("\n")
      : "";
  const canSummarize = bodyText.trim().length >= 200;

  // 기사가 바뀌면 요약·종목분석 초기화
  useEffect(() => {
    setSummary(null);
    setSummarizing(false);
    setSummaryErr("");
    setStocks(null);
    setAnalyzing(false);
    setStocksErr("");
  }, [article.link]);

  const summarize = async () => {
    if (summarizing || !canSummarize) return;
    setSummarizing(true);
    setSummaryErr("");
    const d = await postJson("/api/summarize", { title, text: bodyText });
    if (d.ok) setSummary((d.summary as string[]) ?? []);
    else if (d.timeout)
      setSummaryErr("AI가 잠시 혼잡해요. 다시 시도해 주세요.");
    else setSummaryErr(d.reason || "요약에 실패했어요.");
    setSummarizing(false);
  };

  const analyze = async () => {
    if (analyzing || !canSummarize) return;
    setAnalyzing(true);
    setStocksErr("");
    const d = await postJson("/api/stocks", { title, text: bodyText });
    if (d.ok) {
      const picks = (d.stocks as StockPick[]) ?? [];
      setStocks(picks);
      // 시세는 별도 로드 후 병합 (실패해도 종목은 그대로 표시)
      fetch("/api/stock-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stocks: picks.map((s) => ({ name: s.name, ticker: s.ticker })),
        }),
      })
        .then((r) => r.json())
        .then((qd) => {
          if (!qd.ok || !Array.isArray(qd.quotes)) return;
          setStocks((prev) =>
            prev
              ? prev.map((s, i) => (qd.quotes[i] ? { ...s, ...qd.quotes[i] } : s))
              : prev,
          );
        })
        .catch(() => {});
    } else if (d.timeout) {
      setStocksErr("AI가 잠시 혼잡해요. 다시 시도해 주세요.");
    } else {
      setStocksErr(d.reason || "분석에 실패했어요.");
    }
    setAnalyzing(false);
  };

  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/news/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: article.link, body: text, meta }),
      });
      const d = await res.json();
      if (d.ok) {
        setComments((c) => [...c, d.comment]);
        setText("");
        setTimeout(() => listEnd.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } else alert(d.reason || "댓글 등록 실패");
    } finally {
      setBusy(false);
    }
  };

  const deleteComment = async (cid: string) => {
    if (!window.confirm("이 댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/news/comments/${cid}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) setComments((c) => c.filter((x) => x.id !== cid));
    else alert(d.reason || "삭제 실패");
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button onClick={onClose} aria-label="닫기" className="grid h-9 w-9 place-items-center rounded-full text-text hover:bg-bg-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SourceAvatar source={source} size={24} />
            <span className="truncate text-[14px] font-semibold text-text">{source.name}</span>
            <span className="shrink-0 text-[12px] text-muted">· {timeAgo(article.publishedAt)}</span>
          </div>
          {showLangToggle && (
            <button
              onClick={() => setShowKo((v) => !v)}
              aria-label="한국어 번역 전환"
              title={showKo ? "한국어로 보는 중 · 탭하면 원문(영어)" : "원문(영어)으로 보는 중 · 탭하면 한국어"}
              className="flex shrink-0 items-center gap-1 rounded-full bg-bg-soft px-2.5 py-1.5 text-[12.5px] font-black"
            >
              <span className={showKo ? "text-accent" : "text-muted"}>한</span>
              <span className="text-[11px] text-muted/50">/</span>
              <span className={!showKo ? "text-accent" : "text-muted"}>A</span>
            </button>
          )}
          <a href={article.link} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full bg-bg-soft px-3 py-1.5 text-[12px] font-semibold text-muted hover:text-text">
            원문 ↗
          </a>
        </header>

        <div className="flex-1 overflow-y-auto">
          <article className="px-5 pt-4">
            {isSocial ? (
              <p className="whitespace-pre-wrap text-[18px] font-medium leading-[1.7] text-text">
                {article.title}
              </p>
            ) : (
              <h1 className="text-[22px] font-extrabold leading-snug text-text">
                {isAggregator ? koTitle : title}
              </h1>
            )}
            {translated && (
              <div className="mt-2 flex items-center gap-1.5 text-[12px] text-accent">
                <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold">한국어 번역</span>
              </div>
            )}

            {/* AI 요약 */}
            {canSummarize && (
              <div className="mt-4">
                {!summary && (
                  <button
                    onClick={summarize}
                    disabled={summarizing}
                    className="flex items-center gap-2 rounded-full bg-accent/15 px-4 py-2 text-[13.5px] font-bold text-accent transition-colors hover:bg-accent/25 disabled:opacity-70"
                  >
                    {summarizing ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      </svg>
                    ) : (
                      <SparkleIcon />
                    )}
                    {summarizing ? "AI가 핵심만 요약하는 중…" : "AI 요약 · 핵심만 보기"}
                  </button>
                )}
                {summaryErr && !summarizing && (
                  <p className="mt-2 text-[13px] text-[var(--down)]">
                    {summaryErr}{" "}
                    <button onClick={summarize} className="font-semibold underline">
                      다시 시도
                    </button>
                  </p>
                )}
                {summary && (
                  <div className="rounded-2xl border border-accent/25 bg-accent/[0.08] p-4">
                    <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-accent">
                      <SparkleIcon /> AI 요약
                    </div>
                    <ul className="space-y-2.5">
                      {summary.map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-text">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 text-[11px] text-muted">
                      AI가 생성한 요약이라 원문과 다를 수 있어요.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI 관련 종목 분석 */}
            {canSummarize && (
              <div className="mt-2.5">
                {!stocks && (
                  <button
                    onClick={analyze}
                    disabled={analyzing}
                    className="flex items-center gap-2 rounded-full bg-[#14c38e]/15 px-4 py-2 text-[13.5px] font-bold text-[#14c38e] transition-colors hover:bg-[#14c38e]/25 disabled:opacity-70"
                  >
                    {analyzing ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      </svg>
                    ) : (
                      <ChartIcon />
                    )}
                    {analyzing ? "AI가 관련 종목 분석 중…" : "AI 관련 종목 분석"}
                  </button>
                )}
                {stocksErr && !analyzing && (
                  <p className="mt-2 text-[13px] text-[var(--down)]">
                    {stocksErr}{" "}
                    <button onClick={analyze} className="font-semibold underline">
                      다시 시도
                    </button>
                  </p>
                )}
                {stocks && (
                  <div className="rounded-2xl border border-border bg-bg-soft/60 p-4">
                    <div className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-text">
                      <ChartIcon /> AI 관련 종목
                    </div>
                    {stocks.length === 0 ? (
                      <p className="text-[14px] leading-relaxed text-muted">
                        이 뉴스와 뚜렷하게 연관된 종목을 찾지 못했어요.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {stocks.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => setChartStock(s)}
                            className="group -mx-2 flex w-[calc(100%+1rem)] items-start gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-bg active:bg-bg"
                          >
                            <SentimentBadge sentiment={s.sentiment} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                <span className="text-[15px] font-bold text-text group-hover:underline">
                                  {s.name}
                                </span>
                                {s.price && (
                                  <span className="text-[14px] font-bold text-text">
                                    {fmtStockPrice(s.price, s.currency || "")}
                                  </span>
                                )}
                                {s.price && typeof s.changeRate === "number" && (
                                  <span
                                    className="text-[12px] font-bold"
                                    style={{
                                      color:
                                        s.changeRate > 0
                                          ? PRICE_UP
                                          : s.changeRate < 0
                                            ? PRICE_DOWN
                                            : "var(--muted)",
                                    }}
                                  >
                                    {s.changeRate > 0 ? "▲" : s.changeRate < 0 ? "▼" : ""}
                                    {s.changeRate > 0 ? "+" : ""}
                                    {s.changeRate.toFixed(2)}%
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                                {s.ticker && <span>{s.ticker}</span>}
                                {s.market && <span>· {s.market}</span>}
                                <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                                  차트 보기
                                </span>
                              </div>
                              {s.reason && (
                                <p className="mt-1 text-[13px] leading-relaxed text-muted">
                                  {s.reason}
                                </p>
                              )}
                            </div>
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="mt-1 shrink-0 text-muted group-hover:text-text"
                            >
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted">
                      AI 분석이며 투자 권유가 아니에요. 투자 판단·책임은 본인에게 있어요.
                    </div>
                  </div>
                )}
              </div>
            )}

            {showImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image as string} alt="" onError={() => setImgOk(false)} className="mt-4 w-full rounded-xl object-cover" />
            )}
            {isSocial ? null : !data ? (
              <Loading message="본문을 가져와 한국어로 번역하는 중…" />
            ) : data.ok && data.paragraphs && data.paragraphs.length > 0 ? (
              <div className="mt-5 space-y-4">
                {data.paragraphs.map((p, i) => (
                  <p key={i} className="text-[16px] leading-[1.75] text-text">{p}</p>
                ))}
              </div>
            ) : isAggregator ? (
              <div className="mt-5">
                <p className="text-[14px] leading-relaxed text-muted">
                  이 기사는 앱 안에서 본문을 가져오지 못했어요. 원문에서 전체
                  기사를 볼 수 있어요.
                </p>
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
                >
                  기사 전체 보기 ↗
                </a>
              </div>
            ) : (
              <Fallback summary={article.summary} link={article.link} />
            )}
          </article>

          {/* 좋아요 / 댓글 요약 바 */}
          <div className="mt-5 flex items-center gap-5 border-y border-border px-5 py-3">
            <LikeButton
              targetType="news"
              targetId={article.link}
              meta={meta}
              initialLiked={liked}
              initialCount={likeCount}
            />
            <span className="flex items-center gap-1 text-[13px] font-semibold text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0z" />
              </svg>
              {comments.length}
            </span>
          </div>

          {/* 댓글 */}
          <div className="px-5 py-3">
            <div className="mb-2 text-[14px] font-bold text-text">
              이 뉴스에 대한 의견 {comments.length}
            </div>
            {!stateLoaded ? (
              <div className="py-6 text-center text-[13px] text-muted">불러오는 중…</div>
            ) : comments.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted">첫 의견을 남겨보세요.</div>
            ) : (
              comments.map((c) => {
                const canDel = user.isAdmin || (!!c.userId && c.userId === user.id);
                return (
                  <div key={c.id} className="flex gap-2 border-b border-border py-3">
                    <PersonIcon size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-text">{c.nickname}</span>
                        <span className="text-[11px] text-muted">{timeAgo(c.createdAt)}</span>
                        {canDel && (
                          <button onClick={() => deleteComment(c.id)} className="ml-auto shrink-0 text-muted hover:text-[#f6465d]" aria-label="댓글 삭제">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-text">{c.body}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={listEnd} />
          </div>
        </div>

        {/* 의견 입력 */}
        <div className="border-t border-border bg-bg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={2000}
              placeholder="이 뉴스에 대한 의견을 남겨보세요…"
              className="min-w-0 flex-1 rounded-full border border-border bg-bg-soft px-4 py-2.5 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
            />
            <button onClick={send} disabled={!text.trim() || busy} className="shrink-0 rounded-full bg-accent px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-40">
              등록
            </button>
          </div>
        </div>
      </div>

      {chartStock && (
        <StockChart
          name={chartStock.name}
          ticker={chartStock.ticker}
          market={chartStock.market}
          symbol={chartStock.symbol}
          domestic={chartStock.domestic}
          price={chartStock.price}
          changeRate={chartStock.changeRate}
          currency={chartStock.currency}
          onClose={() => setChartStock(null)}
        />
      )}
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
      <path d="M19 14l.8 2.3L22 17l-2.2.7L19 20l-.8-2.3L16 17l2.2-.7L19 14z" opacity="0.7" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 14l3.5-3.5 3 3L21 7" />
    </svg>
  );
}

function SentimentBadge({
  sentiment,
}: {
  sentiment: "positive" | "negative" | "neutral";
}) {
  const map = {
    positive: { label: "호재", color: "#14c38e", mark: "▲" },
    negative: { label: "악재", color: "#f6465d", mark: "▼" },
    neutral: { label: "중립", color: "#8b96ad", mark: "―" },
  } as const;
  const m = map[sentiment] ?? map.neutral;
  return (
    <span
      className="mt-0.5 flex h-[26px] w-[46px] shrink-0 items-center justify-center gap-0.5 rounded-md text-[11px] font-bold"
      style={{ color: m.color, backgroundColor: `${m.color}22` }}
    >
      <span className="text-[9px]">{m.mark}</span>
      {m.label}
    </span>
  );
}

function Loading({ message }: { message: string }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 py-10 text-muted">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="spin">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      </svg>
      <span className="text-[14px]">{message}</span>
    </div>
  );
}

function Fallback({ summary, link }: { summary: string; link: string }) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-bg-soft p-5 text-center">
      <p className="text-[15px] font-semibold text-text">이 매체는 앱 안에서 본문을 불러올 수 없어요</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">(유료 구독이거나 외부 접근을 막은 사이트예요)</p>
      {summary && <p className="mt-4 text-left text-[14px] leading-relaxed text-muted">{summary}</p>}
      <a href={link} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white">
        원문에서 보기 ↗
      </a>
    </div>
  );
}

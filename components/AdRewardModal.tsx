"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 광고 네트워크는 환경변수로 교체 가능. 없으면 자리표시자(연동 전 안내)를 보여준다.
const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
const AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || "";

type Phase = "intro" | "watching" | "done" | "error";

export default function AdRewardModal({
  open,
  onClose,
  onGranted,
}: {
  open: boolean;
  onClose: () => void;
  onGranted?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [left, setLeft] = useState(0);
  const [ticket, setTicket] = useState("");
  const [reward, setReward] = useState(25);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  // 열릴 때마다 초기화 + 남은 횟수 조회
  useEffect(() => {
    if (!open) return;
    setPhase("intro");
    setMsg("");
    setTicket("");
    fetch("/api/ad-reward", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setRemaining(d.remaining ?? null);
          setReward(d.reward ?? 25);
        } else if (d.reason === "not-ready") {
          setPhase("error");
          setMsg("광고 보상 기능이 아직 준비되지 않았어요.");
        }
      })
      .catch(() => {});
    return stopTimer;
  }, [open]);

  // AdSense 슬롯 주입 (설정된 경우에만)
  useEffect(() => {
    if (phase !== "watching" || !AD_CLIENT) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      /* 광고 실패해도 시청 흐름은 유지 */
    }
  }, [phase]);

  const start = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const d = await fetch("/api/ad-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      }).then((r) => r.json());
      if (!d.ok) {
        setPhase("error");
        setMsg(d.reason || "광고를 불러오지 못했어요.");
        return;
      }
      setTicket(d.ticket);
      setReward(d.reward ?? 25);
      setLeft(d.watchSeconds ?? 15);
      setPhase("watching");
      stopTimer();
      timer.current = setInterval(() => {
        setLeft((v) => {
          if (v <= 1) {
            stopTimer();
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } catch {
      setPhase("error");
      setMsg("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const claim = useCallback(async () => {
    if (busy || !ticket) return;
    setBusy(true);
    try {
      const d = await fetch("/api/ad-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", ticket }),
      }).then((r) => r.json());
      if (d.ok) {
        setPhase("done");
        setReward(d.granted ?? reward);
        setRemaining(d.remaining ?? null);
        onGranted?.();
      } else {
        setPhase("error");
        setMsg(d.reason || "크레딧을 지급하지 못했어요.");
      }
    } catch {
      setPhase("error");
      setMsg("네트워크 오류예요.");
    } finally {
      setBusy(false);
    }
  }, [busy, ticket, reward, onGranted]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-border bg-bg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 안내 */}
        {phase === "intro" && (
          <div className="p-5 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-accent/15 text-accent">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="15" rx="2.5" />
                <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h3 className="text-[17px] font-extrabold text-text">크레딧이 부족해요</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
              광고를 끝까지 보면 <b className="text-accent">크레딧 {reward}</b>을 드려요.
              {remaining !== null && (
                <>
                  <br />
                  오늘 <b className="text-text">{remaining}번</b> 더 받을 수 있어요.
                </>
              )}
            </p>
            <button
              onClick={start}
              disabled={busy || remaining === 0}
              className="mt-4 w-full rounded-xl bg-accent py-3 text-[14.5px] font-extrabold text-white disabled:opacity-50"
            >
              {remaining === 0 ? "오늘 한도를 다 썼어요" : busy ? "광고 준비 중…" : "광고 보고 크레딧 받기"}
            </button>
            <a
              href="/pricing"
              className="mt-2 block w-full rounded-xl border border-border py-3 text-[13.5px] font-bold text-muted"
            >
              프로로 광고 없이 이용하기
            </a>
            <button onClick={onClose} className="mt-3 text-[12.5px] text-muted underline">
              닫기
            </button>
          </div>
        )}

        {/* 시청 */}
        {phase === "watching" && (
          <div>
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="text-[12px] font-bold text-muted">광고</span>
              <span className="ml-auto text-[12px] font-bold text-accent">
                {left > 0 ? `${left}초 후 지급` : "시청 완료"}
              </span>
              {/* ⚠️ 애드센스 보상형 광고 정책: 사용자가 언제든 쉽게 나갈 수 있어야 한다.
                  중간에 나가면 크레딧은 지급되지 않는다(서버가 경과 시간을 검증). */}
              <button
                onClick={onClose}
                aria-label="광고 닫기"
                className="-mr-1 grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-bg-soft hover:text-text"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 광고 영역 */}
            <div className="grid min-h-[220px] place-items-center bg-bg-soft p-4">
              {AD_CLIENT && AD_SLOT ? (
                <ins
                  className="adsbygoogle"
                  style={{ display: "block", width: "100%", minHeight: 200 }}
                  data-ad-client={AD_CLIENT}
                  data-ad-slot={AD_SLOT}
                  data-ad-format="auto"
                  data-full-width-responsive="true"
                />
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-2 h-10 w-10 animate-pulse rounded-lg bg-border" />
                  <p className="text-[12.5px] font-bold text-text">광고 자리</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                    아직 광고 네트워크가 연결되지 않았어요.
                    <br />
                    연결 전에도 보상 흐름은 그대로 동작합니다.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4">
              <button
                onClick={claim}
                disabled={left > 0 || busy}
                className="w-full rounded-xl bg-accent py-3 text-[14.5px] font-extrabold text-white disabled:opacity-40"
              >
                {left > 0 ? `${left}초 남았어요` : busy ? "지급 중…" : `크레딧 ${reward} 받기`}
              </button>
            </div>
          </div>
        )}

        {/* 완료 */}
        {phase === "done" && (
          <div className="p-5 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-[#14c38e]/15 text-[#14c38e]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="text-[17px] font-extrabold text-text">
              크레딧 {reward} 지급 완료
            </h3>
            {remaining !== null && (
              <p className="mt-1.5 text-[13px] text-muted">
                오늘 {remaining}번 더 받을 수 있어요.
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-xl bg-accent py-3 text-[14.5px] font-extrabold text-white"
            >
              이어서 이용하기
            </button>
          </div>
        )}

        {/* 오류 */}
        {phase === "error" && (
          <div className="p-5 text-center">
            <p className="text-[14px] font-bold text-text">{msg}</p>
            <a
              href="/pricing"
              className="mt-4 block w-full rounded-xl bg-accent py-3 text-[14px] font-bold text-white"
            >
              프로 보러가기
            </a>
            <button onClick={onClose} className="mt-3 text-[12.5px] text-muted underline">
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

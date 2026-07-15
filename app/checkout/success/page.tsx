"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

type Status = "loading" | "ok" | "fail";

export default function CheckoutSuccessPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode 이중호출 방지
    ran.current = true;
    const p = new URLSearchParams(window.location.search);
    const paymentKey = p.get("paymentKey");
    const orderId = p.get("orderId");
    const amount = p.get("amount");
    if (!paymentKey || !orderId || !amount) {
      setStatus("fail");
      setMsg("결제 정보가 없어요.");
      return;
    }
    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setStatus("ok");
          setCredits(d.addedCredits ?? null);
        } else {
          setStatus("fail");
          setMsg(d.reason || "결제 승인에 실패했어요.");
        }
      })
      .catch(() => {
        setStatus("fail");
        setMsg("결제 승인 중 오류가 생겼어요.");
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-text">
      <div className="w-full max-w-[400px] text-center">
        <div className="mb-6 flex justify-center">
          <LogoMark size={40} />
        </div>

        {status === "loading" && (
          <>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" className="spin mx-auto">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            </svg>
            <p className="mt-4 text-[15px] font-bold">결제를 승인하는 중이에요…</p>
            <p className="mt-1 text-[13px] text-muted">잠시만 기다려 주세요.</p>
          </>
        )}

        {status === "ok" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="mt-5 text-[22px] font-extrabold">프로 결제 완료 🎉</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">
              이제 저평가·고평가 종목 분석까지 모두 열렸어요.
              {credits != null && (
                <>
                  <br />
                  크레딧 <b className="text-accent">{credits.toLocaleString()}</b>도 충전됐어요.
                </>
              )}
            </p>
            <Link
              href="/"
              className="mt-6 inline-block w-full rounded-xl bg-accent py-3.5 text-[15px] font-extrabold text-white hover:opacity-90"
            >
              앱으로 돌아가기
            </Link>
          </>
        )}

        {status === "fail" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#f6465d]/15 text-[#f6465d]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mt-5 text-[20px] font-extrabold">결제를 완료하지 못했어요</h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{msg}</p>
            <Link
              href="/checkout"
              className="mt-6 inline-block w-full rounded-xl bg-accent py-3.5 text-[15px] font-extrabold text-white hover:opacity-90"
            >
              다시 시도하기
            </Link>
            <Link href="/" className="mt-3 inline-block text-[13px] text-muted underline">
              앱으로 돌아가기
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

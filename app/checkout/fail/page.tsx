"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function CheckoutFailPage() {
  const [msg, setMsg] = useState("결제가 취소되었거나 실패했어요.");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const m = p.get("message");
    if (m) setMsg(m);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-text">
      <div className="w-full max-w-[400px] text-center">
        <div className="mb-6 flex justify-center">
          <LogoMark size={40} />
        </div>
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
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PRO_PLAN, TOSS_CLIENT_KEY, TOSS_TEST_MODE } from "@/lib/plan";

interface Me {
  id: string;
  username: string;
  isPro?: boolean;
}
interface Sub {
  status: string;
  next_charge_at: string;
  amount: number;
}
interface TossInstance {
  payment(o: { customerKey: string }): {
    requestBillingAuth(o: Record<string, unknown>): Promise<void>;
  };
}

function loadToss(): Promise<(key: string) => TossInstance> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { TossPayments?: (k: string) => TossInstance };
    if (w.TossPayments) return resolve(w.TossPayments);
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v2/standard";
    s.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error("no sdk")));
    s.onerror = () => reject(new Error("sdk load fail"));
    document.head.appendChild(s);
  });
}

const PRO_FEATURES = [
  "저평가·고평가 종목 잠금 해제",
  "매월 10,000 크레딧 자동 충전 (AI 약 400회)",
  "AI 요약 · 종목분석 · 시장분석 넉넉하게",
  "우선 응답",
];

function fmtDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, ". ");
}

export default function CheckoutPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user ?? null))
      .catch(() => setMe(null));
  }, []);

  const loadSub = useCallback(() => {
    fetch("/api/billing/subscription", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSub(d.subscription ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (me?.isPro) loadSub();
  }, [me, loadSub]);

  const start = async () => {
    if (busy || !me) return;
    setBusy(true);
    setErr("");
    try {
      const TossPayments = await loadToss();
      const toss = TossPayments(TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: `user_${me.id}` });
      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/checkout/billing-success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: me.username,
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "USER_CANCEL" && code !== "PAY_PROCESS_CANCELED") {
        setErr("결제창을 여는 중 문제가 생겼어요. 다시 시도해 주세요.");
      }
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (canceling) return;
    if (!window.confirm("정기결제를 해지할까요? 남은 기간까지는 계속 이용할 수 있어요.")) return;
    setCanceling(true);
    try {
      const d = await fetch("/api/billing/subscription", { method: "DELETE" }).then((r) => r.json());
      if (d.ok) loadSub();
      else alert(d.reason || "해지에 실패했어요.");
    } finally {
      setCanceling(false);
    }
  };

  return (
    <main className="min-h-screen bg-bg text-text">
      <header className="mx-auto flex max-w-[560px] items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark size={30} />
          <span className="text-[18px] font-extrabold tracking-tight">
            <span className="text-text">New</span>
            <span className="text-accent">sync</span>
          </span>
        </Link>
        <Link href="/pricing" className="rounded-full border border-border px-3.5 py-1.5 text-[13px] font-semibold text-muted hover:text-text">
          요금제
        </Link>
      </header>

      <div className="mx-auto max-w-[440px] px-5 pb-20 pt-4">
        <h1 className="text-[24px] font-extrabold tracking-tight">프로 구독</h1>
        <p className="mt-1 text-[14px] text-muted">
          매월 자동결제로 프로 기능을 끊김 없이 이용하세요.
        </p>

        {TOSS_TEST_MODE && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f7b500]/40 bg-[#f7b500]/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-[#f7b500]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            <span>
              <b>테스트 결제 모드</b>예요. 실제로 돈이 빠져나가지 않아요. 카드번호 앞 6~8자리만 맞으면 나머지는 아무렇게나 입력해도 가상 승인됩니다.
            </span>
          </div>
        )}

        {/* 주문 카드 */}
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[17px] font-extrabold">Newsync 프로</div>
              <div className="mt-0.5 text-[12.5px] text-muted">매월 자동결제 · 언제든 해지</div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-extrabold">
                {PRO_PLAN.amount.toLocaleString()}
                <span className="text-[14px] font-bold text-muted">원</span>
              </div>
              <div className="text-[11.5px] text-muted">/ 월</div>
            </div>
          </div>
          <ul className="mt-4 space-y-2 border-t border-border pt-4">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[13.5px] leading-snug">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {err && <p className="mt-4 text-center text-[13px] text-[#f6465d]">{err}</p>}

        {/* 상태별 */}
        {me === undefined ? (
          <div className="mt-5 h-[52px] w-full animate-pulse rounded-xl bg-bg-soft" />
        ) : me === null ? (
          <div className="mt-5 rounded-xl border border-border bg-bg-soft p-4 text-center">
            <p className="text-[14px] font-bold">로그인이 필요해요</p>
            <p className="mt-1 text-[12.5px] text-muted">프로 결제는 로그인 후 이용할 수 있어요.</p>
            <Link href="/" className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white">
              로그인하러 가기
            </Link>
          </div>
        ) : me.isPro ? (
          <div className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.08] p-4 text-center">
            <p className="text-[14px] font-bold text-accent">프로 이용 중이에요 🎉</p>
            {sub && sub.status === "active" && (
              <p className="mt-1 text-[12.5px] text-muted">
                다음 결제일 {fmtDate(sub.next_charge_at)}
              </p>
            )}
            {sub && sub.status === "canceled" && (
              <p className="mt-1 text-[12.5px] text-muted">
                해지됨 · {fmtDate(sub.next_charge_at)}까지 이용 가능
              </p>
            )}
            <Link href="/" className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white">
              앱으로 돌아가기
            </Link>
            {sub && sub.status === "active" && (
              <button
                onClick={cancel}
                disabled={canceling}
                className="mt-3 block w-full text-[12.5px] text-muted underline disabled:opacity-50"
              >
                {canceling ? "해지 중…" : "정기결제 해지"}
              </button>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={start}
              disabled={busy}
              className="mt-5 w-full rounded-xl bg-accent py-3.5 text-[15.5px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "결제창을 여는 중…" : "카드 등록하고 프로 시작하기"}
            </button>
            <p className="mt-4 text-center text-[11.5px] leading-relaxed text-muted">
              카드를 한 번 등록하면 매월 {PRO_PLAN.amount.toLocaleString()}원이 자동 결제돼요.
              <br />
              언제든 해지할 수 있고, 결제는 토스페이먼츠로 안전하게 처리돼요.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

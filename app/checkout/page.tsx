"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PRO_PLAN, TOSS_CLIENT_KEY, TOSS_TEST_MODE } from "@/lib/plan";

interface Me {
  id: string;
  username: string;
  isPro?: boolean;
}

interface TossWidgets {
  setAmount(a: { currency: string; value: number }): Promise<void>;
  renderPaymentMethods(o: { selector: string; variantKey: string }): Promise<unknown>;
  renderAgreement(o: { selector: string; variantKey: string }): Promise<unknown>;
  requestPayment(o: Record<string, unknown>): Promise<void>;
}
interface TossInstance {
  widgets(o: { customerKey: string }): TossWidgets;
}

// 토스 v2 표준 SDK 로더
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
  "10,000 크레딧 매월 충전 (AI 약 400회)",
  "AI 요약 · 종목분석 · 시장분석 넉넉하게",
  "우선 응답",
];

export default function CheckoutPage() {
  const [me, setMe] = useState<Me | null | undefined>(undefined); // undefined=로딩
  const [ready, setReady] = useState(false); // 결제위젯 렌더 완료
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const widgetsRef = useRef<TossWidgets | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMe(d.user ?? null))
      .catch(() => setMe(null));
  }, []);

  // 로그인 + 비프로일 때만 결제위젯 렌더
  useEffect(() => {
    if (!me || me.isPro) return;
    let cancelled = false;
    (async () => {
      const TossPayments = await loadToss();
      if (cancelled) return;
      const toss = TossPayments(TOSS_CLIENT_KEY);
      const widgets = toss.widgets({ customerKey: `user_${me.id}` });
      await widgets.setAmount({ currency: "KRW", value: PRO_PLAN.amount });
      await Promise.all([
        widgets.renderPaymentMethods({ selector: "#payment-method", variantKey: "DEFAULT" }),
        widgets.renderAgreement({ selector: "#agreement", variantKey: "AGREEMENT" }),
      ]);
      if (cancelled) return;
      widgetsRef.current = widgets;
      setReady(true);
    })().catch(() => {
      if (!cancelled) setErr("결제 UI를 불러오지 못했어요. 새로고침 해주세요.");
    });
    return () => {
      cancelled = true;
    };
  }, [me]);

  const pay = async () => {
    if (busy || !ready || !widgetsRef.current || !me) return;
    setBusy(true);
    setErr("");
    try {
      const orderId = `newsync-${crypto.randomUUID()}`;
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: PRO_PLAN.orderName,
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: me.username,
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "USER_CANCEL" && code !== "PAY_PROCESS_CANCELED") {
        setErr("결제 진행 중 문제가 생겼어요. 다시 시도해 주세요.");
      }
      setBusy(false);
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
        <Link
          href="/pricing"
          className="rounded-full border border-border px-3.5 py-1.5 text-[13px] font-semibold text-muted hover:text-text"
        >
          요금제
        </Link>
      </header>

      <div className="mx-auto max-w-[460px] px-5 pb-20 pt-4">
        <h1 className="text-[24px] font-extrabold tracking-tight">프로 결제</h1>
        <p className="mt-1 text-[14px] text-muted">
          AI를 마음껏 쓰고 저평가·고평가 종목까지 열어보세요.
        </p>

        {TOSS_TEST_MODE && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#f7b500]/40 bg-[#f7b500]/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-[#f7b500]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            <span>
              <b>테스트 결제 모드</b>예요. 실제로 돈이 빠져나가지 않아요. 아무 카드번호나 넣어도 가상 승인됩니다.
            </span>
          </div>
        )}

        {/* 주문 카드 */}
        <div className="mt-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[17px] font-extrabold">Newsync 프로</div>
              <div className="mt-0.5 text-[12.5px] text-muted">월 구독 · 언제든 해지</div>
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
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-[15px]">
            <span className="font-bold">최종 결제 금액</span>
            <span className="text-[18px] font-extrabold text-accent">
              {PRO_PLAN.amount.toLocaleString()}원
            </span>
          </div>
        </div>

        {/* 상태별 영역 */}
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
            <p className="text-[14px] font-bold text-accent">이미 프로 이용 중이에요 🎉</p>
            <Link href="/" className="mt-3 inline-block rounded-full bg-accent px-5 py-2.5 text-[13.5px] font-bold text-white">
              앱으로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            {/* 토스 결제위젯 (결제수단 + 약관) */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
              <div id="payment-method" />
              <div id="agreement" />
            </div>

            {!ready && !err && (
              <div className="mt-3 flex items-center justify-center gap-2 py-2 text-[13px] text-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                </svg>
                결제 수단을 불러오는 중…
              </div>
            )}
            {err && <p className="mt-4 text-center text-[13px] text-[#f6465d]">{err}</p>}

            <button
              onClick={pay}
              disabled={busy || !ready}
              className="mt-4 w-full rounded-xl bg-accent py-3.5 text-[15.5px] font-extrabold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "결제 진행 중…" : `${PRO_PLAN.amount.toLocaleString()}원 결제하기`}
            </button>
          </>
        )}

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-muted">
          결제 시 이용약관 및 개인정보처리방침에 동의하게 됩니다.
          <br />
          카드결제는 토스페이먼츠를 통해 안전하게 처리돼요.
        </p>
      </div>
    </main>
  );
}

import "server-only";

// 정기결제(빌링)용 시크릿 키. 서버 전용. 미설정이면 토스 문서용 테스트 키.
const TOSS_SECRET_KEY =
  process.env.TOSS_SECRET_KEY || "test_sk_5OWRapdA8dYwzX15xxA3o1zEqZKL";

const API = "https://api.tosspayments.com/v1";

function authHeader(): string {
  return "Basic " + Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
}

/**
 * 클라이언트 키와 시크릿 키의 짝이 맞는지 검사.
 * ⚠️ 실제 키로 바꿀 때 둘 중 하나만 바꾸는 실수가 잦은데, 그러면
 *    "결제창은 떴는데 승인이 안 되는" / "테스트 결제인데 프로가 켜지는" 사고가 난다.
 *    토스는 클라이언트·시크릿을 같은 상점의 같은 모드로 써야 한다.
 */
export function tossKeyStatus(): {
  ok: boolean;
  live: boolean;
  reason?: string;
} {
  const client = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  const secret = process.env.TOSS_SECRET_KEY || "";

  // 둘 다 미설정 = 개발용 테스트 키로 동작 (정상)
  if (!client && !secret) return { ok: true, live: false };

  if (!client || !secret) {
    return {
      ok: false,
      live: false,
      reason: !client
        ? "NEXT_PUBLIC_TOSS_CLIENT_KEY가 없습니다(시크릿만 설정됨)."
        : "TOSS_SECRET_KEY가 없습니다(클라이언트 키만 설정됨).",
    };
  }

  const clientLive = client.startsWith("live_");
  const secretLive = secret.startsWith("live_");
  if (clientLive !== secretLive) {
    return {
      ok: false,
      live: false,
      reason: "클라이언트 키와 시크릿 키의 모드(test/live)가 다릅니다.",
    };
  }
  return { ok: true, live: clientLive };
}

export interface TossResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

// authKey + customerKey → 빌링키 발급
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<TossResult> {
  const res = await fetch(`${API}/billing/authorizations/issue`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ authKey, customerKey }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// 빌링키로 실제 결제(승인)
export async function chargeBilling(
  billingKey: string,
  opts: {
    customerKey: string;
    amount: number;
    orderId: string;
    orderName: string;
    customerName?: string;
  },
): Promise<TossResult> {
  const res = await fetch(`${API}/billing/${billingKey}`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      customerKey: opts.customerKey,
      amount: opts.amount,
      orderId: opts.orderId,
      orderName: opts.orderName,
      customerName: opts.customerName,
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

import "server-only";

// 정기결제(빌링)용 시크릿 키. 서버 전용. 미설정이면 토스 문서용 테스트 키.
const TOSS_SECRET_KEY =
  process.env.TOSS_SECRET_KEY || "test_sk_5OWRapdA8dYwzX15xxA3o1zEqZKL";

const API = "https://api.tosspayments.com/v1";

function authHeader(): string {
  return "Basic " + Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
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

// 프로 멤버십 + 토스 클라이언트 설정 (클라이언트/서버 공용 — 시크릿 없음)
export const PRO_PLAN = {
  amount: 4900, // 원 / 월
  credits: 10000, // 결제(및 매월 갱신)마다 충전되는 크레딧
  orderName: "Newsync 프로 멤버십",
};

// 정기결제(빌링)용 'API 개별 연동' 클라이언트 키. 공개값.
// 미설정이면 토스 '문서용' 테스트 키로 동작(실제 청구 없음).
export const TOSS_CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ||
  "test_ck_ALnQvDd2VJYmLewOane3Mj7X41mN";

export const TOSS_TEST_MODE = TOSS_CLIENT_KEY.startsWith("test_");

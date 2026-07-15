// 프로 멤버십 + 토스 클라이언트 설정 (클라이언트/서버 공용 — 시크릿 없음)
export const PRO_PLAN = {
  amount: 4900, // 원
  credits: 10000, // 결제 시 충전되는 크레딧
  orderName: "Newsync 프로 멤버십",
};

// 클라이언트 키는 공개값. 미설정이면 토스 '문서용' 테스트 키로 동작.
export const TOSS_CLIENT_KEY =
  process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ||
  "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

// 테스트 키(test_)면 실제 청구가 없는 테스트 모드
export const TOSS_TEST_MODE = TOSS_CLIENT_KEY.startsWith("test_");

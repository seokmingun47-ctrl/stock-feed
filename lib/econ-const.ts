// 경제 캘린더의 순수 상수 — 클라이언트/서버 공용.
//
// lib/econ.ts 는 번역·AI 같은 서버 전용 코드를 끌고 들어오므로, 화면에서 쓰는
// 표기 테이블은 여기에 둔다. (클라이언트 컴포넌트가 econ.ts 를 import 하면
// 번역 모듈까지 브라우저 번들에 딸려 들어간다.)

/** 통화코드 → 한국어 국가명 */
export const COUNTRY_KO: Record<string, string> = {
  USD: "미국",
  EUR: "유로존",
  JPY: "일본",
  GBP: "영국",
  CNY: "중국",
  KRW: "한국",
  AUD: "호주",
  CAD: "캐나다",
  CHF: "스위스",
  NZD: "뉴질랜드",
};

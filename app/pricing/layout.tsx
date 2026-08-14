import type { Metadata } from "next";

// pricing/page.tsx 는 "use client"라 metadata를 직접 못 내보낸다.
// 클라이언트 페이지의 SEO 메타데이터는 이렇게 layout에서 준다.
export const metadata: Metadata = {
  title: "요금제 — 무료로 시작하고 필요할 때 프로로",
  description:
    "Newsync 요금제 안내. 뉴스 통합 피드와 기본 기능은 무료이며, 프로 요금제에서는 저평가·고평가 종목, AI 종목 추천, 차트 분석, 포트폴리오 진단을 이용할 수 있습니다.",
  alternates: { canonical: "/pricing" },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://newsync.app";

export default function sitemap(): MetadataRoute.Sitemap {
  // 우선순위: 홈 > 소개·요금제(검색 유입을 실제로 받는 콘텐츠 페이지) > 약관류
  const routes: { path: string; priority: number; freq: "hourly" | "weekly" | "monthly" }[] =
    [
      { path: "", priority: 1, freq: "hourly" },
      { path: "/about", priority: 0.9, freq: "weekly" },
      { path: "/pricing", priority: 0.8, freq: "monthly" },
      { path: "/privacy", priority: 0.3, freq: "monthly" },
      { path: "/terms", priority: 0.3, freq: "monthly" },
    ];
  return routes.map(({ path, priority, freq }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: freq,
    priority,
  }));
}

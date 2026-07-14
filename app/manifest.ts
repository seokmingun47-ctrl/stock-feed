import type { MetadataRoute } from "next";

// PWA 매니페스트 — /manifest.webmanifest 로 제공됨 (홈 화면 설치 + Play Store TWA용)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Newsync — 증권 뉴스",
    short_name: "Newsync",
    description: "국내외 증권 뉴스를 앱 하나에서 — 실시간 통합 피드·AI 분석·시장",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0e17",
    theme_color: "#0a0e17",
    lang: "ko",
    categories: ["news", "finance", "business"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://newsync.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/checkout"],
      },
      // 네이버(Yeti)·다음(Daum)은 자사 봇을 명시적으로 허용해주길 권장한다.
      // '*'만 있어도 규격상 수집 가능하지만, 서치어드바이저 검증 도구가
      // 자기 이름이 없으면 "수집 가능"으로 확실히 표시해주지 않는다.
      {
        userAgent: "Yeti",
        allow: "/",
        disallow: ["/api/", "/checkout"],
      },
      {
        userAgent: "Daumoa",
        allow: "/",
        disallow: ["/api/", "/checkout"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

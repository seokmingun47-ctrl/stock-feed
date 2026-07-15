import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 도메인 구매 후 Vercel 환경변수 NEXT_PUBLIC_SITE_URL 만 바꾸면 전체 SEO가 새 주소로 전환됩니다.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://stock-feed-two.vercel.app";
const TITLE = "Newsync — 국내외 증권 뉴스·AI 종목 분석 한 곳에서";
const DESC =
  "국내외 증권 뉴스를 실시간으로 한곳에 모아보고, AI로 뉴스 요약·종목 분석·저평가/고평가까지. 코스피·코스닥·나스닥 뉴스와 시세를 Newsync에서.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | Newsync",
  },
  description: DESC,
  applicationName: "Newsync",
  keywords: [
    "증권 뉴스",
    "주식 뉴스",
    "실시간 증시",
    "증시 속보",
    "해외 주식 뉴스",
    "코스피",
    "코스닥",
    "나스닥",
    "종목 분석",
    "AI 주식 분석",
    "저평가 주식",
    "고평가 주식",
    "경제 뉴스",
    "뉴싱크",
    "Newsync",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Newsync",
    title: TITLE,
    description: DESC,
    url: SITE_URL,
    locale: "ko_KR",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Newsync" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Search Console / 네이버 서치어드바이저에서 받은 코드를 환경변수로 넣으면 자동 삽입
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: {
      "naver-site-verification":
        process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION || "",
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Newsync",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 하이드레이션 전에 저장된 테마를 적용해 깜빡임 방지
  const themeScript = `try{if(localStorage.getItem('stockfeed:theme')==='light'){document.documentElement.dataset.theme='light';var m=document.querySelector('meta[name=theme-color]');if(m)m.setAttribute('content','#ffffff');}}catch(e){}`;
  // 검색엔진용 구조화 데이터
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Newsync",
    alternateName: "뉴싱크",
    url: SITE_URL,
    description: DESC,
    inLanguage: "ko-KR",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return (
    <html
      lang="ko"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <PWARegister />
        {children}
      </body>
    </html>
  );
}

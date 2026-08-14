import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";
import Analytics from "@/components/Analytics";
import AdSense from "@/components/AdSense";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 도메인 구매 후 Vercel 환경변수 NEXT_PUBLIC_SITE_URL 만 바꾸면 전체 SEO가 새 주소로 전환됩니다.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://newsync.app";
// 제목에 한글 '뉴싱크'를 함께 넣어야 한국어로 검색해도 잡힌다(구글은 제목 단어를 크게 본다).
const TITLE = "뉴싱크(Newsync) — 증권 뉴스 앱 · 국내외 증시 뉴스·AI 종목 분석";
const DESC =
  "뉴싱크(Newsync)는 국내외 증권 뉴스를 실시간으로 한곳에 모아보는 증권 뉴스 앱입니다. 뉴싱크 앱에서 AI 뉴스 요약·종목 분석·저평가/고평가와 코스피·코스닥·나스닥 시세까지 확인하세요.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | Newsync 뉴싱크",
  },
  description: DESC,
  applicationName: "Newsync",
  keywords: [
    "증권 뉴스",
    "주식 뉴스",
    "증권 앱",
    "경제 앱",
    "주식 앱",
    "경제 뉴스 앱",
    "증권 뉴스 앱",
    "주식 뉴스 앱",
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
    // 링크 미리보기: 하얀 배경에 앱 아이콘만(앱스토어 카드 느낌)
    images: [
      {
        url: "/og-icon.png",
        width: 1200,
        height: 630,
        alt: "Newsync 앱 아이콘",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og-icon.png"],
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
      // 애드센스 사이트 소유권 확인용 (ads.txt와 함께 심사 통과를 돕는다)
      "google-adsense-account": process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "",
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
  // 검색엔진용 구조화 데이터.
  // WebSite(사이트 자체) + WebApplication(무료 웹앱이라는 사실)을 함께 알린다.
  // 앱 정보가 있어야 "증권 앱" 류 검색에서 리치 결과로 잡힐 여지가 생긴다.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "Newsync",
        alternateName: ["뉴싱크", "Newsync 뉴싱크"],
        url: SITE_URL,
        description: DESC,
        inLanguage: "ko-KR",
        publisher: { "@id": `${SITE_URL}/#org` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        // Organization: 구글이 검색결과·지식패널에 브랜드 로고를 연결하는 근거.
        // logo는 크롤 가능한 정사각 이미지여야 한다(icon-512.png).
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Newsync",
        alternateName: "뉴싱크",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icon-512.png`,
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: "Newsync",
        url: SITE_URL,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web, Android, iOS",
        inLanguage: "ko-KR",
        description: DESC,
        screenshot: `${SITE_URL}/feature-graphic.png`,
        // 무료로 시작할 수 있다는 사실(프로 요금제는 /pricing 참고)
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "KRW",
        },
      },
    ],
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
        <Analytics />
        <AdSense />
        {children}
      </body>
    </html>
  );
}

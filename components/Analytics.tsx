import Script from "next/script";

// 구글 애널리틱스(GA4) — Vercel 환경변수 NEXT_PUBLIC_GA_ID 를 넣으면 자동 활성화.
// (예: G-XXXXXXXXXX) 없으면 아무것도 로드하지 않아요.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// 네이버 애널리틱스 — NEXT_PUBLIC_NAVER_ANALYTICS_ID 를 넣으면 활성화.
const NAVER_ID = process.env.NEXT_PUBLIC_NAVER_ANALYTICS_ID;

export default function Analytics() {
  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {NAVER_ID && (
        <>
          <Script src="//wcs.naver.net/wcslog.js" strategy="afterInteractive" />
          <Script id="naver-analytics" strategy="afterInteractive">
            {`if(!window.wcs_add)window.wcs_add={};window.wcs_add["wa"]="${NAVER_ID}";if(window.wcs)wcs_do();`}
          </Script>
        </>
      )}
    </>
  );
}

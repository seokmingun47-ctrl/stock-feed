import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Newsync — 국내외 증권 뉴스 한 곳에서",
  description: "팔로우한 증권 뉴스를 앱 하나에서 — 국내외 실시간 통합 피드",
  applicationName: "Newsync",
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
  return (
    <html
      lang="ko"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <PWARegister />
        {children}
      </body>
    </html>
  );
}

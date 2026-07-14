"use client";

import { useEffect } from "react";

// 서비스워커 등록 (PWA 설치 조건 충족)
export default function PWARegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

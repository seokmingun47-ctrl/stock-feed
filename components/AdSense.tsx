const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";

/**
 * 애드센스 로더. 환경변수(NEXT_PUBLIC_ADSENSE_CLIENT)가 없으면 아무것도 안 붙는다.
 * 이 스크립트가 있어야 adsbygoogle.push({})가 실제 광고로 바뀐다 —
 * 슬롯만 만들어두고 이걸 빠뜨리면 광고 자리는 영원히 빈칸으로 남는다.
 *
 * ⚠️ next/script를 쓰지 않는 이유:
 *   afterInteractive는 하이드레이션 후 JS로 주입되고,
 *   beforeInteractive조차 Next가 preload 링크 + 자체 로더 큐(__next_s)로 바꿔버려서
 *   서버 HTML에 <script src="...adsbygoogle.js"> 형태로 남지 않는다.
 *   애드센스는 "각 페이지 <head>에 코드를 넣으라"고 요구하고 소유권 확인도 그 기준이라,
 *   JS를 실행하지 않고 HTML만 받아가는 검사에서 코드를 못 찾을 수 있다.
 *   React 19는 async src 스크립트를 <head>로 호이스팅하고 src 기준으로 중복 제거하므로,
 *   평범한 <script> 태그가 오히려 정확히 원하는 결과를 준다.
 */
export default function AdSense() {
  if (!AD_CLIENT) return null;
  return (
    <script
      async
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`}
    />
  );
}

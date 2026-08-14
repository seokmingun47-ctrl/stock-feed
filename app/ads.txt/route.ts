// /ads.txt — 애드센스가 "이 사이트의 광고를 팔 권한이 누구에게 있는지" 확인하는 파일.
// 없으면 심사에서 경고가 뜨고 수익이 제한될 수 있다.
// 퍼블리셔 ID를 환경변수로 두었으므로 정적 파일 대신 라우트로 만든다.
export const dynamic = "force-static";

// f08c47fec0942fa0 은 구글 애드센스의 고정 TAG-ID (모든 사이트 공통)
const GOOGLE_TAG_ID = "f08c47fec0942fa0";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
  // "ca-pub-123..." 형태로 들어오지만 ads.txt에는 "pub-123..." 만 적는다
  const pub = client.replace(/^ca-/, "");
  if (!/^pub-\d+$/.test(pub)) {
    // 아직 애드센스를 연결하지 않았다면 빈 ads.txt 대신 404가 안전하다
    return new Response("Not Found", { status: 404 });
  }
  return new Response(`google.com, ${pub}, DIRECT, ${GOOGLE_TAG_ID}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

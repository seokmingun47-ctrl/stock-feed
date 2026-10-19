import { NextRequest, NextResponse } from "next/server";
import { translateMany } from "@/lib/translate";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 짧은 텍스트를 한국어로 번역 (구글뉴스 헤드라인 등 안전장치용).
// 번역이 안 될 때 점검용으로도 쓴다: /api/translate?q=Stocks rally on rate cut bets
// → ok:false 면 공급자가 전부 막힌 것(Vercel 로그에서 `[translate]` 확인).
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 500);
  if (!q) return NextResponse.json({ text: "", ok: false });
  const [t] = await translateMany([q]);
  const ok = Boolean(t) && t !== q;
  return NextResponse.json(
    { text: t || q, ok },
    // 실패한 응답을 CDN 이 1시간 물고 있으면 복구해도 영어가 계속 나온다.
    { headers: { "Cache-Control": ok ? "public, s-maxage=3600" : "no-store" } },
  );
}

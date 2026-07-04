import { NextRequest, NextResponse } from "next/server";
import { translateMany } from "@/lib/translate";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

// 짧은 텍스트를 한국어로 번역 (구글뉴스 헤드라인 등 안전장치용)
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 500);
  if (!q) return NextResponse.json({ text: "" });
  const [t] = await translateMany([q]);
  return NextResponse.json(
    { text: t || q },
    { headers: { "Cache-Control": "public, s-maxage=3600" } },
  );
}

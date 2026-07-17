import { NextRequest, NextResponse } from "next/server";
import { getEconEvents } from "@/lib/econ";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// 경제 캘린더. FMP 키가 있으면 from~to 기간 + 실제치, 없으면 이번 주.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lang = p.get("lang") === "en" ? "en" : "ko";

  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastStr = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;

  const from = isDate(p.get("from")) ? p.get("from")! : first;
  const to = isDate(p.get("to")) ? p.get("to")! : lastStr;

  const { events, source } = await getEconEvents(from, to, lang);
  return NextResponse.json(
    { ok: events.length > 0, source, from, to, events },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}

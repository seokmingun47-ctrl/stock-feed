import { NextRequest, NextResponse } from "next/server";
import { normalizeTag, localFinanceMatch } from "@/lib/tags";
import { searchStocks } from "@/lib/naver";
import { geminiRace } from "@/lib/gemini";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 20;

// 네이버 종목 자동완성에 실제로 존재하는 회사/종목인지
async function naverMatch(tag: string): Promise<boolean> {
  try {
    const hits = await searchStocks(tag);
    if (!hits.length) return false;
    const t = tag.toLowerCase().replace(/\s+/g, "");
    return hits.some((h) => {
      const n = h.name.toLowerCase().replace(/\s+/g, "");
      const c = h.code.toLowerCase();
      return n.includes(t) || t.includes(n) || c === t;
    });
  } catch {
    return false;
  }
}

// Gemini 심판 — 경제·주식·투자·기업·금융과 관련되면 YES
async function geminiJudge(tag: string): Promise<boolean> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return false;
  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `그룹 투자채팅방 태그로 "${tag}" 가 적절한지 판단해줘. ` +
              `다음 중 하나에 '직접' 해당할 때만 YES: 상장/비상장 기업명, 주식 종목·티커, 산업 섹터/테마(반도체·2차전지 등), 거시경제 지표(금리·환율·CPI 등), 통화, 암호화폐/코인, 원자재, 투자·증시 용어, 유명 투자자/CEO. ` +
              `단지 경제에 영향만 줄 수 있는 일반 명사(예: 날씨·음식·여행·인구·교통), 취미·연예·스포츠·정치인·일상어는 NO. ` +
              `애매하면 NO. 딱 한 단어로만 답해: YES 또는 NO.`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 5 },
  });
  const reply = await geminiRace(apiKey, body);
  return !!reply && /yes/i.test(reply);
}

export async function POST(req: NextRequest) {
  let body: { tag?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const tag = normalizeTag(String(body.tag ?? ""));
  if (!tag) {
    return NextResponse.json({
      ok: true,
      valid: false,
      reason: "태그를 입력해주세요.",
    });
  }
  if (tag.length < 1 || tag.length > 20) {
    return NextResponse.json({
      ok: true,
      valid: false,
      tag,
      reason: "태그는 1~20자로 입력해주세요.",
    });
  }

  // 1) 로컬 빠른 통과 → 2) 네이버 종목 → 3) Gemini 심판
  let valid = localFinanceMatch(tag);
  if (!valid) valid = await naverMatch(tag);
  if (!valid) valid = await geminiJudge(tag);

  return NextResponse.json({
    ok: true,
    valid,
    tag,
    reason: valid ? undefined : "경제·주식과 관련된 태그만 추가할 수 있어요.",
  });
}

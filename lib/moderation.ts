import type { SupabaseClient } from "@supabase/supabase-js";

// 신고 사유
export const REPORT_REASONS = [
  "스팸/광고",
  "욕설/혐오 발언",
  "음란물/선정성",
  "사기/허위정보",
  "폭력/불법",
  "기타",
] as const;

export type ReportTargetType = "post" | "comment" | "message" | "user" | "news";

const TARGET_TYPES = new Set(["post", "comment", "message", "user", "news"]);
export function isReportTargetType(t: string): t is ReportTargetType {
  return TARGET_TYPES.has(t);
}

// 내가 차단한 사용자 id 집합 (테이블 미설정/오류면 빈 Set)
export async function getBlockedIds(
  db: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  try {
    const { data, error } = await db
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);
    if (error) return new Set();
    return new Set((data ?? []).map((b) => String(b.blocked_id)));
  } catch {
    return new Set();
  }
}

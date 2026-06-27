export interface Post {
  id: string;
  nickname: string;
  title: string;
  body: string;
  tags: string[];
  views: number;
  commentCount: number;
  createdAt: number; // epoch ms
}

export interface Comment {
  id: string;
  nickname: string;
  body: string;
  createdAt: number;
}

// DB row → Post
export function rowToPost(r: Record<string, unknown>): Post {
  const cc = r.community_comments as Array<{ count: number }> | undefined;
  return {
    id: String(r.id),
    nickname: String(r.nickname ?? ""),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    views: Number(r.views ?? 0),
    commentCount: cc && cc[0] ? Number(cc[0].count) : 0,
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
  };
}

export function rowToComment(r: Record<string, unknown>): Comment {
  return {
    id: String(r.id),
    nickname: String(r.nickname ?? ""),
    body: String(r.body ?? ""),
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
  };
}

// 입력 정리/검증 결과
export function cleanPostInput(input: {
  nickname?: unknown;
  title?: unknown;
  body?: unknown;
  tags?: unknown;
}): { nickname: string; title: string; body: string; tags: string[] } | null {
  const nickname = String(input.nickname ?? "").trim().slice(0, 20);
  const title = String(input.title ?? "").trim().slice(0, 120);
  const body = String(input.body ?? "").trim().slice(0, 5000);
  let tags: string[] = [];
  if (Array.isArray(input.tags)) {
    tags = input.tags
      .map((t) => String(t).trim().replace(/^#/, "").slice(0, 20))
      .filter(Boolean)
      .slice(0, 5);
  }
  if (!nickname || !title) return null;
  return { nickname, title, body, tags };
}

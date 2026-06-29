export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

export interface Post {
  id: string;
  userId: string | null;
  nickname: string;
  title: string;
  body: string;
  tags: string[];
  views: number;
  commentCount: number;
  likeCount: number;
  liked: boolean;
  createdAt: number; // epoch ms
}

export interface Comment {
  id: string;
  userId: string | null;
  nickname: string;
  body: string;
  createdAt: number;
}

// 인기 뉴스 항목
export interface NewsItem {
  url: string;
  title: string;
  sourceId: string;
  image: string | null;
  likeCount: number;
  commentCount: number;
}

// DB row → Post
export function rowToPost(r: Record<string, unknown>): Post {
  const cc = r.community_comments as Array<{ count: number }> | undefined;
  return {
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    nickname: String(r.nickname ?? ""),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    views: Number(r.views ?? 0),
    commentCount: cc && cc[0] ? Number(cc[0].count) : 0,
    likeCount: Number(r.like_count ?? 0),
    liked: Boolean(r.liked),
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
  };
}

export function rowToComment(r: Record<string, unknown>): Comment {
  return {
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : null,
    nickname: String(r.nickname ?? ""),
    body: String(r.body ?? ""),
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
  };
}

// 글 입력 정리/검증 (작성자는 세션에서 가져옴)
export function cleanPostInput(input: {
  title?: unknown;
  body?: unknown;
  tags?: unknown;
}): { title: string; body: string; tags: string[] } | null {
  const title = String(input.title ?? "").trim().slice(0, 120);
  const body = String(input.body ?? "").trim().slice(0, 5000);
  let tags: string[] = [];
  if (Array.isArray(input.tags)) {
    tags = input.tags
      .map((t) => String(t).trim().replace(/^#/, "").slice(0, 20))
      .filter(Boolean)
      .slice(0, 5);
  }
  if (!title) return null;
  return { title, body, tags };
}

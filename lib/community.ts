export interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  avatarUrl?: string | null;
  profileColor?: string | null;
  bio?: string | null;
}

import type { SupabaseClient } from "@supabase/supabase-js";

export type PostKind = "post" | "news";

export interface Post {
  id: string;
  userId: string | null;
  nickname: string;
  title: string;
  body: string;
  tags: string[];
  images: string[]; // 첨부 이미지 URL
  kind: PostKind; // 'post'=자유글, 'news'=유저 뉴스
  views: number;
  commentCount: number;
  likeCount: number;
  liked: boolean;
  following: boolean; // 현재 사용자가 작성자를 팔로우 중인지
  authorAvatar?: string | null; // 작성자 프로필 사진
  authorColor?: string | null; // 작성자 대표 색상
  createdAt: number; // epoch ms
}

// 팔로우한(뉴스를 쓰는) 유저 — 뉴스탭 상단 채널 칩용
export interface Author {
  id: string;
  username: string;
  newsCount: number;
  avatarUrl?: string | null;
  profileColor?: string | null;
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
    images: Array.isArray(r.images) ? (r.images as string[]) : [],
    kind: r.kind === "news" ? "news" : "post",
    views: Number(r.views ?? 0),
    commentCount: cc && cc[0] ? Number(cc[0].count) : 0,
    likeCount: Number(r.like_count ?? 0),
    liked: Boolean(r.liked),
    following: Boolean(r.following),
    authorAvatar: (r.authorAvatar as string) ?? null,
    authorColor: (r.authorColor as string) ?? null,
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
  };
}

// 작성자 프로필(사진·색상)을 게시글 목록에 붙임 (서버 전용)
export async function attachAuthorProfiles(
  db: SupabaseClient,
  posts: Post[],
): Promise<void> {
  const ids = [...new Set(posts.map((p) => p.userId).filter(Boolean) as string[])];
  if (!ids.length) return;
  try {
    const { data } = await db
      .from("community_users")
      .select("id, avatar_url, profile_color")
      .in("id", ids);
    const map = new Map(
      (data ?? []).map((u: Record<string, unknown>) => [String(u.id), u]),
    );
    for (const p of posts) {
      if (!p.userId) continue;
      const u = map.get(p.userId);
      if (u) {
        p.authorAvatar = (u.avatar_url as string) ?? null;
        p.authorColor = (u.profile_color as string) ?? null;
      }
    }
  } catch {
    /* 프로필 컬럼 미설정 */
  }
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
  kind?: unknown;
  images?: unknown;
}): {
  title: string;
  body: string;
  tags: string[];
  kind: PostKind;
  images: string[];
} | null {
  const title = String(input.title ?? "").trim().slice(0, 120);
  const body = String(input.body ?? "").trim().slice(0, 5000);
  const kind: PostKind = input.kind === "news" ? "news" : "post";
  let tags: string[] = [];
  if (Array.isArray(input.tags)) {
    tags = input.tags
      .map((t) => String(t).trim().replace(/^#/, "").slice(0, 20))
      .filter(Boolean)
      .slice(0, 5);
  }
  let images: string[] = [];
  if (Array.isArray(input.images)) {
    images = input.images
      .map((u) => String(u).trim())
      .filter((u) => /^https:\/\//.test(u))
      .slice(0, 4);
  }
  if (!title) return null;
  return { title, body, tags, kind, images };
}

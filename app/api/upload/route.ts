import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 6 * 1024 * 1024; // 6MB

// 이미지 업로드 → Supabase Storage(media, 공개) → 공개 URL 반환
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-form" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "post") === "avatar" ? "avatars" : "posts";
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: "파일이 없어요." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { ok: false, reason: "이미지 파일만 올릴 수 있어요." },
      { status: 415 },
    );
  }
  if (file.size > MAX) {
    return NextResponse.json(
      { ok: false, reason: "이미지는 6MB 이하만 가능해요." },
      { status: 413 },
    );
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${kind}/${user.id}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const db = getAdminClient();
  const { error } = await db.storage
    .from("media")
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  const { data } = db.storage.from("media").getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl });
}

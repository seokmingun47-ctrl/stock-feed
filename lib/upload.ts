// 클라이언트에서 이미지를 업로드하고 공개 URL을 받음
export async function uploadImage(
  file: File,
  kind: "post" | "avatar",
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const d = await res.json();
  if (!d.ok) throw new Error(d.reason || "업로드에 실패했어요.");
  return d.url as string;
}

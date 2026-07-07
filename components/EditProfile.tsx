"use client";

import { useRef, useState } from "react";
import type { User } from "@/lib/community";
import { uploadImage } from "@/lib/upload";
import Avatar from "./Avatar";

const COLORS = [
  "#2f81f7",
  "#7b5cff",
  "#f6465d",
  "#14c38e",
  "#ff8a3d",
  "#e84393",
  "#18b6e6",
  "#f7b500",
  "#8b5cf6",
  "#ef4444",
  "#22c55e",
  "#0ea5e9",
];

export default function EditProfile({
  user,
  onClose,
  onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    user.avatarUrl ?? null,
  );
  const [color, setColor] = useState<string>(user.profileColor ?? "");
  const [bio, setBio] = useState<string>(user.bio ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setErr("");
    setUploading(true);
    try {
      const url = await uploadImage(files[0], "avatar");
      setAvatarUrl(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (busy || uploading) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarUrl: avatarUrl,
          profileColor: color || null,
          bio,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        setErr(d.reason || "저장에 실패했어요.");
        setBusy(false);
        return;
      }
      onSaved(d.user as User);
    } catch {
      setErr("네트워크 오류예요.");
      setBusy(false);
    }
  };

  return (
    <div className="reader-enter fixed inset-0 z-[65] flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <button onClick={onClose} className="text-[15px] text-muted hover:text-text">
            취소
          </button>
          <span className="text-[16px] font-bold text-text">프로필 편집</span>
          <button
            onClick={save}
            disabled={busy || uploading}
            className="rounded-full bg-accent px-4 py-1.5 text-[14px] font-bold text-white disabled:opacity-40"
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pick(e.target.files)}
          />

          {/* 사진 */}
          <div className="flex flex-col items-center">
            <Avatar name={user.username} avatarUrl={avatarUrl} color={color} size={96} />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-[14px] font-bold text-accent disabled:opacity-60"
              >
                {uploading ? "올리는 중…" : "사진 변경"}
              </button>
              {avatarUrl && (
                <button
                  onClick={() => setAvatarUrl(null)}
                  className="text-[14px] font-semibold text-muted hover:text-[#f6465d]"
                >
                  사진 제거
                </button>
              )}
            </div>
            <div className="mt-1 text-[13px] font-semibold text-text">
              @{user.username}
            </div>
          </div>

          {/* 대표 색상 */}
          <div className="mt-7">
            <div className="mb-2 text-[13px] font-bold text-text">대표 색상</div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setColor("")}
                aria-label="기본"
                className="grid h-9 w-9 place-items-center rounded-full"
                style={{
                  background: "linear-gradient(135deg,#7b5cff,#18b6e6)",
                  boxShadow: color === "" ? "0 0 0 2px var(--bg), 0 0 0 4px var(--text)" : undefined,
                }}
              >
                {color === "" && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className="grid h-9 w-9 place-items-center rounded-full"
                  style={{
                    background: c,
                    boxShadow: color === c ? "0 0 0 2px var(--bg), 0 0 0 4px var(--text)" : undefined,
                  }}
                >
                  {color === c && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 소개 */}
          <div className="mt-7">
            <div className="mb-2 text-[13px] font-bold text-text">소개</div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              rows={3}
              placeholder="자기소개를 입력해보세요 (관심 종목, 투자 스타일 등)"
              className="w-full resize-none rounded-xl border border-border bg-bg-soft px-3.5 py-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-muted focus:border-accent"
            />
            <div className="mt-1 text-right text-[11px] text-muted">{bio.length}/160</div>
          </div>

          {err && <p className="mt-4 text-[13px] text-[var(--down)]">{err}</p>}
        </div>
      </div>
    </div>
  );
}

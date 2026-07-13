"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room, User } from "@/lib/community";
import { timeAgo } from "@/lib/format";
import { uploadImage } from "@/lib/upload";
import ChatRoom from "./ChatRoom";
import RoomIcon from "./RoomIcon";

export default function GroupRooms({ user }: { user: User }) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async (q = "") => {
    setErr(null);
    try {
      const url = q.trim()
        ? `/api/rooms?q=${encodeURIComponent(q.trim())}`
        : "/api/rooms";
      const d = await fetch(url, { cache: "no-store" }).then((r) => r.json());
      if (!d.ok) {
        setErr(d.reason || "불러오지 못했어요.");
        setRooms([]);
        return;
      }
      setRooms(d.rooms);
    } catch {
      setErr("네트워크 오류예요.");
      setRooms([]);
    }
  }, []);

  // 최초 로드 + 검색어 디바운스
  useEffect(() => {
    const t = setTimeout(() => load(query), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const dbMissing = err && /group_rooms|relation|table|no-db/i.test(err);
  const searching = query.trim().length > 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur">
        <h1 className="text-[19px] font-extrabold tracking-tight text-text">
          그룹방
        </h1>
        <p className="mb-2.5 text-[12px] text-muted">관심사가 맞는 사람들과 실시간 대화</p>
        {/* 태그 검색 */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-bg-soft px-3.5 py-2">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="태그로 검색 (예: 스페이스X, 삼성전자)"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-text outline-none placeholder:text-muted"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="검색어 지우기"
              className="shrink-0 text-muted hover:text-text"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1">
        {rooms === null ? (
          <SkeletonList />
        ) : dbMissing ? (
          <Notice
            title="그룹방 준비 중"
            desc="DB 테이블을 아직 만들지 않았어요. 설정이 끝나면 바로 이용할 수 있어요."
          />
        ) : err ? (
          <Notice title="불러오지 못했어요" desc={err} onRetry={() => load(query)} />
        ) : rooms.length === 0 ? (
          searching ? (
            <Notice
              title="검색 결과가 없어요"
              desc={`'${query.trim()}' 태그가 달린 그룹방이 아직 없어요. 직접 만들어보세요!`}
            />
          ) : (
            <Notice
              title="아직 그룹방이 없어요"
              desc="첫 그룹방을 만들어 대화를 시작해보세요!"
            />
          )
        ) : (
          rooms.map((r) => (
            <RoomCard
              key={r.id}
              room={r}
              onOpen={() => setOpen(r)}
              onTagClick={(t) => setQuery(t)}
            />
          ))
        )}
      </main>

      {/* 방 만들기 FAB */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-40 mx-auto max-w-[600px] px-4">
        <button
          onClick={() => setCreating(true)}
          className="pointer-events-auto ml-auto flex h-14 items-center gap-2 rounded-full bg-accent px-5 text-white shadow-lg shadow-accent/30"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-[15px] font-bold">방 만들기</span>
        </button>
      </div>

      {open && (
        <ChatRoom
          room={open}
          user={user}
          onClose={() => {
            setOpen(null);
            load(query);
          }}
          onDeleted={(id) => {
            setOpen(null);
            setRooms((cur) => (cur ? cur.filter((r) => r.id !== id) : cur));
          }}
        />
      )}
      {creating && (
        <CreateRoom
          onClose={() => setCreating(false)}
          onCreated={(room) => {
            setCreating(false);
            setQuery("");
            setRooms((cur) => (cur ? [room, ...cur] : [room]));
            setOpen(room);
          }}
        />
      )}
    </div>
  );
}

function RoomCard({
  room,
  onOpen,
  onTagClick,
}: {
  room: Room;
  onOpen: () => void;
  onTagClick: (tag: string) => void;
}) {
  return (
    <div className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-bg-soft">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <RoomIcon icon={room.emoji} name={room.name} size={48} radius={16} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[16px] font-bold text-text">
              {room.name}
            </span>
            <span className="shrink-0 text-[12px] text-muted">
              · {room.memberCount}명
            </span>
          </div>
          <p className="truncate text-[13px] text-muted">
            {room.lastBody || room.description || "새 그룹방"}
          </p>
          {room.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {room.tags.slice(0, 4).map((t) => (
                <button
                  key={t}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick(t);
                  }}
                  className="rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/20"
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>
      </button>
      {room.lastAt > 0 && (
        <span className="shrink-0 self-start pt-1 text-[11px] text-muted">
          {timeAgo(room.lastAt)}
        </span>
      )}
    </div>
  );
}

// 추천 태그 (전부 경제·주식 용어 → API 확인 없이 바로 추가)
const SUGGESTED = [
  "코스피",
  "삼성전자",
  "엔비디아",
  "비트코인",
  "반도체",
  "2차전지",
  "금리",
  "배당",
];

function CreateRoom({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (room: Room) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [tagErr, setTagErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setErr("");
    setUploading(true);
    try {
      const url = await uploadImage(files[0], "post");
      setImage(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const hasTag = (t: string) =>
    tags.some((x) => x.toLowerCase() === t.toLowerCase());

  // 추천 태그(검증된 용어) 즉시 추가
  const quickAdd = (t: string) => {
    if (tags.length >= 5 || hasTag(t)) return;
    setTags([...tags, t]);
    setTagErr("");
  };

  // 입력 태그 — 경제·주식 관련인지 서버 확인 후 추가
  const addTag = async () => {
    const raw = tagInput.trim();
    if (!raw || checking) return;
    if (tags.length >= 5) {
      setTagErr("태그는 최대 5개까지예요.");
      return;
    }
    if (hasTag(raw)) {
      setTagErr("이미 추가된 태그예요.");
      setTagInput("");
      return;
    }
    setChecking(true);
    setTagErr("");
    try {
      const d = await fetch("/api/tag-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: raw }),
      }).then((r) => r.json());
      if (!d.ok) {
        setTagErr("확인에 실패했어요. 다시 시도해주세요.");
        return;
      }
      if (!d.valid) {
        setTagErr(d.reason || "경제·주식과 관련된 태그만 추가할 수 있어요.");
        return;
      }
      const t = d.tag || raw;
      if (hasTag(t)) {
        setTagInput("");
        return;
      }
      setTags((cur) => [...cur, t]);
      setTagInput("");
    } catch {
      setTagErr("네트워크 오류예요.");
    } finally {
      setChecking(false);
    }
  };

  const canSubmit = !!name.trim() && tags.length >= 1 && !busy && !uploading;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setErr("");
    try {
      const d = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, emoji: image || "", tags }),
      }).then((r) => r.json());
      if (!d.ok) {
        setErr(d.reason || "개설에 실패했어요.");
        setBusy(false);
        return;
      }
      onCreated(d.room);
    } catch {
      setErr("네트워크 오류예요.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <button aria-label="닫기" onClick={onClose} className="flex-1" />
      <div className="sheet-up max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-border bg-bg pb-6">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg px-4 py-3.5">
          <span className="text-[17px] font-bold text-text">그룹방 개설</span>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-full bg-accent px-4 py-1.5 text-[14px] font-bold text-white disabled:opacity-40"
          >
            {busy ? "개설 중…" : "개설"}
          </button>
        </div>
        <div className="px-4 py-4">
          {/* 사진 첨부 */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pick(e.target.files)}
          />
          {image && (
            <div className="relative mb-3 h-20 w-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full rounded-2xl object-cover" />
              <button
                onClick={() => setImage(null)}
                aria-label="사진 삭제"
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mb-4 flex items-center gap-2 rounded-full bg-bg-soft px-4 py-2 text-[13.5px] font-semibold text-muted hover:text-text disabled:opacity-60"
          >
            {uploading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            )}
            {uploading ? "올리는 중…" : image ? "사진 변경" : "사진 추가 (선택)"}
          </button>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            placeholder="방 이름 (예: 삼성전자 장기투자방)"
            className="w-full rounded-xl border border-border bg-bg-soft px-3.5 py-3 text-[16px] font-semibold text-text outline-none placeholder:text-muted focus:border-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="방 소개 (선택)"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-bg-soft px-3.5 py-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-muted focus:border-accent"
          />

          {/* 태그 (필수, 경제·주식 관련만) */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-text">
                태그 <span className="text-accent">*</span>
              </span>
              <span className="text-[11.5px] text-muted">
                {tags.length}/5 · 경제·주식 관련만
              </span>
            </div>

            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 rounded-full bg-accent/15 py-1 pl-2.5 pr-1.5 text-[13px] font-semibold text-accent"
                  >
                    #{t}
                    <button
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      aria-label={`${t} 삭제`}
                      className="grid h-4 w-4 place-items-center rounded-full hover:bg-accent/25"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {tags.length < 5 && (
              <div className="flex items-center gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    if (tagErr) setTagErr("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  maxLength={20}
                  placeholder="예: 삼성전자, 비트코인, 스페이스X"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-bg-soft px-3.5 py-2.5 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
                />
                <button
                  onClick={addTag}
                  disabled={!tagInput.trim() || checking}
                  className="flex shrink-0 items-center gap-1 rounded-xl bg-bg-soft px-3.5 py-2.5 text-[14px] font-bold text-accent disabled:opacity-40"
                >
                  {checking && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="spin">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                    </svg>
                  )}
                  {checking ? "확인중" : "추가"}
                </button>
              </div>
            )}

            {tagErr && (
              <p className="mt-1.5 text-[12.5px] text-[var(--down)]">{tagErr}</p>
            )}

            {tags.length < 5 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED.filter((s) => !hasTag(s)).map((s) => (
                  <button
                    key={s}
                    onClick={() => quickAdd(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-[12.5px] font-medium text-muted hover:border-accent hover:text-accent"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {err && <p className="mt-3 text-[13px] text-[var(--down)]">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-bg-soft" />
          <div className="flex-1">
            <div className="mb-2 h-4 w-32 rounded bg-bg-soft" />
            <div className="h-3 w-48 rounded bg-bg-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Notice({
  title,
  desc,
  onRetry,
}: {
  title: string;
  desc: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
      <p className="text-[17px] font-bold text-text">{title}</p>
      <p className="mt-2 text-[14px] text-muted">{desc}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

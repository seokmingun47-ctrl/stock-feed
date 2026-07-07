"use client";

// 유저 아바타 — 프로필 사진이 있으면 사진, 없으면 대표색(또는 기본 그라데이션) + 이니셜
export default function Avatar({
  name,
  avatarUrl,
  color,
  size = 40,
  ring = false,
  badge = false,
  className = "",
}: {
  name: string;
  avatarUrl?: string | null;
  color?: string | null;
  size?: number;
  ring?: boolean;
  badge?: boolean; // 사람 배지(유저 채널 칩 구분용)
  className?: string;
}) {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  const ringStyle = ring
    ? { boxShadow: "0 0 0 2.5px var(--bg), 0 0 0 4.5px var(--accent)" }
    : undefined;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-visible rounded-full ${className}`}
      style={{ width: size, height: size, ...ringStyle }}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="grid h-full w-full place-items-center rounded-full font-black text-white"
          style={{
            fontSize: size * 0.42,
            background: color || "linear-gradient(135deg,#7b5cff,#18b6e6)",
          }}
        >
          {initial}
        </span>
      )}
      {badge && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2 border-bg bg-[#7b5cff] text-white"
          style={{ width: size * 0.34, height: size * 0.34 }}
        >
          <svg width={size * 0.18} height={size * 0.18} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z" />
          </svg>
        </span>
      )}
    </span>
  );
}

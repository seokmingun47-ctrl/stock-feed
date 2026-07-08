"use client";

// 그룹방 아이콘 — 이모지 또는 업로드한 사진(URL) 모두 렌더
export default function RoomIcon({
  icon,
  size = 48,
  radius = 16,
}: {
  icon: string | null | undefined;
  size?: number;
  radius?: number;
}) {
  const isImg = !!icon && /^https?:\/\//.test(icon);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden bg-bg-soft leading-none"
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.5 }}
    >
      {isImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon!} alt="" className="h-full w-full object-cover" />
      ) : (
        icon || "💬"
      )}
    </span>
  );
}

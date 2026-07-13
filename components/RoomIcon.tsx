"use client";

// 그룹방 아이콘 — 업로드 사진(URL)이면 사진, 아니면 방 이름 첫 글자 모노그램.
// (구버전 이모지 데이터가 남아있으면 그 이모지도 그대로 표시)

const GRADIENTS = [
  "linear-gradient(135deg,#5b54f0,#18b6e6)",
  "linear-gradient(135deg,#2f81f7,#7b5cff)",
  "linear-gradient(135deg,#14c38e,#0d8f6f)",
  "linear-gradient(135deg,#f7b500,#ff8a3d)",
  "linear-gradient(135deg,#f6465d,#c026d3)",
  "linear-gradient(135deg,#0ea5e9,#22d3a5)",
  "linear-gradient(135deg,#8b5cf6,#ec4899)",
  "linear-gradient(135deg,#ff7a45,#f6465d)",
];

// 방 이름을 해시해 항상 같은 색을 뽑음(방마다 고유하되 일관됨)
function pickGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// URL도 일반 텍스트도 아닌 순수 그림문자(이모지)만 판별 — 구버전 데이터 호환용
function isEmoji(s: string): boolean {
  return /\p{Extended_Pictographic}/u.test(s);
}

export default function RoomIcon({
  icon,
  name = "",
  size = 48,
  radius = 16,
}: {
  icon: string | null | undefined;
  name?: string;
  size?: number;
  radius?: number;
}) {
  const isImg = !!icon && /^https?:\/\//.test(icon);
  const legacyEmoji = !isImg && !!icon && isEmoji(icon) ? icon : null;

  if (isImg) {
    return (
      <span
        className="grid shrink-0 place-items-center overflow-hidden bg-bg-soft"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon!} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }

  if (legacyEmoji) {
    return (
      <span
        className="grid shrink-0 place-items-center bg-bg-soft leading-none"
        style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.5 }}
      >
        {legacyEmoji}
      </span>
    );
  }

  // 사진·이모지 없으면 방 이름 첫 글자 모노그램
  const initial = [...(name || "").trim()][0] || "#";
  return (
    <span
      className="grid shrink-0 place-items-center font-black uppercase leading-none text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: size * 0.42,
        background: pickGradient(name || "room"),
      }}
    >
      {initial}
    </span>
  );
}

import Link from "next/link";

// 사업자 정보 — 전자상거래법상 공개 의무 항목이라 실제 값을 기본값으로 표기합니다.
// (비밀이 아닌 공개 정보. Vercel 환경변수를 넣으면 그 값으로 덮어씁니다.)
const BIZ = {
  name: process.env.NEXT_PUBLIC_BIZ_NAME || "캐시비디오(cashvideo)", // 상호명
  ceo: process.env.NEXT_PUBLIC_BIZ_CEO || "석민건", // 대표자
  regNo: process.env.NEXT_PUBLIC_BIZ_REG_NO || "533-06-03173", // 사업자 등록번호
  mailOrder: process.env.NEXT_PUBLIC_BIZ_MAIL_ORDER_NO || "2025-경남김해-0840", // 통신판매업 신고번호
  address: process.env.NEXT_PUBLIC_BIZ_ADDRESS || "경남 김해시 삼계로 239", // 주소
  tel: process.env.NEXT_PUBLIC_BIZ_TEL || "010-3227-9252", // 고객센터
};
const EMAIL = process.env.NEXT_PUBLIC_BIZ_EMAIL || "uutt5823@gmail.com";

export default function SiteFooter() {
  // 값이 있는 항목만 노출 (통신판매업 신고번호는 아직 없으면 자동으로 빠짐)
  const rows: [string, string | undefined][] = [
    ["상호명", BIZ.name],
    ["대표자", BIZ.ceo],
    ["사업자 등록번호", BIZ.regNo],
    ["통신판매업 신고번호", BIZ.mailOrder],
    ["주소", BIZ.address],
    ["고객센터", BIZ.tel],
    ["이메일", EMAIL],
  ];
  const filled = rows.filter(([, v]) => !!v) as [string, string][];

  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-[720px] px-5 py-9 text-center">
        {/* 브랜드 */}
        <div className="flex items-center justify-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[13px] font-black text-white">
            N
          </span>
          <span className="text-[15px] font-extrabold text-text">Newsync</span>
        </div>

        {/* 사업자 정보 */}
        <dl className="mt-5 space-y-1.5 text-[12.5px] leading-relaxed text-muted">
          {filled.map(([k, v]) => (
            <div key={k}>
              <dt className="inline text-muted">{k}: </dt>
              <dd className="inline text-text/80">
                {k === "이메일" ? (
                  <a href={`mailto:${v}`} className="hover:text-text">
                    {v}
                  </a>
                ) : (
                  v
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* 정책 링크 */}
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12.5px] font-semibold">
          <Link href="/terms" className="text-muted hover:text-text">
            이용약관
          </Link>
          <span className="text-border">|</span>
          <Link href="/privacy" className="text-muted hover:text-text">
            개인정보처리방침
          </Link>
          <span className="text-border">|</span>
          <Link href="/terms#refund" className="text-muted hover:text-text">
            환불정책
          </Link>
        </nav>

        {/* 면책 · 저작권 */}
        <p className="mt-6 text-[11.5px] leading-relaxed text-muted">
          Newsync는 뉴스·시세 정보와 AI 분석을 제공하며, 투자 권유가 아닙니다.
          투자 판단과 책임은 이용자 본인에게 있습니다.
        </p>
        <p className="mt-2 text-[11.5px] text-muted">© {new Date().getFullYear()} Newsync</p>
      </div>
    </footer>
  );
}

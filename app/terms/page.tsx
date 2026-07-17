import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "이용약관 — Newsync",
  description: "Newsync 이용약관",
};

const UPDATED = "2026년 7월 14일";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-10 text-text">
      <Link href="/" className="text-[13px] font-semibold text-accent">
        ← Newsync로 돌아가기
      </Link>
      <h1 className="mt-4 text-[26px] font-extrabold">이용약관</h1>
      <p className="mt-1 text-[13px] text-muted">최종 업데이트: {UPDATED}</p>

      <div className="mt-6 space-y-6 text-[14.5px] leading-relaxed">
        <Section title="1. 서비스 소개">
          Newsync는 국내외 증권·경제 뉴스를 통합해 보여주고, 커뮤니티(게시판·
          그룹방), 시장 시세, AI 분석 등을 제공하는 서비스입니다.
        </Section>

        <Section title="2. 계정">
          이용자는 정확한 정보로 가입해야 하며, 계정 보안에 대한 책임은 본인에게
          있습니다. 타인의 계정을 도용하거나 하나의 계정을 부정하게 사용해서는 안
          됩니다.
        </Section>

        <Section title="3. 이용자 콘텐츠 및 금지 행위">
          이용자는 게시글·댓글·그룹방 메시지 등을 작성할 수 있으며, 그 내용에
          대한 책임은 작성자에게 있습니다. 다음 행위는 금지됩니다.
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>욕설·혐오·차별·괴롭힘, 타인에 대한 비방·명예훼손</li>
            <li>음란물, 불법 정보, 스팸·도배, 사기</li>
            <li>허위 사실 유포, 시세 조종 등 자본시장법 위반 행위</li>
            <li>타인의 저작권·개인정보 등 권리 침해</li>
          </ul>
          운영자는 위 사항을 위반한 콘텐츠를 사전 통지 없이 삭제하거나 계정 이용을
          제한할 수 있습니다.
        </Section>

        <Section title="4. 신고 및 조치">
          부적절한 콘텐츠나 이용자를 발견하면 신고할 수 있으며, 운영자는 신고를
          검토해 삭제·차단 등 필요한 조치를 취합니다.
        </Section>

        <Section title="5. 투자 정보 면책">
          서비스가 제공하는 뉴스, AI 종목 분석·주가 전망, 시세 등은 정보 제공 및
          참고용이며, 투자 권유나 자문이 아닙니다. 정보의 정확성·완전성을 보장하지
          않으며, 이를 바탕으로 한 투자 판단과 그 결과에 대한 책임은 전적으로
          이용자 본인에게 있습니다.
        </Section>

        <Section title="6. 책임의 한계">
          서비스는 &ldquo;있는 그대로&rdquo; 제공되며, 서비스 중단·오류·데이터
          손실 등으로 인한 손해에 대해 관련 법령이 허용하는 범위에서 책임을 지지
          않습니다.
        </Section>

        <Section title="7. 약관의 변경">
          약관은 필요 시 변경될 수 있으며, 변경 시 서비스 내 공지합니다. 변경 후
          서비스를 계속 이용하면 변경에 동의한 것으로 간주됩니다.
        </Section>
      </div>

      <div className="mt-10 border-t border-border pt-4 text-[13px] text-muted">
        <Link href="/privacy" className="text-accent">
          개인정보처리방침 보기
        </Link>
      </div>
      <SiteFooter />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[16px] font-bold">{title}</h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}

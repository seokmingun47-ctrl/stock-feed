// Resend로 메일 발송. RESEND_API_KEY 없으면 조용히 비활성.
const KEY = process.env.RESEND_API_KEY;
// 발송 주소 — 인증한 도메인이어야 함(newsync.app). 필요 시 env로 덮어쓰기.
const FROM = process.env.EMAIL_FROM || "Newsync 브리핑 <brief@newsync.app>";

export function emailConfigured(): boolean {
  return !!KEY;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!KEY) return { ok: false, reason: "email-not-configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, reason: `resend ${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e).slice(0, 200) };
  }
}

// 아침 브리핑 안내 메일 HTML — 본문은 짧게, 버튼으로 앱 브리핑 화면 열기.
export function briefEmailHtml(opts: { name: string; url: string; teaser?: string }): string {
  const { name, url, teaser } = opts;
  return `<!doctype html><html lang="ko"><body style="margin:0;background:#0a0e17;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'Malgun Gothic',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="440" cellpadding="0" cellspacing="0" style="max-width:440px;width:100%;background:#161d2e;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 28px 8px;">
        <div style="font-size:22px;font-weight:800;color:#f2f5fa;">오늘의 브리핑</div>
        <div style="margin-top:6px;font-size:14px;color:#8b96ad;">${name}님, 좋은 아침이에요. 밤사이 시장과 오늘 일정을 정리해뒀어요.</div>
      </td></tr>
      ${
        teaser
          ? `<tr><td style="padding:8px 28px;"><div style="font-size:14px;line-height:1.6;color:#c7cfdd;">${teaser}</div></td></tr>`
          : ""
      }
      <tr><td style="padding:16px 28px 28px;">
        <a href="${url}" style="display:inline-block;background:#2f81f7;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:12px;">브리핑 보기 →</a>
        <div style="margin-top:16px;font-size:11px;color:#5f6b7d;line-height:1.5;">Newsync는 투자 참고 정보를 제공하며 투자 권유가 아닙니다.<br>알림을 끄려면 앱 → 시장 → 관심에서 아침 브리핑을 꺼주세요.</div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

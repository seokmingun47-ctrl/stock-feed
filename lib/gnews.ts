// 구글뉴스 리다이렉트 URL(news.google.com/rss/articles/...)을 실제 기사 URL로 해석.
// batchexecute 방식(2024+). 실패 시 null.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export function isGoogleNewsUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "news.google.com";
  } catch {
    return false;
  }
}

export async function resolveGoogleNews(gnewsUrl: string): Promise<string | null> {
  const id = gnewsUrl.match(/articles\/([^?]+)/)?.[1];
  if (!id) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const page = await fetch(gnewsUrl, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA },
      next: { revalidate: 3600 },
    });
    const html = await page.text();
    const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = html.match(/data-n-a-ts="(\d+)"/)?.[1];
    if (!sg || !ts) return null;

    const inner = JSON.stringify([
      "garturlreq",
      [
        ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
        "en-US",
        "US",
        1,
        [2, 3, 4, 8],
        1,
        0,
        "655000234",
        0,
        0,
        null,
        0,
      ],
      id,
      Number(ts),
      sg,
    ]);
    const fReq = JSON.stringify([[["Fbv4je", inner, null, "generic"]]]);

    const be = await fetch(
      "https://news.google.com/_/DotsSplashUi/data/batchexecute",
      {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": UA,
        },
        body: "f.req=" + encodeURIComponent(fReq),
        next: { revalidate: 3600 },
      },
    );
    const text = await be.text();
    // 응답 형식: ...garturlres\",\"<REAL_URL>\",1]...
    const m = text.match(/garturlres\\",\\"(https?:\/\/[^\\]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

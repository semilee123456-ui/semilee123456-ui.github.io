// 참택스(ChamTax) 공유 링크용 동적 OG 카드 Worker.
//
// 왜 필요한가: chamtax.com은 GitHub Pages 정적 호스팅이라, 카카오톡/페이스북 등이 링크
// 미리보기를 만들 때 항상 같은 고정 이미지(og-image-hook.png)만 보여줌 — 사용자가 실제로
// 계산한 금액(예: "223억원")이 카드에 반영되지 않는 문제. 이 Worker는 chamtax.com과 완전히
// 분리된 별도 도메인(workers.dev)에서 동작하며, 실패하거나 배포 안 해도 본 사이트에는
// 아무 영향이 없음.
//
// 라우트 두 개:
//   GET /s?final=...&before=...&taxpct=...&country=...&to=<encoded 계산기 URL>
//     → 사람이 클릭하면 즉시 실제 계산기(chamtax.com/?amount=...)로 리다이렉트되고,
//       링크 미리보기 봇(카카오톡 등)은 리다이렉트를 따라가지 않고 이 페이지의
//       og:title/og:description/og:image만 읽어서 카드에 반영함.
//   GET /api/og.png?final=...&before=...&taxpct=...&country=...
//     → 위 페이지의 og:image가 가리키는 실제 PNG 카드 이미지를 그 자리에서 생성.

import { ImageResponse } from 'workers-og';

const SITE_ORIGIN = 'https://chamtax.com';
const MAX_LEN = 40; // 카드에 들어갈 텍스트 길이 상한(비정상적으로 긴 값으로 카드가 깨지는 것 방지)

function clean(value, fallback) {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value.trim().slice(0, MAX_LEN);
}

function clampPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// 사용자 입력(쿼리 파라미터)이 그대로 HTML 문자열에 들어가므로 최소한의 이스케이프 처리
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseCardParams(searchParams) {
  const finalText = clean(searchParams.get('final'), '실수령액 확인하기');
  const beforeText = clean(searchParams.get('before'), '');
  const country = clean(searchParams.get('country'), '한국 거주자');
  const takePct = clampPct(searchParams.get('taxpct') !== null ? 100 - Number(searchParams.get('taxpct')) : searchParams.get('takepct'));
  return { finalText, beforeText, country, takePct };
}

function buildCardHtml({ finalText, beforeText, country, takePct }) {
  const taxPct = 100 - takePct;
  const f = escapeHtml(finalText);
  const b = escapeHtml(beforeText);
  const c = escapeHtml(country);
  return `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#F4F5F7;padding:70px;font-family:sans-serif;position:relative;">
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="display:flex;width:56px;height:56px;border-radius:28px;background:#155445;color:#ffffff;align-items:center;justify-content:center;font-size:28px;font-weight:800;">참</div>
      <div style="display:flex;font-size:26px;color:#544E42;font-weight:600;">참택스 · chamtax.com</div>
    </div>
    <div style="display:flex;flex-direction:column;margin-top:56px;">
      <div style="display:flex;font-size:32px;color:#544E42;font-weight:600;">일시불 예상 실수령액</div>
      <div style="display:flex;font-size:96px;font-weight:800;color:#155445;margin-top:14px;">${f}</div>
      ${b ? `<div style="display:flex;align-items:baseline;gap:16px;margin-top:24px;">
        <div style="display:flex;font-size:28px;color:#828C97;">세전 ${b}</div>
        <div style="display:flex;font-size:30px;color:#C0392B;font-weight:800;">-${taxPct}%</div>
      </div>` : ''}
    </div>
    <div style="display:flex;width:100%;height:22px;border-radius:11px;overflow:hidden;margin-top:44px;">
      <div style="display:flex;width:${takePct}%;height:100%;background:#155445;"></div>
      <div style="display:flex;width:${taxPct}%;height:100%;background:#C0392B;"></div>
    </div>
    <div style="display:flex;gap:28px;margin-top:18px;font-size:24px;color:#262420;">
      <div style="display:flex;">● ${takePct}% 실수령</div>
      <div style="display:flex;">● ${taxPct}% 세금</div>
    </div>
    <div style="display:flex;position:absolute;bottom:56px;right:70px;font-size:22px;color:#828C97;">${c} · 미국 복권 세금 계산기</div>
  </div>`;
}

async function handleOgImage(url) {
  const params = parseCardParams(url.searchParams);
  try {
    return new ImageResponse(buildCardHtml(params), {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (err) {
    // 카드 생성이 실패해도 깨진 이미지 대신 최소한의 안전한 카드로 대체(전체 실패보다 나음)
    return new ImageResponse(
      `<div style="display:flex;width:1200px;height:630px;background:#155445;color:#ffffff;align-items:center;justify-content:center;font-size:48px;font-family:sans-serif;">참택스 · chamtax.com</div>`,
      { width: 1200, height: 630 }
    );
  }
}

function handleSharePage(url) {
  const params = parseCardParams(url.searchParams);
  const rawTo = url.searchParams.get('to');
  let redirectTo;
  try {
    const candidate = new URL(rawTo || SITE_ORIGIN + '/', SITE_ORIGIN);
    // 오픈 리다이렉트 방지 — chamtax.com으로만 리다이렉트 허용
    redirectTo = candidate.origin === SITE_ORIGIN ? candidate.toString() : SITE_ORIGIN + '/';
  } catch {
    redirectTo = SITE_ORIGIN + '/';
  }

  const imgParams = new URLSearchParams({
    final: params.finalText,
    before: params.beforeText,
    country: params.country,
    takepct: String(params.takePct),
  });
  const ogImageUrl = `${url.origin}/api/og.png?${imgParams.toString()}`;
  const title = escapeHtml(`${params.finalText} · 미국 복권 세금 계산기 - 참택스`);
  const description = escapeHtml(
    `${params.country} 기준 일시불 실수령액 ${params.finalText}. 참택스에서 나도 얼마 받을 수 있는지 확인해보세요.`
  );

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${ogImageUrl}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${escapeHtml(redirectTo)}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${escapeHtml(redirectTo)}">
<script>location.replace(${JSON.stringify(redirectTo)});</script>
</head>
<body>
<p>결과 페이지로 이동 중입니다… 자동으로 이동하지 않으면 <a href="${escapeHtml(redirectTo)}">여기를 눌러주세요</a>.</p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/og.png') return handleOgImage(url);
    if (url.pathname === '/s') return handleSharePage(url);
    return new Response('OK — see /s or /api/og.png', { status: 200 });
  },
};

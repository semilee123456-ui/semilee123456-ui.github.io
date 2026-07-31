// 참택스(ChamTax) 공유 링크용 동적 OG 카드 Worker.
//
// 왜 필요한가: chamtax.com은 GitHub Pages 정적 호스팅이라, 카카오톡/페이스북 등이 링크
// 미리보기를 만들 때 항상 같은 고정 이미지(og-image-hook.png)만 보여줌 — 사용자가 실제로
// 계산한 금액(예: "223억원")이 카드에 반영되지 않는 문제. 이 Worker는 chamtax.com과 완전히
// 분리된 별도 도메인(workers.dev)에서 동작하며, 실패하거나 배포 안 해도 본 사이트에는
// 아무 영향이 없음.
//
// 2026-07-31 범용화: 처음엔 홈 결과 카드(final/before/taxpct/country) 전용이었는데, 사이트
// 안에 공유 버튼이 4개(홈 결과/최근 당첨번호/재미 결과/환급 체크리스트)나 있고 전부 이 동적
// 카드를 쓰길 원해서, 특정 화면 전용 필드 대신 label/main/sub/badge라는 범용 필드로 바꿈 —
// 텍스트는 script.js 쪽에서 이미 화면에 표시 중인(=이미 26개 언어로 번역된) 문자열을 그대로
// 실어 보내고, 이 Worker는 그걸 그대로 카드에 앉히기만 함(Worker 안에 새 번역을 만들지 않음).
//
// 라우트 두 개:
//   GET /s?label=...&main=...&sub=...&taxpct=...&badge=...&title=...&desc=...&lang=xx&to=<encoded>
//     → 사람이 클릭하면 즉시 실제 계산기(chamtax.com/...)로 리다이렉트되고,
//       링크 미리보기 봇(카카오톡 등)은 리다이렉트를 따라가지 않고 이 페이지의
//       og:title/og:description/og:image만 읽어서 카드에 반영함.
//   GET /api/og.png?label=...&main=...&sub=...&taxpct=...&badge=...&lang=xx
//     → 위 페이지의 og:image가 가리키는 실제 PNG 카드 이미지를 그 자리에서 생성.

import { ImageResponse } from 'workers-og';

const SITE_ORIGIN = 'https://chamtax.com';
const MAX_LEN = 60; // 카드에 들어갈 텍스트 길이 상한(비정상적으로 긴 값으로 카드가 깨지는 것 방지)

// 2026-07-31: workers-og(=satori 기반)의 기본 내장 폰트는 라틴 문자만 지원해서, 카드 안
// 비라틴 문자(한글 등)가 전부 네모(tofu)로 깨져 나오는 버그가 실제로 발견됨(사용자 카카오톡
// 스크린샷으로 확인 — 숫자/%는 멀쩡한데 한글만 깨짐). 이 사이트는 27개 언어(ko + 26개)를
// 지원하므로 한글만 고치면 안 되고, 공유 시점의 화면 언어(lang=)에 맞는 스크립트용 Google
// Fonts 패밀리를 그때그때 받아와야 함. 하나의 Noto Sans(라틴 확장+키릴+그리스)가 못 커버하는
// 스크립트만 전용 패밀리로 골라 씀 — 나머지(영어/스페인어/포르투갈어/프랑스어/베트남어/
// 필리핀어/우즈베크어/티모르어/인도네시아어/러시아어/우크라이나어/카자흐어/키르기스어/
// 몽골어)는 기본 'Noto Sans' 하나로 충분함(전부 라틴 또는 키릴 스크립트).
const LANG_FONT_FAMILY = {
  ko: 'Noto Sans KR',
  zh: 'Noto Sans SC',
  ja: 'Noto Sans JP',
  th: 'Noto Sans Thai',
  ar: 'Noto Naskh Arabic', // 사이트 본문(styles.css html[lang="ar"])과 동일한 패밀리로 통일
  ur: 'Noto Nastaliq Urdu', // 사이트 본문(styles.css html[lang="ur"])과 동일한 패밀리로 통일
  hi: 'Noto Sans Devanagari',
  ne: 'Noto Sans Devanagari',
  bn: 'Noto Sans Bengali',
  km: 'Noto Sans Khmer',
  my: 'Noto Sans Myanmar',
  si: 'Noto Sans Sinhala',
  lo: 'Noto Sans Lao',
};
function fontFamilyForLang(lang) {
  return LANG_FONT_FAMILY[lang] || 'Noto Sans';
}

// Google Fonts CSS2 API는 User-Agent에 따라 다른 포맷을 내려줌(최신 브라우저 UA엔 woff2) —
// workers-og(satori)는 ttf/otf/woff만 읽을 수 있고 woff2는 못 읽으므로, 구형 UA를 보내서
// 일부러 예전 포맷(ttf)을 받아냄. text= 파라미터로 카드에 실제 쓰이는 글자만 넘겨서 응답을
// 작게 유지함(전체 폰트 파일은 커서 매 요청마다 통째로 받기엔 무거움).
async function fetchFontSubset(text, lang) {
  const uniqueChars = Array.from(new Set(text.split(''))).join('');
  if (!uniqueChars) return null;
  const family = fontFamilyForLang(lang).replace(/ /g, '+');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@700&text=${encodeURIComponent(uniqueChars)}`;
  const cssRes = await fetch(cssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36',
    },
  });
  if (!cssRes.ok) return null;
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match) return null;
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) return null;
  return fontRes.arrayBuffer();
}

function clean(value, fallback, maxLen) {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value.trim().slice(0, maxLen || MAX_LEN);
}

function cleanLang(value) {
  if (typeof value !== 'string') return 'ko';
  const v = value.trim().toLowerCase();
  return /^[a-z]{2,3}$/.test(v) ? v : 'ko';
}

// 사용자 입력(쿼리 파라미터)이 그대로 HTML 문자열에 들어가므로 최소한의 이스케이프 처리
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseCardParams(searchParams) {
  const label = clean(searchParams.get('label'), '');
  const main = clean(searchParams.get('main'), 'ChamTax');
  const sub = clean(searchParams.get('sub'), '');
  const badge = clean(searchParams.get('badge'), '');
  const lang = cleanLang(searchParams.get('lang'));
  // 쿼리 파라미터 이름은 taxpct(세금 비율)로 통일 — 내부적으로만 취급이 더 쉬운 takePct(실수령
  // 비율)로 바꿔서 씀. 결과 카드(홈 화면)에만 있는 값이라 없으면(다른 공유 유형) null.
  const taxpctRaw = searchParams.get('taxpct');
  let takePct = null;
  if (taxpctRaw !== null && taxpctRaw !== '') {
    const n = Number(taxpctRaw);
    if (Number.isFinite(n)) takePct = Math.max(0, Math.min(100, Math.round(100 - n)));
  }
  return { label, main, sub, badge, lang, takePct };
}

// main 텍스트 길이에 따라 폰트 크기를 줄여서, 당첨번호처럼 긴 문자열도 카드 밖으로 안 삐져나가게 함
function mainFontSize(text) {
  const len = text.length;
  if (len > 32) return 44;
  if (len > 22) return 60;
  if (len > 14) return 76;
  return 96;
}

function buildCardHtml({ label, main, sub, badge, takePct }) {
  const hasBar = takePct !== null;
  const taxPct = hasBar ? 100 - takePct : null;
  const l = escapeHtml(label);
  const m = escapeHtml(main);
  const s = escapeHtml(sub);
  const bd = escapeHtml(badge);
  return `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#F4F5F7;padding:70px;font-family:sans-serif;position:relative;">
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="display:flex;width:56px;height:56px;border-radius:28px;background:#155445;color:#ffffff;align-items:center;justify-content:center;font-size:28px;font-weight:800;">C</div>
      <div style="display:flex;font-size:26px;color:#544E42;font-weight:600;">ChamTax · chamtax.com</div>
    </div>
    <div style="display:flex;flex-direction:column;margin-top:56px;">
      ${l ? `<div style="display:flex;font-size:32px;color:#544E42;font-weight:600;">${l}</div>` : ''}
      <div style="display:flex;font-size:${mainFontSize(main)}px;font-weight:800;color:#155445;margin-top:14px;">${m}</div>
      ${s ? `<div style="display:flex;font-size:28px;color:#828C97;margin-top:24px;">${s}</div>` : ''}
    </div>
    ${hasBar ? `
    <div style="display:flex;width:100%;height:22px;border-radius:11px;overflow:hidden;margin-top:44px;">
      <div style="display:flex;width:${takePct}%;height:100%;background:#155445;"></div>
      <div style="display:flex;width:${taxPct}%;height:100%;background:#C0392B;"></div>
    </div>
    <div style="display:flex;gap:28px;margin-top:18px;font-size:24px;color:#262420;">
      <div style="display:flex;">● ${takePct}%</div>
      <div style="display:flex;">● ${taxPct}%</div>
    </div>` : ''}
    ${bd ? `<div style="display:flex;position:absolute;bottom:56px;right:70px;font-size:22px;color:#828C97;">${bd}</div>` : ''}
  </div>`;
}

async function loadCardFonts(params) {
  const cardText = params.label + params.main + params.sub + params.badge;
  try {
    const fontData = await fetchFontSubset(cardText, params.lang);
    if (fontData) return [{ name: fontFamilyForLang(params.lang), data: fontData, weight: 700, style: 'normal' }];
  } catch (e) {
    // 폰트를 못 받아와도(네트워크 문제 등) 카드 생성 자체는 계속 진행 — 이 경우 비라틴 문자가
    // 다시 깨질 수 있지만, 카드 자체가 안 뜨는 것보단 나음
  }
  return [];
}

async function handleOgImage(url) {
  const params = parseCardParams(url.searchParams);
  const fonts = await loadCardFonts(params);
  try {
    return new ImageResponse(buildCardHtml(params), {
      width: 1200,
      height: 630,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (err) {
    // 카드 생성이 실패해도 깨진 이미지 대신 최소한의 안전한 카드로 대체(전체 실패보다 나음).
    // 위에서 이미 받아둔 폰트(fonts)가 있으면 여기서도 그대로 재사용
    return new ImageResponse(
      `<div style="display:flex;width:1200px;height:630px;background:#155445;color:#ffffff;align-items:center;justify-content:center;font-size:48px;font-family:sans-serif;">ChamTax · chamtax.com</div>`,
      { width: 1200, height: 630, fonts }
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

  const imgParams = new URLSearchParams({ label: params.label, main: params.main, sub: params.sub, badge: params.badge, lang: params.lang });
  if (params.takePct !== null) imgParams.set('taxpct', String(100 - params.takePct));
  const ogImageUrl = `${url.origin}/api/og.png?${imgParams.toString()}`;

  // title/desc는 script.js가 이미 계산해서 넘겨준 값(=navigator.share에도 쓰는, 이미 26개
  // 언어로 번역된 문구)을 그대로 씀 — 이 Worker 안에서 새로 문구를 조립하지 않음. 혹시
  // 빠뜨리고 안 넘어왔으면 label/main으로 최소한의 대체 문구만 구성.
  const title = clean(url.searchParams.get('title'), `${params.main}${params.label ? ' · ' + params.label : ''}`, 200);
  const description = clean(url.searchParams.get('desc'), params.sub || params.label || 'ChamTax', 200);
  const titleEsc = escapeHtml(title);
  const descEsc = escapeHtml(description);
  const lang = params.lang;

  const html = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<title>${titleEsc}</title>
<meta property="og:title" content="${titleEsc}">
<meta property="og:description" content="${descEsc}">
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
<p>Redirecting… <a href="${escapeHtml(redirectTo)}">Tap here</a> if you're not redirected automatically.</p>
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

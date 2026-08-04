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
// 2026-08-01: 60자였을 때 스페인어(64자)·테툼어(61자)·인도네시아어(62자) 환급 체크리스트
// 공유 문구가 단어 중간에서 그대로 잘리는 걸 발견(예: "...lista de verificaci"로 잘림) —
// 실제 캡처된 27개 언어 문구 중 가장 긴 것(64자) 기준으로 여유를 두고 80으로 올림. 그래도
// 비정상적으로 긴 값(공격/오입력)에 대한 안전장치 역할은 유지됨.
const MAX_LEN = 80; // 카드에 들어갈 텍스트 길이 상한(비정상적으로 긴 값으로 카드가 깨지는 것 방지)

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
  // 2026-08-03: 사이트 본문과 통일하려고 원래 Noto Naskh Arabic/Noto Nastaliq Urdu를 썼는데,
  // 실제 배포된 Worker에 직접 요청을 보내 검증해보니(이전 세션들은 샌드박스 네트워크 제한으로
  // 못 했던 것 — 이번엔 됨) 이 두 폰트로 "مليار"(십억)·"ملین"(백만) 같은 흔한 단어가 포함된
  // 카드가 HTTP 200에 본문 0바이트(완전히 빈 이미지)로 깨지는 걸 재현함. 둘 다 Noto Sans
  // Arabic으로 바꿔서 우르두어는 고쳐졌지만, 아랍어는 "ل+ي+ا" 연속(특히 "مليار") 같은 특정
  // 글자 조합에서 여전히 재현됨 — 같은 날 다른 세션이 이 사각지대를 `handleOgImage()`의
  // 안전한 대체 카드 폴백 구조(아래 참고)로 우회했었는데, **뒤이은 세션이 로컬 `wrangler dev`로
  // 직접 재현해서 진짜 원인을 특정함**: satori(이 Worker가 쓰는 렌더링 엔진)가 특정 OpenType
  // GSUB 규칙(lookupType 5, format 3 — Chaining Contextual Substitution)을 아예 지원 안 해서
  // (런타임에 "lookupType: 5 - substFormat: 3 is not yet supported"로 즉시 크래시) —
  // Naskh/Nastaliq·Noto Sans Arabic·Noto Kufi Arabic 전부 이 GSUB 규칙을 갖고 있어서 "ل+ي+ا"
  // 3글자 연속에서 폰트와 무관하게 동일하게 크래시함을 로컬 재현으로 확인(리가처 문제가 아니라
  // 이 규칙 자체를 satori가 못 읽는 문제였음). 반면 Cairo·Tajawal·IBM Plex Sans Arabic·Almarai
  // 등 이 GSUB 규칙 자체를 안 쓰는 폰트들은 크래시 없이 정상 렌더링됨을 확인 — 그중 Tajawal로
  // 교체(사이트 본문에서도 흔히 쓰이는 무난한 산세리프 아랍어 폰트, 아랍어 문자 조인 자체는
  // 정상 지원). `i18n-source/translations.json`의 짧은 아랍어 문자열 387개 전부(로컬
  // `wrangler dev`로 일괄 재현 테스트) 크래시 0건 확인 — **Cairo는 시도 당시 이 문자 조합에
  // 대한 Google Fonts 서브셋 응답 자체가 `content-length: 0`(빈 폰트 파일)이라 되돌렸던 적이
  // 있었는데(다른 세션 기록), Tajawal은 그 문제 없이 정상 응답됨을 같이 확인함.** 아래
  // `handleOgImage()`의 안전한 대체 카드 폴백 구조는 이 근본 수정과 별개로 그대로 유지 —
  // 지금은 안 쓰이지만 앞으로 다른 언어/조합에서 satori가 또 다른 사각지대를 만나면 여전히
  // 최후 방어선 역할을 함. 우르두어(ur)는 재확인해보니 Noto Sans Arabic으로 이미 정상
  // 렌더링되고 있어서(이 3글자 연속 자체가 없는 문구들이라 우연히 안 걸린 것으로 보임) 그대로
  // 둠 — 다만 다음 세션이 우르두어 카드도 같은 증상을 보면 이 항목도 Tajawal(또는 같은 검증을
  // 거친 다른 폰트)로 바꿀 것. 사이트 본문(styles.css)의 폰트는 안 건드림(브라우저는 이 문제가
  // 없음, 이 Worker만의 문제).
  ar: 'Tajawal',
  ur: 'Noto Sans Arabic',
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

// 2026-08-03: 실제 배포된 og.chamtax.com 카드를 직접 열어보다가 발견 — "(추정치 ⚠️)"처럼
// 번역 문구 안에 박힌 이모지가 러시아어(기본 'Noto Sans')·태국어(스크립트 전용 폰트) 카드
// 양쪽 모두에서 tofu(☐) 2개로 깨져있었음. 위 loadCardFonts()의 기본 폰트 폴백으로 해결될까
// 기대했는데, 러시아어는 이미 기본 'Noto Sans'가 1순위 폰트인데도 깨졌다는 건 이 폴백용
// 폰트 자체가 애초에 이모지 글리프를 안 담고 있다는 뜻 — 즉 폰트를 바꾸는 방향으로는 해결
// 불가능(이 프로젝트가 쓰는 어떤 Noto Sans 계열 폰트도 컬러 이모지를 안 담음). 대신 카드에
// 들어가는 텍스트에서 이모지 자체를 렌더링 전에 제거함 — 카드는 이미 단순화된 요약 화면이라
// 이모지가 빠져도 정보 손실은 없음(단어 자체는 그대로 남음, 예: "추정치 ⚠️" → "추정치").
function stripEmoji(str) {
  return str
    .replace(/\p{Extended_Pictographic}/gu, '') // 이모지 자체(예: ⚠, 🎉)
    .replace(/[‍️]/g, '') // ZWJ(U+200D)·이모지 표시용 변형 선택자(U+FE0F, 단독으로 남을 수 있음)
    .replace(/\s+([)）])/g, '$1') // "추정치 )" → "추정치)" (이모지가 빠지며 남은 공백 정리)
    .replace(/([(（])\s*([)）])/g, '') // 안이 완전히 비어버린 괄호 "()" 자체를 제거
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(value, fallback, maxLen) {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return stripEmoji(value.trim()).slice(0, maxLen || MAX_LEN) || fallback;
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

// 2026-08-01: 카카오톡 공유 카드 검수 중 아랍어(ar)·우르두어(ur) 카드가 오른쪽에서 왼쪽으로
// 읽는 언어인데도 왼쪽 정렬로 그대로 나온다는 지적을 받아 확인함 — buildCardHtml()에
// direction/text-align이 전혀 없어서 항상 LTR로 그려지고 있었음. 이 두 언어일 때만 컨테이너에
// direction:rtl + 텍스트 정렬을 오른쪽으로 바꾸고, 절대좌표로 고정된 badge(국가 배지)도
// right→left로 반전시켜 카드의 "끝"(RTL 기준 왼쪽)에 자연스럽게 붙게 함.
const RTL_LANGS = ['ar', 'ur'];

function buildCardHtml({ label, main, sub, badge, takePct, lang }) {
  const hasBar = takePct !== null;
  const taxPct = hasBar ? 100 - takePct : null;
  const l = escapeHtml(label);
  const m = escapeHtml(main);
  const s = escapeHtml(sub);
  const bd = escapeHtml(badge);
  const isRtl = RTL_LANGS.includes(lang);
  const dirStyle = isRtl ? 'direction:rtl;text-align:right;' : '';
  const badgeSideStyle = isRtl ? 'left:70px;' : 'right:70px;';
  return `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:#F4F5F7;padding:70px;font-family:sans-serif;position:relative;${dirStyle}">
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
    <div style="display:flex;gap:28px;margin-top:18px;font-size:24px;color:#262420;align-items:center;">
      <div style="display:flex;align-items:center;gap:8px;"><div style="display:flex;width:14px;height:14px;border-radius:7px;background:#155445;"></div> ${takePct}%</div>
      <div style="display:flex;align-items:center;gap:8px;"><div style="display:flex;width:14px;height:14px;border-radius:7px;background:#C0392B;"></div> ${taxPct}%</div>
    </div>` : ''}
    ${bd ? `<div style="display:flex;position:absolute;bottom:56px;${badgeSideStyle}font-size:22px;color:#828C97;">${bd}</div>` : ''}
  </div>`;
}

// buildCardHtml()이 파라미터와 무관하게 항상 그려넣는 고정 문구/기호 — 브랜드 줄
// ("ChamTax · chamtax.com")과 로고 원 안의 "C", 퍼센트 기호. loadCardFonts()가
// label/main/sub/badge(그때그때 다른 동적 값)만 보고 폰트 서브셋을 받아왔더니, 이 고정
// 문구들의 글자가 서브셋에 아예 없어서 항상 네모(tofu)로 깨지는 버그가 실사용자 스크린샷으로
// 발견됨(금액·라벨 등 동적 글자는 멀쩡한데 브랜드 줄만 깨짐) — 두 자리 숫자 퍼센트가 항상
// 나오는 것도 아니라서 0-9 전체를 안전하게 포함시킴. (2026-08-03: 세율 바 밑 불릿은 "●" 글자가
// 아니라 CSS로 그린 원(div)으로 바꿔서 여기 포함 안 함 — 아래 참고.)
const STATIC_CARD_CHARS = 'ChamTax · chamtax.com0123456789%';

// 2026-08-03: 실제 배포된 Worker에 직접 요청해서 캄보디아어/태국어/힌디어/미얀마어 등 8개
// 언어(LANG_FONT_FAMILY의 스크립트 전용 폰트를 쓰는 언어) 카드를 스크린샷으로 직접 열어보다가
// 발견함 — 위 세율 바 밑 "●"이 tofu(☐)로 깨져 있었음(당시엔 아직 글자였음, 지금은 위처럼 div로
// 바꿔서 해결). 같은 자리에서 "(추정치 ⚠️)"처럼 실제 번역 문구 안에 박힌 이모지(⚠️ 등)도 같은
// 이유로 깨지는 걸 확인함 — Noto Sans Khmer/Thai/Devanagari 같은 스크립트 전용 폰트는 애초에
// 이모지·기호 글리프를 안 담고 있어서, 그 언어 폰트 하나만 받아오면 그 언어 텍스트 자체는
// 멀쩡해도 이런 범용 기호만 깨짐. CSS 도형으로 바꿀 수 있는 불릿은 그렇게 했지만, 번역 문구
// 안에 어떤 이모지가 더 있을지는 27개 언어 전체를 다 뒤지지 않는 한 장담 못 하므로(완전한
// 해결은 아님, 아래 참고), 스크립트 전용 폰트를 쓰는 언어는 항상 기본 'Noto Sans'도 같이
// 받아와서 satori의 font-family 폴백 목록(예: "Noto Sans Khmer, Noto Sans")에 얹음 — 스크립트
// 폰트에 없는 글자(이모지 등)를 만나면 satori가 목록의 다음 폰트로 자동으로 넘어가서 찾음
// (리가처/RTL과 달리 폰트 폴백 목록 자체는 satori가 지원하는 기능). 'Noto Sans'도 이모지를
// 담고 있진 않을 가능성이 높아 이모지 자체가 여전히 깨질 수 있음 — 근본적으로는 카드 문구에서
// 이모지를 걸러내는 게 더 확실하지만, 이번 세션은 이 폴백만으로 범위를 한정함(다음 세션이
// 실제 배포본에서 이모지 포함 카드를 몇 개 더 열어봐서 필요하면 이모지 자체를 clean()에서
// 정규식으로 제거하는 걸 검토할 것). 참고: buildCardHtml()의 CSS font-family는 여전히
// 그냥 "sans-serif"(범용 키워드) — satori는 CSS font-family 이름으로 매칭하는 게 아니라
// fonts 배열에 등록된 폰트들을 글자 단위로 순서대로 훑어서 그 글자를 담고 있는 첫 폰트를
// 쓰는 방식이라(등록 순서 = 우선순위), 이름을 맞출 필요 없이 언어별 폰트를 먼저, 기본
// 'Noto Sans'를 나중에 배열에 넣기만 하면 됨(실제로 기존 코드도 CSS에 "Noto Sans KR" 같은
// 이름을 명시한 적이 한 번도 없었는데 한국어가 정상 렌더링됐던 것도 같은 이유).
async function loadCardFonts(params) {
  const cardText = params.label + params.main + params.sub + params.badge + STATIC_CARD_CHARS;
  const fonts = [];
  try {
    const primaryData = await fetchFontSubset(cardText, params.lang);
    if (primaryData) fonts.push({ name: fontFamilyForLang(params.lang), data: primaryData, weight: 700, style: 'normal' });
  } catch (e) {
    // 폰트를 못 받아와도(네트워크 문제 등) 카드 생성 자체는 계속 진행 — 이 경우 비라틴 문자가
    // 다시 깨질 수 있지만, 카드 자체가 안 뜨는 것보단 나음
  }
  if (fontFamilyForLang(params.lang) !== 'Noto Sans') {
    try {
      const fallbackData = await fetchFontSubset(cardText, 'en'); // 'en'은 LANG_FONT_FAMILY에 없어 항상 기본 'Noto Sans'로 감
      if (fallbackData) fonts.push({ name: 'Noto Sans', data: fallbackData, weight: 700, style: 'normal' });
    } catch (e) {
      // 위와 동일 — 폴백 폰트를 못 받아와도 1순위 폰트만으로 계속 진행
    }
  }
  return fonts;
}

// 안전한 대체 카드(개인화된 정보 없이 브랜드명만) — 실제 카드 생성이 어떤 이유로든 실패했을 때
// 씀. 아래 두 곳(동기 실패·비동기 렌더링 실패)에서 공용으로 재사용.
function buildFallbackCard() {
  return `<div style="display:flex;width:1200px;height:630px;background:#155445;color:#ffffff;align-items:center;justify-content:center;font-size:48px;font-family:sans-serif;">ChamTax · chamtax.com</div>`;
}

async function handleOgImage(url) {
  const params = parseCardParams(url.searchParams);
  const fonts = await loadCardFonts(params);
  try {
    const rendered = new ImageResponse(buildCardHtml(params), { width: 1200, height: 630, fonts });
    // 2026-08-03: 아랍어 카드가 HTTP 200에 본문 0바이트로 깨지는 버그를 실제 배포본에서
    // 재현·조사하다가 발견함 — satori(렌더링 엔진)가 RTL/리가처를 지원 안 해서(공식 문서에
    // 명시) 특정 아랍 문자 조합(예: "مليار")에서 PNG 인코딩이 실패하는데, 이 실패가 위
    // `new ImageResponse(...)`가 "성공적으로" 반환한 Response의 스트림을 실제로 소비하는
    // *시점*(비동기)에야 터짐 — 그래서 바로 아래 catch가 그동안 이 실패를 전혀 못 잡고
    // 있었음(폰트를 Naskh→Noto Sans Arabic→Cairo로 세 번 바꿔봐도 여전히 재현돼서, 폰트
    // 문제가 아니라 이 구조적 사각지대가 진짜 원인이었다는 걸 뒤늦게 확인함). 응답을 그냥
    // 반환하는 대신 **여기서 바로 `arrayBuffer()`로 끝까지 다 읽어서** 렌더링을 지금 이
    // try 블록 안에서 강제로 끝내버림 — 실패하면 Promise가 reject되어 catch로 정상적으로
    // 넘어감(아랍어 텍스트 자체가 예쁘게 나오게 고치진 못했지만, 최소한 빈 이미지 대신 이미
    // 있던 안전한 대체 카드라도 항상 나가게 됨 — "카드가 아예 안 뜬다"보다는 훨씬 나음).
    const buf = await rendered.arrayBuffer();
    return new Response(buf, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (err) {
    // 카드 생성이 실패해도 깨진 이미지 대신 최소한의 안전한 카드로 대체(전체 실패보다 나음).
    // 위에서 이미 받아둔 폰트(fonts)가 있으면 여기서도 그대로 재사용. 이 대체 카드 자체도
    // 실패할 가능성에 대비해 대체 카드는 fonts 없이(라틴 문자만 쓰므로 기본 내장 폰트로 충분)
    // 다시 한번 안전하게 렌더링 시도 — 그래도 실패하면 더 이상 손쓸 수 없어 그대로 전파함.
    const fallback = new ImageResponse(buildFallbackCard(), { width: 1200, height: 630 });
    const buf = await fallback.arrayBuffer();
    return new Response(buf, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' }, // 대체 카드는 짧게만 캐싱(원인이 해소되면 곧 정상 카드로 되돌아오게)
    });
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

  // 2026-08-01: script.js가 더 이상 title/desc를 안 보냄(URL 길이 문제로 제거함, 아래 참고) —
  // 이 Worker가 label/main/sub만으로 항상 자체 조립함. (예전엔 title/desc를 script.js가 만들어
  // 넘겨줬는데, 실사용자가 카카오톡 "나와의 채팅"에 직접 붙여넣어 재현해보니 label/sub/badge/
  // title/desc가 전부 한글이라 퍼센트인코딩되면 500~700자까지 늘어나서 카카오톡이 아예
  // "링크"로 인식조차 못 하는 게 확인됨 — 반면 길이 제한이 없는 카카오 공식 디버거는 같은
  // URL을 문제없이 스크랩함. desc는 애초에 label/main/badge를 합친 것과 내용이 겹쳤고, title도
  // 고정 사이트 문구라 아래 폴백만으로 내용 손실 없이 URL을 크게 줄일 수 있음.)
  const title = clean(url.searchParams.get('title'), `${params.main}${params.label ? ' · ' + params.label : ''} · ChamTax`, 200);
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

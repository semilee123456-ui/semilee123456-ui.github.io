// 접근성(WCAG) 자동 감사 — axe-core를 각 페이지에 라이트/다크 모드 둘 다로 주입해서 대비·alt·
// ARIA·폼 라벨 등 위반 사항을 스캔함. petscan-ai 저장소(사용자의 다른 프로젝트)가 다크모드
// 대비 회귀(인라인 스타일에 하드코딩된 color:#fff 등)를 이 방식으로 자동 검출하길래
// 2026-08-22에 참택스에도 이식함 — 참택스도 다크모드 토글(#theme-toggle/toggleTheme())이
// 있어서 같은 종류의 버그가 날 수 있음.
//
// axe-core는 package.json에 devDependency로 추가하지 않음 — package.json 상단 설명에
// "script.js/styles.css minify 용도로만 존재, 다른 목적으로 의존성 추가 금지"라고 명시돼
// 있어서, npm 패키지 대신 tests/vendor/axe.min.js에 바이너리를 직접 커밋해 둠(axe-core
// 4.10.2, MPL-2.0 라이선스 — tests/vendor/axe-core-LICENSE.txt 동봉). 버전을 올리려면
// https://registry.npmjs.org/axe-core/-/axe-core-X.Y.Z.tgz 를 받아 안의 axe.min.js로 교체.
//
// 실행 방법 (repo 루트에서, 먼저 `python3 -m http.server 9000`으로 정적 서버를 띄워둘 것):
//   NODE_PATH=/opt/node22/lib/node_modules node tests/a11y_audit.js

const path = require('path');
const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:9000';
const AXE_PATH = path.join(__dirname, 'vendor', 'axe.min.js');

// 템플릿별 대표 페이지 — 180개 전 페이지가 아니라 실제 레이아웃/스타일이 다른 종류만
// 하나씩 골라서 감사 시간을 줄임(petscan-ai도 27개 언어 전부가 아니라 대표 페이지만 검사).
const PAGES = [
  '/index.html',
  '/california-lottery-tax.html',       // 주(state) 페이지 템플릿 대표
  '/china-resident-us-lottery-tax.html', // 국가 거주자 페이지 템플릿 대표
  '/china_in_korea_lottery_tax.html',    // 한국 거주 외국인 페이지 템플릿 대표
  '/korea-resident-us-lottery-tax.html',
  '/lottery-tax-data-hub.html',
  '/biggest-lottery-jackpots-after-tax.html',
  '/us-lottery-tax-rate.html',
  '/widget-embed.html',
  '/sitemap.html',
  '/changelog.html',
  '/contact.html',
  '/press-kit.html',
];

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

async function auditPage(context, urlPath, theme) {
  const page = await context.newPage();
  const issues = [];
  try {
    // 진입 애니메이션(milestonePop 등 @keyframes, .view.on의 view-fade-in, .reveal-up의
    // IntersectionObserver 스크롤 등장 등)이 진행되는 도중 스캔하면 opacity가 아직 최종값에
    // 도달하기 전 중간값이라 axe color-contrast가 실제로는 애니메이션이 끝나면 정상인 요소를
    // 오탐함(2026-08-22 세션이 index.html `#home-milestone`에서, 2026-08-23 세션이
    // contact.html에서 각각 실측 확인). `page.goto()` 이후에 `page.addStyleTag()`로 얼리면
    // contact.html처럼 리다이렉트(location.replace)를 거치는 페이지에서 이미 리다이렉트 전
    // 문서가 IntersectionObserver를 먼저 발동시켜(레이스) 얼리기 전에 실제 0.5s 트랜지션이
    // 시작돼버리는 경우가 있고, CSS는 이미 진행 중인 트랜지션의 duration을 나중에 줄여도
    // 소급 적용을 안 해서 그 트랜지션은 얼리기 전 속도 그대로 끝까지 감(2026-08-23 실측
    // 확인). `page.addInitScript()`는 매 네비게이션(리다이렉트로 이어지는 새 문서 포함)의
    // 어떤 페이지 스크립트보다도 먼저 실행되는 것이 보장되므로, 이 레이스 자체가 성립 안 함 —
    // Percy/Cypress 등에서 쓰는 표준 "스냅샷 전 애니메이션 무력화" 기법과 동일한 목적.
    await page.addInitScript(() => {
      const inject = () => {
        const style = document.createElement('style');
        style.textContent = `*, *::before, *::after{
          animation-duration: 0.001ms !important; animation-delay: 0.001ms !important;
          transition-duration: 0.001ms !important; transition-delay: 0.001ms !important;
        }`;
        (document.head || document.documentElement).appendChild(style);
      };
      // addInitScript는 페이지의 어떤 스크립트보다도 먼저 실행되도록 보장되지만, 그만큼
      // 너무 일찍(파서가 아직 <html>도 안 만든 시점) 실행될 수도 있어서 document.documentElement가
      // null이라 appendChild가 조용히(?) 던지는 걸 실측으로 확인함(2026-08-23) — 그 결과
      // 이 스타일 자체가 통째로 안 들어가서 explore-section의 실제 트랜지션(0.5s)이 그대로
      // 살아있었고, 그게 위 5프레임 settle로도 못 잡던 잔여 opacity(0.668)의 진짜 원인이었음.
      // documentElement가 아직 없으면 MutationObserver로 <html>이 생기는 순간을 기다렸다 주입.
      if (document.documentElement) inject();
      else new MutationObserver((_, obs) => {
        if (document.documentElement) { inject(); obs.disconnect(); }
      }).observe(document, { childList: true });
    });
    await page.goto(BASE + urlPath, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // contact.html처럼 클라이언트 리다이렉트를 거쳐 index.html 해시 라우팅(.view/.view.on
    // 구조)으로 넘어가는 페이지는 domcontentloaded 시점에 아직 라우터가 최종 뷰로 전환
    // 완료하기 전일 수 있음 — `.view.on`이 실제로 나타나고 그 opacity가 최종값(1, 위 얼리기로
    // 이제 즉시 도달함)에 이를 때까지 폴링. 이 SPA 라우팅 구조가 아예 없는 나머지 정적
    // 랜딩페이지(주별/국가별 페이지 등)에서는 `.view` 자체가 없으니 즉시 통과.
    await page.waitForFunction(
      () => {
        if (!document.querySelector('.view')) return true;
        const view = document.querySelector('.view.on');
        return !!view && getComputedStyle(view).opacity === '1';
      },
      { timeout: 5000 }
    );
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForTimeout(200);
    }
    // 스크롤 등장 애니메이션(.reveal-up, script.js의 setupRevealAnimation())은 IntersectionObserver가
    // 스크롤로 뷰포트에 들어와야 opacity:0→1로 바뀌는데, 이 감사는 스크롤을 전혀 안 하므로
    // 뷰포트 밖 섹션은 항상 opacity:0 상태로 스캔됨 — axe color-contrast가 이 반투명 텍스트를
    // "대비 거의 없음(1.0~1.5:1)"으로 오탐하는 걸 2026-08-22 세션이 index.html "explore" 섹션에서
    // 실측으로 확인함(실제 사용자는 스크롤하면 정상 대비로 보임, 사이트 버그 아님). 실제 사용자가
    // 결국 보게 될 최종 상태(다 스크롤된 상태)를 스캔하도록 애니메이션을 완료 상태로 강제 적용.
    // 위 얼리기(addInitScript)로 대부분의 애니메이션은 즉시 최종 프레임으로 스냅되지만,
    // #home-milestone처럼 페이지 로드 후 계산 결과에 따라 나중에(비동기 초기화 체인 중)
    // display:none→block으로 바뀌면서 그제서야 트랜지션이 "시작"되는 요소는, 그 시작 시점과
    // 이 스캔 시점이 정확히 같은 프레임이면 브라우저가 아직 애니메이션 시작 프레임(중간값)
    // 그대로일 수 있음(2026-08-23 실측 — 재실행마다 위반이 나왔다 안 나왔다 하는 걸 확인).
    // requestAnimationFrame을 몇 차례 왕복시켜 이런 "뒤늦게 시작되는" 애니메이션도 최소
    // 한 프레임 이상 지나 최종 프레임에 안착하게 함 — 동시에 .reveal-up도 매 프레임 다시
    // 강제해서, setupRevealAnimation()이 우리보다 늦게 호출돼 새로 뷰포트 밖 섹션에
    // .reveal-up을 붙이는 경우(explore 섹션 등)까지 놓치지 않게 함.
    await page.evaluate(async () => {
      const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      for (let i = 0; i < 5; i++) {
        document.querySelectorAll('.reveal-up').forEach((el) => el.classList.add('is-in'));
        await settle();
      }
    });
    await page.addScriptTag({ path: AXE_PATH });
    const results = await page.evaluate(
      (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
      WCAG_TAGS
    );
    if (results.violations.length) {
      issues.push({ page: urlPath, theme, violations: results.violations });
    }
  } catch (e) {
    issues.push({ page: urlPath, theme, error: e.message });
  }
  await page.close();
  return issues;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const context = await browser.newContext();
  const allIssues = [];

  for (const p of PAGES) {
    for (const theme of ['light', 'dark']) {
      allIssues.push(...(await auditPage(context, p, theme)));
    }
  }

  await browser.close();

  console.log(`검사한 페이지 ${PAGES.length}개 x 2모드 = ${PAGES.length * 2}개 조합 중 위반 발견: ${allIssues.length}개`);
  for (const item of allIssues) {
    console.log(`\n✗ ${item.page} [${item.theme}]`);
    if (item.error) { console.log(`    ERROR: ${item.error}`); continue; }
    item.violations.forEach((v) => {
      console.log(`    [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length}곳)`);
      v.nodes.slice(0, 3).forEach((n) => console.log(`      - ${n.target.join(' ')}`));
    });
  }
  if (allIssues.length === 0) {
    console.log('\n✅ WCAG 2.1 AA 위반 없음 (라이트/다크 모드 둘 다)');
  } else {
    process.exitCode = 1;
  }
})();

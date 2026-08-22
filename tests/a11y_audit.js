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
    await page.goto(BASE + urlPath, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
      await page.waitForTimeout(200);
    }
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

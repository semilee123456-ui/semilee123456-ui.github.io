// 2026-08-03: 사용자가 "모든 기기, 모든 외국어를 빠짐없이" 오버플로우 검사해달라고 요청해서
// 신설. 기존 오버플로우 검사(home_audit.js/wrap_audit.js/audit_odds_compare.js)는 전부
// ko 또는 ko+en 2개 언어만 테스트하고 있었음(재확인 결과) — 나머지 24개 언어는 오버플로우
// 관점에서 한 번도 검증된 적이 없었던 실제 사각지대. 이 스크립트는 사이트가 지원하는
// 전체 27개 언어(ko + 26개 전환 가능 언어) × 대표 화면 폭 5개(작은 폰~큰 폰) × 주요 화면
// 7개를 전수 검사함.
//
// 검사 방식: 처음엔 scrollWidth > clientWidth 기준으로 짰다가, `.menu-links button::after`
// 같은 "터치 영역만 넓히는 투명 가상요소"(position:absolute + 음수 inset, 화면엔 안 보임)가
// 부모의 scrollWidth를 부풀려서 945개 조합 전부가 오탐으로 걸리는 걸 발견함 — 이 프로젝트의
// 기존 audit_odds_compare.js가 이미 쓰고 있던 "실제 렌더링된 박스(getBoundingClientRect)가
// 부모/화면 경계를 벗어나는지" 방식으로 바꿔서 진짜 눈에 보이는 오버플로우만 잡음.
const { chromium } = require('playwright');

const ALL_LANGS = ['ko', 'en', 'zh', 'vi', 'th', 'ru', 'km', 'ne', 'id', 'my', 'si', 'uz', 'mn', 'kk', 'ky', 'ur', 'bn', 'lo', 'ja', 'ar', 'hi', 'fr', 'tl', 'pt', 'es', 'uk', 'tet'];
const WIDTHS = [320, 375, 390, 412, 430];
const VIEWS = ['home', 'compare', 'odds', 'faq', 'privacy', 'disclaimer', 'contact'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const allIssues = [];
  let totalChecks = 0;

  for (const lang of ALL_LANGS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
    try {
      await page.goto('http://127.0.0.1:9000/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
      if (lang !== 'ko') await page.evaluate((l) => setLanguage(l, true), lang);
      await page.waitForTimeout(250);

      for (const view of VIEWS) {
        await page.evaluate((v) => { if (typeof go === 'function') go(v); }, view);
        await page.waitForTimeout(150);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
        await page.waitForTimeout(150);

        for (const w of WIDTHS) {
          await page.setViewportSize({ width: w, height: 1000 });
          await page.waitForTimeout(80);
          totalChecks++;

          const result = await page.evaluate((viewportWidth) => {
            const issues = [];
            // 1) 실제 페이지 전체가 가로 스크롤되는지 (가장 확실한 실제 버그 신호)
            const pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            if (pageOverflow > 3) issues.push({ type: 'page-scroll', over: Math.round(pageOverflow) });

            // 2) 실제로 렌더링된 요소(가상요소 제외, getBoundingClientRect만 사용)가
            //    화면 좌우 경계를 벗어나는지 — audit_odds_compare.js와 같은 방식
            document.querySelectorAll('body *').forEach(el => {
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden') return;
              if (el.closest('[aria-hidden="true"]')) return;
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) return;
              const overRight = r.right - viewportWidth;
              const overLeft = -r.left;
              const over = Math.max(overRight, overLeft);
              if (over > 3) {
                issues.push({
                  type: 'viewport-escape',
                  tag: el.tagName,
                  cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 50) : '',
                  text: (el.textContent || '').trim().slice(0, 40),
                  over: Math.round(over),
                });
              }
            });
            return issues;
          }, w);

          if (result.length) {
            allIssues.push({ lang, view, width: w, issues: result.slice(0, 8) });
          }
        }
      }
    } catch (e) {
      allIssues.push({ lang, error: e.message });
    } finally {
      await page.close();
    }
  }

  console.log(JSON.stringify(allIssues, null, 1));
  console.log(`LANGS: ${ALL_LANGS.length}  WIDTHS: ${WIDTHS.length}  VIEWS: ${VIEWS.length}  TOTAL CHECKS: ${totalChecks}  CONFIGS WITH ISSUES: ${allIssues.length}`);
  await browser.close();
  process.exit(allIssues.length ? 1 : 0);
})();

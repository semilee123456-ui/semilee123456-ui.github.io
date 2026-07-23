// 국가 카드(#sideByCountryGrid .side-card)를 탭했을 때 지도(#countryMapWrap)가 화면 밖에
// 남아있는 회귀 검사. 지도는 view-compare에만 있음(view-home 아님) — 반드시 국가별 비교
// 탭에서 확인할 것.
const { chromium } = require('playwright');
const widths = [320, 375, 390, 412, 430];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const issues = [];

  for (const lang of ['ko', 'en']) {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 700 } });
      try {
        await page.goto('http://127.0.0.1:9000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        if (lang === 'en') await page.evaluate(() => setLanguage('en'));
        await page.evaluate(() => go('compare'));
        await page.waitForTimeout(300);

        // 지도가 화면 밖으로 스크롤되게 카드 그리드까지 강제로 내림
        await page.evaluate(() => {
          const grid = document.getElementById('sideByCountryGrid');
          if (grid) grid.scrollIntoView({ block: 'end' });
        });
        await page.waitForTimeout(200);

        const mapVisibleBefore = await page.evaluate(() => {
          const wrap = document.getElementById('countryMapWrap');
          if (!wrap) return null;
          const r = wrap.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        });

        // 두 번째 국가 카드를 클릭 (첫 카드는 이미 활성 상태라 스크롤이 안 일어날 수 있어서 회피)
        const clicked = await page.evaluate(() => {
          const cards = document.querySelectorAll('#sideByCountryGrid .side-card');
          if (cards.length < 2) return false;
          cards[1].click();
          return true;
        });
        if (!clicked) { issues.push({ lang, w, error: 'side-card not found (< 2 cards)' }); await page.close(); continue; }

        await page.waitForTimeout(600); // smooth scroll 애니메이션 대기

        const result = await page.evaluate(() => {
          const wrap = document.getElementById('countryMapWrap');
          if (!wrap) return { found: false };
          const r = wrap.getBoundingClientRect();
          const visible = wrap.getClientRects().length > 0 && r.bottom > 0 && r.top < window.innerHeight;
          return { found: true, top: r.top, bottom: r.bottom, viewportHeight: window.innerHeight, visible };
        });

        if (!result.found) {
          issues.push({ lang, w, error: '#countryMapWrap not found' });
        } else if (!result.visible) {
          issues.push({ lang, w, mapVisibleBeforeClick: mapVisibleBefore, mapTop: result.top, mapBottom: result.bottom, viewportHeight: result.viewportHeight });
        }
      } catch (e) {
        issues.push({ lang, w, error: e.message });
      }
      await page.close();
    }
  }

  console.log(JSON.stringify(issues, null, 2));
  console.log('TOTAL:', widths.length * 2, 'ISSUES:', issues.length);
  await browser.close();
  process.exit(0);
})();

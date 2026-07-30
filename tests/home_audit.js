// 2026-07-30: 셀렉트 대상에 .input-card를 추가함 — 국가 select에 라벨을 붙였을 때(홈
// 화면 통화/국가 select 줄) 영어 라벨("Country"/"Currency")이 한글보다 길어서 카드 왼쪽 밖으로
// 삐져나가는 실제 렌더링 버그가 있었는데, 이 감사가 그때까지 .panel/.trust-panel 등만 보고
// .input-card는 안 봐서 못 잡았음(Playwright 스크린샷으로 직접 확인하다가 뒤늦게 발견) — 같은
// 사각지대가 남지 않도록 여기 포함시킴
const { chromium } = require('playwright');
const widths = [240, 280, 320, 344, 375, 390, 393, 412, 430];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const allIssues = [];

  for (const lang of ['ko', 'en']) {
    for (const w of widths) {
      const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
      try {
        await page.goto('http://127.0.0.1:9000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        if (lang === 'en') await page.evaluate(() => setLanguage('en'));
        await page.waitForTimeout(300);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
        await page.waitForTimeout(300);

        const result = await page.evaluate(() => {
          const pageOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          const escapes = [];
          document.querySelectorAll('.panel, .trust-panel, .fun-toggle, .more-details-toggle, .input-card').forEach(card => {
            const cr = card.getBoundingClientRect();
            if (cr.width === 0) return;
            card.querySelectorAll('*').forEach(child => {
              const cs = getComputedStyle(child);
              if (cs.display === 'none' || cs.visibility === 'hidden' || child.closest('[aria-hidden="true"]')) return;
              const r = child.getBoundingClientRect();
              if (r.width === 0 || r.height === 0) return;
              if (r.right > cr.right + 1.5 || r.left < cr.left - 1.5) {
                escapes.push({ cls: child.className && typeof child.className === 'string' ? child.className.slice(0,40) : child.tagName, over: Math.max(r.right-cr.right, cr.left-r.left).toFixed(1) });
              }
            });
          });
          return { pageOverflow, escapes };
        });

        const realEscapes = result.escapes.filter(e => parseFloat(e.over) > 2);
        if (result.pageOverflow > 0 || realEscapes.length > 0) {
          allIssues.push({ lang, w, overflow: result.pageOverflow, escapes: realEscapes.slice(0,5) });
        }
      } catch (e) {
        allIssues.push({ lang, w, error: e.message });
      }
      await page.close();
    }
  }

  console.log(JSON.stringify(allIssues, null, 1));
  console.log('TOTAL:', widths.length * 2, 'ISSUES:', allIssues.length);
  await browser.close();
  process.exit(0);
})();

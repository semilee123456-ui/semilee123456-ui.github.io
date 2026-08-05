const { chromium } = require('playwright');
const WIDTHS = [320, 360, 375, 390, 412, 430, 480, 600, 768];
const LANGS = ['ko', 'en'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const issues = [];
  for (const width of WIDTHS) {
    for (const lang of LANGS) {
      const page = await browser.newPage({ viewport: { width, height: 1200 } });
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      // domcontentloaded로: 기본값(load)은 광고·폰트CDN·환율API 같은 외부 리소스가 전부
      // 끝나야 resolve되는데, 네트워크가 제한된 샌드박스에서 이 파일들이 늘 pending 상태로
      // 남아 goto()가 영원히 안 끝남(2026-08-05 발견 — 다른 audit 스크립트는 전부
      // domcontentloaded를 쓰는데 이 파일만 빠져있었음). 실사용자 브라우저는 인터넷이
      // 정상이라 load 이벤트가 잘 뜨므로 사이트 자체 버그 아님.
      await page.goto('http://127.0.0.1:9000/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(200);
      if (lang === 'en') { await page.evaluate(() => setLanguage('en')); await page.waitForTimeout(150); }
      await page.evaluate(() => { if (typeof go === 'function') go('faq'); });
      await page.waitForTimeout(200);
      await page.click('#view-faq .more-details-toggle summary');
      await page.waitForTimeout(150);
      const panels = page.locator('#view-faq .panel-accordion');
      const count = await panels.count();
      for (let i = 0; i < count; i++) {
        await panels.nth(i).locator('> summary').click();
      }
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('#view-faq *').forEach(el => {
          if (el.scrollWidth > el.clientWidth + 3 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflowX !== 'scroll') {
            results.push({ tag: el.tagName, cls: el.className, sw: el.scrollWidth, cw: el.clientWidth });
          }
        });
        return results;
      });
      if (overflow.length) issues.push({ width, lang, overflow });
      if (pageErrors.length) issues.push({ width, lang, jsErrors: pageErrors });
      await page.close();
    }
  }
  console.log(JSON.stringify(issues, null, 2));
  console.log('TOTAL CONFIGS:', WIDTHS.length * LANGS.length, 'ISSUES:', issues.length);
  await browser.close();
})();

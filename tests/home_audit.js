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
          document.querySelectorAll('.panel, .trust-panel, .fun-toggle, .more-details-toggle').forEach(card => {
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

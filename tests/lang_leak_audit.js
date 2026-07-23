// 한국어가 아닌 언어를 선택했는데 한글이 3자 이상 연속으로 화면에 남아있는 경우(번역
// 누락으로 인한 언어 혼용)를 찾음. getClientRects().length로 실제 렌더링 여부를 확인해서
// 조상 요소의 display:none에 가려진 요소를 오탐하지 않게 함.
const { chromium } = require('playwright');
const LANGS = ['en','zh','vi','th','ru','km','ne','id','my','si','uz','mn','kk','ky','ur','bn','lo','ja','ar','hi','fr','tl'];
const VIEWS = ['home', 'compare', 'odds', 'faq'];
const HANGUL_RUN = /[가-힣]{3,}/g;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const issues = [];

  for (const lang of LANGS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 1200 } });
    try {
      await page.goto('http://127.0.0.1:9000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.evaluate((l) => setLanguage(l), lang);
      await page.waitForTimeout(200);

      for (const view of VIEWS) {
        await page.evaluate((v) => { if (typeof go === 'function') go(v); }, view);
        await page.waitForTimeout(150);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
        await page.waitForTimeout(150);

        const leaks = await page.evaluate((viewId) => {
          const root = document.getElementById('view-' + viewId);
          if (!root) return [];
          const found = [];
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              if (!node.nodeValue || !/[가-힣]{3,}/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
              const p = node.parentElement;
              if (!p) return NodeFilter.FILTER_REJECT;
              if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
              if (p.getClientRects().length === 0) return NodeFilter.FILTER_REJECT; // 실제로 안 보이면 제외
              return NodeFilter.FILTER_ACCEPT;
            }
          });
          let node;
          while ((node = walker.nextNode())) {
            const m = node.nodeValue.match(/[가-힣]{3,}/g);
            const p = node.parentElement;
            found.push({
              text: node.nodeValue.trim().slice(0, 60),
              matches: m,
              cls: p.className && typeof p.className === 'string' ? p.className.slice(0, 40) : p.tagName,
            });
          }
          return found;
        }, view);

        if (leaks.length) issues.push({ lang, view, leaks });
      }
    } catch (e) {
      issues.push({ lang, error: e.message });
    }
    await page.close();
  }

  console.log(JSON.stringify(issues, null, 2));
  console.log('TOTAL CONFIGS:', LANGS.length * VIEWS.length, 'ISSUES:', issues.length);
  await browser.close();
  process.exit(0);
})();

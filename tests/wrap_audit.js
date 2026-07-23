// 단어+괄호/%가 공백 없이 붙어있다가 좁은 화면에서 그 지점 그대로 줄바꿈되는 버그 검사.
// Range.getClientRects()로 경계 문자 바로 앞/뒤 글자의 렌더링 줄(top)을 비교해서,
// 공백이 아닌 곳에서 실제로 줄이 갈렸는지 확인함 (정적 텍스트 분석이 아니라 실제 렌더링 기준).
const { chromium } = require('playwright');
const widths = [320, 344, 360, 375, 390, 412, 414];
const views = ['home', 'compare', 'odds', 'faq'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const issues = [];

  for (const w of widths) {
    for (const view of views) {
      const page = await browser.newPage({ viewport: { width: w, height: 1200 } });
      try {
        await page.goto('http://127.0.0.1:9000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.evaluate((v) => { if (typeof go === 'function') go(v); }, view);
        await page.waitForTimeout(200);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
        await page.waitForTimeout(300);

        const found = await page.evaluate((viewId) => {
          const root = document.getElementById('view-' + viewId);
          if (!root) return [];
          const results = [];
          const boundaryChars = ['(', ')', '%'];
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
              if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
              const p = node.parentElement;
              if (!p) return NodeFilter.FILTER_REJECT;
              const tag = p.tagName;
              if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
              if (p.closest('[aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
              if (p.getClientRects().length === 0) return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            }
          });
          let node;
          while ((node = walker.nextNode())) {
            const text = node.nodeValue;
            for (let i = 1; i < text.length; i++) {
              const ch = text[i];
              if (!boundaryChars.includes(ch)) continue;
              const prevCh = text[i - 1];
              if (/\s/.test(prevCh)) continue; // 원래 공백이 있던 자리는 대상 아님
              try {
                const r1 = document.createRange();
                r1.setStart(node, i - 1); r1.setEnd(node, i);
                const r2 = document.createRange();
                r2.setStart(node, i); r2.setEnd(node, i + 1);
                const rect1 = r1.getClientRects()[0];
                const rect2 = r2.getClientRects()[0];
                if (!rect1 || !rect2) continue;
                if (Math.abs(rect1.top - rect2.top) > 2) {
                  // 실제로 이 지점에서 줄이 갈림 = 버그
                  const snippet = text.slice(Math.max(0, i - 8), i + 8);
                  results.push({
                    snippet,
                    boundaryChar: ch,
                    cls: node.parentElement.className && typeof node.parentElement.className === 'string' ? node.parentElement.className.slice(0, 40) : node.parentElement.tagName,
                  });
                }
              } catch (e) { /* ignore range errors */ }
            }
          }
          return results;
        }, view);

        if (found.length) issues.push({ w, view, found });
      } catch (e) {
        issues.push({ w, view, error: e.message });
      }
      await page.close();
    }
  }

  console.log(JSON.stringify(issues, null, 2));
  console.log('TOTAL:', widths.length * views.length, 'ISSUES:', issues.length);
  await browser.close();
  process.exit(0);
})();

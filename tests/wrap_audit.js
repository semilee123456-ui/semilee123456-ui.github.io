// 단어+괄호/%가 공백 없이 붙어있다가 좁은 화면에서 그 지점 그대로 줄바꿈되는 버그 검사.
// Range.getClientRects()로 경계 문자 바로 앞/뒤 글자의 렌더링 줄(top)을 비교해서,
// 공백이 아닌 곳에서 실제로 줄이 갈렸는지 확인함 (정적 텍스트 분석이 아니라 실제 렌더링 기준).
const { chromium } = require('playwright');
const widths = [320, 344, 360, 375, 390, 412, 414];
const views = ['home', 'compare', 'odds', 'faq'];
// 2026-08-02: FAQ의 "재외국민 전용" 질문/답변(data-basis="us"/"cn"/... + data-audience)은
// sharedCountry가 그 나라로 선택돼있을 때만 화면에 보임(기본값 kr) — 기존 wrap_audit는 항상
// 기본 country=kr로만 FAQ를 열어서 이 20개국 항목은 getClientRects().length===0으로 걸러져
// 한 번도 실제 검증된 적이 없었음(i18n_attr_lint.js가 잡은 41개 후보가 실제로 줄바꿈되는지
// 검증되지 않은 채 방치된 원인). 아래 국가 목록으로 하나씩 전환해가며 같은 방식으로 재검증.
const FAQ_AUDIENCE_COUNTRIES = ['us','cn','in','vn','id','ph','jp','th','ru','np','lk','uz','kz','kg','mm','bd','pk','kh','mn','la'];

function checkBoundaryWraps(root) {
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
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const issues = [];
  let totalChecks = 0;

  for (const w of widths) {
    for (const view of views) {
      // 2026-08-02: locale/?lang=ko를 명시하지 않으면 이 함정(테스트 짤 때 흔한 함정 #6 참고)에
      // 걸려서 Playwright 기본 브라우저 로케일(en-US 등)로 navigator.language 자동감지가
      // 작동해 영어로 렌더링된 채 테스트될 수 있음 — 이 검사의 원래 목적(한국어 "단어(설명)"
      // 줄바꿈)이 무력화되므로 명시적으로 고정함.
      const page = await browser.newPage({ viewport: { width: w, height: 1200 }, locale: 'ko-KR' });
      await page.addInitScript(checkBoundaryWraps.toString() + '; window.__checkBoundaryWraps = checkBoundaryWraps;');
      try {
        await page.goto('http://127.0.0.1:9000/index.html?lang=ko', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.evaluate((v) => { if (typeof go === 'function') go(v); }, view);
        await page.waitForTimeout(200);
        await page.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
        await page.waitForTimeout(300);

        const found = await page.evaluate((viewId) => {
          const root = document.getElementById('view-' + viewId);
          return root ? window.__checkBoundaryWraps(root) : [];
        }, view);
        totalChecks++;
        if (found.length) issues.push({ w, view, found });

        if (view === 'faq') {
          for (const country of FAQ_AUDIENCE_COUNTRIES) {
            const foundForCountry = await page.evaluate((c) => {
              if (typeof setHomeCountry === 'function') setHomeCountry(c, true);
              const items = document.querySelectorAll(`#view-faq details[data-basis="${c}"][data-audience]`);
              const results = [];
              items.forEach(el => { results.push(...window.__checkBoundaryWraps(el)); });
              return results;
            }, country);
            totalChecks++;
            if (foundForCountry.length) issues.push({ w, view: 'faq', country, found: foundForCountry });
          }
        }
      } catch (e) {
        issues.push({ w, view, error: e.message });
      }
      await page.close();
    }
  }

  console.log(JSON.stringify(issues, null, 2));
  console.log('TOTAL:', totalChecks, 'ISSUES:', issues.length);
  await browser.close();
  process.exit(0);
})();

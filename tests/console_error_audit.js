// 언어 x 화면 조합을 로드할 때 JS 콘솔 에러(console.error, 처리되지 않은 예외)가 나는지 검사.
const { chromium } = require('playwright');
const LANGS = ['ko', 'en', 'zh', 'vi', 'th', 'ru', 'km', 'ne', 'id', 'my', 'si', 'uz', 'mn', 'kk', 'ky', 'ur', 'bn', 'lo', 'ja', 'ar', 'hi', 'fr', 'tl', 'de', 'nl', 'sv', 'no', 'da', 'fi', 'it', 'pl', 'tr'];
const VIEWS = ['home', 'compare', 'odds', 'faq', 'privacy', 'disclaimer', 'contact'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const issues = [];

  for (const lang of LANGS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const errors = [];
    // 이 샌드박스 환경은 외부 인터넷(폰트 CDN·광고·환율 API 등)이 막혀있어서 그로 인한
    // "Failed to load resource" 콘솔 에러는 실제 코드 버그가 아니라 환경 제약임 — 같은 오리진
    // (로컬 서버) 리소스 실패나 그 외의 진짜 JS 에러만 잡음. fetch()로 호출하는 외부 API
    // (환율 등)는 같은 네트워크 제약이 "Access to fetch at ... blocked by CORS policy"
    // 형태로 다르게 찍혀서(2026-11-01 발견) 별도로 같이 거름.
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      if (/^Failed to load resource/.test(msg.text())) return;
      if (/^Access to fetch at .* has been blocked by CORS policy/.test(msg.text())) return;
      errors.push(msg.text().slice(0, 200));
    });
    // TagError: 구글 애드센스 자체 스크립트(GPT)가 광고 요청이 막혔을 때 내부적으로 던지는
    // 에러 — 위 "Failed to load resource" 필터와 같은 샌드박스 네트워크 제약이 원인, 우리
    // 코드 버그 아님(2026-11-01 발견: name==='TagError', message==='Y', 광고 요청이
    // net::ERR_ABORTED로 막힐 때만 간헐적으로 발생 — 재현해서 원인 확인함).
    page.on('pageerror', e => {
      if (e.name === 'TagError') return;
      errors.push('pageerror: ' + e.message.slice(0, 200));
    });
    page.on('requestfailed', req => {
      try {
        if (new URL(req.url()).origin === 'http://127.0.0.1:9000') {
          errors.push('requestfailed(local): ' + req.url() + ' ' + (req.failure() && req.failure().errorText));
        }
      } catch (e) {}
    });

    try {
      await page.goto('http://127.0.0.1:9000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (lang !== 'ko') await page.evaluate((l) => setLanguage(l), lang);
      await page.waitForTimeout(200);

      for (const view of VIEWS) {
        errors.length = 0;
        await page.evaluate((v) => { if (typeof go === 'function') go(v); }, view);
        await page.waitForTimeout(250);
        if (errors.length) {
          issues.push({ lang, view, errors: [...new Set(errors)].slice(0, 5) });
        }
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

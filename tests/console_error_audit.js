// 언어 x 화면 조합을 로드할 때 JS 콘솔 에러(console.error, 처리되지 않은 예외)가 나는지 검사.
const { chromium } = require('playwright');
const LANGS = ['ko', 'en', 'zh', 'vi', 'th', 'ru', 'km', 'ne', 'id', 'my', 'si', 'uz', 'mn', 'kk', 'ky', 'ur', 'bn', 'lo', 'ja', 'ar', 'hi', 'fr', 'tl'];
const VIEWS = ['home', 'compare', 'odds', 'faq', 'privacy', 'disclaimer', 'contact'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const issues = [];

  for (const lang of LANGS) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    const errors = [];
    // 이 샌드박스 환경은 외부 인터넷(폰트 CDN·광고·환율 API 등)이 막혀있어서 그로 인한
    // "Failed to load resource" 콘솔 에러는 실제 코드 버그가 아니라 환경 제약임 — 같은 오리진
    // (로컬 서버) 리소스 실패나 그 외의 진짜 JS 에러만 잡음.
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      if (/^Failed to load resource/.test(msg.text())) return;
      errors.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
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

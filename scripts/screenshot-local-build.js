// Reusable helper: screenshot the live/local ChamTax build (index.html served
// by `python3 -m http.server`) at a given mobile viewport, walking Home →
// Compare → Odds → FAQ (button ids nav-compare/nav-odds/nav-faq, logo click
// for Home) and toggling dark mode via the settings panel
// (#settingsMenu summary → #theme-toggle), for side-by-side comparison
// against a rendered UX-handoff mockup (see screenshot-dc-mockup.js).
//
// Usage: NODE_PATH=/opt/node22/lib/node_modules node scripts/screenshot-local-build.js <url> <outDir>
const { chromium } = require('playwright');

const url = process.argv[2];
const outDir = process.argv[3];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  // Force Korean: script.js auto-detects UI language from navigator.language
  // when no ?lang=/localStorage override is present, and Playwright's default
  // locale (en-US) would otherwise silently switch the whole build to English
  // — a false "gap" against the Korean-only mockup, not a real one.
  const page = await browser.newPage({ viewport: { width: 400, height: 900 }, locale: 'ko-KR' });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);

  // The live build uses IntersectionObserver-driven `.reveal-up` fade-ins
  // (opacity:0 until scrolled into view). Playwright's fullPage screenshot
  // resizes the viewport rather than performing a real scroll, so those
  // observers never fire and whole sections (e.g. the Compare tab's country
  // ranking grid) silently render invisible in the capture even though the
  // DOM content is present. Walk the page in steps first so every section
  // has actually been "seen" at least once.
  const scrollThroughPage = async () => {
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 400) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
  };

  const shot = async (name) => {
    await scrollThroughPage();
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    console.log('saved', name);
  };

  const toggleDark = async () => {
    const summary = page.locator('#settingsMenu > summary');
    const details = page.locator('#settingsMenu');
    const isOpen = await details.evaluate((el) => el.hasAttribute('open')).catch(() => false);
    if (!isOpen) {
      await summary.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    await page.locator('#theme-toggle').click().catch(() => {});
    await page.waitForTimeout(300);
    if (!isOpen) {
      await summary.click().catch(() => {}); // close panel again
      await page.waitForTimeout(200);
    }
  };

  await shot('home-light');
  await toggleDark();
  await shot('home-dark');
  await toggleDark(); // back to light

  const goTab = async (id) => {
    const btn = page.locator(`#${id}`);
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(400);
      return true;
    }
    console.log('tab not found:', id);
    return false;
  };

  for (const [id, slug] of [
    ['nav-compare', 'compare'],
    ['nav-odds', 'odds'],
    ['nav-faq', 'faq'],
  ]) {
    if (!(await goTab(id))) continue;
    await shot(`${slug}-light`);
    await toggleDark();
    await shot(`${slug}-dark`);
    await toggleDark();
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

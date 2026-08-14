// One-off / reusable helper: render a ".dc.html" design-mockup export (the
// custom "dc-runtime" prototyping format used in UX handoffs — React loaded
// from unpkg at runtime, template driven by <x-dc>/<sc-if>/<sc-for> tags) and
// capture full-page screenshots at a given viewport, walking through the
// in-page tab navigation (Home/Compare/Odds/FAQ pill links) and toggling
// dark mode via the theme button (aria-label "테마 전환").
//
// Network note: this sandbox's outbound HTTPS is transparently intercepted
// by a local CA-terminating proxy that Chromium's own cert verifier does not
// trust (Chrome Root Store ignores the OS/NSS trust store), so any direct
// https:// navigation inside the browser fails with ERR_CONNECTION_RESET /
// ERR_CERT_AUTHORITY_INVALID even though curl/node fetch work fine. Rather
// than fight Chromium's trust store, we launch it with NO proxy at all and
// intercept every https:// request with page.route(), fulfilling it via
// Node's own fetch() (which does honor NODE_EXTRA_CA_CERTS). Plain http://
// requests (the local static server) go straight through, untouched.
//
// Usage: NODE_PATH=/opt/node22/lib/node_modules node scripts/screenshot-dc-mockup.js <url> <outDir> [--tabs=Home,Compare,Odds,FAQ]
const { chromium } = require('playwright');

const url = process.argv[2];
const outDir = process.argv[3];
const tabsArg = process.argv.find((a) => a.startsWith('--tabs='));
const tabs = tabsArg ? tabsArg.slice('--tabs='.length).split(',') : ['Compare', 'Odds', 'FAQ'];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });

  await page.route(/^https:\/\//, async (route) => {
    try {
      const req = route.request();
      const resp = await fetch(req.url(), {
        method: req.method(),
        headers: req.headers(),
        body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() || undefined,
      });
      const buf = Buffer.from(await resp.arrayBuffer());
      await route.fulfill({
        status: resp.status,
        headers: Object.fromEntries(resp.headers.entries()),
        body: buf,
      });
    } catch (e) {
      console.log('[route error]', route.request().url(), e.message);
      await route.abort();
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  // give the React app time to boot + fetch fonts/CDN scripts
  await page.waitForTimeout(2000);

  const shot = async (name) => {
    await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: true });
    console.log('saved', name);
  };

  const themeToggle = page.locator('[aria-label="테마 전환"]').first();
  const toggleDark = async () => {
    if (await themeToggle.count()) {
      await themeToggle.click().catch(() => {});
      await page.waitForTimeout(300);
      return true;
    }
    console.log('no theme toggle found');
    return false;
  };

  await shot('home-light');
  if (await toggleDark()) {
    await shot('home-dark');
    await toggleDark(); // back to light
  }

  const goTab = async (label) => {
    const link = page.locator(`a:has-text("${label}")`).first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(400);
      return true;
    }
    console.log('tab not found:', label);
    return false;
  };

  for (const tab of tabs) {
    if (!(await goTab(tab))) continue;
    const slug = tab.toLowerCase();
    await shot(`${slug}-light`);
    if (await toggleDark()) {
      await shot(`${slug}-dark`);
      await toggleDark();
    }
  }

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

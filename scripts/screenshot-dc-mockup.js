// One-off / reusable helper: render a ".dc.html" design-mockup export (the
// custom "dc-runtime" prototyping format used in UX handoffs — React loaded
// from unpkg at runtime, template driven by <x-dc>/<sc-if>/<sc-for> tags) and
// capture full-page screenshots at a given viewport, walking through the
// in-page tab navigation (Home/Compare/Odds/FAQ pill links) and toggling
// dark mode via the settings globe button.
//
// Usage: NODE_PATH=/opt/node22/lib/node_modules node scripts/screenshot-dc-mockup.js <url> <outDir>
const { chromium } = require('playwright');

const url = process.argv[2];
const outDir = process.argv[3];

(async () => {
  const proxyServer = process.env.HTTPS_PROXY || process.env.https_proxy;
  // The local mockup/build server is plain http:// on 127.0.0.1 and must go
  // direct — the CCR agent proxy rejects plain-HTTP absolute-form requests
  // outright (see /root/.ccr/README.md). "<local>" is Chromium's bypass
  // token for loopback/private addresses; list it alongside explicit values
  // since plain IP-literal bypass entries aren't always honored.
  const browser = await chromium.launch(
    proxyServer
      ? { proxy: { server: proxyServer, bypass: '<local>,127.0.0.1,localhost' } }
      : {}
  );
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
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

  await shot('01-home-light');

  // dark mode: try clicking the moon/settings toggle if present
  const moon = page.locator('text=🌙').first();
  if (await moon.count()) {
    await moon.click().catch(() => {});
    await page.waitForTimeout(300);
    await shot('02-home-dark');
    await moon.click().catch(() => {}); // back to light
    await page.waitForTimeout(300);
  } else {
    console.log('no moon toggle found');
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

  if (await goTab('Compare')) await shot('03-compare-light');
  if (await goTab('Odds')) await shot('04-odds-light');
  if (await goTab('FAQ')) await shot('05-faq-light');

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

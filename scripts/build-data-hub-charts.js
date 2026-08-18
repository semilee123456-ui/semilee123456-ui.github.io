// Generates the two static chart images embedded in lottery-tax-data-hub.html for
// image-search SEO (plain SVG files, not client-side-rendered charts, so Google
// Images can index them directly — see that page's "why SVG not a live chart"
// comment). Numbers come from mcp-server/tax-data.js (see build-lottery-tax-data-hub.js
// for the state/country dataset this reads from), not hand-typed.
//
// Rerun whenever the underlying rates change: node scripts/build-data-hub-charts.js
// Writes:
//   us-lottery-tax-rate-by-state-chart.svg
//   us-lottery-tax-by-country-500-million-chart.svg

const fs = require('fs');
const path = require('path');
const { calculateTakeHome, STATE_TAX_RATES } = require('../mcp-server/tax-data.js');

const ROOT = path.join(__dirname, '..');

// Site color tokens (from styles.css :root, light mode — these are static export
// images so they don't theme-switch with the page; picked to read fine on either).
const COLOR = {
  bg: '#FFFFFF',
  card: '#F4F5F7',
  bar: '#155445', // --teal
  barZero: '#828C97', // --border, muted — visually distinct from the taxed bars
  text: '#262420', // --text-dark
  muted: '#544E42', // --text-muted
  grid: '#D8DBE0',
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Chart 1: State tax rate comparison — top 8 highest vs. 8 states with no tax
// on lottery winnings.
// ---------------------------------------------------------------------------
function buildStateChart() {
  const rows = Object.keys(STATE_TAX_RATES)
    .filter((c) => c !== 'AVG')
    .map((c) => ({ code: c, name: STATE_TAX_RATES[c].labelEn.replace(' (lottery winnings exempt)', ''), rate: STATE_TAX_RATES[c].rate }))
    .sort((a, b) => b.rate - a.rate);

  const top8 = rows.slice(0, 8);
  const zero8 = rows
    .filter((r) => r.rate === 0)
    .filter((r) => ['CA', 'TX', 'FL', 'WA', 'NV', 'TN', 'SD', 'NH'].includes(r.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  const bars = [...top8, ...zero8];

  const W = 720,
    marginLeft = 190,
    marginRight = 90,
    barH = 26,
    gap = 10,
    marginTop = 74,
    marginBottom = 34;
  const plotW = W - marginLeft - marginRight;
  const H = marginTop + bars.length * (barH + gap) + marginBottom;
  const maxRate = 0.11; // fixed scale (fraction, matches STATE_TAX_RATES units) so bar length is visually honest across the two groups
  const dividerY = marginTop + top8.length * (barH + gap) - gap / 2;

  let bodyRows = '';
  bars.forEach((r, i) => {
    const y = marginTop + i * (barH + gap);
    const w = Math.max((r.rate / maxRate) * plotW, r.rate === 0 ? 0 : 3);
    const isZero = r.rate === 0;
    const fill = isZero ? COLOR.barZero : COLOR.bar;
    const label = isZero ? 'No tax on winnings' : (r.rate * 100).toFixed(2).replace(/\.?0+$/, '') + '%';
    bodyRows += `
    <text x="${marginLeft - 10}" y="${y + barH / 2 + 5}" text-anchor="end" font-size="14" fill="${COLOR.text}" font-family="Arial,Helvetica,sans-serif">${esc(r.name)}</text>
    <rect x="${marginLeft}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="4" fill="${fill}"/>
    <text x="${marginLeft + w + 8}" y="${y + barH / 2 + 5}" font-size="13" fill="${isZero ? COLOR.muted : COLOR.text}" font-family="Arial,Helvetica,sans-serif" font-weight="${isZero ? 400 : 700}">${label}</text>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="stChartTitle stChartDesc">
  <title id="stChartTitle">US lottery tax rate by state: highest vs. no-tax states</title>
  <desc id="stChartDesc">Horizontal bar chart comparing the 8 US states with the highest lottery/state income tax rate on a jackpot-size win against 8 states that charge no state tax on lottery winnings, based on top marginal state income tax rates.</desc>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COLOR.bg}"/>
  <text x="${marginLeft}" y="30" font-size="18" font-weight="700" fill="${COLOR.text}" font-family="Arial,Helvetica,sans-serif">US lottery tax rate by state</text>
  <text x="${marginLeft}" y="50" font-size="13" fill="${COLOR.muted}" font-family="Arial,Helvetica,sans-serif">Top marginal state tax rate on a jackpot win, highest 8 vs. 8 no-tax states</text>
  <line x1="${marginLeft}" y1="${dividerY}" x2="${W - marginRight}" y2="${dividerY}" stroke="${COLOR.grid}" stroke-width="1" stroke-dasharray="3,3"/>
  ${bodyRows}
</svg>`;
  fs.writeFileSync(path.join(ROOT, 'us-lottery-tax-rate-by-state-chart.svg'), svg);
  console.log('Wrote us-lottery-tax-rate-by-state-chart.svg', W, 'x', H);
}

// ---------------------------------------------------------------------------
// Chart 2: Country take-home comparison at a $500M lump-sum jackpot.
// ---------------------------------------------------------------------------
function buildCountryChart() {
  const scenarios = [
    { code: 'kr', label: 'South Korea', opts: { krwPerUsd: 1487.73 } },
    { code: 'us', label: 'US resident (Texas)', opts: { stateCode: 'TX' } },
    { code: 'us', label: 'US resident (California)', opts: { stateCode: 'CA' } },
    { code: 'vn', label: 'Vietnam', opts: {} },
    { code: 'cn', label: 'China', opts: {} },
    { code: 'in', label: 'India', opts: {} },
    { code: 'tr', label: 'Turkey', opts: {} },
    { code: 'pl', label: 'Poland', opts: {} },
  ];
  const rows = scenarios
    .map((s) => {
      const r = calculateTakeHome(500000000, s.code, s.opts.stateCode, s.opts.krwPerUsd);
      return { label: s.label, takeHomePct: 100 - r.effectiveTaxRatePct, takeHomeUsd: r.takeHomeUsd };
    })
    .sort((a, b) => b.takeHomePct - a.takeHomePct);

  const W = 720,
    marginLeft = 200,
    marginRight = 130,
    barH = 30,
    gap = 14,
    marginTop = 74,
    marginBottom = 34;
  const plotW = W - marginLeft - marginRight;
  const H = marginTop + rows.length * (barH + gap) + marginBottom;
  const maxPct = 80;

  let bodyRows = '';
  rows.forEach((r, i) => {
    const y = marginTop + i * (barH + gap);
    const w = (r.takeHomePct / maxPct) * plotW;
    const usd = '$' + Math.round(r.takeHomeUsd / 1e6) + 'M';
    bodyRows += `
    <text x="${marginLeft - 10}" y="${y + barH / 2 + 5}" text-anchor="end" font-size="14" fill="${COLOR.text}" font-family="Arial,Helvetica,sans-serif">${esc(r.label)}</text>
    <rect x="${marginLeft}" y="${y}" width="${w.toFixed(1)}" height="${barH}" rx="4" fill="${COLOR.bar}"/>
    <text x="${marginLeft + w + 8}" y="${y + barH / 2 + 5}" font-size="13" fill="${COLOR.text}" font-family="Arial,Helvetica,sans-serif" font-weight="700">${r.takeHomePct.toFixed(1)}% (${usd})</text>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="ctChartTitle ctChartDesc">
  <title id="ctChartTitle">$500 million US lottery jackpot take-home by country of residence</title>
  <desc id="ctChartDesc">Horizontal bar chart comparing the estimated after-tax take-home amount of a $500,000,000 lump-sum US Powerball or Mega Millions jackpot across 8 countries of residence, including US federal/state tax and non-resident withholding plus each country's own tax treatment.</desc>
  <rect x="0" y="0" width="${W}" height="${H}" fill="${COLOR.bg}"/>
  <text x="${marginLeft}" y="30" font-size="18" font-weight="700" fill="${COLOR.text}" font-family="Arial,Helvetica,sans-serif">$500M jackpot take-home by country</text>
  <text x="${marginLeft}" y="50" font-size="13" fill="${COLOR.muted}" font-family="Arial,Helvetica,sans-serif">Lump-sum win, after US + home-country tax, by residence</text>
  ${bodyRows}
</svg>`;
  fs.writeFileSync(path.join(ROOT, 'us-lottery-tax-by-country-500-million-chart.svg'), svg);
  console.log('Wrote us-lottery-tax-by-country-500-million-chart.svg', W, 'x', H);
}

buildStateChart();
buildCountryChart();

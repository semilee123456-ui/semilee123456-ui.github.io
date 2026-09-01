// Regenerates the open dataset behind lottery-tax-data-hub.html:
//   data/state-lottery-tax-rates.{csv,json}
//   data/country-lottery-tax-rates.{csv,json}
// and prints ready-to-paste HTML <table> fragments (state table, country table,
// $100M/$500M/$1B reference-scenario table) so the page's numbers never have to be
// hand-transcribed from script.js.
//
// Source of truth: mcp-server/tax-data.js (itself a hand-synced numeric mirror of
// script.js's STATE_TAX_RATES / TAX_MODEL / calcTakeHome() — see that file's header
// for the sync date). Country metadata below (full name, tax authority, confidence
// tier) is transcribed from script.js's COUNTRY_TAX_PROFILES / COUNTRY_TAX_AUTHORITY
// English strings and is NOT auto-derived — if a country is added/removed or a
// confidence flag (⚠️) changes in script.js, update COUNTRY_META below by hand too.
//
// When to rerun: whenever mcp-server/tax-data.js is updated (new country, changed
// rate) — regenerate the data/ files and re-paste the printed table fragments into
// lottery-tax-data-hub.html, then update that page's "AS OF" date.
//
// Usage: node scripts/build-lottery-tax-data-hub.js
//   (writes data/*.csv|json, prints table HTML to stdout — redirect to a scratch
//   file if you want to review before pasting, per CLAUDE.md)

const fs = require('fs');
const path = require('path');
const { calculateTakeHome, STATE_TAX_RATES, SUPPORTED_COUNTRIES } = require('../mcp-server/tax-data.js');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TODAY = '2026-09-01';

// ---------------------------------------------------------------------------
// 1. State table (51 = 50 states + DC, from STATE_TAX_RATES; AVG excluded from
//    the per-row dataset since it's a derived summary stat, not a jurisdiction).
// ---------------------------------------------------------------------------
const STATE_ROWS = Object.keys(STATE_TAX_RATES)
  .filter((code) => code !== 'AVG')
  .map((code) => {
    const s = STATE_TAX_RATES[code];
    const exempt = s.rate === 0 && /exempt/i.test(s.labelEn || '');
    const noIncomeTax = s.rate === 0 && !exempt;
    return {
      code,
      name: s.labelEn.replace(' (lottery winnings exempt)', ''),
      ratePct: +(s.rate * 100).toFixed(2),
      exempt,
      noIncomeTax,
    };
  })
  .sort((a, b) => a.code.localeCompare(b.code));

// ---------------------------------------------------------------------------
// 2. Country table (42 = SUPPORTED_COUNTRIES minus 'other'; kr/us/pk are the three
//    branches in tax-data.js with bracket/multi-component logic, the rest are flat
//    rate + optional FTC). Metadata transcribed by hand from script.js — see header.
// ---------------------------------------------------------------------------
const COUNTRY_META = {
  kr: { name: 'South Korea', authority: 'National Tax Service (NTS)/IRS', confidence: 'verified', structure: 'Progressive (comprehensive income tax, 8 brackets up to 45%) + 10% local surtax, FTC applied' },
  us: { name: 'United States (resident)', authority: 'IRS', confidence: 'verified', structure: 'Federal top bracket (37%) + state rate (see state table) — no US non-resident withholding, this is the resident basis' },
  cn: { name: 'China', authority: 'State Taxation Administration/IRS', confidence: 'verified', structure: 'Flat 20% "incidental income" tax, FTC applied' },
  jp: { name: 'Japan', authority: 'National Tax Agency (NTA)/IRS', confidence: 'verified', structure: '"Temporary income" with 1/2 inclusion, taxed at top marginal rate (≈27.97% effective), FTC applied' },
  in: { name: 'India', authority: 'Income Tax Department/IRS', confidence: 'verified', structure: 'Flat 30% + 25% surcharge + 4% cess (≈39% effective), no deductions, FTC applied' },
  vn: { name: 'Vietnam', authority: 'General Department of Taxation/IRS', confidence: 'verified', structure: 'Flat 10% prize-income tax, FTC applied under domestic law (no US-Vietnam treaty in force)' },
  id: { name: 'Indonesia', authority: 'Directorate General of Taxes/IRS', confidence: 'verified', structure: 'Flat 25% final tax on lottery winnings, no FTC (domestic final-tax credit procedure under Art. 24 excludes this Art. 4(2) final-tax category; treaty-based relief unconfirmed) — stacks in full on top of US withholding' },
  ph: { name: 'Philippines', authority: 'Bureau of Internal Revenue/IRS', confidence: 'approximate', structure: 'Approximated at the top progressive bracket (35%) since foreign winnings do not get the 20% domestic-lottery final tax rate; FTC applied' },
  th: { name: 'Thailand', authority: 'Estimate based on Revenue Department data/IRS', confidence: 'estimate', structure: '⚠️ No clear official guidance found for foreign lottery winnings; approximated at the top personal income tax bracket (35%)' },
  ru: { name: 'Russia', authority: 'Federal Tax Service (FNS)/IRS', confidence: 'verified', structure: 'Flat top progressive rate (22%); FTC believed unavailable since the US-Russia tax treaty’s double-taxation article has been suspended since 2023' },
  np: { name: 'Nepal', authority: 'Inland Revenue Department (IRD)/IRS', confidence: 'verified', structure: 'Flat 25% "windfall gain" final tax, FTC applied under domestic law' },
  lk: { name: 'Sri Lanka', authority: 'Inland Revenue Department (IRD)/IRS', confidence: 'approximate', structure: 'Approximated at the top progressive bracket (36%); a possible 15% preferential rate for remitted foreign income has unclear applicability to lottery winnings' },
  uz: { name: 'Uzbekistan', authority: 'State Tax Committee/IRS', confidence: 'verified', structure: 'Flat 12% on all personal income, no FTC (US-Uzbekistan relations still run on the 1973 US-USSR treaty, with no general "other income" or double-tax-relief article covering lottery winnings) — stacks in full on top of US withholding' },
  kz: { name: 'Kazakhstan', authority: 'Committee of State Revenues/IRS', confidence: 'verified', structure: 'Flat 10% on "winnings"-category income, FTC applied' },
  kg: { name: 'Kyrgyzstan', authority: 'State Tax Service/IRS', confidence: 'verified', structure: 'Flat 10% on personal income including winnings, no FTC (same 1973 US-USSR treaty as Uzbekistan, no general foreign-tax-credit article; no unilateral domestic relief found) — stacks in full on top of US withholding' },
  mm: { name: 'Myanmar', authority: 'Internal Revenue Department (IRD)/IRS', confidence: 'approximate', structure: 'Approximated at the top bracket (25%) for "income from other sources", no FTC (no US-Myanmar tax treaty in force) — stacks in full on top of US withholding' },
  bd: { name: 'Bangladesh', authority: 'National Board of Revenue (NBR)/IRS', confidence: 'verified', structure: 'Flat 25% on "income from other sources" (prizes), FTC applied' },
  pk: { name: 'Pakistan', authority: 'Estimate based on FBR data/IRS', confidence: 'estimate', structure: '⚠️ Base 35% + 8% super tax + 10% surcharge on the base; FTC offsets only the base-rate component, not super tax/surcharge' },
  kh: { name: 'Cambodia', authority: 'Estimate based on GDT data/IRS', confidence: 'estimate', structure: '⚠️ No clear legal basis found for taxing personal lottery/prize income — treated as 0% pending verification, NOT a confirmed exemption' },
  mn: { name: 'Mongolia', authority: 'Estimate based on Tax Administration data/IRS', confidence: 'estimate', structure: '⚠️ Approximated at 40% per secondary-source summaries; not independently verified against primary legislation' },
  la: { name: 'Laos', authority: 'Estimate based on Ministry of Finance data/IRS', confidence: 'estimate', structure: '⚠️ Flat 5% under the new income tax law; no US-Laos tax treaty, so no FTC — stacks fully on top of US withholding' },
  ca: { name: 'Canada', authority: 'Canada Revenue Agency (CRA)/IRS', confidence: 'verified', structure: 'Non-taxable windfall under the Income Tax Act — no domestic tax base' },
  tw: { name: 'Taiwan', authority: 'National Taxation Bureau/IRS', confidence: 'verified', structure: 'Worldwide-income Alternative Minimum Tax, flat 20% on foreign-source income above NT$7.5M, FTC applied against the AMT increase' },
  hk: { name: 'Hong Kong', authority: 'Inland Revenue Department (IRD)/IRS', confidence: 'verified', structure: 'Territorial system (salaries/profits/property tax only) — lottery winnings fall outside all three, no domestic tax base' },
  uk: { name: 'United Kingdom', authority: 'HMRC/IRS', confidence: 'verified', structure: 'No Income Tax, Capital Gains Tax, or National Insurance on gambling/lottery winnings — no domestic tax base' },
  au: { name: 'Australia', authority: 'Australian Taxation Office (ATO)/IRS', confidence: 'verified', structure: 'Non-assessable windfall gain, not income — no domestic tax base' },
  mx: { name: 'Mexico', authority: 'Servicio de Administración Tributaria (SAT)/IRS', confidence: 'verified', structure: 'Foreign winnings taxed as "other income" at the top progressive bracket (35%), FTC applied' },
  fr: { name: 'France', authority: 'DGFiP/IRS', confidence: 'verified', structure: 'Pure games of chance fall outside taxable-income categories under the CGI — no domestic tax base' },
  nz: { name: 'New Zealand', authority: 'Inland Revenue (IRD)/IRS', confidence: 'verified', structure: 'Non-taxable windfall, not assessable income — no domestic tax base' },
  ie: { name: 'Ireland', authority: 'Revenue/IRS', confidence: 'verified', structure: 'Betting/lottery/prize winnings have never been within any taxable-income category — no domestic tax base' },
  sg: { name: 'Singapore', authority: 'IRAS/IRS', confidence: 'verified', structure: 'Official IRAS FAQ: gambling/lottery winnings are windfall, not taxable income — no domestic tax base' },
  za: { name: 'South Africa', authority: 'South African Revenue Service (SARS)/IRS', confidence: 'verified', structure: 'Capital in nature, excluded from "gross income" and exempt from CGT — no domestic tax base' },
  my: { name: 'Malaysia', authority: 'Lembaga Hasil Dalam Negeri (LHDN)/IRS', confidence: 'verified', structure: 'Non-taxable windfall under the Income Tax Act 1967 — no domestic tax base' },
  de: { name: 'Germany', authority: 'Finanzamt/IRS', confidence: 'verified', structure: 'Falls outside all 7 enumerated taxable-income categories (EStG) — "nicht steuerbar", no domestic tax base' },
  nl: { name: 'Netherlands', authority: 'Belastingdienst/IRS', confidence: 'verified', structure: '⚠️ Kansspelbelasting (games-of-chance tax), flat 37.8% — a separate tax head with no FTC provision found, stacks in full on top of US withholding' },
  sv: { name: 'Sweden', authority: 'Skatteverket/IRS', confidence: 'verified', structure: 'Flat 30% capital-income tax on non-EU/EEA winnings; FTC exactly offsets the 30% US withholding (coincidence of equal rates)' },
  no: { name: 'Norway', authority: 'Skatteetaten/IRS', confidence: 'verified', structure: 'Flat 22% general-income rate; FTC fully absorbs the (lower) Norwegian tax, residual 0' },
  da: { name: 'Denmark', authority: 'Skattestyrelsen/IRS', confidence: 'verified', structure: 'Top marginal personal-income rate (57.07%, incl. 2026 "top-top tax"); FTC leaves the largest residual of any supported country (≈27pp)' },
  fi: { name: 'Finland', authority: 'Verohallinto/IRS', confidence: 'verified', structure: 'Top marginal rate (46.17%) on non-EEA winnings; FTC leaves a residual of ≈16pp' },
  it: { name: 'Italy', authority: 'Agenzia delle Entrate/IRS', confidence: 'verified', structure: 'Top progressive IRPEF bracket + regional/municipal surtax (≈47.23% combined); FTC leaves a residual of ≈17pp' },
  pl: { name: 'Poland', authority: 'Krajowa Administracja Skarbowa/IRS', confidence: 'verified', structure: 'General progressive tax (12%/32%) + 4% solidarity levy above PLN 1M, approximated at 36% combined; FTC leaves a residual of ≈6pp' },
  tr: { name: 'Turkey', authority: 'Gelir İdaresi Başkanlığı/IRS', confidence: 'verified', structure: '⚠️ Taxed under inheritance/transfer tax law (VİVK), flat 20%, not income tax — outside the income tax treaty’s scope, no FTC, stacks in full' },
  br: { name: 'Brazil', authority: 'Receita Federal do Brasil/IRS', confidence: 'verified', structure: 'A foreign lottery win escapes the domestic 30% lottery withholding (Lei 4.506/64 Art. 14) and is instead taxed via carnê-leão at the top progressive IRPF bracket (27.5%); FTC applies via documented US-Brazil reciprocity (Ato Declaratório SRF 28/2000, per IN SRF 208/2002 Art. 16) and fully absorbs the lower Brazilian rate, residual 0' },
  es: { name: 'Spain', authority: 'Agencia Tributaria/IRS', confidence: 'verified', structure: 'Taxed as a "ganancia patrimonial no derivada de una transmisión" in the general tax base at progressive rates (Ley 35/2006 Art. 33), approximated at the national top marginal rate (47%); US-Spain treaty Art. 24(1)(a) ordinary FTC leaves a residual of ≈17pp' },
  ch: { name: 'Switzerland', authority: 'Cantonal tax authorities (Zürich reference)/IRS', confidence: 'verified', structure: '⚠️ US-CH treaty Art. 21(3) explicitly excludes gambling/lottery winnings from its Other Income article, and neither treaty relief nor the unilateral DA-1 credit covers gambling — no FTC. Approximated at Zürich\'s 2026 top marginal rate (39.1%), stacks in full on top of US withholding' },
  ae: { name: 'United Arab Emirates', authority: 'PwC Worldwide Tax Summaries/IRS', confidence: 'verified', structure: 'No personal/individual income tax regime exists — no domestic tax base at all' },
  sa: { name: 'Saudi Arabia', authority: 'ZATCA/PwC Worldwide Tax Summaries/IRS', confidence: 'verified', structure: 'No personal/individual income tax regime exists — no domestic tax base (Zakat is a separate annual wealth levy, out of scope for a one-time payout)' },
  eg: { name: 'Egypt', authority: 'Egyptian Tax Authority/IRS', confidence: 'verified', structure: 'Taxed as ordinary worldwide income under Law 91/2005, approximated at the top marginal PIT rate (27.5%); US-Egypt treaty Art. 25(2) ordinary FTC fully absorbs it, residual 0' },
  il: { name: 'Israel', authority: 'Israel Tax Authority/IRS', confidence: 'verified', structure: 'Income Tax Ordinance Sec. 2A taxes gambling/lottery/prize gains at a flat 35%; US-Israel treaty Art. 26(3) ordinary FTC leaves a residual of ≈5pp' },
  ua: { name: 'Ukraine', authority: 'State Tax Service of Ukraine/PwC/IRS', confidence: 'verified', structure: '⚠️ Personal income tax (18%) + military levy (5%); the US-Ukraine treaty FTC covers only the 18% PIT (fully absorbed by the 30% US withholding), while the 5% levy has no credit and always stacks — net residual ≈5pp' },
  ng: { name: 'Nigeria', authority: 'Estimate based on Nigeria Tax Act 2025/IRS', confidence: 'estimate', structure: '⚠️ No US-Nigeria tax treaty, but Nigeria Tax Act 2025 Sec. 119 grants a unilateral FTC; approximated at the new top marginal PIT rate (25%), which the FTC fully absorbs — this reasoning chain (that lottery withholding regs don\'t apply to a foreign payer) is not confirmed by a direct ruling' },
};

const COUNTRY_ROWS = SUPPORTED_COUNTRIES
  .filter((c) => c !== 'other' && c !== 'us') // 'us' is a resident-basis row, shown separately in the state table context
  .map((code) => {
    const meta = COUNTRY_META[code];
    if (!meta) throw new Error(`Missing COUNTRY_META for ${code}`);
    const r500 = calculateTakeHome(500000000, code, undefined, code === 'kr' ? 1487.73 : undefined);
    return {
      code,
      name: meta.name,
      authority: meta.authority,
      confidence: meta.confidence,
      structure: meta.structure,
      usWithholdingPct: code === 'kr' ? 30 : 30, // IRC §871(a) nonresident withholding; kr uses same 30% first-stage withholding
      effectiveTotalTaxPct500M: r500.effectiveTaxRatePct,
      takeHomePct500M: +(100 - r500.effectiveTaxRatePct).toFixed(2),
    };
  });

// ---------------------------------------------------------------------------
// 3. Write CSV + JSON
// ---------------------------------------------------------------------------
function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(rows, cols) {
  const header = cols.map((c) => c.key).join(',');
  const lines = rows.map((r) => cols.map((c) => csvEscape(c.get(r))).join(','));
  return [header, ...lines].join('\n') + '\n';
}

const stateCols = [
  { key: 'state_code', get: (r) => r.code },
  { key: 'state_name', get: (r) => r.name },
  { key: 'top_marginal_rate_pct', get: (r) => r.ratePct },
  { key: 'no_state_income_tax', get: (r) => r.noIncomeTax },
  { key: 'lottery_winnings_exempt', get: (r) => r.exempt },
];
fs.writeFileSync(path.join(DATA_DIR, 'state-lottery-tax-rates.csv'), toCsv(STATE_ROWS, stateCols));
fs.writeFileSync(
  path.join(DATA_DIR, 'state-lottery-tax-rates.json'),
  JSON.stringify(
    {
      source: 'https://chamtax.com/lottery-tax-data-hub.html',
      license: 'CC0-1.0 (public domain) — attribution to ChamTax (chamtax.com) appreciated but not required',
      lastUpdated: TODAY,
      methodology:
        'Top marginal individual state income tax rate, applied as a flat approximation on the assumption that a jackpot-size prize always falls in the top bracket. Not a withholding rate — see the page for the withholding-vs-top-rate distinction.',
      unit: 'percent',
      rows: STATE_ROWS,
    },
    null,
    2
  ) + '\n'
);

const countryCols = [
  { key: 'country_code', get: (r) => r.code },
  { key: 'country_name', get: (r) => r.name },
  { key: 'tax_authority', get: (r) => r.authority },
  { key: 'us_nonresident_withholding_pct', get: (r) => r.usWithholdingPct },
  { key: 'effective_total_tax_pct_at_500m_usd', get: (r) => r.effectiveTotalTaxPct500M },
  { key: 'take_home_pct_at_500m_usd', get: (r) => r.takeHomePct500M },
  { key: 'confidence', get: (r) => r.confidence },
  { key: 'tax_structure_notes', get: (r) => r.structure },
];
fs.writeFileSync(path.join(DATA_DIR, 'country-lottery-tax-rates.csv'), toCsv(COUNTRY_ROWS, countryCols));
fs.writeFileSync(
  path.join(DATA_DIR, 'country-lottery-tax-rates.json'),
  JSON.stringify(
    {
      source: 'https://chamtax.com/lottery-tax-data-hub.html',
      license: 'CC0-1.0 (public domain) — attribution to ChamTax (chamtax.com) appreciated but not required',
      lastUpdated: TODAY,
      methodology:
        'US federal withholding on lottery/gambling winnings for non-resident aliens is a flat 30% (IRC §871(a)). effective_total_tax_pct_at_500m_usd is the combined US + home-country effective rate computed by ChamTax’s calculation engine for a $500,000,000 lump-sum payout (chosen because it is large enough that every country’s top-bracket/flat-rate approximation applies), after any Foreign Tax Credit the country’s law/treaty allows. confidence: "verified" = primary statute/treaty/official guidance found; "approximate" = reasonable secondary-source estimate, some structural simplification; "estimate" = best-effort, no authoritative primary source found — see chamtax.com’s per-country landing pages for full citations.',
      unit: 'percent (except country_code, country_name, tax_authority, confidence, tax_structure_notes)',
      rows: COUNTRY_ROWS,
    },
    null,
    2
  ) + '\n'
);

// ---------------------------------------------------------------------------
// 4. Reference scenarios ($100M / $500M / $1B lump sum, 8 representative countries)
// ---------------------------------------------------------------------------
const SCENARIO_COUNTRIES = [
  { code: 'kr', label: 'South Korea', opts: { krwPerUsd: 1487.73 } },
  { code: 'us', label: 'United States (Texas)', opts: { stateCode: 'TX' } },
  { code: 'us', label: 'United States (California)', opts: { stateCode: 'CA' } },
  { code: 'vn', label: 'Vietnam', opts: {} },
  { code: 'cn', label: 'China', opts: {} },
  { code: 'in', label: 'India', opts: {} },
  { code: 'tr', label: 'Turkey', opts: {} },
  { code: 'pl', label: 'Poland', opts: {} },
];
const AMOUNTS = [100000000, 500000000, 1000000000];
const scenarioRows = SCENARIO_COUNTRIES.map(({ code, label, opts }) => {
  const results = AMOUNTS.map((amt) => calculateTakeHome(amt, code, opts.stateCode, opts.krwPerUsd));
  return { label, results };
});

// ---------------------------------------------------------------------------
// 5. Print HTML fragments (paste into lottery-tax-data-hub.html by hand)
// ---------------------------------------------------------------------------
function fmtUsd(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

let out = '';
out += '<!-- ===== STATE TABLE ROWS (paste inside <tbody>) ===== -->\n';
STATE_ROWS.forEach((r) => {
  const note = r.exempt ? 'Lottery winnings exempt' : r.noIncomeTax ? 'No state income tax' : '';
  out += `<tr><td>${r.name}</td><td>${r.code}</td><td class="pct">${r.ratePct}%</td><td>${note}</td></tr>\n`;
});

out += '\n<!-- ===== COUNTRY TABLE ROWS (paste inside <tbody>) ===== -->\n';
COUNTRY_ROWS.forEach((r) => {
  const badgeClass = r.confidence === 'verified' ? 'badge-verified' : r.confidence === 'approximate' ? 'badge-approx' : 'badge-estimate';
  const badgeLabel = r.confidence === 'verified' ? 'verified' : r.confidence === 'approximate' ? 'approximate' : 'unverified estimate';
  out += `<tr><td>${r.name}</td><td>${r.authority}</td><td class="pct">${r.effectiveTotalTaxPct500M}%</td><td class="pct">${r.takeHomePct500M}%</td><td><span class="badge ${badgeClass}">${badgeLabel}</span></td></tr>\n`;
});

out += '\n<!-- ===== SCENARIO TABLE ROWS (paste inside <tbody>) ===== -->\n';
scenarioRows.forEach(({ label, results }) => {
  const cells = results.map((r) => `<td class="pct">${fmtUsd(r.takeHomeUsd)}<br><span style="color:var(--text-muted); font-size:var(--fs-small);">(${r.effectiveTaxRatePct}% total tax)</span></td>`).join('');
  out += `<tr><td>${label}</td>${cells}</tr>\n`;
});

console.log(out);
console.log('\n// Wrote:');
console.log('//', path.relative(ROOT, path.join(DATA_DIR, 'state-lottery-tax-rates.csv')));
console.log('//', path.relative(ROOT, path.join(DATA_DIR, 'state-lottery-tax-rates.json')));
console.log('//', path.relative(ROOT, path.join(DATA_DIR, 'country-lottery-tax-rates.csv')));
console.log('//', path.relative(ROOT, path.join(DATA_DIR, 'country-lottery-tax-rates.json')));

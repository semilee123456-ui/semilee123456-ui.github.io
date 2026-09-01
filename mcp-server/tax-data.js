// Numeric tax rules for the "calculate_lottery_takehome" MCP tool.
//
// Source of truth is the main site's script.js (TAX_MODEL / STATE_TAX_RATES /
// KOREA_TAX_BRACKETS / calcTakeHome(), roughly lines 1158-2429 as of 2026-08-18).
// This file is a numeric-only re-derivation of that logic for a headless (no-DOM)
// Node context — it intentionally drops the 30+-language label strings, keeping
// only the math and a short English note per country. If the rates in script.js
// change, this file needs to be updated to match by hand; it is NOT auto-generated
// and there is no build step wiring the two together. Last synced with script.js: 2026-08-22
// (added br: Brazil, 30th supported country — a foreign lottery win escapes the domestic
// 30% lottery withholding regime and is taxed via carnê-leão at the top IRPF bracket
// (27.5%), with the US foreign tax credit available via Ato Declaratório SRF 28/2000's
// documented reciprocity; since 27.5% < the 30% US withholding, the credit fully absorbs
// it. See TAX_MODEL.br_resident in script.js for full sourcing.)
// Previously (added the 21 countries introduced between 2026-08-16 and 2026-08-18: ca, tw, hk, uk,
// au, mx, fr, nz, ie, sg, za, my, de, nl, sv, no, da, fi, it, pl, tr — all of them fit the
// existing generic flat-rate + optional-FTC shape below, none needed bracket logic like
// kr/pk, so they were folded straight into FLAT_COUNTRY_MODEL rather than given their own
// branches. 2026-08-21: picked up a 2026-08-20 script.js correction this file had missed —
// id/uz/kg/mm all had `ftcAvailable: true` here while script.js's TAX_MODEL had already
// been corrected to `ftc_available: false` for all four (Indonesia's Art.24 domestic
// credit excludes this final-tax category; Uzbekistan/Kyrgyzstan's 1973 US-USSR treaty
// has no general FTC article; Myanmar has no US treaty at all) — this silently made the
// MCP tool's answers wrong for those 4 countries until this fix. See
// data/country-lottery-tax-rates.json for the downstream dataset fix this also required).
//
// Every "additional country tax" branch below assumes the amount you pass in is
// the actual payout you're evaluating (e.g. lump-sum cash value), not an announced
// annuity total.

const US_WITHHOLDING_RATE = 0.30; // IRC §871(a) — US non-resident withholding on gambling/lottery winnings

const STATE_TAX_RATES = {
  AVG: { labelEn: 'Average (50 states + DC)', rate: 0 }, // recomputed below from the other 51 entries
  AL: { labelEn: 'Alabama', rate: 0.05 },
  AK: { labelEn: 'Alaska', rate: 0.0 },
  AZ: { labelEn: 'Arizona', rate: 0.025 },
  AR: { labelEn: 'Arkansas', rate: 0.037 },
  CA: { labelEn: 'California (lottery winnings exempt)', rate: 0.0 },
  CO: { labelEn: 'Colorado', rate: 0.044 },
  CT: { labelEn: 'Connecticut', rate: 0.0699 },
  DE: { labelEn: 'Delaware', rate: 0.066 },
  FL: { labelEn: 'Florida', rate: 0.0 },
  GA: { labelEn: 'Georgia', rate: 0.0519 },
  HI: { labelEn: 'Hawaii', rate: 0.11 },
  ID: { labelEn: 'Idaho', rate: 0.053 },
  IL: { labelEn: 'Illinois', rate: 0.0495 },
  IN: { labelEn: 'Indiana', rate: 0.0295 },
  IA: { labelEn: 'Iowa', rate: 0.038 },
  KS: { labelEn: 'Kansas', rate: 0.0558 },
  KY: { labelEn: 'Kentucky', rate: 0.035 },
  LA: { labelEn: 'Louisiana', rate: 0.03 },
  ME: { labelEn: 'Maine', rate: 0.0915 },
  MD: { labelEn: 'Maryland', rate: 0.065 },
  MA: { labelEn: 'Massachusetts', rate: 0.09 },
  MI: { labelEn: 'Michigan', rate: 0.0425 },
  MN: { labelEn: 'Minnesota', rate: 0.0985 },
  MS: { labelEn: 'Mississippi', rate: 0.04 },
  MO: { labelEn: 'Missouri', rate: 0.047 },
  MT: { labelEn: 'Montana', rate: 0.0565 },
  NE: { labelEn: 'Nebraska', rate: 0.0455 },
  NV: { labelEn: 'Nevada', rate: 0.0 },
  NH: { labelEn: 'New Hampshire', rate: 0.0 },
  NJ: { labelEn: 'New Jersey', rate: 0.1075 },
  NM: { labelEn: 'New Mexico', rate: 0.059 },
  NY: { labelEn: 'New York', rate: 0.109 },
  NC: { labelEn: 'North Carolina', rate: 0.0399 },
  ND: { labelEn: 'North Dakota', rate: 0.0195 },
  OH: { labelEn: 'Ohio', rate: 0.0275 },
  OK: { labelEn: 'Oklahoma', rate: 0.045 },
  OR: { labelEn: 'Oregon', rate: 0.099 },
  PA: { labelEn: 'Pennsylvania', rate: 0.0307 },
  RI: { labelEn: 'Rhode Island', rate: 0.0599 },
  SC: { labelEn: 'South Carolina', rate: 0.0521 },
  SD: { labelEn: 'South Dakota', rate: 0.0 },
  TN: { labelEn: 'Tennessee', rate: 0.0 },
  TX: { labelEn: 'Texas', rate: 0.0 },
  UT: { labelEn: 'Utah', rate: 0.0455 },
  VT: { labelEn: 'Vermont', rate: 0.0875 },
  VA: { labelEn: 'Virginia', rate: 0.0575 },
  WA: { labelEn: 'Washington', rate: 0.0 },
  DC: { labelEn: 'Washington D.C.', rate: 0.1075 },
  WV: { labelEn: 'West Virginia', rate: 0.0482 },
  WI: { labelEn: 'Wisconsin', rate: 0.0765 },
  WY: { labelEn: 'Wyoming', rate: 0.0 },
};
(function computeAvgStateTaxRate() {
  const codes = Object.keys(STATE_TAX_RATES).filter((code) => code !== 'AVG');
  const sum = codes.reduce((total, code) => total + STATE_TAX_RATES[code].rate, 0);
  STATE_TAX_RATES.AVG.rate = sum / codes.length;
})();

// 2026 Korean comprehensive income tax brackets (KRW), 8 tiers.
// tax = taxableIncome * rate - deduction
const KOREA_TAX_BRACKETS = [
  { limit: 14000000, rate: 0.06, deduction: 0 },
  { limit: 50000000, rate: 0.15, deduction: 1260000 },
  { limit: 88000000, rate: 0.24, deduction: 5760000 },
  { limit: 150000000, rate: 0.35, deduction: 15440000 },
  { limit: 300000000, rate: 0.38, deduction: 19940000 },
  { limit: 500000000, rate: 0.40, deduction: 25940000 },
  { limit: 1000000000, rate: 0.42, deduction: 35940000 },
  { limit: Infinity, rate: 0.45, deduction: 65940000 },
];

function calcKoreaProgressiveTaxWon(wonAmount) {
  for (const b of KOREA_TAX_BRACKETS) {
    if (wonAmount <= b.limit) return Math.max(wonAmount * b.rate - b.deduction, 0);
  }
  return 0;
}

// Flat-rate country tax model: { rate, ftcAvailable, note }
// FTC = Foreign Tax Credit — offsets US withholding against the home-country tax,
// up to whichever is smaller. ftcAvailable:false means the country tax stacks in
// full on top of the US withholding (no credit / no treaty basis found).
const FLAT_COUNTRY_MODEL = {
  cn: { rate: 0.20, ftcAvailable: true, note: 'China: incidental income tax, flat rate.' },
  in: { rate: 0.30 * 1.25 * 1.04, ftcAvailable: true, note: 'India: 30% base + 25% surcharge + 4% cess, no deductions (Sec 115BB).' },
  vn: { rate: 0.10, ftcAvailable: true, note: 'Vietnam: prize income tax, flat rate; FTC via domestic law, not a tax treaty (US-VN treaty not yet in force).' },
  id: { rate: 0.25, ftcAvailable: false, note: 'Indonesia: lottery winnings final tax, flat rate; no FTC (Art. 24 domestic credit procedure excludes this Art. 4(2) final-tax category, and no treaty-based relief confirmed) — stacks in full.' },
  ph: { rate: 0.35, ftcAvailable: true, note: 'Philippines: approximated at the top progressive bracket (foreign lottery winnings do not get the 20% local-lottery final tax rate).' },
  th: { rate: 0.35, ftcAvailable: true, note: '⚠️ Thailand: no clear official guidance found for foreign lottery winnings; approximated at the top personal income tax bracket.' },
  jp: { rate: 0.55945 * 0.5, ftcAvailable: true, note: 'Japan: foreign lottery winnings are "temporary income" (ichiji shotoku) with 1/2 inclusion, approximated at the top effective rate.' },
  ru: { rate: 0.22, ftcAvailable: false, note: '⚠️ Russia: FTC believed unavailable — the US-Russia tax treaty\'s double-taxation article has been suspended since 2023.' },
  np: { rate: 0.25, ftcAvailable: true, note: 'Nepal: "windfall gain" flat final tax (lottery, gifts, prizes).' },
  lk: { rate: 0.36, ftcAvailable: true, note: '⚠️ Sri Lanka: approximated at the top progressive bracket; a possible 15% preferential rate for remitted foreign income has unclear applicability to lottery winnings.' },
  uz: { rate: 0.12, ftcAvailable: false, note: 'Uzbekistan: flat rate on all personal income; no FTC (US-Uzbekistan relations still run on the 1973 US-USSR treaty, which has no general "other income" or double-tax-relief article covering lottery winnings) — stacks in full.' },
  kz: { rate: 0.10, ftcAvailable: true, note: 'Kazakhstan: flat rate on "winnings"-category income for residents.' },
  kg: { rate: 0.10, ftcAvailable: false, note: 'Kyrgyzstan: flat rate on personal income including winnings; no FTC (same 1973 US-USSR treaty as Uzbekistan, no general foreign-tax-credit article; no unilateral domestic relief found) — stacks in full.' },
  mm: { rate: 0.25, ftcAvailable: false, note: 'Myanmar: approximated at the top bracket for "income from other sources"; no FTC (no US-Myanmar tax treaty in force) — stacks in full.' },
  bd: { rate: 0.25, ftcAvailable: true, note: 'Bangladesh: flat rate on "income from other sources" (prizes).' },
  kh: { rate: 0, ftcAvailable: true, note: '⚠️ Cambodia: no clear legal basis found for taxing personal lottery/prize income — treated as 0 pending verification, NOT a confirmed exemption.' },
  mn: { rate: 0.40, ftcAvailable: true, note: '⚠️ Mongolia: approximated at 40% per PwC Worldwide Tax Summaries ("Lotteries (net)"); not independently verified against primary legislation.' },
  la: { rate: 0.05, ftcAvailable: false, note: '⚠️ Laos: flat rate under the new income tax law; no US-Laos tax treaty, so no FTC — this stacks fully on top of US withholding.' },
  // --- Added 2026-08-16 through 2026-08-18 (see file header) ---
  ca: { rate: 0, ftcAvailable: true, note: 'Canada: lottery/gambling winnings are a non-taxable windfall under the Income Tax Act — no domestic tax base at all (not an FTC-to-zero case), same treatment for domestic and foreign lotteries.' },
  tw: { rate: 0.20, ftcAvailable: true, note: 'Taiwan: worldwide-income Alternative Minimum Tax (Income Basic Tax Act Art. 13) applies a flat 20% to foreign-source income once it exceeds the NT$7.5M threshold (always true at jackpot scale); foreign tax paid is creditable against the resulting AMT increase (Art. 13 proviso).' },
  hk: { rate: 0, ftcAvailable: true, note: 'Hong Kong: territorial system with only three narrow tax heads (salaries/profits/property tax) — lottery winnings fall outside all three, so there is no domestic tax base regardless of source.' },
  uk: { rate: 0, ftcAvailable: true, note: 'UK: HMRC does not treat gambling/lottery winnings as taxable income at all (no Income Tax, Capital Gains Tax, or National Insurance) — same for the National Lottery and foreign lotteries.' },
  au: { rate: 0, ftcAvailable: true, note: 'Australia: ATO treats gambling/lottery winnings as a non-assessable windfall gain rather than income — same for domestic (Powerball AU) and foreign lotteries, unless gambling is a taxpayer\'s business.' },
  mx: { rate: 0.35, ftcAvailable: true, note: 'Mexico: a foreign lottery win falls under LISR Art. 142 "other income" (not the domestic-lottery Art. 138 withholding regime) and is taxed at the top progressive bracket (35%); Art. 5 foreign tax credit offsets the US withholding up to that amount, leaving a residual of ~5pp since Mexico\'s top rate exceeds the US 30%.' },
  fr: { rate: 0, ftcAvailable: true, note: 'France: pure games of chance (lottery, draws with no player skill) fall outside every taxable-income category under the CGI unless gambling is a habitual profession — same domestic/foreign treatment.' },
  nz: { rate: 0, ftcAvailable: true, note: 'New Zealand: IRD treats gambling/lottery winnings as a non-taxable windfall, not assessable income, for both Lotto NZ and foreign lotteries.' },
  ie: { rate: 0, ftcAvailable: true, note: 'Ireland: Irish Revenue has never brought betting/lottery/prize winnings within any taxable-income category (TCA 1997 s.613(2) confirms this for betting gains specifically).' },
  sg: { rate: 0, ftcAvailable: true, note: 'Singapore: IRAS\'s public FAQ states gambling/lottery winnings (4D/Toto/foreign lotteries alike) are windfall, not taxable income — no filing required.' },
  za: { rate: 0, ftcAvailable: true, note: 'South Africa: lottery winnings are "capital in nature" and excluded from "gross income" under the Income Tax Act, and separately exempt from Capital Gains Tax.' },
  my: { rate: 0, ftcAvailable: true, note: 'Malaysia: LHDN treats gambling/lottery winnings as a non-taxable windfall under the Income Tax Act 1967, same for domestic and foreign lotteries.' },
  de: { rate: 0, ftcAvailable: true, note: 'Germany: EStG Sec. 2(3) limits taxable income to 7 enumerated categories (Sec 22 lists them) — lottery/gambling winnings fall outside all of them ("nicht steuerbar"), same for domestic and foreign lotteries.' },
  nl: { rate: 0.378, ftcAvailable: false, note: '⚠️ Netherlands: a non-EU/EEA, non-online lottery win (i.e. Powerball/Mega Millions) is subject to kansspelbelasting (games-of-chance tax) at 37.8% (2026) — a separate tax head from income tax with no foreign-tax-credit provision found in its own statute, so it stacks in full on top of the US withholding.' },
  sv: { rate: 0.30, ftcAvailable: true, note: 'Sweden: a non-EU/EEA lottery win is taxed as capital income at a flat 30% (Inkomstskattelagen ch.42 §25); the ordinary foreign tax credit exactly offsets the 30% US withholding, leaving a residual of 0 — coincidence of equal rates, not a structural exemption.' },
  no: { rate: 0.22, ftcAvailable: true, note: 'Norway: "tilfeldige gevinster" (windfall prizes) over NOK 10,000 from a non-EEA/non-charitable operator are taxed at the flat general-income rate (22%); the treaty/domestic ordinary credit for the US withholding fully absorbs the (lower) Norwegian tax, leaving a residual of 0.' },
  da: { rate: 0.5707, ftcAvailable: true, note: 'Denmark: winnings from an unlicensed (non-EU/EEA) game are taxed as personal income at the top marginal rate (57.07% including the new 2026 "top-top tax"); ordinary foreign tax credit under Ligningsloven §33 absorbs the 30% US withholding, leaving a residual of ~27.1pp — the largest of any supported country.' },
  fi: { rate: 0.4617, ftcAvailable: true, note: 'Finland: a non-EEA lottery win is taxed at the top marginal rate (46.17%); ordinary foreign tax credit absorbs the 30% US withholding, leaving a residual of ~16.17pp.' },
  it: { rate: 0.4723, ftcAvailable: true, note: 'Italy: a foreign lottery win is "redditi diversi" under TUIR Art. 67(1)(d), taxed at the top progressive IRPEF bracket plus regional/municipal surtax (~47.23% combined, using Lazio/Rome 2026 rates as a reference); Art. 165 ordinary foreign tax credit absorbs the 30% US withholding, leaving a residual of ~17.23pp.' },
  pl: { rate: 0.36, ftcAvailable: true, note: 'Poland: the 10-15% preferential PIT rate on gambling winnings (Art. 30.1.2) is limited to games organized in Poland/EU/EEA, so a US lottery win falls into general progressive income tax (12%/32%) plus the "solidarity levy" (4% above PLN 1M), approximated at 36% combined; the 1974 US-Poland treaty has no modern "Other Income" article, and the proportional foreign tax credit leaves a residual of ~6pp.' },
  tr: { rate: 0.20, ftcAvailable: false, note: '⚠️ Turkey: lottery/prize winnings are taxed under the Inheritance and Transfer Tax Law (VİVK) Art. 16 at a flat 20%, not under the income tax law (GVK) — since VİVK sits outside the scope of the US-Turkey income tax treaty (Art. 2) and VİVK\'s own domestic foreign tax credit (Art. 20) only covers foreign inheritance/gift tax, there is no credit against the US withholding; it stacks in full.' },
  br: { rate: 0.275, ftcAvailable: true, note: 'Brazil: a foreign (US) lottery win is not covered by the domestic-lottery 30% withholding regime (Lei 4.506/64 Art. 14, which only applies to Brazilian-run lotteries) and instead is reported as ordinary foreign-source income via carnê-leão, taxed at the top progressive IRPF bracket (27.5%); IN SRF 208/2002 Art. 16 conditions the foreign tax credit on a treaty or documented reciprocity — there is no US-Brazil income tax treaty, but Receita Federal formally recognized reciprocity with the US in Ato Declaratório SRF nº 28/2000 (still cited as operative, incl. in a 2024 press case on a Brazilian athlete\'s US prize money), so the credit applies. Since Brazil\'s rate (27.5%) is below the US withholding (30%), the credit fully absorbs it, leaving a residual of 0.' },
  es: { rate: 0.47, ftcAvailable: true, note: 'Spain: a foreign lottery win is a "ganancia patrimonial no derivada de una transmisión" (Ley 35/2006 Art. 33) taxed in the general tax base at progressive rates, not the 19-28% savings-base rate some sources wrongly cite; approximated at the national-scale top marginal rate (47%, regional variance ~45-54%). US-Spain treaty Art. 24(1)(a) gives an ordinary/capped foreign tax credit; since Spain\'s rate exceeds the 30% US withholding, a residual of ~17pp remains.' },
  ch: { rate: 0.391, ftcAvailable: false, note: '⚠️ Switzerland: US-CH treaty Art. 21(3) explicitly excludes "wagering, gambling or lottery winnings" from the Other Income article, so the US retains an unconstrained 30% withholding right; Art. 23 treaty relief and the unilateral DA-1 credit only cover dividends/interest/royalties, not gambling — no credit available. Approximated at Zürich\'s 2026 combined top marginal rate (39.1%, cantonal range 21.9-43.24%); the domestic CHF 1M lottery exemption (Art. 24 lit. i bis DBG) does not apply to non-Swiss lotteries, so the full amount is taxable and stacks on top of the US withholding.' },
  ae: { rate: 0, ftcAvailable: true, note: 'UAE: no personal/individual income tax exists under UAE law (PwC Worldwide Tax Summaries, reviewed 2026-03-12) — no domestic tax base at all, same treatment as Canada/Hong Kong.' },
  sa: { rate: 0, ftcAvailable: true, note: 'Saudi Arabia: no personal/individual income tax exists under Saudi law (PwC Worldwide Tax Summaries, reviewed 2026-03-12) — no domestic tax base at all. Zakat is a separate annual wealth levy on holdings, not a tax on the prize itself, so it is out of scope for this one-time-payout calculator.' },
  eg: { rate: 0.275, ftcAvailable: true, note: 'Egypt: taxed as ordinary worldwide income for a resident under Law 91/2005, approximated at the top marginal PIT rate (27.5%, PwC reviewed 2026-02-04). The 1980/1981 US-Egypt treaty has no "Other Income" catch-all article, so the US withholds 30% unimpeded; treaty Art. 25(2) gives Egypt an ordinary/capped foreign tax credit, which fully absorbs the lower Egyptian rate, leaving a residual of 0.' },
  il: { rate: 0.35, ftcAvailable: true, note: 'Israel: Income Tax Ordinance Section 2A taxes a resident\'s gambling/lottery/prize gains (domestic or foreign) at a flat 35% above a low threshold. The US-Israel treaty has no "Other Income" article, so the US withholds 30% unimpeded; treaty Art. 26(3) gives an ordinary foreign tax credit, leaving a residual of ~5pp since Israel\'s rate exceeds the US withholding.' },
  ua: { rate: 0.05, ftcAvailable: false, note: '⚠️ Ukraine: domestic tax on a foreign lottery win is personal income tax (PIT, 18%) plus a military levy (5%). PwC Worldwide Tax Summaries (reviewed 2026-06-30) confirms the foreign tax credit under the US-Ukraine treaty Art. 24 covers only the PIT — "credit against military tax is not allowed." Since PIT (18%) is fully absorbed by the 30% US withholding, it contributes no residual; the military levy (5%) has no credit and always stacks in full. This flat model represents only that net residual (5%, ftcAvailable:false) rather than the full 23% gross rate, since script.js\'s calcTakeHome() splits pit_rate/military_levy_rate separately — do not "fix" this to rate:0.23 without also changing ftcAvailable semantics, or the flat-model formula (calculatedTax*ftcAvailable) will wrongly compute 0 residual instead of 5%.' },
  ng: { rate: 0.25, ftcAvailable: true, note: '⚠️ Nigeria: no US-Nigeria tax treaty exists, but the Nigeria Tax Act 2025 (effective 2026-01-01) Sec. 119 grants a unilateral (treaty-independent) foreign tax credit; approximated at the new top marginal PIT rate (25%, over ₦50M). Nigeria\'s 2024 Withholding Tax Regulations have a specific 5%/15% lottery-winnings withholding, but that appears to apply only to Nigerian-licensed operators as withholding agents, not a foreign payer like Powerball/Mega Millions — this chain of reasoning is not confirmed by a direct ruling, hence marked as an unverified estimate. Since 25% is below the 30% US withholding, the credit fully absorbs it, leaving a residual of 0.' },
};

const SUPPORTED_COUNTRIES = ['kr', 'us', 'pk', 'other', ...Object.keys(FLAT_COUNTRY_MODEL)];

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * @param {number} amountUsd - the actual payout amount to evaluate (e.g. lump-sum
 *   cash value), NOT an announced annuity total.
 * @param {string} country - one of SUPPORTED_COUNTRIES.
 * @param {string} [stateCode] - US state code, only used when country === 'us'.
 * @param {number} [krwPerUsd] - USD/KRW exchange rate, only used when country ===
 *   'kr' (Korea's progressive brackets are defined in absolute KRW, unlike every
 *   other country here which is a flat rate and therefore currency-invariant).
 *   Defaults to an approximate, deliberately-stale placeholder — pass a current
 *   rate for anything beyond a rough estimate.
 */
function calculateTakeHome(amountUsd, country, stateCode, krwPerUsd) {
  if (typeof amountUsd !== 'number' || !Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error('amountUsd must be a positive finite number');
  }
  country = String(country || 'kr').toLowerCase();
  if (!SUPPORTED_COUNTRIES.includes(country)) {
    throw new Error(`Unsupported country "${country}". Supported: ${SUPPORTED_COUNTRIES.join(', ')}`);
  }

  if (country === 'us') {
    const state = STATE_TAX_RATES[String(stateCode || 'AVG').toUpperCase()] || STATE_TAX_RATES.AVG;
    const federalRate = 0.37; // simplified: real US withholding is 24% up front, true rate up to 37% at filing
    const federalTax = amountUsd * federalRate;
    const stateTax = amountUsd * state.rate;
    const takeHomeUsd = amountUsd - federalTax - stateTax;
    return {
      country, stateCode: (stateCode || 'AVG').toUpperCase(),
      breakdown: [
        { label: 'US federal tax (simplified flat top-rate estimate)', amountUsd: round2(federalTax), ratePct: round2(federalRate * 100) },
        { label: `${state.labelEn} state tax`, amountUsd: round2(stateTax), ratePct: round2(state.rate * 100) },
      ],
      takeHomeUsd: round2(takeHomeUsd),
      effectiveTaxRatePct: round2(((amountUsd - takeHomeUsd) / amountUsd) * 100),
      note: 'US resident basis. Federal tax is simplified to a flat top-rate estimate for this tool; real US filing uses progressive brackets.',
    };
  }

  if (country === 'other') {
    const usWithholding = amountUsd * US_WITHHOLDING_RATE;
    const takeHomeUsd = amountUsd - usWithholding;
    return {
      country,
      breakdown: [{ label: 'US non-resident withholding (IRC §871(a))', amountUsd: round2(usWithholding), ratePct: round2(US_WITHHOLDING_RATE * 100) }],
      takeHomeUsd: round2(takeHomeUsd),
      effectiveTaxRatePct: round2((usWithholding / amountUsd) * 100),
      note: 'Country not in the supported list — only the confirmed US non-resident withholding is deducted. Your home country almost certainly taxes this too; that is NOT included here, verify separately.',
    };
  }

  const usWithholding = amountUsd * US_WITHHOLDING_RATE;

  if (country === 'kr') {
    const rate = typeof krwPerUsd === 'number' && krwPerUsd > 0 ? krwPerUsd : 1500;
    const krw = amountUsd * rate;
    const usWithholdingKrw = krw * US_WITHHOLDING_RATE;
    const koreaCalculatedTaxKrw = calcKoreaProgressiveTaxWon(krw);
    const ftcCreditKrw = Math.min(usWithholdingKrw, koreaCalculatedTaxKrw);
    const koreaAdditionalNationalTaxKrw = Math.max(koreaCalculatedTaxKrw - ftcCreditKrw, 0);
    const koreaLocalTaxKrw = koreaAdditionalNationalTaxKrw * 0.1; // local income tax = 10% of national tax
    const koreaTotalTaxKrw = koreaAdditionalNationalTaxKrw + koreaLocalTaxKrw;
    const koreaTotalTaxUsd = koreaTotalTaxKrw / rate;
    const takeHomeUsd = amountUsd - usWithholding - koreaTotalTaxUsd;
    return {
      country,
      exchangeRateUsed: rate,
      exchangeRateIsDefaultPlaceholder: typeof krwPerUsd !== 'number' || krwPerUsd <= 0,
      breakdown: [
        { label: 'US federal withholding (non-resident, IRC §871(a))', amountUsd: round2(usWithholding), ratePct: round2(US_WITHHOLDING_RATE * 100) },
        { label: 'Korea additional tax (comprehensive income tax + 10% local surtax, after foreign tax credit)', amountUsd: round2(koreaTotalTaxUsd), ratePct: round2((koreaTotalTaxKrw / krw) * 100) },
      ],
      takeHomeUsd: round2(takeHomeUsd),
      effectiveTaxRatePct: round2(((amountUsd - takeHomeUsd) / amountUsd) * 100),
      note: 'Korea resident basis. Korea taxes this as "other income" under comprehensive income tax (progressive brackets), with the US withholding offset via foreign tax credit. If exchangeRateIsDefaultPlaceholder is true, pass a current krwPerUsd for an accurate bracket lookup.',
    };
  }

  if (country === 'pk') {
    // Pakistan: FTC only offsets the base rate, not the super tax / surcharge components (mirrors script.js).
    const base = amountUsd * 0.35;
    const superTax = amountUsd * 0.08;
    const surcharge = base * 0.10;
    const calculatedTax = base + superTax + surcharge;
    const ftcCredit = Math.min(usWithholding, base);
    const additionalTax = Math.max(calculatedTax - ftcCredit, 0);
    const takeHomeUsd = amountUsd - usWithholding - additionalTax;
    return {
      country,
      breakdown: [
        { label: 'US federal withholding (non-resident, IRC §871(a))', amountUsd: round2(usWithholding), ratePct: round2(US_WITHHOLDING_RATE * 100) },
        { label: 'Pakistan additional tax (base + super tax + surcharge, FTC offsets base only)', amountUsd: round2(additionalTax), ratePct: round2((additionalTax / amountUsd) * 100) },
      ],
      takeHomeUsd: round2(takeHomeUsd),
      effectiveTaxRatePct: round2(((amountUsd - takeHomeUsd) / amountUsd) * 100),
      note: '⚠️ Pakistan: whether the domestic lottery withholding statute (Sec 156) even applies to a payout with no Pakistani withholding agent is unclear — this approximates using the general top income tax bracket + super tax + surcharge.',
    };
  }

  const model = FLAT_COUNTRY_MODEL[country];
  const calculatedTax = amountUsd * model.rate;
  const ftcCredit = model.ftcAvailable ? Math.min(usWithholding, calculatedTax) : 0;
  const additionalTax = Math.max(calculatedTax - ftcCredit, 0);
  const takeHomeUsd = amountUsd - usWithholding - additionalTax;
  return {
    country,
    breakdown: [
      { label: 'US federal withholding (non-resident, IRC §871(a))', amountUsd: round2(usWithholding), ratePct: round2(US_WITHHOLDING_RATE * 100) },
      { label: `Additional country tax${model.ftcAvailable ? ' (after foreign tax credit)' : ' (no foreign tax credit available — stacks in full)'}`, amountUsd: round2(additionalTax), ratePct: round2((additionalTax / amountUsd) * 100) },
    ],
    takeHomeUsd: round2(takeHomeUsd),
    effectiveTaxRatePct: round2(((amountUsd - takeHomeUsd) / amountUsd) * 100),
    note: model.note,
  };
}

module.exports = { calculateTakeHome, SUPPORTED_COUNTRIES, STATE_TAX_RATES };

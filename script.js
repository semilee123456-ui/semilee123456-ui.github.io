// ============================================================
// 세금 모델 정의 (단일 기준 — 여기만 고치면 전체 계산기에 반영됨)
// 출처: IRS Instructions for Forms W-2G (2026), Park v. Commissioner 136 T.C. 569 (2011),
//       IRS-Korea Tax Treaty (irs.gov/pub/irs-trty/korea.pdf)
// ============================================================
// 환율 (전역 단일 기준 — 실제 서비스에서는 매일 자동 갱신 필요)
// ============================================================
// 언어 전환 (Phase 1 — 홈 화면 핵심 UI만 영어 지원. 국가비교/확률체감/FAQ는 아직 한국어만 제공)
// ============================================================
// ⚠️ [향후 다국어 확장 시 필독] currentLang은 'ko'|'en' 이진값이고, 아래 I18N 사전도
// 항목당 en 필드 하나만 가짐. 코드 곳곳(약 17곳)에 `currentLang === 'en' ? A : B` 삼항연산이
// 흩어져 있어서, 베트남어·태국어 등을 추가하려면:
//   1) currentLang을 언어 코드로, 토글 버튼을 선택 UI로 변경
//   2) I18N 사전 항목을 { en:'', vi:'', th:'' } 형태로 확장
//   3) 흩어진 `currentLang === 'en' ? A : B` 삼항연산을 전부 사전 조회 방식으로 교체
//   4) 무엇보다, 150개 넘는 문구의 실제 번역 작업이 코드 작업보다 훨씬 큼
// 실제 언어가 확정되기 전엔 구조를 미리 넓히지 않기로 결정함 (2026년 7월) — 근거 없이
// 짐작한 구조가 실제 필요와 안 맞을 위험이 구조를 안 짜두는 비용보다 크다고 판단.
let currentLang = 'ko';

const I18N = {
  'nav.compare':   { en: 'Compare' },
  'nav.odds':      { en: 'Odds' },
  'nav.faq':       { en: 'FAQ' },
  'hero.tag':      { en: '🧮 US Lottery Tax Calculator' },
  'hero.title':    { en: 'how much would<br>you actually take home?' },
  'result.label':      { en: '💰 Estimated take-home amount' },
  'result.trustBadge': { en: 'Based on official IRS · Korea NTS data' },
  'result.share':      { en: '📤 Share this result' },
  'input.amountLabel': { en: 'Enter prize amount' },
  'input.amountLabelFull': { en: 'Prize amount (pre-tax lump sum)' },
  'input.amountPlaceholder': { en: 'e.g. 100' },
  'input.bridge': { en: '👇 The amount above is just an example — try entering your own' },
  'input.orManualLabel': { en: 'Or enter an amount directly' },
  'input.basisLabel':  { en: 'Tax basis' },
  'input.krwHint':     { en: '💡 The advertised jackpot isn\u2019t what you actually receive —' },
  'input.krwHintFull': { en: 'Enter the actual lump-sum amount (about 45–60%) — not the jackpot number from the news' },
  'home.inputHint': { en: 'Enter your winnings directly' },
  'home.quickfillPowerball': { en: 'Powerball recent jackpot' },
  'home.quickfillMega': { en: 'Mega Millions recent jackpot' },
  'input.optKorea':    { en: '🇰🇷 Korea basis' },
  'input.optUS':       { en: '🇺🇸 US basis' },
  'home.filingNoteState': { en: '💡 Korean residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.' },
  'common.seeMore':    { en: 'See more' },
  'explore.title':      { en: '🧭 Curious about more?' },
  'explore.compareLabel': { en: 'Country Compare' },
  'explore.compareSub':   { en: 'Where\u2019s better to live' },
  'explore.oddsLabel':    { en: 'Odds Sense' },
  'explore.oddsSub':      { en: 'Get a feel for the 1-in-292M odds' },
  'explore.faqLabel':     { en: 'FAQ' },
  'explore.faqSub':       { en: 'Taxes, refunds & more' },
  'common.backHome':   { en: '← Back to Home' },
  'common.home':       { en: 'Home' },
  'common.exchangeRate': { en: 'Rate' },
  'common.won':        { en: 'KRW' },
  'common.close':      { en: 'Close' },
  'common.refreshRate': { en: 'Refresh exchange rate' },
  'common.adSlot':     { en: 'Ad Space (Google AdSense)' },
  'compare.breadcrumb':  { en: 'Country Comparison' },
  'compare.panelTitle':  { en: 'Curious what actually lands in your pocket?' },
  'compare.panelDesc':   { en: 'Type the prize amount or use the slider 👇' },
  'compare.krwHint':     { en: '💡 Not the advertised annuity jackpot — enter the pre-tax lump-sum cash value.' },
  'compare.selectHint':  { en: '💬 Your take-home amount depends on where you live' },
  'compare.stateLabel':  { en: '🇺🇸 State used for the US-resident calculation <span>(state tax ranges 0%~10.9%)</span>' },
  'compare.filingLabel': { en: 'US resident filing status' },
  'compare.filingSmall': { en: '💬 For prizes this large, filing status (single/married) barely changes the result (bracket difference is under 0.1% of the total)' },
  'compare.filingRow':   { en: 'Single and Married Filing Jointly give nearly identical results, so no selection is needed' },
  'compare.filingNote':  { en: '💡 Korea residents are <b>subject to US nonresident withholding</b>, so there\u2019s no need to choose a filing status (Single/Married). (May vary by payout type or tax treaty.)' },
  'compare.flowExplain': { en: 'The US withholds tax first, then Korea taxes the rest (with some credit available)' },
  'compare.sideTitle': { en: 'Korea vs. US, side by side' },
  'compare.otherLangTitle': { en: 'Living in Korea as a different nationality?' },
  'compare.sideKRFlag': { en: '🇰🇷 Korea resident' },
  'compare.sideUSFlag': { en: '🇺🇸 US resident (average state tax)' },
  'compare.sideRateLabel': { en: 'Take-home rate about' },
  'compare.sideBreakdownTitle': { en: "Here's how the tax breaks down" },
  'compare.sideFlowExplain': { en: '🇺🇸 The US withholds tax first, then 🇰🇷 Korea taxes the rest (with some credit available) — US residents only pay federal + state tax' },
  'compare.sideUSFedLabel': { en: 'US Federal Tax' },
  'compare.sideUSStateLabel': { en: 'Average State Tax' },
  'compare.finalLabel':  { en: 'Final take-home amount' },
  'compare.simNote':     { en: '\ud83d\udca1 A reference calculation reflecting progressive Korean income tax and Foreign Tax Credit (FTC) \u2014 actual tax varies by situation, consult a tax professional.' },
  'compare.vnNote': { en: '🇻🇳 Vietnam resident figures are still being researched — we\u2019ll add them once ready' },
  'compare.tableTitle':  { en: 'Which country is better to live in?' },
  'compare.tableDesc':   { en: 'US resident, Korea resident, and Vietnam resident (planned) take-home rates side by side' },
  'compare.thCountry':    { en: 'Country' },
  'compare.thStructure':  { en: 'Tax Structure' },
  'compare.thTakeHome':   { en: 'Take-home' },
  'compare.rowUS':       { en: '🇺🇸 US resident' },
  'compare.rowUSRate':   { en: 'Federal 37% + state tax (varies)' },
  'compare.rowKR':       { en: '🇰🇷 Korea resident' },
  'compare.rowKRRate':   { en: 'US 30% withholding + Korea progressive income tax (with FTC)' },
  'compare.rowUSPct':    { en: 'About 58.0%' },
  'compare.rowKRPct':    { en: 'About 53.5%' },
  'compare.rowVN':       { en: '🇻🇳 Vietnam resident (planned)' },
  'compare.rowVNRate':   { en: 'Researching' },
  'compare.tableFoot':   { en: '(Example calculation \u2014 actual rates may vary by income bracket, state, and tax treaty)' },
  'compare.callout':     { en: '💡 Same prize, but <b>your take-home rate can differ a lot depending on where you live.</b> Interesting, right?' },
  'compare.oddsHint':    { en: 'Curious? Try the <b>Odds Sense</b> menu too \u2192 it\u2019s pretty fun' },
  'compare.disclaimer':  { en: 'Built with reference to IRS and Korean NTS guidance (hope you get the chance to actually win!)' },
  'state.AVG': { en: 'Average (example, 8%)' },
  'state.AL': { en: 'Alabama (5%)' },
  'state.AK': { en: 'Alaska (0%)' },
  'state.AZ': { en: 'Arizona (2.5%)' },
  'state.AR': { en: 'Arkansas (3.9%)' },
  'state.CA': { en: 'California (lottery-exempt, 0%)' },
  'state.CO': { en: 'Colorado (4.4%)' },
  'state.CT': { en: 'Connecticut (6.99%)' },
  'state.DE': { en: 'Delaware (6.6%)' },
  'state.FL': { en: 'Florida (0%)' },
  'state.GA': { en: 'Georgia (5.39%)' },
  'state.HI': { en: 'Hawaii (11%)' },
  'state.ID': { en: 'Idaho (5.3%)' },
  'state.IL': { en: 'Illinois (4.95%)' },
  'state.IN': { en: 'Indiana (2.95%)' },
  'state.IA': { en: 'Iowa (3.8%)' },
  'state.KS': { en: 'Kansas (5.58%)' },
  'state.KY': { en: 'Kentucky (3.5%)' },
  'state.LA': { en: 'Louisiana (3%)' },
  'state.ME': { en: 'Maine (7.15%)' },
  'state.MD': { en: 'Maryland (8.95%, unconfirmed)' },
  'state.MA': { en: 'Massachusetts (9%)' },
  'state.MI': { en: 'Michigan (4.25%)' },
  'state.MN': { en: 'Minnesota (9.85%)' },
  'state.MS': { en: 'Mississippi (4%)' },
  'state.MO': { en: 'Missouri (4.7%)' },
  'state.MT': { en: 'Montana (5.65%)' },
  'state.NE': { en: 'Nebraska (4.55%)' },
  'state.NV': { en: 'Nevada (0%)' },
  'state.NH': { en: 'New Hampshire (0%)' },
  'state.NJ': { en: 'New Jersey (10.75%)' },
  'state.NM': { en: 'New Mexico (5.9%)' },
  'state.NY': { en: 'New York (10.9%)' },
  'state.NC': { en: 'North Carolina (3.99%)' },
  'state.ND': { en: 'North Dakota (1.95%)' },
  'state.OH': { en: 'Ohio (2.75%)' },
  'state.OK': { en: 'Oklahoma (4.5%)' },
  'state.OR': { en: 'Oregon (9.9%)' },
  'state.PA': { en: 'Pennsylvania (3.07%)' },
  'state.RI': { en: 'Rhode Island (5.99%)' },
  'state.SC': { en: 'South Carolina (6.2%)' },
  'state.SD': { en: 'South Dakota (0%)' },
  'state.TN': { en: 'Tennessee (0%)' },
  'state.TX': { en: 'Texas (0%)' },
  'state.UT': { en: 'Utah (4.55%)' },
  'state.VT': { en: 'Vermont (8.75%)' },
  'state.VA': { en: 'Virginia (5.75%)' },
  'state.WA': { en: 'Washington (0%)' },
  'state.DC': { en: 'Washington D.C. (10.75%)' },
  'state.WV': { en: 'West Virginia (4.82%)' },
  'state.WI': { en: 'Wisconsin (7.65%)' },
  'state.WY': { en: 'Wyoming (0%)' },
  'odds.breadcrumb':  { en: 'Odds Sense Tool' },
  'odds.panelTitle':  { en: 'This probability doesn\u2019t really register, does it?' },
  'odds.panelDesc':   { en: '1 in 292 million doesn\u2019t feel real. So we compared it to things that do.' },
  'odds.barPowerball': { en: 'Powerball Jackpot' },
  'odds.barLightning': { en: 'Struck by lightning' },
  'odds.barPlane':     { en: 'Plane crash' },
  'odds.barShark':     { en: 'Shark attack' },
  'odds.oddsPowerball': { en: '1 / 292M' },
  'odds.oddsLightning': { en: '1 / 15,000' },
  'odds.oddsPlane':     { en: '1 / 11M' },
  'odds.oddsShark':     { en: '1 / 3.75M' },
  'odds.callout': { en: '💡 Winning the Powerball jackpot is about as likely as <b>getting struck by lightning 19,000 times in a row.</b> Yet several people still win every year 🍀' },
  'odds.winnersTitle': { en: '🏆 People really have won this much' },
  'odds.winnersDesc':  { en: 'It does actually happen \u2014 here are some record-breaking real cases' },
  'odds.historyTitle': { en: '📜 Past Jackpot Records' },
  'odds.historyDesc':  { en: 'Jackpot amounts we\u2019ve checked, with estimated take-home for both Korean and US residents (including the top 5 all-time records)' },
  'odds.historyFullLink': { en: '📄 See the Top 5 all-time jackpots in detail →' },
  'odds.winner1Amt': { en: '$2.04 billion' },
  'odds.winner1':    { en: 'November 2022, California \u2014 Edwin Castro, winner of the largest Powerball jackpot in history. He took the $997.6M lump sum and bought $25.5M and $47M houses back to back. Sued over a claim the ticket was stolen, he was confirmed the rightful owner in 2024, then in 2025 donated land to build homes for wildfire victims.' },
  'odds.winner2Amt': { en: '$758.7 million' },
  'odds.winner2':    { en: 'August 2017, Massachusetts \u2014 Mavis Wanczyk quit her job at a hospital where she\u2019d worked for 32 years the moment she found out she\u2019d won. Once she became famous, though, dozens of fake accounts impersonating her popped up online, and police had to step in.' },
  'odds.winner3Amt': { en: '🍀 Anonymous winners' },
  'odds.winner3':    { en: 'Some states let winners stay anonymous (Florida, Texas, Delaware, etc.). If you’d rather not end up like Castro or Wanczyk, this is the option many big winners choose.' },
  'odds.lightningTitle': { en: '⚡ Today\u2019s Lightning Numbers' },
  'odds.lightningDesc':  { en: 'Drawn just for fun, with today\u2019s "lightning" energy \u2014 6 random numbers' },
  'odds.drawBtn':  { en: '⚡⚡⚡ Draw numbers' },
  'odds.drawNote': { en: 'Your odds with these numbers are still 1 in 292 million \u2014 just for fun 😉' },
  'odds.payoutTitle': { en: 'How much do you win for each match?' },
  'odds.payoutDesc':  { en: 'Powerball prize tiers by numbers matched' },
  'odds.megaNote':    { en: '💡 Mega Millions has different numbers and prizes — <a href="https://www.megamillions.com" target="_blank" rel="noopener noreferrer" style="color:var(--teal); font-weight:700; text-decoration:none;">check the official site →</a>' },
  'odds.howtoTitle': { en: '🎱 First, how the game works' },
  'odds.howtoText':  { en: 'Powerball is a game of matching <b>5 regular numbers</b> (from 1\u201369) plus <b>1 Powerball number</b> (from 1\u201326) \u2014 6 numbers total. The prize depends on how many regular numbers you match, plus whether you match the Powerball.' },
  'odds.jackpotTag':     { en: '🏆 Jackpot' },
  'odds.jackpotMatch':   { en: '🎯 Match all 6 numbers' },
  'odds.jackpotExplain': { en: 'Keeps growing until someone wins' },
  'odds.jcStep1': { en: '📢 Announced jackpot (annuity basis)' },
  'odds.jcStep2': { en: '💰 Lump-sum option (present value, pre-tax, ~58%)' },
  'odds.jcStep3': { en: 'What actually lands in your hand after tax' },
  'odds.jcStep4': { en: '💡 What if you take the annuity instead of the lump sum?' },
  'odds.jcAnnuityYear':    { en: '📅 30 payments, average per year (pre-tax)' },
  'odds.jcAnnuityYearNet': { en: 'What you actually get each year' },
  'odds.jcAnnuityMonth':   { en: '🗓️ Per month' },
  'odds.jcAnnuityNote': { en: 'Unlike the discounted lump sum, an annuity pays out <b>the full announced jackpot</b> over 30 payments across 29 years (each payment grows 5% after the first). Spreading it out over years also spreads the tax burden \u2014 the amount above is a simple average, so the actual first payment is lower.' },
  'odds.match5':      { en: 'Match 5 numbers' },
  'odds.missedPB':    { en: 'Missed the Powerball' },
  'odds.amt5':        { en: 'About \u20a91.5B' },
  'odds.odds5':       { en: '1 / 11.69M' },
  'odds.match4pb':    { en: 'Match 4 + Powerball' },
  'odds.amt4pb':      { en: 'About \u20a975.2M' },
  'odds.odds4pb':     { en: '1 / 910K' },
  'odds.match4':      { en: 'Match 4 numbers' },
  'odds.amt4':        { en: 'About \u20a9150,000' },
  'odds.odds4':       { en: '1 / 36,525' },
  'odds.match3pb':    { en: 'Match 3 + Powerball' },
  'odds.amt3pb':      { en: 'About \u20a9150,000' },
  'odds.odds3pb':     { en: '1 / 14,494' },
  'odds.matchPBonly': { en: 'Powerball number only' },
  'odds.amtPBonly':   { en: 'About \u20a96,000' },
  'odds.oddsPBonly':  { en: '1 / 38' },
  'odds.disclaimer': { en: 'Odds figures are based on official published data. KRW conversion uses a reference exchange rate and may differ from actual amounts.' },
  'faq.breadcrumb':  { en: 'Frequently Asked Questions' },
  'faq.panelTitle':  { en: 'Questions people often ask' },
  'faq.panelDesc':   { en: 'Common questions from people who searched their way here · Confirmed based on National Tax Service consultations' },
  'faq.searchPlaceholder': { en: '🔍 Search (e.g. tax, citizenship, Powerball)' },
  'faq.catAll':      { en: 'All' },
  'faq.catTax':      { en: 'Tax & Double Taxation' },
  'faq.catLife':     { en: 'Health, Pension & Gift Tax' },
  'faq.catRefund':   { en: 'Refunds & Deadlines' },
  'faq.catPurchase': { en: 'Purchasing & Process' },
  'faq.catGame':     { en: 'Game Info' },
  'faq.noResult':    { en: 'No content.' },
  'faq.q1': { en: 'How much tax is actually deducted? 😮' },
  'faq.a1': { en: 'US residents get 24% withheld upfront, settled up to 37% later. Non-US residents (including Korean residents) generally face a 30% withholding rule.' },
  'faq.q2': { en: 'Wait, I pay tax in Korea too?' },
  'faq.a2': { en: 'Yes. US lottery winnings aren\u2019t a domestic lottery, so they\u2019re combined into comprehensive income tax (up to 45%). Tax already paid in the US can offset via Foreign Tax Credit (FTC).' },
  'faq.q3': { en: 'Can I get any of the tax back? 💸' },
  'faq.a3': { en: 'The 30% US federal withholding is practically non-refundable. State tax varies \u2014 Maryland and Arizona are unusual in taxing non-residents too. Pick your winning state below to check.' },
  'faq.step': { en: 'STEP' },
  'faq.selectState': { en: 'Select the state you won in' },
  'faq.selectStatePlaceholder': { en: 'Select the state you won in 👇' },
  'faq.wizardDefault': { en: 'Select a state to see your refund possibility instantly' },
  'faq.q4': { en: 'Will my health insurance premium spike if I win? 🏥' },
  'faq.a4': { en: 'Regional subscribers see winnings fully counted as income, raising premiums a lot. Employed subscribers pay extra premium above ₩20M/year in outside income too. If registered as a dependent, you may lose that status.' },
  'faq.q5': { en: 'I\u2019m already receiving National Pension / Basic Pension \u2014 does this affect it? 👴' },
  'faq.a5': { en: 'Depends on the program. National Pension \u2014 if already receiving it, the reduction rule applies to earned/business income, not a one-time windfall. Basic Pension / welfare benefits reassess eligibility by income and assets, so benefits could change.' },
  'faq.q6': { en: 'How do I tell if a "you won" message is a scam? 🚨' },
  'faq.a6': { en: 'Common scam patterns: impersonating card companies asking for card info to "refund" a losing ticket, fake lottery commission asking for crypto purchases, or selling fake winning-number predictions. Real winnings are checked by you on the official site \u2014 unsolicited requests for money or info are 100% scams.' },
  'faq.q7': { en: 'How much gift tax if I share with family? 👨‍👩‍👧' },
  'faq.a7': { en: 'Spouse up to ₩600M, adult children up to ₩50M are tax-free. Amounts above that face a 10–50% progressive rate. Filing on time gets you a 3% credit.' },
  'faq.q8': { en: 'Is prize money subject to property division in a divorce? 💍' },
  'faq.a8': { en: 'In principle, no \u2014 courts treat it as personal property from pure luck. But if a spouse helped preserve or grow the money afterward, that contribution may be included.' },
  'faq.q9': { en: 'By when do I have to claim the winnings? ⏰' },
  'faq.deadlineBadge': { en: 'Has a deadline' },
  'faq.a9': { en: 'Usually 90 days to 1 year. Miss it, and it reverts to the state \u2014 gone forever. One winner actually lost $138M by missing the deadline.' },
  'state.name.AL': { en: 'Alabama' },
  'state.name.AK': { en: 'Alaska' },
  'state.name.AZ': { en: 'Arizona' },
  'state.name.AR': { en: 'Arkansas' },
  'state.name.CA': { en: 'California' },
  'state.name.CO': { en: 'Colorado' },
  'state.name.CT': { en: 'Connecticut' },
  'state.name.DE': { en: 'Delaware' },
  'state.name.FL': { en: 'Florida' },
  'state.name.GA': { en: 'Georgia' },
  'state.name.HI': { en: 'Hawaii' },
  'state.name.ID': { en: 'Idaho' },
  'state.name.IL': { en: 'Illinois' },
  'state.name.IN': { en: 'Indiana' },
  'state.name.IA': { en: 'Iowa' },
  'state.name.KS': { en: 'Kansas' },
  'state.name.KY': { en: 'Kentucky' },
  'state.name.LA': { en: 'Louisiana' },
  'state.name.ME': { en: 'Maine' },
  'state.name.MD': { en: 'Maryland' },
  'state.name.MA': { en: 'Massachusetts' },
  'state.name.MI': { en: 'Michigan' },
  'state.name.MN': { en: 'Minnesota' },
  'state.name.MS': { en: 'Mississippi' },
  'state.name.MO': { en: 'Missouri' },
  'state.name.MT': { en: 'Montana' },
  'state.name.NE': { en: 'Nebraska' },
  'state.name.NV': { en: 'Nevada' },
  'state.name.NH': { en: 'New Hampshire' },
  'state.name.NJ': { en: 'New Jersey' },
  'state.name.NM': { en: 'New Mexico' },
  'state.name.NY': { en: 'New York' },
  'state.name.NC': { en: 'North Carolina' },
  'state.name.ND': { en: 'North Dakota' },
  'state.name.OH': { en: 'Ohio' },
  'state.name.OK': { en: 'Oklahoma' },
  'state.name.OR': { en: 'Oregon' },
  'state.name.PA': { en: 'Pennsylvania' },
  'state.name.RI': { en: 'Rhode Island' },
  'state.name.SC': { en: 'South Carolina' },
  'state.name.SD': { en: 'South Dakota' },
  'state.name.TN': { en: 'Tennessee' },
  'state.name.TX': { en: 'Texas' },
  'state.name.UT': { en: 'Utah' },
  'state.name.VT': { en: 'Vermont' },
  'state.name.VA': { en: 'Virginia' },
  'state.name.WA': { en: 'Washington' },
  'state.name.DC': { en: 'Washington D.C.' },
  'state.name.WV': { en: 'West Virginia' },
  'state.name.WI': { en: 'Wisconsin' },
  'state.name.WY': { en: 'Wyoming' },
  'faq.q10': { en: 'Aside from the lottery, might I have unclaimed money that\u2019s already mine?' },
  'faq.a10': { en: 'Unlike the lottery, this is money already confirmed under your name — old tax refunds, forgotten bank accounts, unclaimed retirement plans, and more. Billions of dollars in unclaimed property sit unclaimed in the US every year. Check the list below.' },
  'faq.checklistTitle': { en: 'Check if any of these apply to you' },
  'faq.check1': { en: 'Never claimed a state or federal tax refund you were actually owed' },
  'faq.check2': { en: 'Worked as a freelancer/contractor and might have skipped filing some year' },
  'faq.check3': { en: 'Left a job mid-year and never checked if you overpaid that year\u2019s taxes' },
  'faq.check4': { en: 'Might have missed deductions (medical, donations, etc.) in some year' },
  'faq.check5': { en: 'Not sure where to even start \u2014 want a general starting point' },
  'faq.check6': { en: 'Have an old bank account, uncashed check, or insurance payout you forgot about' },
  'faq.check7': { en: 'Changed jobs and never rolled over an old 401(k) or pension plan' },
  'faq.check8': { en: 'Own U.S. Savings Bonds that matured years ago and stopped earning interest' },
  'faq.checkDefault': { en: 'If any apply, check for real below 👇' },
  'faq.recommend': { en: '⭐ Recommended' },
  'faq.linkHometax':   { en: 'IRS Refund<br>Status' },
  'faq.linkGov24':     { en: 'Unclaimed Money<br>Hub' },
  'faq.linkFine':      { en: 'Find Unclaimed<br>Property' },
  'faq.linkHealth':    { en: 'Old 401(k)/<br>Retirement Plans' },
  'faq.linkCardpoint': { en: 'Matured Savings<br>Bonds' },
  'faq.checklistFooter': { en: 'We can\u2019t do the lookup for you \u2014 a couple of these (MissingMoney, USA.gov) just need your name, but others (IRS, retirement plans, savings bonds) will ask for your SSN, the same way Korean sites ask for your resident registration number. Either way, these are the real official channels. Takes about 10 minutes to check.' },
  'faq.shareChecklist': { en: '📤 Share this with a friend' },
  'faq.q11': { en: 'Is it better to take it all at once, or in installments?' },
  'faq.a11': { en: 'The announced jackpot is the annuity total — lump sum is about 45–60% of that. Most winners choose lump sum — check the <button type="button" class="inline-link-btn" onclick="goToAnnuityInfo()">jackpot calculator under Odds</button> for a detailed comparison.' },
  'faq.q12': { en: 'Where can I buy a US lottery ticket?' },
  'faq.a12': { en: 'Sold at convenience stores and gas stations in the US. Domestic purchase-agent services carry legal risk, so we don\u2019t refer them.' },
  'faq.q13': { en: 'What if a friend buys a ticket for me, or claims the prize on my behalf?' },
  'faq.a13': { en: 'Even a friend buying it personally creates complications. Ownership is usually determined by who signs to claim it. If they claim as a US resident, their tax rate applies, and transferring the money could trigger both US and Korean gift tax.' },
  'faq.q14': { en: 'Where can I check past winning numbers?' },
  'faq.a14b': { en: 'We show recent numbers on our home screen, but the official sites are the most accurate source.' },
  'faq.linkPowerball': { en: '🔗 Powerball official site →' },
  'faq.linkMega':      { en: '🔗 Mega Millions official site →' },
  'faq.q15': { en: 'Can I claim winnings without US citizenship?' },
  'faq.a15': { en: 'Yes, foreigners who legally bought a ticket can claim. Non-resident aliens face the 30% withholding though.' },
  'faq.q16': { en: 'I\u2019m a Korean living in the US \u2014 which option should I choose? (students, expats, green card, citizens)' },
  'faq.a16': { en: '\u201cLiving in the US\u201d and \u201cUS tax resident\u201d can differ. Green card/citizenship holders should pick \u201cUS.\u201d Students or early-stage expats may still be non-resident aliens, making \u201cKorea (non-resident)\u201d more accurate. Consult a US tax pro if unsure.' },
  'faq.q17': { en: 'What is the "filing status (single/married)" option in the calculator?' },
  'faq.a17': { en: 'US filing status affects tax brackets, but for lottery-size amounts it barely matters \u2014 the difference between single and joint top brackets is a rounding error.' },
  'faq.q18': { en: 'What actually happens, step by step, if I win?' },
  'faq.a18': { en: 'It’s a 6-step process: buy in the US → confirm the win → claim it. See the full breakdown under <b>A closer look at the purchase process</b> below.' },
  'faq.q19': { en: 'How do I file these taxes?' },
  'faq.a19': { en: 'The US withholds 30% first; in Korea you report it as other income the following May. Tax paid in the US can offset via FTC. Consult a tax pro handling both countries.' },
  'faq.q20': { en: 'How do I claim the Foreign Tax Credit (FTC)? What documents do I need?' },
  'faq.a20': { en: 'To offset the US tax (30% withholding) against your Korean income tax filing, based on a July 2026 National Tax Service phone consultation you’ll need: <b>a certificate of tax payment issued by the foreign (US) government, a payment receipt, a withholding tax receipt, and proof of the prize itself</b>. The exchange rate used is <b>the rate on the day you actually received the prize money</b> (per Enforcement Decree of the Income Tax Act, Article 50). This isn’t an official written ruling, so confirm the exact document list with a tax professional before filing.' },
  'faq.moreTitle':  { en: '📚 Learn more (terms, purchase process, payout methods, etc.)' },
  'faq.termsTitle': { en: 'Let\u2019s start with the basic terms' },
  'faq.termsDesc':  { en: 'The part people mix up the most \u2014 here\u2019s a side-by-side comparison of the two games' },
  'faq.gamePowerball':  { en: '🔴 Powerball' },
  'faq.gamePrice':      { en: 'Price' },
  'faq.gameDrawDay':    { en: 'Draw days' },
  'faq.gameNumFormat':  { en: 'Number format' },
  'faq.pbDrawDays':     { en: 'Mon, Wed, Sat' },
  'faq.pbNumFormat':    { en: '5 of 1\u201369<br>+ 1 of 1\u201326' },
  'faq.gameOdds':    { en: 'Jackpot odds' },
  'faq.gameMega':    { en: '🟡 Mega Millions' },
  'faq.multiplierOption': { en: '(includes Megaplier option)' },
  'faq.mgDrawDays':  { en: 'Tue, Fri' },
  'faq.mgNumFormat': { en: '5 of 1\u201370<br>+ 1 of 1\u201324' },
  'faq.mgOdds':      { en: '1 / 290.47M' },
  'faq.samePlace': { en: '📍 Where to buy: <b>Same place!</b> Both are sold at the same convenience stores and gas stations' },
  'faq.sameStoreCallout': { en: '\ud83d\udca1 Many wonder "where do I buy Powerball vs Mega Millions?" \u2014 they\u2019re actually sold at the same stores. Just tell the cashier which game you want.' },
  'faq.otherGamesNote': { en: 'Note: there\u2019s also Millionaire for Life, Lotto America, and state-specific lotteries, but only these two make Korean news, so that\u2019s our focus.' },
  'faq.trivia': { en: 'Trivia you don\u2019t need to know this month: Millionaire for Life replaced the previous "Lucky for Life" and "Cash4Life," which ended and merged on February 21, 2026.' },
  'faq.taxGuideTitle': { en: 'The tax basics, in a nutshell' },
  'faq.tg1Title': { en: 'How is US tax calculated?' },
  'faq.tg1Sub':   { en: 'Federal 24\u201337% + 30% nonresident withholding' },
  'faq.tg2Title': { en: 'Do I pay again in Korea?' },
  'faq.tg2Sub':   { en: 'Progressive income tax (up to 45%), adjusted via Foreign Tax Credit (FTC) \u2014 reference calculation' },
  'faq.tg3Title': { en: 'Lump sum vs. annuity \u2014 what\u2019s the difference?' },
  'faq.tg3Sub':   { en: 'Different tax brackets apply, so total tax owed can differ' },
  'faq.purchaseGuideTitle': { en: 'A closer look at the purchase process' },
  'faq.purchaseGuideDesc':  { en: 'A step-by-step guide for first-timers' },
  'faq.gateLabel': { en: '⚠️ Prerequisite' },
  'faq.gateText':  { en: 'You need to actually be in the US<br>(travel, business trip, studying abroad, etc.)' },
  'faq.gateSub':   { en: 'There\u2019s no legal way to buy remotely from Korea' },
  'faq.step1Title':  { en: 'Find a retailer' },
  'faq.step1Detail': { en: 'Any convenience store, gas station, or supermarket with a \u2018Lottery\u2019 sign works' },
  'faq.ticketTitle': { en: '🎫 What the ticket looks like' },
  'faq.ticketMeta':  { en: 'Draw date: MON JUL 06 2026  |  QP (Quick Pick)  |  $2.00' },
  'faq.ticketDetail': { en: 'The front shows <b>your chosen numbers (or Quick Pick random numbers), the draw date, price, and a scannable barcode</b>. That barcode is essential for verifying a win later \u2014 keep it safe!' },
  'faq.step2FlowTitle':  { en: 'Pay' },
  'faq.step2FlowDetail': { en: 'Usually $2\u2013$5 per ticket. You pay right at the counter.' },
  'faq.tagCash':      { en: '✓ Cash accepted' },
  'faq.tagCard':      { en: '✓ Card accepted' },
  'faq.tagNoInstall': { en: '✗ No installment payments' },
  'faq.phraseTitle': { en: '🗣️ Useful phrases even if you don\u2019t speak English' },
  'faq.phrase1': { en: 'One Powerball, quick pick, please' },
  'faq.phrase2': { en: 'One Mega Millions, please' },
  'faq.phrase3': { en: 'Cash / Card, please' },
  'faq.phraseTip': { en: '\ud83d\udca1 Just say "quick pick" and the computer picks random numbers \u2014 most people buy this way!' },
  'faq.playslipTitle': { en: '✏️ Want to pick your own numbers? (How to fill out a play slip)' },
  'faq.psRegular':   { en: '5 regular numbers (1\u201369)' },
  'faq.psPowerball': { en: '1 Powerball number (1\u201326)' },
  'faq.psStep1': { en: 'Grab a <b>free play slip</b> from the store, and fill in bubbles with a black or blue pen (or pencil) \u2014 <b>fill the circles solidly</b> (red pen won\u2019t scan)' },
  'faq.psStep2': { en: 'You can pick some numbers yourself and mark <b>QP (Quick Pick)</b> for the rest \u2014 only those get filled randomly' },
  'faq.psStep3': { en: 'If you make a mistake, don\u2019t erase \u2014 mark the <b>VOID</b> box and fill in the next row' },
  'faq.psStep4': { en: 'Hand the completed slip to <b>the cashier</b>, who scans it on the spot to turn it into a real ticket (the slip itself isn\u2019t a ticket!)' },
  'faq.signBackNote': { en: '💡 If you win, <b>sign the back of the ticket immediately</b> \u2014 this is an important step to prove ownership if lost' },
  'faq.step3Title':  { en: 'Age verification' },
  'faq.step3Detail': { en: 'Most states require you to be <b>18 or older</b> (some require 21). You can buy regardless of nationality.' },
  'faq.step4Title':  { en: '📢 Want to check past winning numbers?' },
  'faq.step4Detail': { en: 'You can check winning numbers directly on the official sites.' },
  'faq.newTabNote':  { en: '(opens in a new tab)' },
  'faq.checkWinTitle': { en: '💡 Here\u2019s how to check if your ticket won' },
  'faq.checkMethod1': { en: '<b>Compare the numbers yourself</b> \u2014 the most reliable method' },
  'faq.checkMethod2': { en: 'Scan the barcode with the state lottery\u2019s official app' },
  'faq.checkMethod3': { en: 'Use the store\u2019s self-service scanner or ask staff' },
  'faq.step5Title':  { en: 'If you won, claim it' },
  'faq.step5Detail': { en: 'Visit the <b>lottery office for that state</b> in person with your ID and ticket. The deadline is usually <b>180 days to 1 year</b>' },
  'faq.step6Title':  { en: 'Lump sum or annuity? You must choose when claiming' },
  'faq.step6Detail': { en: 'After claiming, you usually have <b>60 days</b> to choose one or the other. If you don\u2019t choose in time, it defaults to the annuity.' },
  'faq.lumpSumTitle':  { en: '💵 Lump Sum' },
  'faq.lumpSumDetail': { en: 'Receive about <b>45\u201360%</b> of the announced amount all at once. The option most winners choose' },
  'faq.annuityTitle':  { en: '📅 Annuity' },
  'faq.annuityDetail': { en: 'Full announced amount paid over 29 years in 30 installments (first immediate, +5%/year after)' },
  'faq.payoutIrreversible': { en: 'This choice is irreversible \u2014 decide only after consulting a tax/financial professional' },
  'faq.sixStepsNote': { en: 'That\u2019s all 6 steps. The key point is that if step 1 (the prerequisite) isn\u2019t met, none of the later steps apply to you.' },
  'faq.payMethodTitle': { en: 'Do you get paid in cash or by bank transfer?' },
  'faq.payMethodDesc':  { en: 'Completely different depending on the amount' },
  'faq.small600':       { en: '💵 $600 or less' },
  'faq.small600Detail': { en: 'You can get <b>cash</b> right on the spot at the store where you bought the ticket.' },
  'faq.largeAmt':       { en: '🏦 Large amounts (hundreds of thousands to millions of dollars)' },
  'faq.largeAmtDetail': { en: 'Not paid in cash. Paid by check or bank transfer, usually taking 6\u20138 weeks.' },
  'faq.krResident':       { en: 'If you\u2019re a Korea resident?' },
  'faq.krResidentDetail': { en: 'There\u2019s no clearly published official process. If this happens, proceed together with the lottery office, a bank capable of international transfer, and a tax/legal professional.' },
  'faq.howManyTitle': { en: 'How many tickets can I buy at once?' },
  'faq.howManyDesc':  { en: 'Actually two different questions mixed together' },
  'faq.multiTicketQ': { en: 'Q. Can I buy multiple tickets at once?' },
  'faq.multiTicketA': { en: 'Yes, no legal limit. A play slip usually allows up to 5 games per slip.' },
  'faq.multiDrawQ': { en: 'Q. Can I enter the same numbers into multiple future drawings at once?' },
  'faq.multiDrawA': { en: 'Yes, via \u2018multi-draw\u2019 \u2014 usually 10\u201326 draws at once depending on the state.' },
  'faq.noRefundNote': { en: 'Note: tickets can\u2019t be refunded or canceled once purchased (all sales are final)' },
  'faq.finalDisclaimer': { en: 'If you have any other questions, feel free to reach out via Contact!' },
  'privacy.breadcrumb':    { en: 'Privacy Policy' },
  'privacy.title':         { en: 'Privacy Policy' },
  'privacy.effectiveDate': { en: 'Effective date: July 9, 2026' },
  'disclaimer.effectiveDate': { en: 'Effective date: July 9, 2026' },
  'privacy.h1': { en: '1. Personal information collected' },
  'privacy.b1': { en: 'ChamTax (the "Site") does <b>not store calculator input values (prize amount, country of residence, exchange rate, etc.) on any server.</b> All calculations happen only within the visitor\u2019s browser and disappear when you leave the page.<br>However, if you contact us via "Contact," we collect only the <b>email address and message content</b> you provide.' },
  'privacy.h2': { en: '2. Purpose of collection' },
  'privacy.b2': { en: 'Used only to review and respond to inquiries \u2014 never for marketing or other purposes.' },
  'privacy.h3': { en: '3. Retention period' },
  'privacy.b3': { en: 'Retained for up to 1 year after the inquiry is resolved, then promptly destroyed.' },
  'privacy.h4': { en: '4. Sharing with third parties' },
  'privacy.b4': { en: 'We do not share collected personal information with third parties. However, ads displayed on the site (Google AdSense) may independently collect visit information via cookies through Google, which is handled under Google\u2019s privacy policy, not this site\u2019s.' },
  'privacy.h5': { en: '5. Use of cookies' },
  'privacy.b5': { en: 'Cookies from third-party ad services such as Google may be used to serve ads. You can refuse or delete cookies in your browser settings, though this may limit ad personalization.' },
  'privacy.h6': { en: '6. User rights' },
  'privacy.b6': { en: 'You may request to view, correct, or delete any personal information you provided via inquiries at any time. Please contact us via the Contact page below.' },
  'privacy.h7': { en: '7. Privacy officer' },
  'common.inquiry': { en: 'Contact' },
  'common.contactPageLink': { en: 'Please use the Contact page' },
  'disclaimer.breadcrumb': { en: 'Disclaimer' },
  'disclaimer.title':      { en: 'Disclaimer' },
  'disclaimer.h1': { en: '1. Purpose of information' },
  'disclaimer.b1': { en: 'All calculation results and information provided on this site are a <b>reference simulation</b>, not tax, legal, or financial advice.' },
  'disclaimer.h2': { en: '2. Accuracy of calculations' },
  'disclaimer.b2': { en: 'The tax rates, exchange rates, etc. used in the calculator are simplified examples based on tax law and may differ from actual tax owed. Regarding how foreign lottery winnings are taxed under Korean law, the calculator reflects an answer received via a July 2026 NTS online consultation ("comprehensive income tax combined, Foreign Tax Credit applicable"), but this is a consultation response, not an official binding ruling, and actual application may vary by circumstance (see FAQ for details).' },
  'disclaimer.h3': { en: '3. Recommendation to consult a professional' },
  'disclaimer.b3': { en: 'If you actually win a lottery and need to make decisions such as tax filing, please be sure to consult a professional such as a tax accountant who handles both Korean and US tax matters. This site is not liable for decisions made based solely on information provided here.' },
  'disclaimer.h4': { en: '4. No purchase agency or brokerage' },
  'disclaimer.b4': { en: 'This site does not act as an agent or broker for lottery ticket purchases and does not provide any purchase channels. Acting as a purchase agent for foreign lotteries within Korea may be subject to penalties under relevant law (e.g., Criminal Act Article 248).' },
  'disclaimer.h5': { en: '5. Trademarks and third-party services' },
  'disclaimer.b5': { en: 'Powerball®, Mega Millions®, etc. are registered trademarks of their respective operating organizations (MUSL, etc.). This site is an independent information service with no affiliation or partnership with those organizations.' },
  'disclaimer.h6': { en: '6. Limitation of liability' },
  'disclaimer.b6': { en: 'To the extent permitted by law, the operator of this site is not liable for direct or indirect damages arising from use of the site, reliance on calculation results, or errors in information.' },
  'disclaimer.h7': { en: '7. Changes to content' },
  'disclaimer.b7': { en: 'The content, tax rate information, and policies of this site may change without prior notice.' },
  'contact.breadcrumb': { en: 'Contact' },
  'contact.title': { en: 'Let us know if something\u2019s off or you have questions' },
  'contact.desc':  { en: 'If a calculation seems wrong or you\u2019re curious about something, feel free to leave a message :)' },
  'contact.leaveEmpty': { en: 'Leave this field empty' },
  'contact.emailPlaceholder':   { en: 'Email address (for our reply)' },
  'contact.messagePlaceholder': { en: 'Type your message here' },
  'contact.send':    { en: 'Send' },
  'contact.success': { en: '✓ Your message was sent, thank you!' },
  'contact.error':   { en: 'Something went wrong sending this \u2014 please try again shortly.' },
  'footer.copy': { en: 'This site is an informational simulator and does not act as an agent or broker for lottery purchases.' },
  'home.taxBefore': { en: 'Announced' },
  'home.taxAfter':  { en: 'Take-home' },
  'home.taxDiff':   { en: 'Taxes' },
  'home.miniResultLabel': { en: '✏️ Or, want to start from your desired take-home amount?' },
  'home.reverseUnit':     { en: '(×₩100M)' },
  'home.sliderMin': { en: '$10M' },
  'home.sliderMax': { en: '$2B' },
  'home.detailSummary':   { en: '🔍 See the full breakdown' },
  'home.flowExplain1':    { en: '💡 The <b>advertised jackpot (annuity basis)</b> shown in the news isn\u2019t what you actually receive. Taking the lump sum gets you roughly 45\u201360% of that as the <b>pre-tax cash value</b>, and this calculator is based on that pre-tax cash amount.' },
  'home.annuityInfoLink': { en: '\ud83d\udcc5 How is it different if you take the annuity? \u2192' },
  'home.calcBasisBox':    { en: '• Lump-sum basis (differs for installment payouts)' },
  'home.funMoneySummary': { en: '🤑 How much could you actually buy with this? (just for fun)' },
  'home.flexApt':      { en: 'Manhattan apartment (based on $1.5M)' },
  'home.flexCar':      { en: 'Ferrari Roma (based on ₩350M)' },
  'home.flexCoffee':   { en: 'Starbucks Americano (₩5,000)' },
  'home.groundingNote': { en: '🌱 But honestly, what you already have might be more than enough for a good day' },
  'home.dreamSummary': { en: '🎬 What would you do first if you won? (just for fun)' },
  'home.dreamIntro':   { en: 'What would you do first if you won?' },
  'home.dreamFreedom': { en: '<span class="dream-emoji">🕊️</span> Hand in my resignation letter first' },
  'home.dreamFamily':  { en: '<span class="dream-emoji">🏠</span> Buy a house for every family member' },
  'home.dreamTravel':  { en: '<span class="dream-emoji">✈️</span> Leave on a world trip right away' },
  'home.dreamCalm':    { en: '<span class="dream-emoji">💼</span> Just quietly check my bank balance' },
  'home.shareDreamBtn': { en: '📤 Share this result' },
  'home.jackpotToggle': { en: '🎟️ Check the recent jackpot' },
  'home.powerballName': { en: 'Powerball' },
  'home.megaName':      { en: 'Mega Millions' },
  'home.officialLink':  { en: '\ud83d\udd17 Check the official site' },
  'home.oddsTeaserTitle': { en: 'The 1-in-292M odds don\u2019t really register, do they?' },
  'home.oddsTeaserSub':   { en: 'Comparing it to things like lightning strikes makes it click' },
  'home.oddsTeaserLink':  { en: 'See the odds \u2192' },
  'home.faqTeaserTitle': { en: '❓ People usually wonder about this' },
  'home.faqTeaserDesc':  { en: 'Tap for the answer right away' },
  'home.faqTeaserLink':  { en: 'See more answers \u2192' },
  'home.trustToggle': { en: '✓ Why can I trust this?' },
  'home.trust1Name': { en: 'Reliable info' },
  'home.trust1Desc': { en: 'Based on IRS · Korea NTS' },
  'home.trust2Name': { en: 'Accurate calculations' },
  'home.trust2Desc': { en: 'Reflects current tax rates' },
  'home.trust3Name': { en: 'No personal data' },
  'home.trust3Desc': { en: 'Calculates only, nothing stored' },
  'home.trust4Name': { en: 'No purchase/brokerage' },
  'home.trust4Desc': { en: 'No agency or connection service' },
  'home.sourceLabel': { en: 'Sources:' },
  'home.ntsLink':      { en: 'Korea NTS Hometax' },
};

function toggleLanguage(){
  currentLang = (currentLang === 'ko') ? 'en' : 'ko';
  applyTranslations();
}

function applyTranslations(){
  const toggleBtn = document.getElementById('lang-toggle');
  document.documentElement.lang = currentLang;
  if (toggleBtn) toggleBtn.textContent = (currentLang === 'ko') ? 'EN' : '한국어';

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const entry = I18N[key];
    if (!entry) return;
    el.textContent = (currentLang === 'en' && entry.en) ? entry.en : el.getAttribute('data-i18n-ko') || el.textContent;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const entry = I18N[key];
    if (!entry) return;
    if (currentLang === 'en' && entry.en) {
      if (!el.getAttribute('data-i18n-ko-html')) el.setAttribute('data-i18n-ko-html', el.innerHTML);
      el.innerHTML = entry.en;
    } else {
      const ko = el.getAttribute('data-i18n-ko-html');
      if (ko) el.innerHTML = ko;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const entry = I18N[key];
    if (!entry) return;
    if (!el.getAttribute('data-i18n-ko-placeholder')) el.setAttribute('data-i18n-ko-placeholder', el.placeholder);
    el.placeholder = (currentLang === 'en' && entry.en) ? entry.en : el.getAttribute('data-i18n-ko-placeholder');
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    const entry = I18N[key];
    if (!entry) return;
    if (!el.getAttribute('data-i18n-ko-aria-label')) el.setAttribute('data-i18n-ko-aria-label', el.getAttribute('aria-label'));
    el.setAttribute('aria-label', (currentLang === 'en' && entry.en) ? entry.en : el.getAttribute('data-i18n-ko-aria-label'));
  });

  // 역대 잭팟 TOP5 링크는 영문 모드일 때 별도로 만들어둔 영어 페이지로 이어지게 함
  // (텍스트만 번역되고 href는 그대로 한국어 페이지를 가리키던 문제 수정)
  const jackpotFullLink = document.getElementById('jackpot-history-full-link');
  if (jackpotFullLink) {
    jackpotFullLink.href = (currentLang === 'en') ? 'biggest-lottery-jackpots-after-tax.html' : 'biggest-jackpot-payouts.html';
  }

  // 언어 전환 시 환율 배지의 상태 문구(title)도 항상 다시 반영 (실패/성공/기본 상태와 무관하게 현재 언어로)
  updateExchangeRateBadges(exchangeRateFetchFailed);

  // 언어 전환 시 동적으로 생성되는 텍스트(CTA 버튼, 잭팟 패널, 추첨 카운트다운 등)도 다시 계산해서 갱신.
  // 홈 화면이 켜져 있을 때만 갱신하면, 확률체감 페이지의 잭팟 카드(#jackpot-card-amt 등 — 홈과 ID를
  // 공유함)가 언어 전환 시 갱신되지 않고 예전 언어로 남아있다가, 나중에 환율 자동갱신 등 무관한
  // 이벤트가 발생할 때에야 그 시점의 언어로 갑자기 바뀌어 "언어가 왔다갔다 하는" 것처럼 보이는
  // 버그가 있었음 — 뷰와 무관하게 항상 갱신해서 어느 화면에 있든 즉시 반영되게 함
  updateHomeCalc();
  applyJackpotData();
  updateDrawCountdown();
  initJackpotCardAmt();
  refreshJackpotDrawerIfOpen();
  updateJcTapLabel();
  updateHiddenMoneyChannelsForLang();
  renderJackpotHistory();
}

// 최초 로드 시, data-i18n 요소들의 원본 한국어를 저장해둠(다시 한국어로 돌아갈 때 쓰기 위함)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.setAttribute('data-i18n-ko', el.textContent);
  });
});

let EXCHANGE_RATE = 1503.40; // 기본값(fallback). 중앙은행 고시 기반 기준환율(2026-07-13 확인) — 페이지 로드 시 실시간 환율로 자동 갱신을 시도함. 이 기본값은 주기적으로 수동 업데이트 필요

// 환율 입력창(표시값)을 실제 계산에 쓰이는 EXCHANGE_RATE와 강제로 맞춰줌.
// 이게 없으면 HTML에 하드코딩된 옛 기본값이 입력창에 남아있는 채로, 실제 계산은
// EXCHANGE_RATE(새 기본값/실시간값)로 되어 "표시 환율"과 "실제 계산 환율"이 어긋나는 문제가 생김
function syncRateInputsDisplay(){
  const homeInput = document.getElementById('home-rate-input');
  const compareInput = document.getElementById('compare-rate-input');
  if (homeInput && document.activeElement !== homeInput) homeInput.value = EXCHANGE_RATE.toLocaleString('ko-KR');
  if (compareInput && document.activeElement !== compareInput) compareInput.value = EXCHANGE_RATE.toLocaleString('ko-KR');
}
let exchangeRateSourceName = null; // 실시간 조회에 성공했을 때, 어느 제공처에서 가져온 값인지 화면에 표시하기 위해 저장
let exchangeRateIsLive = false; // 실시간 fetch 성공 여부 표시용
let exchangeRateFetchFailed = false; // 실시간 fetch를 "시도했지만 실패"했는지 여부 — 이걸 알아야 "기본값을 아직 안 써봤음"과 "가져오려다 실패해서 기본값 씀"을 구분해서 보여줄 수 있음
let isRateManuallyEdited = false; // 유저가 환율을 직접 수정했는지 여부 — true면 비동기 fetch가 뒤늦게 와도 덮어쓰지 않음

// fetch에 타임아웃을 걸어주는 헬퍼 — 해외(느린 회선/일부 API 접속 제한 지역)에서
// 요청이 응답 없이 무한 대기하는 것을 막고, 정해진 시간 안에 실패 처리로 넘어가게 함
function fetchWithTimeout(url, ms){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// 환율 API 후보 목록 — 중앙은행 고시 기반 기준환율(재현성·출처가 명확함)을 우선으로 하고,
// 막히거나(지역 차단) 타임아웃 나면 순서대로 다음 걸 시도. 응답 형식이 달라서 각자 getRate로 KRW 환율만 뽑아냄
const EXCHANGE_RATE_SOURCES = [
  { url: 'https://api.frankfurter.app/latest?from=USD&to=KRW', getRate: (data) => data && data.rates && data.rates.KRW, name: 'Frankfurter (중앙은행 기준환율)', nameEn: 'Frankfurter (central bank reference rate)' },
  { url: 'https://open.er-api.com/v6/latest/USD', getRate: (data) => data && data.rates && data.rates.KRW, name: 'open.er-api.com', nameEn: 'open.er-api.com' },
];

async function fetchLiveExchangeRate(force){
  // force=true: 유저가 배지를 직접 클릭해서 재시도하는 경우 — 수동 편집 상태였어도 우선권을 줌
  if (isRateManuallyEdited && !force) return;

  for (const source of EXCHANGE_RATE_SOURCES) {
    try {
      const res = await fetchWithTimeout(source.url, 6000); // 6초 안에 응답 없으면 다음 소스로 넘어감
      const data = await res.json();
      const rate = source.getRate(data);
      if (rate) {
        EXCHANGE_RATE = Math.round(rate * 100) / 100; // 소수점 둘째자리까지 유지 (기준환율은 보통 소수점 단위로 고시됨)
        exchangeRateSourceName = source;
        exchangeRateIsLive = true;
        exchangeRateFetchFailed = false;
        isRateManuallyEdited = false; // 실시간 값으로 갱신됐으니 수동 편집 플래그 해제

        // 현재 화면에 켜져있는(active) 뷰의 입력값을 원본(source of truth)으로 삼아 동기화.
        // 잘못하면 방문한 적 없는 다른 탭의 기본값(100M)이 공유 상태를 덮어써버리는 레이스 컨디션이 생김.
        const homeIsOn = document.getElementById('view-home').classList.contains('on');
        const compareIsOn = document.getElementById('view-compare').classList.contains('on');
        if (homeIsOn) {
          syncHomeFromShared();
        } else if (compareIsOn) {
          syncCompareFromShared();
        } else {
          // 홈/비교 화면 둘 다 안 보고 있을 때는 화면 갱신 없이 계산 로직만 공유 데이터 기준으로 조용히 갱신
          updateHomeCalc(sharedAmountUsd);
          updateCalc(sharedAmountUsd);
        }
        initJackpotCardAmt();
        refreshJackpotDrawerIfOpen();
        updateExchangeRateBadges();
        return true;
      }
    } catch (e) {
      // 이 소스가 타임아웃/네트워크 오류/지역 차단이면 다음 소스로 계속 시도
    }
  }
  // 모든 소스가 실패한 경우 — 기본값(EXCHANGE_RATE 초기값) 그대로 사용, 계산 자체는 문제없이 계속 작동함
  exchangeRateFetchFailed = true;
  updateExchangeRateBadges(true);
  syncRateInputsDisplay(); // 입력창 표시값을 실제 계산에 쓰인 기본 환율(EXCHANGE_RATE)로 맞춰줌
  if (document.getElementById('view-home').classList.contains('on')) updateHomeCalc();
  return false;
}

// 유저가 환율 배지(아이콘 버튼)를 직접 눌렀을 때 — 그 자리에서 바로 재시도
// 모바일에서는 title(툴팁)이 마우스 오버가 없어서 절대 안 보이므로, 상태 안내는 배지의
// 반짝임 애니메이션으로 전달함 — 재시도가 다시 실패해도 "탭이 씹혔나?" 싶지 않도록, 매번 눈에 띄는 반응을 줌
async function retryLiveExchangeRate(btn){
  const isEnRetry = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const buttons = document.querySelectorAll('.rate-live-badge');
  buttons.forEach(b => {
    b.disabled = true; b.classList.remove('is-live','is-fail','just-retried');
    b.innerHTML = '<span class="spin" aria-hidden="true">🔄</span>';
    b.title = isEnRetry ? 'Checking exchange rate...' : '환율 확인 중...';
  });
  const minSpinTime = new Promise(resolve => setTimeout(resolve, 500)); // 너무 빨리 끝나면 눌렀는지도 모르게 지나가버려서, 최소 0.5초는 스피너가 보이게 함
  const [ok] = await Promise.all([fetchLiveExchangeRate(true), minSpinTime]);
  if (!ok) updateExchangeRateBadges(true);
  // 성공 시에는 fetchLiveExchangeRate 안에서 updateExchangeRateBadges()가 이미 갱신함

  // 결과가 이전과 같아 보여도(예: 재시도했는데 또 실패) "지금 막 반응했다"는 걸 눈으로 확인할 수 있게 배지를 잠깐 반짝임
  buttons.forEach(b => {
    b.classList.add('just-retried');
    setTimeout(() => b.classList.remove('just-retried'), 450);
  });
}

function updateExchangeRateBadges(failed){
  const isEnBadge = (typeof currentLang !== 'undefined' && currentLang === 'en');
  document.querySelectorAll('.rate-live-badge').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-live','is-fail');
    el.innerHTML = '<span aria-hidden="true">🔄</span>';
    if (failed) {
      el.classList.add('is-fail');
      el.title = isEnBadge ? 'Couldn\u2019t fetch live rate · tap to retry' : '환율 조회 실패 · 탭해서 재시도';
    } else if (exchangeRateIsLive) {
      el.classList.add('is-live');
      el.title = isEnBadge ? 'Live exchange rate applied · tap to refresh' : '실시간 환율 적용 중 · 탭하면 새로고침';
    } else {
      el.title = isEnBadge ? 'Using default rate · tap to fetch live rate' : '기본값 사용 중 · 탭하면 실시간 환율로 갱신';
    }
  });
}

// 홈/국가비교 페이지가 각자 독립된 입력 상태를 갖고 있으면 페이지 이동 시 데이터가 끊기는 문제가 있어
// 실제 "원본 데이터"는 여기 하나만 두고, 두 페이지는 화면에 들어올 때마다 여기서 값을 읽어와 표시한다.
let sharedAmountUsd = 100000000; // 기본 $100M
let sharedCountry = 'kr';
let sharedState = 'AVG';

function syncHomeFromShared(){
  const millions = sharedAmountUsd / 1000000;
  document.getElementById('homeAmountInput').value = millions;
  const slider = document.getElementById('homeAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.step = (millions % 10 === 0) ? 10 : 1; // 10의 배수가 아니면 step을 풀어줘야 value가 반올림 없이 정확히 반영됨
  slider.min = Math.min(10, Math.round(millions)); // $10M 미만 입력 시 슬라이더 하한도 같이 낮춰 불일치 방지
  slider.value = Math.round(millions);
  document.getElementById('homeCountrySelect').value = sharedCountry;
  document.getElementById('homeCountryBtnKr').classList.toggle('active', sharedCountry === 'kr');
  document.getElementById('homeCountryBtnUs').classList.toggle('active', sharedCountry === 'us');
  document.getElementById('homeStateSelect').value = sharedState;
  document.getElementById('home-rate-input').value = EXCHANGE_RATE.toLocaleString('ko-KR');
  updateHomeCalc(sharedAmountUsd);
}

// ⚠️ [향후 국가 확장 시 필독] "반대 국가로 전환"은 국가가 딱 2개(kr/us)일 때만 성립하는
// 토글 로직. 3번째 국가(예: 베트남)가 추가되면 "반대"라는 개념 자체가 없어지므로,
// 이 버튼은 토글이 아니라 선택 UI(예: 국가 목록에서 고르기)로 다시 설계해야 함.
function goToCompareWithOppositeCountry(){
  sharedCountry = (sharedCountry === 'us') ? 'kr' : 'us';
  go('compare');
}

function syncCompareFromShared(){
  const millions = sharedAmountUsd / 1000000;
  document.getElementById('amountInput').value = millions;
  const slider = document.getElementById('compareAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.min = Math.min(10, Math.round(millions));
  slider.value = Math.round(millions);
  updateSliderFill(slider);
  document.getElementById('compareStateSelect').value = sharedState;
  document.getElementById('compare-rate-input').value = EXCHANGE_RATE.toLocaleString('ko-KR');
  updateCalc(sharedAmountUsd);
}

// ⚠️ [향후 다국가·다통화 확장 시 필독] 이 사이트의 모든 금액 표시(세금 비교표, 잭팟 계산기,
// 역산 계산기 등)가 이 함수 하나를 거치는데, 지금은 "억원"이 고정 접미사로 박혀 있음.
// 베트남 동(₫)·태국 바트 등 다른 통화로 보여주려면 국가별 통화 포맷터로 새로 짜야 하고,
// 코드 곳곳에 "억원"이 리터럴 문자열로도 흩어져 있어(2026년 7월 기준 약 25곳) 같이 찾아 바꿔야 함.
function formatWon(n){
  if (typeof currentLang !== 'undefined' && currentLang === 'en') return formatWonEn(n);
  // 소수점 없이 정수(억원 단위)로 반올림해서 표시 — 읽기 쉽게 + 천단위 콤마
  const numStr = Math.round(n).toLocaleString('ko-KR');
  return numStr + '억원';
}

// 영어 화면에서는 "억"이라는 한국식 단위가 그대로 노출되면 안 되므로, 실제 원화 금액을
// million/billion/trillion 단위의 표준 영어 표기(₩)로 환산해서 보여줌.
// n은 "억" 단위 숫자(예: 6107.8 = 610,780,000,000원)
function formatWonEn(n){
  const krw = n * 100000000; // 억 → 실제 원화
  const abs = Math.abs(krw);
  let numStr, unit;
  if (abs >= 1e12) {
    numStr = (krw / 1e12).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    unit = 'trillion';
  } else if (abs >= 1e9) {
    numStr = (krw / 1e9).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    unit = 'billion';
  } else {
    numStr = (krw / 1e6).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    unit = 'million';
  }
  return '₩ ' + numStr + ' ' + unit;
}

const TAX_MODEL = {
  us_resident: {
    federal: 0.37,      // 연방세 최고구간 (실제: 24% 원천징수 후 최대 37% 정산 — 데모는 단순화해 37% 일괄 적용)
    state_avg: 0.08      // 평균 주세 (예시치 — 실제 주 선택 시 STATE_TAX_RATES 값으로 대체됨)
  },
  nonresident: {
    // 한국 거주자 등 미국 비거주 외국인. 한미 조세조약이 도박·복권 소득을 커버하지 않아
    // IRC 871(a)에 따라 일괄 30% 원천징수가 적용되며, 대부분 이것이 최종세율(추가 정산 없음)
    us_withholding: 0.30
    // 한국 세금은 KOREA_TAX_BRACKETS(종합소득세 누진세율) + FTC로 계산 — 2026-07 국세청 답변 반영
  },
  cn_resident: {
    // 중국 개인소득세법 제3조: 복권 당첨 등 "偶然所得"(우연소득)은 20% 단일 비례세율.
    // 개인소득세법 실시조례 제20조 + 재정부세무총국공고 2020년 제3호: 경외(境外) 우연소득은
    // 경내 종합소득과 합산하지 않고 별도 계산 — 한국의 누진세율 같은 구간 구조가 없음.
    incidental_income_rate: 0.20
    // FTC(경외세액공제)는 한도 내 상계, 초과분은 5년 이월 가능(국가세무총국 공고) — 여기 계산은 당해년도 상계분만 반영
  }
};

// 50개 주 + DC 전체 세율 (2026년 7월 컴파일). 출처: 각 주 세무당국 공식 최고 한계세율(top marginal
// individual income tax rate)을 "거대 당첨금이 최고 구간에 해당한다"는 가정하에 근사치로 사용.
// ⚠️ 매년 주별로 세율 개정이 있어(예: 2026년만 해도 인디애나·켄터키·미시시피·노스캐롤라이나·오하이오 등
// 다수 인하) 실제 신고 전에는 반드시 해당 주 세무당국/복권위원회 공식 자료로 재확인 필요.
const STATE_TAX_RATES = {
  AVG:   { label: '평균 (예시)', labelEn: 'Average (example)', rate: 0.08 },
  AL:  { label: '앨라배마', labelEn: 'Alabama', rate: 0.05 },
  AK:  { label: '알래스카', labelEn: 'Alaska', rate: 0.0 },
  AZ:  { label: '애리조나', labelEn: 'Arizona', rate: 0.025 },
  AR:  { label: '아칸소', labelEn: 'Arkansas', rate: 0.039 },
  CA:  { label: '캘리포니아 (복권 당첨금 면제)', labelEn: 'California (lottery-exempt)', rate: 0.0 },
  CO:  { label: '콜로라도', labelEn: 'Colorado', rate: 0.044 },
  CT:  { label: '코네티컷', labelEn: 'Connecticut', rate: 0.0699 },
  DE:  { label: '델라웨어', labelEn: 'Delaware', rate: 0.066 },
  FL:  { label: '플로리다', labelEn: 'Florida', rate: 0.0 },
  GA:  { label: '조지아', labelEn: 'Georgia', rate: 0.0539 },
  HI:  { label: '하와이', labelEn: 'Hawaii', rate: 0.11 },
  ID:  { label: '아이다호', labelEn: 'Idaho', rate: 0.053 },
  IL:  { label: '일리노이', labelEn: 'Illinois', rate: 0.0495 },
  IN:  { label: '인디애나', labelEn: 'Indiana', rate: 0.0295 },
  IA:  { label: '아이오와', labelEn: 'Iowa', rate: 0.038 },
  KS:  { label: '캔자스', labelEn: 'Kansas', rate: 0.0558 },
  KY:  { label: '켄터키', labelEn: 'Kentucky', rate: 0.035 },
  LA:  { label: '루이지애나', labelEn: 'Louisiana', rate: 0.03 },
  ME:  { label: '메인', labelEn: 'Maine', rate: 0.0715 },
  MD:  { label: '메릴랜드 (확인중)', labelEn: 'Maryland (unconfirmed)', rate: 0.0895 }, // 공식 출처마다 8.75~9.5%로 상이 — 최신 수치 재확인 필요
  MA:  { label: '매사추세츠', labelEn: 'Massachusetts', rate: 0.09 },
  MI:  { label: '미시간', labelEn: 'Michigan', rate: 0.0425 },
  MN:  { label: '미네소타', labelEn: 'Minnesota', rate: 0.0985 },
  MS:  { label: '미시시피', labelEn: 'Mississippi', rate: 0.04 },
  MO:  { label: '미주리', labelEn: 'Missouri', rate: 0.047 },
  MT:  { label: '몬태나', labelEn: 'Montana', rate: 0.0565 },
  NE:  { label: '네브래스카', labelEn: 'Nebraska', rate: 0.0455 },
  NV:  { label: '네바다', labelEn: 'Nevada', rate: 0.0 },
  NH:  { label: '뉴햄프셔', labelEn: 'New Hampshire', rate: 0.0 },
  NJ:  { label: '뉴저지', labelEn: 'New Jersey', rate: 0.1075 },
  NM:  { label: '뉴멕시코', labelEn: 'New Mexico', rate: 0.059 },
  NY:  { label: '뉴욕', labelEn: 'New York', rate: 0.109 },
  NC:  { label: '노스캐롤라이나', labelEn: 'North Carolina', rate: 0.0399 },
  ND:  { label: '노스다코타', labelEn: 'North Dakota', rate: 0.0195 },
  OH:  { label: '오하이오', labelEn: 'Ohio', rate: 0.0275 },
  OK:  { label: '오클라호마', labelEn: 'Oklahoma', rate: 0.045 },
  OR:  { label: '오리건', labelEn: 'Oregon', rate: 0.099 },
  PA:  { label: '펜실베이니아', labelEn: 'Pennsylvania', rate: 0.0307 },
  RI:  { label: '로드아일랜드', labelEn: 'Rhode Island', rate: 0.0599 },
  SC:  { label: '사우스캐롤라이나', labelEn: 'South Carolina', rate: 0.062 },
  SD:  { label: '사우스다코타', labelEn: 'South Dakota', rate: 0.0 },
  TN:  { label: '테네시', labelEn: 'Tennessee', rate: 0.0 },
  TX:  { label: '텍사스', labelEn: 'Texas', rate: 0.0 },
  UT:  { label: '유타', labelEn: 'Utah', rate: 0.0455 },
  VT:  { label: '버몬트', labelEn: 'Vermont', rate: 0.0875 },
  VA:  { label: '버지니아', labelEn: 'Virginia', rate: 0.0575 },
  WA:  { label: '워싱턴', labelEn: 'Washington', rate: 0.0 },
  DC:  { label: '워싱턴 D.C.', labelEn: 'Washington D.C.', rate: 0.1075 },
  WV:  { label: '웨스트버지니아', labelEn: 'West Virginia', rate: 0.0482 },
  WI:  { label: '위스콘신', labelEn: 'Wisconsin', rate: 0.0765 },
  WY:  { label: '와이오밍', labelEn: 'Wyoming', rate: 0.0 },
};

// 2026년 종합소득세 누진세율표 (국세청 기준, 8단계) — 원(KRW) 단위
// 산출세액 = 과세표준 × 세율 - 누진공제액
const KOREA_TAX_BRACKETS = [
  { limit: 14000000,    rate: 0.06, deduction: 0 },
  { limit: 50000000,    rate: 0.15, deduction: 1260000 },
  { limit: 88000000,    rate: 0.24, deduction: 5760000 },
  { limit: 150000000,   rate: 0.35, deduction: 15440000 },
  { limit: 300000000,   rate: 0.38, deduction: 19940000 },
  { limit: 500000000,   rate: 0.40, deduction: 25940000 },
  { limit: 1000000000,  rate: 0.42, deduction: 35940000 },
  { limit: Infinity,    rate: 0.45, deduction: 65940000 },
];

function calcKoreaProgressiveTaxWon(wonAmount){
  for (const b of KOREA_TAX_BRACKETS) {
    if (wonAmount <= b.limit) return Math.max(wonAmount * b.rate - b.deduction, 0);
  }
  return 0;
}

// ⚠️ [향후 국가 확장 시 필독] 새 나라를 추가하는 건 그냥 옵션 하나 늘리는 게 아니라, 그 나라가
// 해외 복권 당첨금을 어떻게 과세하는지(자체 세율표 구조, 미국과의 조세조약 여부, 원천징수 상계 방식 등)를
// 처음부터 리서치해서 완전히 새로운 계산 분기를 만들어야 함. 실제 세법 데이터 없이 구조부터 짜면
// 잘못된 형태로 미리 만들 위험이 있어 데이터가 확정되기 전까진 손대지 않기로 결정함 (2026년 7월).
// 'cn' 분기는 이 원칙대로 공식 자료(개인소득세법 제3조·실시조례 제20조 등) 확인 후 추가함 (2026년 7월).
function calcTakeHome(amount, country, stateCode){
  const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
  if (country === 'us') {
    const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
    const afterUS = amount * (1 - TAX_MODEL.us_resident.federal);
    const final = afterUS * (1 - stateInfo.rate);
    // stateInfo.label이 "평균 (예시)"처럼 이미 괄호를 포함하는 경우 "주세"를 그냥 붙이면
    // "평균 (예시) 주세"처럼 어색해지므로, 괄호 설명은 떼어내고 순수 지역명만 사용
    const cleanStateLabel = stateInfo.label.replace(/\s*\(예시\)|\s*\(예시,[^)]*\)/, '');
    const cleanStateLabelEn = stateInfo.labelEn.replace(/\s*\(example\)|\s*\(example,[^)]*\)/i, '');
    return {
      afterUS, final,
      label1: isEn ? 'US Federal Tax' : '미국 연방세', val1: '-' + (TAX_MODEL.us_resident.federal * 100) + '%',
      label2: isEn ? `${cleanStateLabelEn} State Tax` : `${cleanStateLabel} 주세`,
      val2: '-' + (stateInfo.rate * 100).toFixed(stateInfo.rate * 100 % 1 === 0 ? 0 : 2) + '%',
      basisSuffix: isEn ? 'US resident' : `미국 거주자`
    };
  } else if (country === 'cn') {
    // 중국 개인소득세법 제3조: 복권 당첨(偶然所得)은 20% 단일세율. 실시조례 제20조 + 재정부세무총국공고
    // 2020년 제3호: 경외 우연소득은 경내 종합소득과 합산하지 않고 별도 계산(한국처럼 누진세율 구간 없음).
    const wonAmount = amount * 100000000;
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const chinaCalculatedTaxWon = wonAmount * TAX_MODEL.cn_resident.incidental_income_rate;
    const ftcCreditWon = Math.min(usWithholdingWon, chinaCalculatedTaxWon); // FTC 공제액(한도 내, 초과분은 5년 이월 가능하나 여기 반영 안 함)
    const chinaAdditionalTaxWon = Math.max(chinaCalculatedTaxWon - ftcCreditWon, 0);

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (chinaAdditionalTaxWon / 100000000);
    const chinaEffectivePct = wonAmount > 0 ? (chinaAdditionalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: isEn ? 'US Federal Tax (nonresident)' : '미국 연방세 (비거주자)', val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: isEn ? 'China additional tax (FTC applied)' : '중국 추가 납부 (FTC 적용)',
      val2: chinaAdditionalTaxWon > 0 ? '-' + chinaEffectivePct.toFixed(1) + '%' : (isEn ? '₩0 (offset by tax credit)' : '0원 (세액공제로 상계)'),
      basisSuffix: isEn ? 'China resident' : '중국 거주자'
    };
  } else {
    // 2026-07 국세청 인터넷 상담 답변 기준: 미국 복권은 「복권 및 복권기금법」상 복권이 아니라
    // 무조건 분리과세 대상이 아니며, 종합소득세(누진세율)에 합산 신고. 외국납부세액공제(FTC)로 이중과세 조정.
    // (당첨소득 외 다른 국내 종합소득이 없다고 가정 — 이 경우 FTC 공제한도 ≈ 산출세액 전체에 근접)
    const wonAmount = amount * 100000000; // 억원 -> 원
    const usWithholdingWon = wonAmount * TAX_MODEL.nonresident.us_withholding;
    const koreaCalculatedTaxWon = calcKoreaProgressiveTaxWon(wonAmount); // 종합소득세 산출세액(국세, FTC 적용 전)
    const ftcCreditWon = Math.min(usWithholdingWon, koreaCalculatedTaxWon); // FTC 공제액(한도 내)
    const koreaAdditionalNationalTaxWon = Math.max(koreaCalculatedTaxWon - ftcCreditWon, 0); // FTC 적용 후 한국에 추가 납부할 국세
    const koreaLocalTaxWon = koreaAdditionalNationalTaxWon * 0.1; // 지방소득세(국세의 10%)
    const koreaTotalTaxWon = koreaAdditionalNationalTaxWon + koreaLocalTaxWon;

    const afterUS = amount - (usWithholdingWon / 100000000);
    const final = afterUS - (koreaTotalTaxWon / 100000000);
    const koreaEffectivePct = wonAmount > 0 ? (koreaTotalTaxWon / wonAmount * 100) : 0;

    return {
      afterUS, final,
      label1: isEn ? 'US Federal Tax (nonresident)' : '미국 연방세 (비거주자)', val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: isEn ? 'Korea additional tax (FTC applied)' : '한국 추가 납부 (FTC 적용)',
      val2: koreaAdditionalNationalTaxWon > 0 ? '-' + koreaEffectivePct.toFixed(1) + '%' : (isEn ? '₩0 (offset by tax credit)' : '0원 (세액공제로 상계)'),
      basisSuffix: isEn ? 'Korea resident' : '한국 거주자'
    };
  }
}

async function submitContactForm(e){
  e.preventDefault();
  const form = document.getElementById('contactForm');
  const successMsg = document.getElementById('contactSuccessMsg');
  const errorMsg = document.getElementById('contactErrorMsg');
  successMsg.style.display = 'none';
  errorMsg.style.display = 'none';

  const formData = new FormData(form);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000); // 12초 안에 응답 없으면 타임아웃 처리 (무한 로딩 방지)
    const response = await fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (response.ok) {
      successMsg.style.display = 'block';
      form.reset();
    } else {
      errorMsg.style.display = 'block';
    }
  } catch (err) {
    errorMsg.style.display = 'block';
  }
  return false;
}

function goToFaqItem(query){
  go('faq');
  const searchBox = document.getElementById('faqSearch');
  searchBox.value = query;
  filterFaq();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function go(view){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.getElementById('view-' + view).classList.add('on');
  setupRevealAnimation();
  document.getElementById('nav-compare').classList.toggle('active', view === 'compare');
  document.getElementById('nav-odds').classList.toggle('active', view === 'odds');
  document.getElementById('nav-faq').classList.toggle('active', view === 'faq');
  const titles = {
    home: '미국 복권 세금 계산기 | 참택스 - 미국 파워볼·메가밀리언즈 실수령액',
    compare: '미국 복권 이중과세·국가별 실수령액 비교 | 참택스',
    odds: '미국 파워볼 당첨 확률 체감 | 참택스',
    faq: '미국 복권 세금 FAQ - 이중과세·원천징수 | 참택스',
    privacy: '개인정보처리방침 | 참택스',
    disclaimer: '면책조항 | 참택스',
    contact: '문의하기 | 참택스'
  };
  document.title = titles[view];

  // 홈 ↔ 국가비교 이동 시, 어느 쪽에서 왔든 상관없이 항상 공용 상태(sharedAmountUsd/sharedCountry/EXCHANGE_RATE)를
  // 기준으로 화면을 다시 그려서 입력값·환율이 끊기지 않게 함
  if (view === 'home') {
    syncHomeFromShared();
    // 다른 페이지에서 언어를 전환한 뒤 홈으로 돌아오는 경우에도 잭팟 패널·추첨 카운트다운이
    // 항상 현재 언어로 보이도록 재적용 (언어 전환 시점에 홈 화면이 아니면 안 갱신되던 문제)
    applyJackpotData();
    updateDrawCountdown();
  } else if (view === 'compare') {
    syncCompareFromShared();
  }

  document.querySelector('.page').scrollIntoView({behavior:'smooth', block:'start'});
}

function formatAbbreviatedUsd(value){
  if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(0) + 'M';
  return Math.round(value).toLocaleString('en-US');
}

function animateCount(el, target, opts) {
  opts = opts || {};
  const duration = 900;
  const start = performance.now();
  const prefix = opts.prefix || '';
  const suffix = opts.suffix || '';
  const decimals = opts.decimals || 0;
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out
    const value = target * eased;
    const formatted = opts.abbreviate
      ? formatAbbreviatedUsd(value)
      : decimals > 0
        ? value.toFixed(decimals)
        : Math.round(value).toLocaleString('en-US');
    el.textContent = prefix + formatted + suffix;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function runCountUps() {
  document.querySelectorAll('.countup').forEach(el => {
    const target = Number(el.getAttribute('data-target'));
    animateCount(el, target, { prefix: '$', abbreviate: true });
  });
  document.querySelectorAll('.countup-dec').forEach(el => {
    const target = Number(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    animateCount(el, target, { suffix, decimals: 1 });
  });
}

function usdToKrwLabel(usd){
  const krw = usd * EXCHANGE_RATE;
  if (typeof currentLang !== 'undefined' && currentLang === 'en') {
    return '(≈ ' + formatWonEn(krw / 100000000) + ')';
  }
  // 억 단위로 먼저 반올림한 뒤 조/억을 나누면, "999.6억이 반올림되며 조 단위를 못 넘어가는" 이월 누락 문제가 안 생김
  const totalEok = Math.round(krw / 100000000);
  const 조 = Math.floor(totalEok / 10000);
  const 억 = totalEok % 10000;
  if (조 > 0 && 억 === 0) return `(약 ${조}조원)`;
  if (조 > 0) return `(약 ${조}조 ${억.toLocaleString('ko-KR')}억원)`;
  return `(약 ${억.toLocaleString('ko-KR')}억원)`;
}

function getJackpotKRW(){
  const usd = Number(document.getElementById('jp-powerball').getAttribute('data-target'));
  return usd * EXCHANGE_RATE;
}

// 놓친 돈 체크리스트의 5개 채널 링크 — 한국 사이트는 전부 주민등록번호 인증이 필요한
// 한국 국내 시스템이라, 한국 연고가 없는 영어권 사용자에게는 그대로 도움이 안 됨.
// 그래서 영어 모드에서는 실제 미국에서 통용되는 자산 찾기 서비스로 링크 자체를 바꿔줌
// (href·아이콘·출처명 모두 교체, 텍스트는 data-i18n으로 별도 처리)
const HIDDEN_MONEY_CHANNELS_EN = {
  hometax:   { href: 'https://www.irs.gov/refunds', icon: '🏛️', sub: 'IRS.gov' },
  gov24:     { href: 'https://www.usa.gov/unclaimed-money', icon: '🇺🇸', sub: 'USA.gov' },
  fine:      { href: 'https://www.missingmoney.com', icon: '💰', sub: 'MissingMoney' },
  health:    { href: 'https://www.unclaimedretirementbenefits.com', icon: '💼', sub: 'Unclaimed Retirement' },
  cardpoint: { href: 'https://www.treasurydirect.gov/indiv/tools/treasuryhunt.htm', icon: '🏦', sub: 'TreasuryDirect' },
};
const HIDDEN_MONEY_CHANNELS_KO = {
  hometax:   { href: 'https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=42&tm2lIdx=4203000000&tm3lIdx=4203010000', icon: '🏛️', sub: 'Hometax' },
  gov24:     { href: 'https://www.gov.kr/portal/service/serviceInfo/174100000054', icon: '🏢', sub: 'Gov24' },
  fine:      { href: 'https://fine.fss.or.kr/fine/main/contents.do?menuNo=900032', icon: '💰', sub: 'FSS Fine' },
  health:    { href: 'https://www.nhis.or.kr/nhis/minwon/retrieveHwangub.do', icon: '🏥', sub: 'NHIS' },
  cardpoint: { href: 'https://www.cardpoint.or.kr', icon: '💳', sub: 'Yeosin Finance' },
};
function updateHiddenMoneyChannelsForLang(){
  const isEnHm = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const map = isEnHm ? HIDDEN_MONEY_CHANNELS_EN : HIDDEN_MONEY_CHANNELS_KO;
  Object.keys(map).forEach(site => {
    const a = document.getElementById('refund-site-' + site);
    if (!a) return;
    a.href = map[site].href;
    const iconEl = a.querySelector('.refund-link-btn-icon');
    if (iconEl) iconEl.textContent = map[site].icon;
    const subEl = a.querySelector('.refund-link-btn-sub');
    if (subEl) subEl.textContent = map[site].sub;
  });
}

function checkHiddenMoney(){
  const checks = document.querySelectorAll('.refund-check-row input[type="checkbox"]');
  checks.forEach(c => {
    const row = c.closest('.refund-check-row');
    if (row) row.classList.toggle('checked', c.checked);
  });
  const checkedBoxes = Array.from(checks).filter(c => c.checked);
  const checkedCount = checkedBoxes.length;
  const resultEl = document.getElementById('hiddenMoneyResult');
  const isEnHm = (typeof currentLang !== 'undefined' && currentLang === 'en');

  if (checkedCount === 0) {
    resultEl.textContent = isEnHm
      ? 'If even one applies to you, check below to find out 👇'
      : '하나라도 해당되면, 아래에서 실제로 확인해보세요 👇';
    resultEl.className = 'refund-wizard-result';
  } else if (checkedCount === 1) {
    resultEl.textContent = isEnHm
      ? '✅ You checked one — there may be money you haven\u2019t claimed. We\u2019ve highlighted the right place for you below'
      : '✅ 해당하시는 게 있네요 — 못 받은 돈이 있을 가능성이 있어요. 아래에서 회원님한테 맞는 곳을 추천해드렸어요';
    resultEl.className = 'refund-wizard-result tag-hit';
  } else {
    resultEl.textContent = isEnHm
      ? `✅ You checked ${checkedCount} — there\u2019s a good chance you have unclaimed money. We\u2019ve highlighted the right places for you below`
      : `✅ ${checkedCount}개나 해당되시네요 — 실제로 못 받은 돈이 있을 가능성이 꽤 높아요. 아래에서 회원님한테 맞는 곳을 추천해드렸어요`;
    resultEl.className = 'refund-wizard-result tag-hit';
  }

  // 체크한 항목에 연결된 사이트만 추천(강조)하고, 나머지는 흐리게
  const recommendedSites = new Set(checkedBoxes.map(c => c.dataset.site));
  const allSites = ['hometax', 'gov24', 'fine', 'health', 'cardpoint'];
  allSites.forEach(site => {
    const btn = document.getElementById('refund-site-' + site);
    if (!btn) return;
    if (checkedCount === 0) {
      btn.classList.remove('recommended', 'dimmed');
    } else if (recommendedSites.has(site)) {
      btn.classList.add('recommended');
      btn.classList.remove('dimmed');
    } else {
      btn.classList.remove('recommended');
      btn.classList.add('dimmed');
    }
  });
}

function checkRefundPossibility(){
  const stateCode = document.getElementById('refundStateSelect').value;
  const resultEl = document.getElementById('refundWizardResult');
  const isEnRp = (typeof currentLang !== 'undefined' && currentLang === 'en');
  if (!stateCode) {
    resultEl.textContent = isEnRp
      ? 'Select a state and we\u2019ll tell you right away whether a refund is likely'
      : '주를 선택하면 환급 가능성을 바로 알려드려요';
    resultEl.className = 'refund-wizard-result';
    return;
  }

  const STATE_DISPLAY_NAMES = {
    AL: '앨라배마', AK: '알래스카', AZ: '애리조나', AR: '아칸소', CA: '캘리포니아',
    CO: '콜로라도', CT: '코네티컷', DE: '델라웨어', FL: '플로리다', GA: '조지아',
    HI: '하와이', ID: '아이다호', IL: '일리노이', IN: '인디애나', IA: '아이오와',
    KS: '캔자스', KY: '켄터키', LA: '루이지애나', ME: '메인', MD: '메릴랜드',
    MA: '매사추세츠', MI: '미시간', MN: '미네소타', MS: '미시시피', MO: '미주리',
    MT: '몬태나', NE: '네브래스카', NV: '네바다', NH: '뉴햄프셔', NJ: '뉴저지',
    NM: '뉴멕시코', NY: '뉴욕', NC: '노스캐롤라이나', ND: '노스다코타', OH: '오하이오',
    OK: '오클라호마', OR: '오리건', PA: '펜실베이니아', RI: '로드아일랜드', SC: '사우스캐롤라이나',
    SD: '사우스다코타', TN: '테네시', TX: '텍사스', UT: '유타', VT: '버몬트',
    VA: '버지니아', WA: '워싱턴', DC: '워싱턴 D.C.', WV: '웨스트버지니아', WI: '위스콘신',
    WY: '와이오밍',
  };
  const STATE_DISPLAY_NAMES_EN = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', DC: 'Washington D.C.', WV: 'West Virginia', WI: 'Wisconsin',
    WY: 'Wyoming',
  };
  const NO_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];
  const EXEMPT_STATES = ['CA'];
  const UNCERTAIN_STATES = ['MD'];
  const stateInfo = STATE_TAX_RATES[stateCode];
  const stateName = isEnRp ? STATE_DISPLAY_NAMES_EN[stateCode] : STATE_DISPLAY_NAMES[stateCode];

  let msg, cls;
  if (NO_TAX_STATES.includes(stateCode)) {
    msg = isEnRp
      ? `✕ This state (${stateName}) has no state income tax at all. Nothing was withheld in the first place, so there\u2019s nothing to get back.`
      : `✕ 이 주(${stateName})는 주 소득세 자체가 없는 무과세 주예요. 애초에 원천징수된 게 없어서 돌려받을 것도 없어요.`;
    cls = 'tag-none';
  } else if (EXEMPT_STATES.includes(stateCode)) {
    msg = isEnRp
      ? `✕ This state (${stateName}) has state income tax, but exempts lottery winnings specifically. This is also a case where there\u2019s nothing to get back.`
      : `✕ 이 주(${stateName})는 주 소득세는 있지만 복권 당첨금은 별도로 면제해줘요. 이것도 돌려받을 게 없는 경우예요.`;
    cls = 'tag-none';
  } else if (UNCERTAIN_STATES.includes(stateCode)) {
    msg = isEnRp
      ? `⚠ This state (${stateName}) has withholding rate figures that vary slightly across official sources (8.75~9.5%), so it needs more checking. Be sure to confirm the actual withholding rate on the state lottery\u2019s official site if you win.`
      : `⚠ 이 주(${stateName})는 원천징수율 정보가 공식 자료마다 조금씩 달라서(8.75~9.5%) 정확한 확인이 더 필요해요. 당첨 시 주 복권 공식 사이트에서 실제 원천징수율을 꼭 확인하세요.`;
    cls = 'tag-maybe';
  } else {
    msg = isEnRp
      ? `ℹ This state (${stateName}) withholds about ${(stateInfo.rate*100).toFixed(2)}%. For nonresidents, this withholding often ends up being the final tax, but you can only know for sure by settling it through a US nonresident tax return (1040-NR) \u2014 a refund isn\u2019t guaranteed.`
      : `ℹ 이 주(${stateName})는 원천징수율이 약 ${(stateInfo.rate*100).toFixed(2)}%예요. 비거주자는 대체로 이 원천징수율 자체가 최종 세금으로 확정되는 경우가 많지만, 실제로 더 냈는지는 미국 비거주자 세금신고(1040-NR)로 정산해봐야 정확히 알 수 있어요 — 무조건 환급된다는 뜻은 아니에요.`;
    cls = 'tag-check';
  }
  resultEl.textContent = msg;
  resultEl.className = 'refund-wizard-result ' + cls;
}

let activeFaqCategory = 'all';

function setFaqCategory(cat, btnEl){
  activeFaqCategory = cat;
  document.querySelectorAll('.faq-chip').forEach(c => c.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  filterFaq();
}

function filterFaq(){
  const query = document.getElementById('faqSearch').value.trim().toLowerCase();
  const items = document.querySelectorAll('#view-faq .faq-item');
  let visibleCount = 0;
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const searchMatch = query === '' || text.includes(query);
    const catMatch = activeFaqCategory === 'all' || item.dataset.cat === activeFaqCategory;
    const match = searchMatch && catMatch;
    item.style.display = match ? '' : 'none';
    if (match) visibleCount++;
    if (query !== '' && match && item.tagName === 'DETAILS') item.open = true;
    if (query === '' && item.tagName === 'DETAILS') item.open = false;
  });

  // 심화 콘텐츠(더 자세히 알아보기 — 플레이슬립, 티켓 생김새 등)도 검색 대상에 포함
  // 단, 카테고리 칩이 '전체'가 아니면 심화 콘텐츠는 어느 카테고리에도 속하지 않으므로 숨김
  const moreToggle = document.querySelector('#view-faq .more-details-toggle');
  let moreMatch = false;
  if (moreToggle && activeFaqCategory !== 'all') {
    moreToggle.style.display = 'none';
    moreToggle.open = false;
  } else if (moreToggle) {
    const moreText = moreToggle.textContent.toLowerCase();
    moreMatch = query !== '' && moreText.includes(query);
    if (moreMatch) {
      moreToggle.open = true;
      moreToggle.style.display = '';
      if (visibleCount === 0) visibleCount++; // 심화 콘텐츠에서만 매칭되어도 '결과 없음' 문구는 숨김
    } else if (query !== '') {
      moreToggle.style.display = visibleCount === 0 ? '' : 'none'; // 위 FAQ에 매칭이 있으면 심화 콘텐츠는 숨겨서 화면 정리
    } else {
      moreToggle.style.display = '';
      moreToggle.open = false;
    }
  }

  document.getElementById('faqNoResult').style.display = (visibleCount === 0) ? 'block' : 'none';
}

function drawLightningNumbers(){
  const nums = new Set();
  while (nums.size < 5) nums.add(Math.floor(Math.random() * 69) + 1);
  const sorted = [...nums].sort((a,b) => a-b);
  const pb = Math.floor(Math.random() * 26) + 1;
  const balls = document.querySelectorAll('#lightning-result .lightning-ball');
  sorted.forEach((n, i) => {
    balls[i].textContent = n;
    balls[i].classList.remove('drawn');
    void balls[i].offsetWidth;
    balls[i].classList.add('drawn');
  });
  balls[5].textContent = pb;
  balls[5].classList.remove('drawn');
  void balls[5].offsetWidth;
  balls[5].classList.add('drawn');
}

function updateDrawCountdown(){
  // 파워볼: 월(1)/수(3)/토(6), 메가밀리언즈: 화(2)/금(5)
  // 실제 추첨은 미국 동부시간 기준이라, 방문자가 어느 나라/시간대에서 접속하든
  // 항상 미국 동부시간 기준 요일로 계산해야 정확함 (로컬 시간 기준이면 해외 접속 시 하루 오차 발생 가능)
  function getUsEasternDayOfWeek(){
    const now = new Date();
    const easternStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    return new Date(easternStr).getDay();
  }
  function nextDrawInfo(drawDays){
    const todayDow = getUsEasternDayOfWeek();
    if (drawDays.includes(todayDow)) return 'D-0';
    let diff = 1;
    while (!drawDays.includes((todayDow + diff) % 7)) diff++;
    return `D-${diff}`;
  }
  document.getElementById('dday-powerball').textContent = nextDrawInfo([1,3,6]);
  document.getElementById('dday-mega').textContent = nextDrawInfo([2,5]);
}

// ============================================================================
// 🎟️ 오늘 잭팟 수동 업데이트 존 — 추첨(파워볼 월/수/토, 메가밀리언즈 화/금) 다음날
// amountUsd만 공식 사이트 보고 고치면 30초로 끝납니다.
// ============================================================================
const JACKPOT_DATA = {
  powerball:    { amountUsd: 1200000000 },
  megamillions: { amountUsd: 450000000 },
};

// 🗂️ 역대 잭팟 확인 기록 — JACKPOT_DATA를 갱신할 때마다 그 시점 금액을 한 줄씩 추가.
// 경쟁사가 하루 만에 못 베끼는 누적형 콘텐츠(가이드북 Moat Rule 참고). date는 YYYY-MM-DD.
// cashUsd: 실제 당첨자가 받은 일시불 금액이 공식 확인된 경우 그 실제값(출처: powerball.com/megamillions.com
// 공식 발표, CNN·CBS 등 언론 보도) — 없으면 렌더링 시 CASH_VALUE_RATIO(0.58)로 추정.
// stateCode: 당첨 주(State) — 세율 있는 주로 단일 특정 가능한 경우만 표기, 복수 주 분할 당첨은 'AVG' 처리.
const JACKPOT_HISTORY = [
  // 역대 최고액 기록 5건 (공식 발표·언론 보도로 확인된 실제 일시불 금액 기준)
  { date: '2022-11-07', game: 'powerball', amountUsd: 2040000000, cashUsd: 997600000, stateCode: 'CA', noteKo: '역대 최고액 (캘리포니아, 1인)', noteEn: 'All-time record (California, single winner)' },
  { date: '2025-09-06', game: 'powerball', amountUsd: 1787000000, cashUsd: 820600000, stateCode: 'AVG', noteKo: '역대 2위 (미주리·텍사스 2인 분할)', noteEn: '2nd all-time (Missouri & Texas, split 2 ways)' },
  { date: '2016-01-13', game: 'powerball', amountUsd: 1586000000, cashUsd: 983400000, stateCode: 'AVG', noteKo: '캘리포니아·플로리다·테네시 3인 분할', noteEn: 'California, Florida & Tennessee, split 3 ways' },
  { date: '2023-10-11', game: 'powerball', amountUsd: 1765000000, cashUsd: 774100000, stateCode: 'CA', noteKo: '캘리포니아, 1인', noteEn: 'California, single winner' },
  { date: '2023-08-08', game: 'megamillions', amountUsd: 1602000000, cashUsd: 794200000, stateCode: 'FL', noteKo: '역대 메가밀리언즈 최고액 (플로리다, 1인)', noteEn: 'Mega Millions all-time record (Florida, single winner)' },
  { date: '2026-07-16', game: 'powerball', amountUsd: 1200000000 },
  { date: '2026-07-16', game: 'megamillions', amountUsd: 450000000 },
];

function renderJackpotHistory(){
  const listEl = document.getElementById('jackpot-history-list');
  if (!listEl) return;
  const isEnJh = (typeof currentLang !== 'undefined' && currentLang === 'en');
  if (!JACKPOT_HISTORY.length) {
    listEl.innerHTML = `<p class="jackpot-history-empty">${isEnJh ? 'No records yet.' : '아직 기록이 없어요.'}</p>`;
    return;
  }
  const gameNameKo = { powerball: '파워볼', megamillions: '메가밀리언즈' };
  const gameNameEn = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const sorted = [...JACKPOT_HISTORY].sort((a, b) => b.date.localeCompare(a.date));
  listEl.innerHTML = sorted.map(entry => {
    const cashUsd = entry.cashUsd || entry.amountUsd * CASH_VALUE_RATIO;
    const cashKrw = cashUsd * EXCHANGE_RATE;
    const rKr = calcTakeHome(cashKrw / 100000000, 'kr');
    const rUs = calcTakeHome(cashKrw / 100000000, 'us', entry.stateCode || 'AVG');
    const krLabel = isEnJh ? formatWonEn(rKr.final) : formatWon(rKr.final);
    const usLabel = isEnJh ? formatWonEn(rUs.final) : formatWon(rUs.final);
    const gameLabel = isEnJh ? gameNameEn[entry.game] : gameNameKo[entry.game];
    const note = isEnJh ? entry.noteEn : entry.noteKo;
    const noteHtml = note ? `<p class="jh-note">${note}</p>` : '';
    return `<div class="jackpot-history-row">
      <div class="jh-top">
        <span class="jh-date">${entry.date}</span>
        <span class="jh-game">${gameLabel}</span>
      </div>
      ${noteHtml}
      <div class="jh-amounts">
        <span class="jh-amt-item"><span class="jh-amt-label">${isEnJh ? 'Korea resident' : '한국 거주자'}</span><span class="jh-amt">${krLabel}</span></span>
        <span class="jh-amt-item"><span class="jh-amt-label">${isEnJh ? 'US resident' : '미국 거주자'}</span><span class="jh-amt">${usLabel}</span></span>
      </div>
    </div>`;
  }).join('');
}

function applyJackpotData(){
  document.getElementById('jp-powerball').setAttribute('data-target', JACKPOT_DATA.powerball.amountUsd);
  document.getElementById('jp-mega').setAttribute('data-target', JACKPOT_DATA.megamillions.amountUsd);
}

const CASH_VALUE_RATIO = 0.58; // 일시불(lump sum)은 발표된 연금 기준 잭팟의 약 45~60% (현재가치 할인) — 중간값 사용, 화면 표시 문구와 일치

function initJackpotCardAmt(){
  const krw = getJackpotKRW();
  const isEnCard = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const 억 = isEnCard
    ? (n) => formatWonEn(n / 100000000)
    : (n) => Math.round(n / 100000000).toLocaleString('ko-KR') + '억원';
  document.getElementById('jackpot-card-amt').textContent = (isEnCard ? 'About ' : '약 ') + 억(krw * CASH_VALUE_RATIO);
  document.getElementById('jackpot-card-amt-note').textContent = isEnCard ? '(lump-sum, pre-tax)' : '(일시불 세전)';

  const pbUsd = Number(document.getElementById('jp-powerball').getAttribute('data-target'));
  const mgUsd = Number(document.getElementById('jp-mega').getAttribute('data-target'));
  document.getElementById('jp-powerball-krw').textContent = usdToKrwLabel(pbUsd);
  document.getElementById('jp-mega-krw').textContent = usdToKrwLabel(mgUsd);

  // "million/billion 감이 안 온다"는 사용자에게 숫자를 직접 타이핑하게 하는 대신,
  // 오늘 실제 잭팟의 일시불 환산액을 버튼에 미리 보여주고 누르면 바로 채워지게 함.
  // 버튼에는 실제로 입력창에 채워질 값(M USD)과 그 원화 감(약 -억원)을 같이 보여줘서,
  // "버튼을 누르면 아래 M USD 칸에 정확히 이 숫자가 들어간다"는 걸 한눈에 알 수 있게 함
  const quickfillLabel = (usd) => {
    const cashUsd = usd * CASH_VALUE_RATIO;
    const millions = Math.round(cashUsd / 1000000);
    const krwLabel = usdToKrwLabel(cashUsd).replace(/^\(|\)$/g, '');
    return isEnCard ? `$${millions}M USD (${krwLabel})` : `${millions}M USD (${krwLabel})`;
  };
  document.getElementById('quickfill-pb-amt').textContent = quickfillLabel(pbUsd);
  document.getElementById('quickfill-mm-amt').textContent = quickfillLabel(mgUsd);
}

function fillHomeAmountFromJackpot(game){
  const amountUsd = JACKPOT_DATA[game].amountUsd;
  const cashUsd = amountUsd * CASH_VALUE_RATIO;
  const millions = Math.round(cashUsd / 1000000);
  const input = document.getElementById('homeAmountInput');
  input.value = millions;
  const slider = document.getElementById('homeAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.step = 1;
  slider.min = Math.min(10, millions);
  slider.value = millions;
  updateHomeCalc(millions * 1000000);
  input.focus();
}

function refreshJackpotDrawerIfOpen(){
  const box = document.getElementById('jackpot-calc-box');
  if (box && box.classList.contains('show')) {
    const announcedKrw = getJackpotKRW();
    const cashKrw = announcedKrw * CASH_VALUE_RATIO;
    const r = calcTakeHome(cashKrw / 100000000, 'kr');
    const isEnJc = (typeof currentLang !== 'undefined' && currentLang === 'en');
    const 억 = isEnJc
      ? (n) => formatWonEn(n / 100000000)
      : (n) => Math.round(n / 100000000).toLocaleString('ko-KR') + '억원';
    const about = isEnJc ? 'About ' : '약 ';
    document.getElementById('jc-jackpot').textContent = about + 억(announcedKrw);
    document.getElementById('jc-cash').textContent = about + 억(cashKrw);
    document.getElementById('jc-final').textContent = about + formatWon(r.final);
    document.getElementById('jc-note-basis').textContent = isEnJc
      ? `Korea resident basis (30% US non-resident withholding + Korean progressive income tax/FTC, ~${EXCHANGE_RATE.toLocaleString('en-US')} KRW/USD)`
      : `한국 거주자 기준 (미국 비거주자 원천징수 30% + 한국 종합소득세 누진세율/FTC 적용, 환율 약 ${EXCHANGE_RATE.toLocaleString('ko-KR')}원 적용)`;

    // 연금(annuity) 선택 시 — 발표 잭팟 총액을 30회로 단순 평균해 희망적인 그림도 함께 보여줌
    const ANNUITY_PAYMENTS = 30;
    const perYearKrw = announcedKrw / ANNUITY_PAYMENTS;
    const rYear = calcTakeHome(perYearKrw / 100000000, 'kr');
    document.getElementById('jc-annuity-year').textContent = about + 억(perYearKrw);
    document.getElementById('jc-annuity-year-net').textContent = about + formatWon(rYear.final);
    document.getElementById('jc-annuity-month-net').textContent = about + formatWon(rYear.final / 12);
  }
}

// "자세히 보기" 류의 링크에서 공용으로 사용 — details를 펼친 뒤, 펼쳐지는 애니메이션으로 인해
// 레이아웃 높이가 바뀌는 것을 브라우저가 반영할 시간(한 프레임)을 준 다음에 스크롤함.
// 펼치자마자 바로 스크롤하면 "펼치기 전" 높이를 기준으로 위치를 계산해서 엉뚱한 곳으로 이동할 수 있음.
function openDetailAndScroll(selector){
  const el = document.querySelector(selector);
  if (!el) return;
  el.open = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// jc-tap-cta 한 줄짜리 문구를 열림/닫힘 상태·현재 언어에 맞게 다시 그려줌
// (예전엔 "👇 눌러서..."와 "👆 다시 누르면 접혀요" 두 문단을 따로 두고 하나만 숨기는 방식이라,
// 카드를 펼치면 두 줄이 같이 보이는 버그가 있었음 — 디자인 원본처럼 한 줄이 상태에 따라 바뀌게 함)
function updateJcTapLabel(){
  const el = document.getElementById('jc-tap-cta');
  if (!el) return;
  const box = document.getElementById('jackpot-calc-box');
  const isOpen = box && box.classList.contains('show');
  const isEnJc = (typeof currentLang !== 'undefined' && currentLang === 'en');
  if (isOpen) {
    el.textContent = isEnJc ? '👆 Tap the card again to collapse' : '👆 카드를 다시 누르면 접혀요';
  } else {
    el.textContent = isEnJc ? '👇 Tap to see your after-tax take-home' : '👇 눌러서 세후 실수령액 보기';
  }
}

function toggleJackpotCalc(){
  const box = document.getElementById('jackpot-calc-box');
  const isShowing = box.classList.toggle('show');
  updateJcTapLabel();
  if (isShowing) refreshJackpotDrawerIfOpen();
}

// 홈 화면 계산기는 일시불(lump sum) 기준으로만 계산함 — 연금(annuity) 세금은 30년에 걸쳐
// 매년 다른 세율 구간이 적용되는 완전히 별도의 계산이라 여기에 중복으로 넣지 않고,
// 이미 만들어둔 확률체감 페이지의 잭팟 계산기(연금 단계 포함)로 안내만 함
function goToAnnuityInfo(){
  go('odds');
  const box = document.getElementById('jackpot-calc-box');
  if (!box.classList.contains('show')) toggleJackpotCalc();
  setTimeout(() => {
    document.querySelector('.prize-card.jackpot').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 400);
}

// 스크롤하면서 각 섹션이 살짝 떠오르며 나타나는 효과. reduced-motion 환경에서는 CSS가 즉시 보이게 처리함
let _revealObserver = null;
function setupRevealAnimation(){
  const activeView = document.querySelector('.view.on');
  if (!activeView) return;
  const targets = activeView.querySelectorAll(':scope > .hero, :scope > .panel, :scope > .input-card, :scope > .explore-section, :scope > details, :scope > .legal-section, :scope > form');
  if (!_revealObserver){
    _revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting){
          entry.target.classList.add('is-in');
          _revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  }
  targets.forEach(el => {
    if (el.classList.contains('is-in') || el.classList.contains('reveal-up')) return;
    el.classList.add('reveal-up');
    _revealObserver.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', () => { applyJackpotData(); runCountUps(); updateHomeCalc(100000000); updateCalc(); initJackpotCardAmt(); updateDrawCountdown(); syncRateInputsDisplay(); setupRevealAnimation(); renderJackpotHistory(); fetchLiveExchangeRate(); });

// 다른 페이지(korea-resident-us-lottery-tax.html 등)에서 "index.html#faq"처럼 해시가 붙은 링크로
// 들어왔을 때, 이 SPA는 해시를 안 보고 항상 홈 화면부터 그려서 그 링크가 사실상 무시되던 문제 수정.
// 페이지 로드 시 해시를 확인해서, 알려진 뷰 이름이면 그 화면으로 바로 이동시켜줌
document.addEventListener('DOMContentLoaded', () => {
  const knownViews = ['home', 'compare', 'odds', 'faq', 'privacy', 'disclaimer', 'contact'];
  const hashView = location.hash.replace('#', '');
  if (knownViews.includes(hashView) && hashView !== 'home') {
    go(hashView);
  }
});

// 영어 랜딩페이지(korean-abroad-lottery-tax.html 등)에서 "index.html?lang=en"으로 들어왔을 때
// 기본값인 한국어 화면이 아니라 바로 영어로 보이도록 함
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  if (params.get('lang') === 'en' && currentLang !== 'en') {
    toggleLanguage();
  }
});
setInterval(() => { fetchLiveExchangeRate(); }, 60 * 60 * 1000); // 1시간마다 환율 자동 재조회 — 유저가 직접 수정한 경우는 fetchLiveExchangeRate 내부에서 자동으로 건너뜀

// Pretendard 웹폰트는 렌더링 차단 없이 비동기로 로드되는데(느린 CDN 대비), 그 말은 즉
// fitAmountFontSize()가 실행되는 시점엔 아직 대체 폰트(시스템 폰트) 기준으로 폭이 계산될 수 있다는 뜻.
// 이후 실제로 Pretendard가 로드되면서 글자 폭이 달라지면(대체 폰트보다 넓으면), 이미 계산해둔
// 크기로는 다시 넘칠 수 있는데 이걸 감지해서 재계산하는 로직이 없었음 — 그래서 폰트 로딩이
// "완료된" 시점(document.fonts.ready)에 한 번 더 안전하게 재계산함
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    const homeFinalEl = document.getElementById('home-final-amt');
    if (homeFinalEl && homeFinalEl.textContent && homeFinalEl.textContent !== '-') fitAmountFontSize(homeFinalEl);
    // 'finalAmt'는 국가비교 화면 리디자인 이후 더 이상 쓰이지 않는 죽은 id라 여기서 빼고,
    // 실제로 화면에 그려지는 .side-card-amt(나라별 카드에 동적으로 생성됨) 전체를 재계산 대상으로 함
    document.querySelectorAll('.side-card-amt').forEach(el => {
      if (el.textContent && el.textContent !== '-') fitAmountFontSize(el);
    });
  });
}
let _resizeDebounceTimer = null;
window.addEventListener('resize', () => {
  // resize는 창을 드래그하는 동안 초당 수십 번 발생할 수 있어서, 매번 재계산하면
  // 저사양 기기·모바일 사파리에서 버벅임(프레임 드랍)을 유발할 수 있음.
  // 창 크기 조절이 "멈춘 뒤" 0.2초 후 딱 한 번만 재계산하도록 디바운스 적용
  clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(() => {
    requestAnimationFrame(() => { fitAmountFontSize(document.getElementById('home-final-amt')); });
  }, 200);
});

function fitAmountFontSize(el){
  if (!el) return;
  const container = el.parentElement;
  if (!container) return;
  el.style.fontSize = ''; // CSS clamp 기본값으로 리셋
  let fontSize = parseFloat(getComputedStyle(el).fontSize);
  const minFontSize = 20; // 아무리 길어도 이 밑으로는 안 줄임 (그 이하는 가독성 문제)
  const safetyMargin = 22; // 기기별 폰트 렌더링(서브픽셀 anti-aliasing, 폰트 로딩 전/후 폭 차이 등) 오차를 감안한 여유폭.
  // 이전엔 14px였는데, 딱 안 넘치는 수준이라 "билл" 등 긴 단위가 붙으면 폭을 꽉 채워 답답해 보인다는
  // 피드백이 있어서 시각적 여유를 더 확보하도록 확대함
  let guard = 0;
  while (el.scrollWidth > container.clientWidth - safetyMargin && fontSize > minFontSize && guard < 30) {
    fontSize -= 1;
    el.style.fontSize = fontSize + 'px';
    guard++;
  }
}

const _activeAnimations = new WeakMap(); // 엘리먼트별 진행 중인 애니메이션 프레임 추적 (빠른 연속 입력 시 중첩 실행 방지)

function animateValueChange(el, fromVal, toVal, suffix, decimals, duration, onDone){
  duration = duration || 250;
  // 이 엘리먼트에서 이미 돌고 있는 애니메이션이 있으면 취소하고 새로 시작
  const prevFrameId = _activeAnimations.get(el);
  if (prevFrameId) cancelAnimationFrame(prevFrameId);

  const start = performance.now();
  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 2);
    const value = fromVal + (toVal - fromVal) * eased;
    // formatWon()이 현재 언어(currentLang)에 맞춰 "억원" 또는 million/billion/trillion(₩) 표기를
    // 알아서 골라주므로, 여기서 suffix를 직접 붙이지 않고 항상 formatWon을 거치게 함.
    // (예전엔 이 함수가 '억원'을 하드코딩해서 직접 붙이고 있어서, 영어 모드로 전환해도
    // 애니메이션되는 숫자만 "6,107.8억원"처럼 한국어 단위가 그대로 남아있던 버그가 있었음)
    el.textContent = formatWon(value);
    el.dataset.eokVal = value; // 다음 애니메이션의 시작값을 이 값에서 읽음(아래 설명 참고)
    if (progress >= 1) {
      _activeAnimations.delete(el);
      // 애니메이션이 "진짜로" 끝난 이 시점에만 폰트 크기 재계산을 실행함.
      // 예전엔 setTimeout(고정 시간)으로 따로 타이밍을 맞췄는데, 모바일에서 애니메이션(rAF)이
      // 화면 초기 로딩 부하 등으로 늦게 끝나면 setTimeout이 먼저 발동해서 아직 다 안 늘어난
      // 중간 숫자 기준으로 폰트를 계산해버리는 경합(race condition) 버그가 있었음 —
      // 그래서 최종 숫자("7,654.9억원" 같은 긴 값)가 카드 밖으로 삐져나오는 문제가 있었음.
      if (onDone) onDone();
    } else {
      const id = requestAnimationFrame(frame);
      _activeAnimations.set(el, id);
    }
  }
  const id = requestAnimationFrame(frame);
  _activeAnimations.set(el, id);
}

const MAX_INPUT_MILLIONS = 1000000; // $1조 달러 — 역대 최고 잭팟(약 20억 달러)의 500배 수준으로 이미 비현실적인 상한.
// 이 상한이 없으면 자릿수가 극단적으로 큰 입력(예: 30자리 숫자)이 들어왔을 때, 결과 숫자가 애니메이션으로
// 올라가는 도중 극단적으로 큰 이전 값과 정상 범위의 새 값 사이의 부동소수점 연산(a + (b-a)*progress)에서
// 자릿수 차이가 너무 커 오차가 발생해, 이후 정상적인 금액을 입력해도 결과가 "0"에 멈춰버리는 문제가 있었음

function parseMillionsInput(str){
  // 소수점이 두 개 이상(예: "100.5.5") 들어오면, 뒤에 오는 숫자를 이어붙이지 않고 무시함.
  // "100.5.5"는 "100.5"를 치려다 마침표를 실수로 한 번 더 누른 경우일 가능성이 높아서,
  // 이걸 "100.55"로 이어붙여 해석하면 유저가 의도하지 않은 값이 될 수 있음
  const parts = str.replace(/[^0-9.]/g, '').split('.');
  const sanitized = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
  const n = Number(sanitized);
  if (isNaN(n)) return 0;
  return Math.min(n, MAX_INPUT_MILLIONS);
}

function parseRateInput(str){
  // 소수점을 지우면 "1,382.5" 같은 입력이 13825로 10배 뻥튀기되는 버그가 있었음(콤마와 마침표를
  // 구분 없이 한꺼번에 지워버렸기 때문) — parseMillionsInput과 동일하게 마침표는 보존하도록 수정
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const sanitized = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
  const n = Number(sanitized);
  // 원/달러 환율은 현대사에서 대체로 700~2000원 사이였음 — 이 범위를 크게 벗어나면
  // 입력 실수(자릿수 오타 등)일 가능성이 높아 직전 값을 그대로 유지함
  return isNaN(n) || n < 500 || n > 3000 ? EXCHANGE_RATE : n;
}

function onHomeAmountTyped(){
  const rawValue = document.getElementById('homeAmountInput').value;
  const millions = parseMillionsInput(rawValue);
  const slider = document.getElementById('homeAmountSlider');
  slider.max = Math.max(2000, millions); // 기본 상한(2000=$2B)을 넘는 값을 입력하면 슬라이더 상한도 같이 늘려서 롤백 방지
  slider.step = 1; // 타이핑한 정밀값(예: 153)이 슬라이더를 살짝 건드릴 때 10단위로 스냅되지 않도록 임시로 완화
  slider.min = Math.min(10, Math.round(millions)); // $10M 미만 입력 시 슬라이더 하한도 같이 낮춰 불일치 방지
  slider.value = Math.round(millions);
  // rawValue가 진짜 비어있을 때만 "값 없음"(undefined -> 마지막 유효값 유지)으로 처리하고,
  // "0"을 직접 입력한 경우는 millions===0이어도 유효한 입력으로 인정해서 그대로 반영함
  // (예전엔 millions>0으로만 판단해서 "0"을 입력해도 무시되고 이전 값에 멈춰있던 문제가 있었음)
  updateHomeCalc(rawValue.trim() === '' ? undefined : millions * 1000000);
}

// -webkit-appearance:none으로 네이티브 트랙을 지운 뒤라 Chrome/Safari는 진행 정도를 색으로
// 보여줄 pseudo-element(::-webkit-slider-progress)가 없음 — 그래서 값이 바뀔 때마다 여기서
// 직접 "지나온 구간만 --teal, 남은 구간은 --border"인 그라데이션을 계산해 발라줌
// (Firefox는 ::-moz-range-progress로 CSS만으로 처리되니 이 함수와 무관)
function updateSliderFill(slider){
  const min = Number(slider.min) || 0;
  const max = Number(slider.max) || 100;
  const pct = max > min ? ((Number(slider.value) - min) / (max - min)) * 100 : 0;
  slider.style.background = `linear-gradient(to right, var(--teal) ${pct}%, var(--border) ${pct}%)`;
}

let _prevSliderUsdM = null; // 5억 달러 문턱 통과 감지용 (진동 피드백이 방향 전환마다 한 번만 울리게)
function onHomeSliderMoved(){
  const slider = document.getElementById('homeAmountSlider');
  slider.step = 10; // 유저가 슬라이더를 직접 조작하면 원래대로 10단위 스냅 복원
  const usdMillions = Number(slider.value);
  document.getElementById('homeAmountInput').value = usdMillions;
  updateHomeCalc(usdMillions * 1000000);

  // 5억 달러 문턱을 넘나들 때 짧게 진동 (안드로이드 Chrome 등만 지원, 미지원 브라우저는 조용히 무시됨)
  if (_prevSliderUsdM !== null && navigator.vibrate) {
    const crossedThreshold = (_prevSliderUsdM < 500 && usdMillions >= 500) || (_prevSliderUsdM >= 500 && usdMillions < 500);
    if (crossedThreshold) navigator.vibrate(12);
  }
  _prevSliderUsdM = usdMillions;
}

function onHomeRateChanged(){
  isRateManuallyEdited = true;
  exchangeRateIsLive = false; // 수동으로 값을 고쳤으니 더 이상 "실시간 환율"이 아님
  exchangeRateFetchFailed = false;
  EXCHANGE_RATE = parseRateInput(document.getElementById('home-rate-input').value);
  updateExchangeRateBadges();
  updateHomeCalc();
  initJackpotCardAmt();
  refreshJackpotDrawerIfOpen();
}

// 요약줄에 "이 돈"처럼 추상적인 표현 대신 실제 금액을 직접 넣어서, 위쪽에 함께 보이는
// 발표 금액과 헷갈리지 않고 바로 어떤 액수 얘기인지 알 수 있게 함
function updateFunSummary(finalEok){
  const el = document.getElementById('fun-summary');
  if (!el) return;
  const amt = formatWon(finalEok);
  el.textContent = (currentLang === 'en')
    ? `🤑 What could ${amt} buy? (just for fun)`
    : `🤑 ${amt}이면 얼마나 살 수 있을까요? (재미로 보기)`;
}

function updateFlexBox(finalEok){
  updateFunSummary(finalEok);
  const wonAmount = finalEok * 100000000;
  const isEnFlex = (currentLang === 'en');
  // 강남 아파트는 한국 사용자에게는 익숙한 '엄청 비싼 곳' 기준이지만, 영어권 사용자에게는
  // 와닿지 않을 수 있어서 영어 버전은 맨해튼 아파트(~$1.5M) 기준으로 따로 계산함
  const apt = isEnFlex
    ? Math.floor((wonAmount / EXCHANGE_RATE) / 1500000)
    : Math.floor(wonAmount / 2500000000);
  const car = Math.floor(wonAmount / 350000000);
  const coffeeCups = Math.floor(wonAmount / 5000);
  const coffeeYears = Math.floor(coffeeCups / 3 / 365);
  document.getElementById('flex-apt').textContent = isEnFlex ? apt.toLocaleString('en-US') + ' units' : apt.toLocaleString('ko-KR') + '채';
  document.getElementById('flex-car').textContent = isEnFlex ? car.toLocaleString('en-US') + ' cars' : car.toLocaleString('ko-KR') + '대';
  if (isEnFlex) {
    document.getElementById('flex-coffee').textContent = coffeeYears > 0
      ? `3/day for ${coffeeYears.toLocaleString('en-US')} years`
      : coffeeCups.toLocaleString('en-US') + ' cups';
  } else {
    document.getElementById('flex-coffee').textContent = coffeeYears > 0
      ? `하루 3잔씩 ${coffeeYears.toLocaleString('ko-KR')}년`
      : coffeeCups.toLocaleString('ko-KR') + '잔';
  }
}

const DREAM_DATA = {
  freedom: {
    emoji: '🕊️',
    title: '자유의 몸', desc: '월요일 아침이 더 이상 두렵지 않은 삶. 사표는 이미 냈어요.',
    titleEn: 'Free at last', descEn: 'Monday mornings don\u2019t scare you anymore. You already handed in your resignation.'
  },
  family:  {
    emoji: '🏠',
    title: '가족 부동산왕', desc: '온 가족이 집 걱정 없이 사는 명절, 그 주인공이 바로 나예요.',
    titleEn: 'Family real-estate mogul', descEn: 'The whole family lives worry-free about housing \u2014 and you\u2019re the reason why.'
  },
  travel:  {
    emoji: '✈️',
    title: '지구 한 바퀴 클럽', desc: '여권에 도장이 모자랄 지경이에요. 다음 목적지는 어디로 갈까요?',
    titleEn: 'Around-the-world club', descEn: 'Your passport is running out of pages for stamps. Where\u2019s next?'
  },
  calm:    {
    emoji: '💼',
    title: '현실주의자', desc: '화려하게 안 살아도 괜찮아요. 잔고만 봐도 웃음이 나요.',
    titleEn: 'The realist', descEn: 'No need for a flashy lifestyle \u2014 just checking your balance makes you smile.'
  },
};

let lastPickedDreamKey = null; // 마지막으로 고른 드림 카드 — 언어 전환 시 dream-result 텍스트를 새 언어로 다시 그리기 위해 기억해둠

// finalAmtOverride: home-final-amt는 animateValueChange()로 requestAnimationFrame을 통해
// 비동기로 애니메이션되며 채워지므로, 이 함수 호출 시점에 DOM에서 바로 읽으면 애니메이션 도중의
// 값(또는 이전 언어 포맷)을 읽어버리는 레이스 컨디션이 생길 수 있음 — updateHomeCalc()처럼 최종
// 금액을 이미 계산해둔 곳에서는 그 값을 직접 넘겨줘서 항상 정확한 최신 금액이 쓰이게 함
function renderDreamResult(key, finalAmtOverride){
  const data = DREAM_DATA[key];
  if (!data) return;
  const isEnDream = (currentLang === 'en');
  const finalAmt = finalAmtOverride !== undefined ? finalAmtOverride : document.getElementById('home-final-amt').textContent;
  document.getElementById('dream-title').textContent = data.emoji + ' ' + (isEnDream ? data.titleEn : data.title);
  document.getElementById('dream-desc').textContent = isEnDream ? data.descEn : data.desc;
  document.getElementById('dream-amt').textContent = isEnDream ? `The one taking home ${finalAmt}` : finalAmt + '의 주인공';
}

function pickDream(key){
  if (!DREAM_DATA[key]) return;
  lastPickedDreamKey = key;
  renderDreamResult(key);
  const resultEl = document.getElementById('dream-result');
  resultEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  fireConfettiBurst();
}

// 브랜드 컬러 사각 조각 14개가 dream-result 위에서 짧게 떨어지는 연출.
// prefers-reduced-motion 환경에서는 CSS 쪽에서 애니메이션 자체를 꺼버리므로 여기서는 그냥 만들기만 해도 안전함
function fireConfettiBurst(){
  const target = document.getElementById('dream-result');
  if (!target) return;
  const colors = ['#155445', '#9C6F1E', '#F0A98C', '#FFFEF9', '#0D3A2F'];
  const rect = target.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (rect.left + window.scrollX + Math.random() * rect.width) + 'px';
    piece.style.top = (rect.top + window.scrollY) + 'px';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.15) + 's';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1000);
  }
}

// dream-result가 이미 열려있는 상태에서 언어가 바뀌거나 당첨 금액이 바뀌면, 고정 텍스트로 남지
// 않도록 현재 언어·최신 금액으로 다시 그려줌
function refreshDreamResultIfOpen(finalAmtOverride){
  const resultEl = document.getElementById('dream-result');
  if (resultEl && resultEl.style.display !== 'none' && lastPickedDreamKey) {
    renderDreamResult(lastPickedDreamKey, finalAmtOverride);
  }
}

async function shareDreamResult(){
  const title = document.getElementById('dream-title').textContent;
  const amt = document.getElementById('dream-amt').textContent;
  const isEnSd = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const shareText = isEnSd
    ? `I'm [${title}]! ${amt}. What would you do first if you won?`
    : `나는 [${title}]! ${amt}. 너는 당첨되면 뭐부터 할래?`;
  const shareUrl = location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: isEnSd ? 'What would I do if I won?' : '당첨되면 나는?', text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    alert(isEnSd ? 'Copied! Paste it anywhere you like :)' : '복사됐어요! 카톡에 붙여넣기 해보세요 :)');
  } catch (e) {
    window.prompt(isEnSd ? 'Press and hold to copy, then share it' : '아래 내용을 길게 눌러 복사해서 공유해주세요', `${shareText} ${shareUrl}`);
  }
}

async function shareResult(){
  const amountText = document.getElementById('homeAmountInput').value || '100';
  const finalAmt = document.getElementById('home-final-amt').textContent;
  const isEnSr = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const country = document.getElementById('homeCountrySelect').value === 'us'
    ? (isEnSr ? 'US resident' : '미국 거주자')
    : (isEnSr ? 'Korea resident' : '한국 거주자');
  const shareText = isEnSr
    ? `If I won the US lottery (${amountText} Million USD), my take-home as a ${country} would be about ${finalAmt}. See how much you'd actually keep after tax on ChamTax! (This is a reference simulation)`
    : `미국 복권(${amountText} Million USD) 당첨되면 ${country} 기준 실수령액이 약 ${finalAmt}이래요. 세금 떼고 나면 실제로 얼마 남는지 참택스에서 계산해보세요! (참고용 시뮬레이션 결과예요)`;
  const shareUrl = location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: isEnSr ? 'US Lottery Tax Calculator - ChamTax' : '미국 복권 세금 계산기 - 참택스', text: shareText, url: shareUrl });
      return;
    } catch (e) {
      // 사용자가 공유 취소한 경우 등 — 조용히 무시
      if (e && e.name === 'AbortError') return;
    }
  }

  // Web Share API 미지원 브라우저 — 클립보드 복사로 대체
  const btn = document.getElementById('home-share-btn');
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = isEnSr ? '✅ Link copied' : '✅ 링크가 복사됐어요';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    // 클립보드 API까지 막힌 환경(카카오톡 등 인앱 브라우저 등) — 사용자가 직접 보고 복사할 수 있게 표시
    window.prompt(isEnSr ? 'Press and hold to copy, then share it' : '아래 내용을 길게 눌러 복사해서 공유해주세요', `${shareText} ${shareUrl}`);
  }
}

async function shareRefundChecklist(){
  const isEnSc = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const shareText = isEnSc
    ? 'I checked whether I had unclaimed money using this checklist. Apparently hundreds of billions of won in unclaimed tax refunds go unclaimed every year in Korea (reverts to the treasury after 5 years). Takes 10 minutes to check on the ChamTax FAQ!'
    : '나도 모르게 못 받은 돈이 있는지 체크리스트로 확인해봤어요. 국세환급금만 매년 수천억 원대가 안 찾아가서 사라진대요 (5년 지나면 국고로 귀속). 참택스 FAQ에서 10분이면 확인 끝나요!';
  const shareUrl = location.href;
  const btn = document.getElementById('refund-share-btn');

  if (navigator.share) {
    try {
      await navigator.share({ title: isEnSc ? 'Find money you didn\u2019t know you had \u2014 checklist' : '나도 모르는 잠자는 내 돈 찾기 체크리스트', text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = isEnSc ? '✅ Link copied' : '✅ 링크가 복사됐어요';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    window.prompt(isEnSc ? 'Press and hold to copy, then share it' : '아래 내용을 길게 눌러 복사해서 공유해주세요', `${shareText} ${shareUrl}`);
  }
}

let lastMilestoneTier = 0; // 0=없음, 1=1000억, 2=1조 — 마일스톤을 "새로" 넘었을 때만 효과를 터뜨리기 위한 추적
let homeResultFirstRender = true; // 페이지에 처음 들어왔을 때는 0에서부터 세는 카운트업 효과가 오히려
// "어? 0원인가?" 하는 순간적인 혼동을 줄 수 있어서, 최초 1회만 애니메이션 없이 바로 최종 숫자를 보여주고,
// 그 이후 유저가 직접 금액을 바꿀 때만 카운트업 효과를 사용함

function triggerMilestoneBurst(){
  const container = document.getElementById('milestone-burst');
  if (!container) return;
  const balls = ['🔴', '🟡', '🟢', '🔵'];
  container.innerHTML = '';
  balls.forEach((ball, i) => {
    const span = document.createElement('span');
    span.className = 'ball';
    span.textContent = ball;
    span.style.left = (30 + i * 14) + '%';
    span.style.animationDelay = (i * 0.08) + 's';
    container.appendChild(span);
  });
  setTimeout(() => { container.innerHTML = ''; }, 1300);
}

// 실수령액 미니 박스를 눌러서 "이만큼 받고 싶다"는 금액을 직접 입력하면,
// 세율이 누진세율이라 단순 나눗셈이 안 되므로 이분 탐색으로 필요한 당첨금(억원)을 역산해서
// 위쪽 당첨금 입력창에 반영함 (예전엔 별도 아코디언이었는데, 결과 숫자를 직접 고치는 방식으로 단순화)
function startEditMiniResult(){
  const display = document.getElementById('live-result-mini-display');
  const editBox = document.getElementById('live-result-mini-edit');
  const hint = document.getElementById('mini-result-hint');
  const input = document.getElementById('miniResultEditInput');
  const current억 = parseFloat(document.getElementById('home-final-amt').dataset.eokVal) || 0;

  display.style.display = 'none';
  editBox.style.display = 'inline-flex';
  if (hint) hint.style.display = 'none';
  input.value = Math.round(current억);

  function finish(){
    input.removeEventListener('keydown', onKeydown);
    input.removeEventListener('blur', finish);
    confirmEditMiniResult(input.value);
  }
  function onKeydown(e){
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { input.removeEventListener('keydown', onKeydown); input.removeEventListener('blur', finish); cancelEditMiniResult(); }
  }
  input.addEventListener('keydown', onKeydown);
  input.addEventListener('blur', finish);
  input.focus();
  input.select();
}

function cancelEditMiniResult(){
  document.getElementById('live-result-mini-display').style.display = '';
  document.getElementById('live-result-mini-edit').style.display = 'none';
  const hint = document.getElementById('mini-result-hint');
  if (hint) hint.style.display = '';
}

function confirmEditMiniResult(rawValue){
  cancelEditMiniResult();
  const target억 = parseFloat(String(rawValue).replace(/[^0-9.]/g, ''));
  if (!target억 || target억 <= 0) return;

  const country = document.getElementById('homeCountrySelect').value;
  const stateCode = document.getElementById('homeStateSelect').value;

  let lo = target억; // 세금 떼면 항상 원금보다 적게 받으므로, 필요한 당첨금은 최소 목표금액 이상
  let hi = target억 * 3;
  let guard = 0;
  while (calcTakeHome(hi, country, stateCode).final < target억 && guard < 40) {
    hi *= 2;
    guard++;
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const midFinal = calcTakeHome(mid, country, stateCode).final;
    if (midFinal < target억) lo = mid; else hi = mid;
  }

  const required억 = hi;
  const requiredUsd = Math.round(required억 * 100000000 / EXCHANGE_RATE);
  const requiredUsdM = requiredUsd / 1000000;

  const amountInput = document.getElementById('homeAmountInput');
  amountInput.value = requiredUsdM >= 10 ? Math.round(requiredUsdM) : Math.round(requiredUsdM * 10) / 10;
  const slider = document.getElementById('homeAmountSlider');
  slider.value = Math.min(Math.max(Math.round(requiredUsdM), Number(slider.min)), Number(slider.max));
  updateSliderFill(slider);
  updateHomeCalc(requiredUsd);
}
function setHomeCountry(country){
  document.getElementById('homeCountrySelect').value = country;
  document.getElementById('homeCountryBtnKr').classList.toggle('active', country === 'kr');
  document.getElementById('homeCountryBtnUs').classList.toggle('active', country === 'us');
  updateHomeCalc();
}

function updateHomeCalc(usdOverride){
  // 입력창이 비어있으면(플레이스홀더만 보이는 초기 상태) 0으로 계산하지 않고, 마지막으로
  // 알려진 유효한 금액(sharedAmountUsd, 기본값 $100M)을 그대로 씀 — 환율 재조회·언어전환처럼
  // 다른 이유로 이 함수가 인자 없이 재호출될 때마다 결과가 0으로 튀는 걸 방지
  const typedValue = parseMillionsInput(document.getElementById('homeAmountInput').value);
  const usd = usdOverride !== undefined ? usdOverride : (typedValue > 0 ? typedValue * 1000000 : sharedAmountUsd);
  const country = document.getElementById('homeCountrySelect').value;
  const stateCode = document.getElementById('homeStateSelect').value;
  sharedAmountUsd = usd;
  sharedCountry = country;
  sharedState = stateCode;
  updateSliderFill(document.getElementById('homeAmountSlider'));
  const 억 = (usd * EXCHANGE_RATE) / 100000000;
  const r = calcTakeHome(억, country, stateCode);
  const { final, label1, val1, label2, val2, basisSuffix } = r;

  document.getElementById('home-krw-amt').textContent = formatWon(억);

  const trustLine = document.getElementById('home-trust-line');
  if (trustLine) {
    const rateStr = EXCHANGE_RATE.toLocaleString('ko-KR');
    trustLine.textContent = currentLang === 'en'
      ? `Based on IRS/NTS official data · 2026 tax rates · rate ${rateStr} KRW/USD`
      : `국세청·IRS 공식 자료 기반 · 2026년 세율 · 환율 ${rateStr}원 적용`;
  }

  const milestoneEl = document.getElementById('home-milestone');
  const newMilestoneTier = final >= 10000 ? 2 : (final >= 1000 ? 1 : 0);
  if (newMilestoneTier === 2) {
    milestoneEl.textContent = currentLang === 'en' ? '🎉 Your take-home tops ₩1 trillion!' : '🎉 실수령액만 1조원이 넘어요!';
    milestoneEl.style.display = 'block';
  } else if (newMilestoneTier === 1) {
    milestoneEl.textContent = currentLang === 'en' ? '💎 Your take-home tops ₩100 billion' : '💎 실수령액이 1,000억원을 넘었어요';
    milestoneEl.style.display = 'block';
  } else {
    milestoneEl.style.display = 'none';
  }
  // 마일스톤을 "새로" 넘어섰을 때만 짧게 로또볼이 튀어오르는 효과 (계속 떠있지 않고 한 번만)
  if (newMilestoneTier > lastMilestoneTier) {
    triggerMilestoneBurst();
  }
  lastMilestoneTier = newMilestoneTier;
  const finalEl = document.getElementById('home-final-amt');
  const prevVal = parseFloat(finalEl.dataset.eokVal) || 0;
  if (homeResultFirstRender) {
    // 최초 1회 — 카운트업 없이 바로 최종 숫자를 보여줌 (0에서 세는 걸 보고 헷갈리지 않게)
    finalEl.textContent = formatWon(final);
    finalEl.dataset.eokVal = final;
    fitAmountFontSize(finalEl);
    homeResultFirstRender = false;
  } else {
    animateValueChange(finalEl, prevVal, final, '억원', 1, 250, () => fitAmountFontSize(finalEl));
  }
  const miniEl = document.getElementById('live-result-mini-amt');
  if (miniEl) miniEl.textContent = formatWon(final);
  document.getElementById('home-final-basis').textContent = currentLang === 'en'
    ? formatWon(억) + ' prize basis · ' + basisSuffix
    : formatWon(억) + ' 당첨 기준 · ' + basisSuffix;
  const usdMillions = Math.round(usd / 1000000).toLocaleString(currentLang === 'en' ? 'en-US' : 'ko-KR');
  document.getElementById('home-final-basis-mini').textContent = currentLang === 'en'
    ? `${usdMillions}M USD prize · ${basisSuffix}`
    : `${usdMillions}M USD 당첨 · ${basisSuffix}`;
  document.getElementById('home-tax1-label').textContent = label1;
  document.getElementById('home-tax1-val').textContent = val1;
  document.getElementById('home-tax2-label').textContent = label2;
  document.getElementById('home-tax2-val').textContent = val2;

  const taxImpactPct = 억 > 0 ? Math.round(100 - (final / 억 * 100)) : 0;
  document.getElementById('tax-impact-before').textContent = formatWon(억);
  document.getElementById('tax-impact-after').textContent = formatWon(final);
  document.getElementById('tax-impact-diff').textContent = '-' + formatWon(억 - final) + ` (${taxImpactPct}%)`;

  const usdNote = document.getElementById('home-usd-note');
  if (country === 'us') {
    const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
    const finalUsd = Math.round(usd * (1 - TAX_MODEL.us_resident.federal) * (1 - stateInfo.rate));
    usdNote.textContent = currentLang === 'en'
      ? `💵 You actually receive USD ($${finalUsd.toLocaleString('en-US')}) directly — the KRW figure is just for comparison with the Korea basis`
      : `💵 실제로는 달러($${finalUsd.toLocaleString('en-US')})로 그대로 받아요 — 원화는 한국 기준과 비교하기 위한 참고용이에요`;
    usdNote.style.display = 'block';
  } else {
    usdNote.style.display = 'none';
  }

  const showFiling = (country === 'us');
  document.getElementById('home-state-row').style.display = showFiling ? 'flex' : 'none';
  document.getElementById('home-state-label').style.display = showFiling ? 'block' : 'none';
  updateFlexBox(final);
  document.getElementById('home-filing-label').style.display = showFiling ? 'block' : 'none';
  document.getElementById('home-filing-small').style.display = showFiling ? 'block' : 'none';
  document.getElementById('home-filing-note').style.display = showFiling ? 'none' : 'block';
  refreshDreamResultIfOpen(formatWon(final));
}

function onCompareAmountTyped(){
  const rawValue = document.getElementById('amountInput').value;
  const millions = parseMillionsInput(rawValue);
  const slider = document.getElementById('compareAmountSlider');
  slider.max = Math.max(2000, millions);
  slider.step = 1;
  slider.min = Math.min(10, Math.round(millions));
  slider.value = Math.round(millions);
  updateSliderFill(slider);
  updateCalc(rawValue.trim() === '' ? undefined : millions * 1000000);
}

function onCompareSliderMoved(){
  const slider = document.getElementById('compareAmountSlider');
  slider.step = 10;
  const usdMillions = Number(slider.value);
  document.getElementById('amountInput').value = usdMillions;
  updateSliderFill(slider);
  updateCalc(usdMillions * 1000000);
}

function onCompareRateChanged(){
  isRateManuallyEdited = true;
  exchangeRateIsLive = false; // 수동으로 값을 고쳤으니 더 이상 "실시간 환율"이 아님
  exchangeRateFetchFailed = false;
  EXCHANGE_RATE = parseRateInput(document.getElementById('compare-rate-input').value);
  updateExchangeRateBadges();
  updateCalc();
  initJackpotCardAmt();
  refreshJackpotDrawerIfOpen();
}

function updateCalc(usdOverride){
  const usd = usdOverride !== undefined ? usdOverride : parseMillionsInput(document.getElementById('amountInput').value) * 1000000;
  const stateCode = document.getElementById('compareStateSelect').value;
  sharedAmountUsd = usd;
  sharedState = stateCode;
  const 억 = (usd * EXCHANGE_RATE) / 100000000;

  document.getElementById('compare-krw-amt').textContent = formatWon(억);

  updateSideBySide(억, stateCode);
}

// 한국/미국 거주자 결과를 나란히(select와 무관하게 항상 둘 다) 보여주는 비교 카드용 계산
// 국가 비교 카드에 표시할 나라 목록 — 새 나라를 추가할 때는 이 배열에 항목만 추가하면
// 카드·breakdown이 자동으로 늘어남(HTML/CSS를 따로 손댈 필요 없음).
// implemented:false면 "준비 중" 카드로만 표시되고, calcTakeHome()에 해당 country 분기를
// 추가한 뒤 implemented:true로 바꾸면 실제 계산이 자동으로 반영됨.
const COUNTRY_TAX_PROFILES = [
  { code: 'kr', flag: '🇰🇷', label: '한국 거주자', labelEn: 'Korea resident', implemented: true, needsState: false },
  { code: 'us', flag: '🇺🇸', label: '미국 거주자', labelEn: 'US resident', implemented: true, needsState: true },
  { code: 'vn', flag: '🇻🇳', label: '베트남 거주자 (실제 베트남 거주 기준)', labelEn: 'Vietnam resident (living in Vietnam)', implemented: false, needsState: false },
  { code: 'cn', flag: '🇨🇳', label: '중국 거주자 (실제 중국 거주 기준)', labelEn: 'China resident (living in China)', implemented: true, needsState: false, detailPage: 'china-resident-us-lottery-tax.html', detailLabel: '자세히 보기 →', detailLabelEn: 'Learn more →' },
];

// "한국에 사는 OO 국적자" 안내 페이지 목록 — 실제 그 나라 세법이 아니라 한국 세법(위 kr 기준)을
// 그대로 따르는 번역 콘텐츠라서, COUNTRY_TAX_PROFILES(진짜 다른 나라 세금 비교)와는 완전히 분리해서 관리함.
// 새 언어 추가할 땐 이 배열에 한 줄만 추가하면 됨.
const LANGUAGE_CONTENT_PAGES = [
  { flag: '🇻🇳', label: '한국에 사는 베트남분이라면', labelEn: 'Living in Korea as a Vietnamese national', contentPage: 'vietnamese-in-korea-lottery-tax.html', contentLabel: 'Tiếng Việt →' },
];

function renderLanguageContentLinks(){
  const container = document.getElementById('otherLanguagesList');
  if (!container) return;
  const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
  container.innerHTML = '';
  LANGUAGE_CONTENT_PAGES.forEach(item => {
    const row = document.createElement('div');
    row.className = 'other-lang-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'other-lang-label';
    labelEl.textContent = `${item.flag} ${isEn ? item.labelEn : item.label}`;
    const linkEl = document.createElement('a');
    linkEl.className = 'other-lang-link';
    linkEl.href = item.contentPage;
    linkEl.textContent = item.contentLabel;
    row.append(labelEl, linkEl);
    container.appendChild(row);
  });
}

function updateSideBySide(eok, stateCode){
  const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const grid = document.getElementById('sideByCountryGrid');
  const breakdownContainer = document.getElementById('sideBreakdownContainer');
  if (!grid || !breakdownContainer) return;
  grid.innerHTML = '';
  breakdownContainer.innerHTML = '';

  COUNTRY_TAX_PROFILES.forEach(profile => {
    const baseLabel = `${profile.flag} ${isEn ? profile.labelEn : profile.label}`;

    if (!profile.implemented) {
      // 데이터가 아직 준비 안 된 나라 — 카드만 "준비 중"으로 보여주고 breakdown은 생략
      const card = document.createElement('div');
      card.className = 'side-card';
      const amtEl = document.createElement('p');
      amtEl.className = 'side-card-amt';
      amtEl.style.cssText = 'color:var(--text-muted); font-size:16px;';
      amtEl.textContent = isEn ? 'Coming soon' : '준비 중';
      card.innerHTML = `<p class="side-card-flag">${baseLabel}</p>`;
      card.appendChild(amtEl);
      grid.appendChild(card);
      return;
    }

    const result = calcTakeHome(eok, profile.code, profile.needsState ? (stateCode || 'AVG') : null);
    const pct = eok > 0 ? (result.final / eok * 100) : 0;
    let labelText = baseLabel;
    if (profile.needsState) {
      const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
      const stateLabelRaw = isEn ? stateInfo.labelEn : stateInfo.label;
      const stateLabel = stateLabelRaw.replace(/\s*\(예시\)|\s*\(example\)/i, '');
      labelText = `${baseLabel} (${stateLabel})`;
    }

    const card = document.createElement('div');
    card.className = 'side-card';
    const flagEl = document.createElement('p'); flagEl.className = 'side-card-flag'; flagEl.textContent = labelText;
    const amtEl = document.createElement('p'); amtEl.className = 'side-card-amt'; amtEl.textContent = formatWon(result.final);
    const rateEl = document.createElement('p'); rateEl.className = 'side-card-rate';
    rateEl.textContent = (isEn ? 'Take-home rate about ' : '실수령률 약 ') + pct.toFixed(1) + '%';
    card.append(flagEl, amtEl, rateEl);
    if (profile.detailPage) {
      const detailEl = document.createElement('a');
      detailEl.className = 'side-card-detail-link';
      detailEl.href = profile.detailPage;
      detailEl.textContent = isEn ? profile.detailLabelEn : profile.detailLabel;
      card.appendChild(detailEl);
    }
    grid.appendChild(card);

    const groupLabel = document.createElement('p'); groupLabel.className = 'side-group-label'; groupLabel.textContent = labelText;
    const bGrid = document.createElement('div'); bGrid.className = 'side-breakdown-grid';
    [[result.label1, result.val1], [result.label2, result.val2]].forEach(([label, val]) => {
      const cell = document.createElement('div'); cell.className = 'side-breakdown-cell';
      const l = document.createElement('p'); l.className = 'side-breakdown-label'; l.textContent = label;
      const v = document.createElement('p'); v.className = 'side-breakdown-val'; v.textContent = val;
      cell.append(l, v);
      bGrid.appendChild(cell);
    });
    breakdownContainer.append(groupLabel, bGrid);
  });

  renderLanguageContentLinks();
}

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
  'hero.tag':      { en: '🇺🇸 US Lottery Tax Calculator' },
  'hero.label':    { en: 'If you won a US lottery,' },
  'hero.title':    { en: 'how much would<br>actually land in your bank account?' },
  'hero.reassure': { en: '✔ Information only · No purchase/brokerage · No data stored' },
  'result.label':      { en: '💰 Estimated take-home amount' },
  'result.trustBadge': { en: '📊 Based on official IRS · Korea NTS data' },
  'result.share':      { en: '📤 Share this result' },
  'input.amountLabel': { en: 'Enter prize amount' },
  'input.amountLabelFull': { en: 'Prize amount (pre-tax lump sum)' },
  'input.amountPlaceholder': { en: 'e.g. 100' },
  'input.bridge': { en: '👇 The amount above is just an example — try entering your own' },
  'input.basisLabel':  { en: 'Tax basis' },
  'input.krwHint':     { en: '💡 The advertised jackpot isn\u2019t what you actually receive —' },
  'input.krwHintFull': { en: '💡 The advertised jackpot isn\u2019t what you actually receive — this calculates the pre-tax lump-sum value (about 45–60%)' },
  'input.optKorea':    { en: '🇰🇷 Korea resident' },
  'input.optUS':       { en: '🇺🇸 US resident' },
  'common.seeMore':    { en: 'See more' },
  'explore.title':      { en: '🧭 Curious about more?' },
  'explore.compareLabel': { en: 'Country Compare' },
  'explore.compareSub':   { en: 'Where is it better to live' },
  'explore.oddsLabel':    { en: 'Odds Sense' },
  'explore.oddsSub':      { en: 'Get a feel for the 1-in-292M odds' },
  'explore.faqLabel':     { en: 'FAQ' },
  'explore.faqSub':       { en: 'Taxes, refunds & more' },
  'common.backHome':   { en: '← Back to Home' },
  'common.home':       { en: 'Home' },
  'common.exchangeRate': { en: 'Rate' },
  'common.won':        { en: 'KRW' },
  'common.close':      { en: 'Close' },
  'common.adSlot':     { en: 'Ad Space (Google AdSense)' },
  'compare.breadcrumb':  { en: 'Country Comparison' },
  'compare.panelTitle':  { en: 'Curious what actually lands in your pocket?' },
  'compare.panelDesc':   { en: 'Type the prize amount or use the slider 👇' },
  'compare.krwHint':     { en: '💡 Not the advertised annuity jackpot — enter the pre-tax lump-sum cash value.' },
  'compare.selectHint':  { en: '💬 Your take-home amount depends on where you live' },
  'compare.stateLabel':  { en: '🇺🇸 State of residence <span>(state tax ranges 0%~10.9%)</span>' },
  'compare.filingLabel': { en: '🇺🇸 US resident filing status' },
  'compare.filingSmall': { en: '💬 For prizes this large, filing status (single/married) barely changes the result (bracket difference is under 0.1% of the total)' },
  'compare.filingRow':   { en: 'Single and Married Filing Jointly give nearly identical results, so no selection is needed' },
  'compare.filingNote':  { en: '💡 Korea residents are <b>generally subject to US nonresident withholding rules</b>, so choosing a filing status like US residents (Single / Married Filing Jointly) usually isn\u2019t necessary. (May vary depending on payout type, tax treaty, etc.)' },
  'compare.flowExplain': { en: '🇺🇸 The US withholds tax first, then 🇰🇷 Korea taxes the rest (with some credit available)' },
  'compare.sideTitle': { en: 'Korea vs. US, side by side' },
  'compare.sideKRFlag': { en: '🇰🇷 Korea resident' },
  'compare.sideUSFlag': { en: '🇺🇸 US resident (average state tax)' },
  'compare.sideRateLabel': { en: 'Take-home rate about' },
  'compare.sideBreakdownTitle': { en: "Here's how the tax breaks down" },
  'compare.sideFlowExplain': { en: '🇺🇸 The US withholds tax first, then 🇰🇷 Korea taxes the rest (with some credit available) — US residents only pay federal + state tax' },
  'compare.sideUSFedLabel': { en: 'US Federal Tax' },
  'compare.sideUSStateLabel': { en: 'Average State Tax' },
  'compare.finalLabel':  { en: 'Final take-home amount' },
  'compare.simNote':     { en: '💡 This is a reference estimate reflecting Korea\u2019s progressive income tax and Foreign Tax Credit. Actual tax owed may vary by individual circumstances \u2014 consulting a tax professional is recommended.' },
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
  'compare.disclaimer':  { en: 'Built with reference to IRS and Korean NTS guidance, but if you actually win, please consult a tax professional (hope you get the chance!)' },
  'state.AVG': { en: 'Average (example, 8%)' },
  'state.TX':  { en: 'Texas (0%)' },
  'state.FL':  { en: 'Florida (0%)' },
  'state.CA':  { en: 'California (lottery-exempt, 0%)' },
  'state.WA':  { en: 'Washington (0%)' },
  'state.NV':  { en: 'Nevada (0%)' },
  'state.NY':  { en: 'New York (10.9%)' },
  'state.NJ':  { en: 'New Jersey (10.75%)' },
  'state.OR':  { en: 'Oregon (9.9%)' },
  'state.MN':  { en: 'Minnesota (9.85%)' },
  'state.MD':  { en: 'Maryland (8.95%, unconfirmed)' },
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
  'odds.winner1Amt': { en: '$2.04 billion' },
  'odds.winner1':    { en: 'November 2022, California \u2014 the largest Powerball jackpot in history. The winner chose the lump-sum cash option (about $997.6M).' },
  'odds.winner2Amt': { en: '$758.7 million' },
  'odds.winner2':    { en: 'August 2017, Massachusetts \u2014 the winner made headlines by announcing she would not be returning to work.' },
  'odds.winner3Amt': { en: 'Anonymous winners' },
  'odds.winner3':    { en: 'Some states let winners stay anonymous (Florida, Texas, Delaware, etc.). Many large winners actually choose this option.' },
  'odds.lightningTitle': { en: '⚡ Today\u2019s Lightning Numbers' },
  'odds.lightningDesc':  { en: 'Drawn just for fun, with today\u2019s "lightning" energy \u2014 6 random numbers' },
  'odds.drawBtn':  { en: '⚡⚡⚡ Draw numbers' },
  'odds.drawNote': { en: 'Your odds with these numbers are still 1 in 292 million \u2014 just for fun 😉 (not a purchase suggestion)' },
  'odds.payoutTitle': { en: 'How much do you win for each match?' },
  'odds.payoutDesc':  { en: 'Powerball prize tiers by numbers matched' },
  'odds.howtoTitle': { en: '🎱 First, how the game works' },
  'odds.howtoText':  { en: 'Powerball is a game of matching <b>5 regular numbers</b> (from 1\u201369) plus <b>1 Powerball number</b> (from 1\u201326) \u2014 6 numbers total. The prize depends on how many regular numbers you match, plus whether you match the Powerball.' },
  'odds.jackpotTag':     { en: '🏆 Jackpot' },
  'odds.jackpotMatch':   { en: '🎯 Match all 6 numbers' },
  'odds.jackpotExplain': { en: 'Keeps growing until someone wins' },
  'odds.jcTapCta':  { en: '👇 Tap to see your after-tax take-home' },
  'odds.jcTapHint': { en: '👆 Tap the card again to collapse' },
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
  'odds.amt5':        { en: 'About \u20a91.38B' },
  'odds.odds5':       { en: '1 / 11.69M' },
  'odds.match4pb':    { en: 'Match 4 + Powerball' },
  'odds.amt4pb':      { en: 'About \u20a96.9M' },
  'odds.odds4pb':     { en: '1 / 910K' },
  'odds.match4':      { en: 'Match 4 numbers' },
  'odds.amt4':        { en: 'About \u20a914,000' },
  'odds.odds4':       { en: '1 / 36,525' },
  'odds.match3pb':    { en: 'Match 3 + Powerball' },
  'odds.amt3pb':      { en: 'About \u20a914,000' },
  'odds.odds3pb':     { en: '1 / 14,494' },
  'odds.matchPBonly': { en: 'Powerball number only' },
  'odds.amtPBonly':   { en: 'About \u20a9550' },
  'odds.oddsPBonly':  { en: '1 / 38' },
  'odds.disclaimer': { en: 'Odds figures are based on official published data. KRW conversion uses a reference exchange rate and may differ from actual amounts.' },
  'faq.breadcrumb':  { en: 'Frequently Asked Questions' },
  'faq.panelTitle':  { en: 'Questions people often ask' },
  'faq.panelDesc':   { en: 'Common questions from people who searched their way here' },
  'faq.searchPlaceholder': { en: '🔍 Search (e.g. tax, citizenship, Powerball)' },
  'faq.catAll':      { en: 'All' },
  'faq.catTax':      { en: 'Tax & Double Taxation' },
  'faq.catLife':     { en: 'Insurance, Pension & Gift Tax' },
  'faq.catRefund':   { en: 'Refunds & Deadlines' },
  'faq.catPurchase': { en: 'Purchasing & Process' },
  'faq.catGame':     { en: 'Game Info' },
  'faq.noResult':    { en: 'No results found. Try a different search term!' },
  'faq.q1': { en: 'How much tax is actually deducted? 😮' },
  'faq.a1': { en: '👉 <b>US residents</b> have 24% withheld upfront when they win, and it\u2019s settled up to 37% later when filing income tax.<br>👉 <b>US nonresidents, including Korea residents,</b> are generally subject to a separate <b>30% withholding rule</b> (may vary based on tax treaties, etc.).' },
  'faq.q2': { en: 'Wait, I pay tax in Korea too? Isn\u2019t that double taxation?' },
  'faq.a2': { en: 'Yes, you\u2019ll owe tax in Korea too. <b>Based on a direct inquiry to Korea\u2019s National Tax Service in July 2026</b>, US lottery winnings aren\u2019t domestic lottery income under the Lottery and Lottery Fund Act, so it doesn\u2019t end with a flat 22\u201333% separate tax like Korean lotto \u2014 instead it must be <b>combined and reported as comprehensive income tax (progressive rate, up to 45%)</b>. However, tax already paid in the US (30% withholding) can be offset via <b>Foreign Tax Credit (FTC)</b>, so the two taxes aren\u2019t simply added together \u2014 they\u2019re reconciled. Note this answer came through an NTS phone/online consultation (not an official binding ruling), so we\u2019ll double-check once we receive the formal written response. The calculator reflects this current understanding.' },
  'faq.q3': { en: 'Can I get any of the tax back? 💸' },
  'faq.a3': { en: 'I won\u2019t just tell you "yes, you can get a refund." Here\u2019s what actually works and what doesn\u2019t.<br><br>👉 <b>US federal tax (30%) \u2014 realistically difficult.</b> Korea isn\u2019t treaty-exempt with the US for gambling/lottery income (confirmed by Park v. Commissioner), and nonresident aliens can\u2019t claim gambling loss deductions, so the 30% federal withholding is usually final.<br><br>👉 <b>State Tax \u2014 select the state you won in to check directly:</b><br>💡 Note: <b>Maryland and Arizona are the two unusual states that tax winners even if they don\u2019t live there</b> \u2014 most other states only withhold state tax based on residency, not where the ticket was purchased. So if you won while traveling, it only matters which state you bought the ticket in if it was one of these two.' },
  'faq.step': { en: 'STEP' },
  'faq.selectState': { en: 'Select the state you won in' },
  'faq.selectStatePlaceholder': { en: 'Select the state you won in 👇' },
  'faq.wizardDefault': { en: 'Select a state to see your refund possibility instantly' },
  'faq.a3b': { en: '👉 <b>Korea Foreign Tax Credit (FTC) \u2014 partially offsets double taxation.</b> You can credit what you already paid in the US against Korean tax owed (up to a limit). It\u2019s less a "refund" and more "not paying twice."<br><br>👉 <b>Required documents (confirmed with NTS, July 2026)</b> \u2014 prepare a foreign tax payment certificate, payment receipt, withholding statement filed with the foreign government, and proof of the lottery win.<br>👉 <b>The exchange rate used is based on the date you received the winnings</b> (Enforcement Decree of the Income Tax Act, Article 50) \u2014 not the win date or the date brought into Korea, but the official/market rate on the day you actually received the money.<br>👉 <b>Local income tax (10%) isn\u2019t handled by the National Tax Service</b> \u2014 it\u2019s a local government matter, so check with the Local Tax Consultation Center (1577-5700) or your local district office for the exact calculation basis.<br><br>⚠️ <b>The NTS answer was somewhat ambiguous about whether the tax base for a lump-sum payout is the "announced jackpot total" or the "actual lump sum received"</b> \u2014 we haven\u2019t been able to confirm this, so if you actually win, please verify this specific point with a tax professional.<br><br>※ This is general guidance; actual tax matters require professional consultation' },
  'faq.q4': { en: 'Will my health insurance premium spike if I win? 🏥' },
  'faq.a4': { en: 'Yes, this can hit harder than the tax itself. If you\u2019re a <b>regional (self-employed) subscriber</b>, the winnings count fully as "other income," and when premiums are recalculated every November (based on the prior year\u2019s income), it can rise sharply.<br><br>👉 Even <b>employer-based subscribers</b> aren\u2019t safe \u2014 if income outside your salary (including winnings) exceeds ₩20M/year, a separate "income-based premium" is added.<br>👉 <b>If you\u2019re registered as a dependent</b> (e.g., under a child), a large income can cause you to lose dependent status and be moved to regional subscriber status.<br><br>※ This is separate from tax filing \u2014 check with the National Health Insurance Service' },
  'faq.q5': { en: 'I\u2019m already receiving National Pension / Basic Pension \u2014 does this affect it? 👴' },
  'faq.a5': { en: 'It depends.<br><br>👉 <b>National Pension (old-age pension)</b> \u2014 if you\u2019re already receiving it, don\u2019t worry too much. The reduction rule applies to "earned/business income," so a one-time windfall like lottery winnings appears not to directly apply.<br>👉 <b>Basic Pension / Basic Livelihood benefits</b> \u2014 this is different. Eligibility is reassessed based on income and assets, so a large windfall could change or revoke your eligibility.<br><br>※ For exact details, check directly with the National Pension Service or your local community center' },
  'faq.q6': { en: 'How do I tell if a "you won" message is a scam? 🚨' },
  'faq.a6': { en: 'These are real, common scam patterns \u2014 knowing them makes them easy to filter out.<br><br>👉 <b>Scammers impersonate card companies or lottery operators</b>, claiming to "refund" money for a losing ticket and asking for your card number/PIN. Losing tickets were never eligible for a refund in the first place.<br>👉 <b>Scammers impersonate the Lottery Commission or Dong Haeng Lottery</b>, offering "refunds in crypto" to get you to install an app or buy crypto.<br>👉 <b>Scams also sell "predicted winning numbers" or lucky charms</b> \u2014 no one can predict lottery numbers.<br><br>💡 <b>One rule covers it all</b> \u2014 real winnings are confirmed by checking yourself at the official lottery site or retailer. If someone calls or texts you first saying "you won" and then asks for money or personal information, it\u2019s 100% a scam.' },
  'faq.q7': { en: 'How much gift tax if I share with family? 👨‍👩‍👧' },
  'faq.a7': { en: 'Here\u2019s the summary as of 2026.<br><br>👉 <b>Basic exemption (tax-free limit, combined over 10 years)</b> \u2014 up to ₩600M for a spouse, ₩50M for an adult child, ₩20M for a minor child \u2014 no gift tax below these amounts.<br>👉 <b>Amounts above the exemption face progressive rates</b> \u2014 10% up to ₩100M, 20% for ₩100M\u2013500M, 30% for ₩500M\u20131B, 40% for ₩1B\u20133B, 50% above ₩3B (each bracket has its own progressive deduction, so actual tax is somewhat lower).<br>👉 <b>An extra ₩100M exemption</b> is available for a child\u2019s marriage/childbirth (separate from the basic exemption, combined max ₩100M for marriage+birth).<br>👉 Filing within the deadline yourself gets you a <b>3% tax credit</b>.<br><br>※ For amounts this large, the timing and method of gifting matters a lot for tax \u2014 consult a tax professional in advance' },
  'faq.q8': { en: 'Is prize money subject to property division in a divorce? 💍' },
  'faq.a8': { en: 'In principle, <b>no.</b> Lottery winnings are treated as "separate property" acquired purely through individual luck, and Korean courts have consistently excluded them from divorce property division (e.g., a 2014 Busan District Court ruling).<br><br>👉 <b>There are exceptions</b> \u2014 if your spouse contributed to preserving or growing the winnings after you won (e.g., covering living expenses so the winnings weren\u2019t spent down, or jointly paying off a loan), that contribution may be included in property division.<br>👉 <b>It can also differ if you bought the ticket together</b> \u2014 if your spouse paid for the ticket or picked the numbers, contributing to the win itself, that may be considered too.<br><br>※ This varies a lot case by case \u2014 consult a divorce/property division attorney if this applies to you' },
  'faq.q9': { en: 'By when do I have to claim the winnings? ⏰' },
  'faq.deadlineBadge': { en: 'Has a deadline' },
  'faq.a9': { en: 'This is really important \u2014 <b>if you don\u2019t claim within the deadline, the prize simply disappears.</b> It reverts to the state and is gone forever.<br><br>👉 <b>Usually between 90 days and 1 year</b>, but it varies by state. For example, Florida gives 180 days; California gives 180 days for regular prizes but up to 1 year for the jackpot.<br>👉 <b>Jackpots have a second deadline</b> \u2014 the deadline to choose lump sum vs. annuity is usually 60 days (see the "Take the lump sum" item above for details). Miss it, and you\u2019re automatically switched to the annuity.<br>👉 <b>Someone actually lost a fortune this way.</b> A winner in Ohio missed the 180-day claim deadline and forfeited <b>$138 million (about ₩190B)</b>. This really happened.<br><br>※ Deadlines vary by state \u2014 always check the official lottery site for the state you won in' },
  'state.name.TX': { en: 'Texas' },
  'state.name.FL': { en: 'Florida' },
  'state.name.CA': { en: 'California' },
  'state.name.WA': { en: 'Washington' },
  'state.name.NV': { en: 'Nevada' },
  'state.name.NY': { en: 'New York' },
  'state.name.NJ': { en: 'New Jersey' },
  'state.name.OR': { en: 'Oregon' },
  'state.name.MN': { en: 'Minnesota' },
  'state.name.MD': { en: 'Maryland' },
  'faq.q10': { en: 'Aside from the lottery, might I have unclaimed money that\u2019s already mine? 🇰🇷' },
  'faq.a10': { en: 'Unlike the lottery, this is money <b>already confirmed under your name</b>, so it\u2019s a different story. According to the National Tax Service, <b>unclaimed tax refunds pile up to hundreds of billions of won every year</b> \u2014 unclaimed refunds from unfiled comprehensive income tax alone reached ₩274.4B over 5 years. <b>After 5 years from the first claim date, it reverts to the national treasury</b> and is gone for good.' },
  'faq.checklistTitle': { en: 'Check if any of these apply to you' },
  'faq.check1': { en: 'Changed jobs or left a job within the last 5 years' },
  'faq.check2': { en: 'Worked part-time/freelance but didn\u2019t file taxes some year' },
  'faq.check3': { en: 'Left a job mid-year and missed that year\u2019s year-end settlement' },
  'faq.check4': { en: 'Might have missed deductions (medical, card, donations) in some year' },
  'faq.check5': { en: 'Paid local taxes (car tax, property tax) but never rechecked them' },
  'faq.check6': { en: 'Have an old bank account or insurance policy not checked in years' },
  'faq.check7': { en: 'Health insurance/pension eligibility changed (job change, etc.) but never checked' },
  'faq.check8': { en: 'Have card points sitting unused for years' },
  'faq.checkDefault': { en: 'If any apply, check for real below 👇' },
  'faq.step2Title': { en: 'Go straight to the official claim portal' },
  'faq.recommend': { en: '⭐ Recommended' },
  'faq.linkHometax':   { en: 'Find tax<br>refunds' },
  'faq.linkGov24':     { en: 'Check unclaimed<br>refunds' },
  'faq.linkFine':      { en: 'Find dormant<br>money' },
  'faq.linkHealth':    { en: 'Health insurance/<br>pension refunds' },
  'faq.linkCardpoint': { en: 'Card points<br>lookup' },
  'faq.checklistFooter': { en: 'We can\u2019t look this up for you directly (these government systems require ID verification) \u2014 but we\u2019ve linked you straight to the official channels. Takes about 10 minutes to check.' },
  'faq.shareChecklist': { en: '📤 Share this with a friend' },
  'faq.q11': { en: 'Is it better to take it all at once, or in installments?' },
  'faq.a11': { en: 'The announced jackpot is actually the <b>annuity-based amount</b> \u2014 taking it as a lump sum only gets you <b>about 45\u201360%</b> of that (the rest is the discount for getting 29 years of payments all at once). From a tax standpoint, though, <b>a lump sum pushes you into a much higher bracket that year, while an annuity spreads the burden over many years</b>. In practice, most winners choose the lump sum. You usually have to decide within <b>60 days</b> of claiming, and it\u2019s irreversible once chosen \u2014 definitely consult a financial advisor before deciding.' },
  'faq.q12': { en: 'Where can I buy a US lottery ticket?' },
  'faq.a12': { en: 'Tickets are sold at convenience stores, gas stations, etc. in the US. You may see services in Korea claiming to buy tickets on your behalf online, but such services may be illegal under Korean law (unauthorized lottery brokerage), so we don\u2019t recommend or link to them. Note that using such a service could also expose the consumer to penalties. We only help with tax and odds calculations 🙏' },
  'faq.q13': { en: 'What if a friend buys a ticket for me, or claims the prize on my behalf?' },
  'faq.a13': { en: 'The commercial purchase-agent services mentioned above may be illegal, but if you\u2019re asking about a friend in the US personally buying a ticket for you \u2014 that also creates some genuinely complicated issues.<br><br>\n            <b>① Ownership</b>: US lottery ticket ownership is mostly determined by who signs to claim it. Without a prior written agreement, if that friend changes their mind and doesn\u2019t share the winnings, you\u2019d have little legal recourse.<br><br>\n            <b>② Taxes can actually get more complicated</b>: If your friend claims as a US resident, their tax rate (24\u201337%) applies. Then, sending that money to you would be treated as a "gift" under US tax law, potentially triggering <b>a separate US gift tax</b>, and receiving that money in Korea could also trigger <b>Korean gift tax</b> again. In other words, the total tax could end up <b>higher</b> than if you had claimed it yourself as a nonresident.<br><br>\n            In short, the larger the amount, the riskier this kind of proxy arrangement becomes. If this situation actually arises, be sure to consult a tax professional and lawyer beforehand (before winning!).' },
  'faq.q14': { en: 'Where can I check past winning numbers?' },
  'faq.a14': { en: 'Our home screen shows recent winning numbers too, but the official site is always most accurate.' },
  'faq.a14b': { en: 'Our home screen shows recent winning numbers too, but the official site is always most accurate. You\u2019ll find official site links in the "Result Check Flow" section above (step 4).' },
  'faq.linkPowerball': { en: '🔗 Powerball official site →' },
  'faq.linkMega':      { en: '🔗 Mega Millions official site →' },
  'faq.q15': { en: 'Can I claim winnings without US citizenship?' },
  'faq.a15': { en: 'Yes, a foreign national who legally purchased a winning ticket can claim it without citizenship or a green card. However, the tax/filing process differs from US residents \u2014 nonresident aliens, including Korea residents, are generally subject to 30% withholding (may vary by tax treaty, etc.).' },
  'faq.q16': { en: 'I\u2019m a Korean living in the US \u2014 which option should I choose? (students, expats, green card, citizens)' },
  'faq.a16': { en: '"Living in the US" and "US tax resident" can be different things! <b>Green card/citizenship holders</b>, and <b>expats</b> who\u2019ve lived there a long time, should generally choose <b>\u2018US\u2019</b>. On the other hand, <b>students</b> (F-1 visa, etc.) with a short stay, or expats early in their assignment, may still be classified as <b>\u2018nonresident alien\u2019</b> for tax purposes, in which case the \u2018Korea (nonresident)\u2019 calculation may actually be more accurate. This determination (the Substantial Presence Test) is a fairly complex rule based on days present over the last 3 years \u2014 if it\u2019s unclear, consult a US tax professional.' },
  'faq.q17': { en: 'What is the "filing status (single/married)" option in the calculator?' },
  'faq.a17': { en: 'When filing US taxes, the bracket depends on which status you file under. Single means filing alone; Married Filing Jointly means filing combined with your spouse. However, <b>for an amount as large as lottery winnings, this barely matters</b> \u2014 as of 2026 the top bracket (37%) starts around $640K for Single vs. about $770K for Married Filing Jointly, and that ~$130K gap is rounding-error territory next to a prize worth millions to billions. That\u2019s why our calculator shows nearly identical results either way. Note that Korea residents are generally subject to the 30% withholding rule regardless of this distinction.' },
  'faq.q18': { en: 'What actually happens, step by step, if I win?' },
  'faq.a18': { en: 'Buy in the US → Confirm the win → Submit ID, ticket, and claim form to that state\u2019s lottery office → Claim within the deadline (usually 180 days to 1 year) → Federal tax is automatically withheld at the time of claim, with the rest settled the following year when you file. (We don\u2019t provide purchase-agent guidance for buying from Korea \u2014 see "Learn more" below!)' },
  'faq.q19': { en: 'How do I file these taxes?' },
  'faq.a19': { en: '30% is withheld in the US first, and in Korea, <b>you must combine it as other income and file with your comprehensive income tax return the following May</b> (based on an NTS online consultation response from July 2026). Tax paid in the US can be offset via Foreign Tax Credit (FTC). Since this is a consultation answer rather than an official ruling, please consult a tax professional who handles both US and Korean tax when you actually file.' },
  'faq.q20': { en: 'Are there lotteries other than Powerball and Mega Millions?' },
  'faq.a20': { en: 'Yes! Starting February 22, 2026, a new lottery called <b>"Millionaire for Life"</b> launched, merging the two previous games "Lucky for Life" and "Cash4Life." The top prize pays <b>$1M per year for life</b> (about ₩1.38B/year, or roughly $18M as a lump sum), and the second prize pays $100K per year for life (about ₩140M/year). Tickets are $5, with drawings every night. Note that this site\u2019s tax calculator is currently set up for Powerball and Mega Millions only.' },
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
  'faq.sameStoreCallout': { en: '💡 <b>"Where do I buy Powerball vs. Mega Millions?"</b> is a common question \u2014 but actually, the same store sells both. Just tell the cashier "Powerball" or "Mega Millions."' },
  'faq.otherGamesNote': { en: 'Note: besides these two, there\u2019s also <b>Millionaire for Life</b> (launched Feb 2026, pays over ₩100M/year for life if you win), <b>Lotto America</b> (15 states), and other multi-state games, plus each state has its own lotto and scratch-off games \u2014 hundreds combined. But Powerball and Mega Millions are the only two that make Korean news, so that\u2019s all this site covers.' },
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
  'faq.ticketMeta':  { en: 'Draw date: MON JUL 06 2026 &nbsp;|&nbsp; QP (Quick Pick) &nbsp;|&nbsp; $2.00' },
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
  'faq.phraseTip': { en: '💡 You don\u2019t have to pick numbers yourself. Just say "quick pick" and the computer picks randomly \u2014 that\u2019s how most people buy!' },
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
  'faq.checkMethod2': { en: 'Use the <b>official lottery app for the state you bought in</b> to <b>scan the ticket\u2019s barcode</b> with your camera \u2014 it shows whether you won automatically' },
  'faq.checkMethod3': { en: 'Scan the ticket at a <b>self-service scanner</b> at a convenience store, or ask a clerk to scan it' },
  'faq.scanNote': { en: '※ Always double-check through an official channel before throwing away a ticket \u2014 scanner apps are for reference only' },
  'faq.step5Title':  { en: 'If you won, claim it' },
  'faq.step5Detail': { en: 'Visit the <b>lottery office for that state</b> in person with your ID and ticket. The deadline is usually <b>180 days to 1 year</b>' },
  'faq.step5Note':   { en: '💡 There isn\u2019t just one office \u2014 the <b>official lottery site for the state you bought in</b> has a "Claim Center" address (e.g., California has several regional offices including Sacramento; Texas and New York each have their own)' },
  'faq.step6Title':  { en: 'Lump sum or annuity? You must choose when claiming' },
  'faq.step6Detail': { en: 'After claiming, you usually have <b>60 days</b> to choose one or the other. If you don\u2019t choose in time, it defaults to the annuity.' },
  'faq.lumpSumTitle':  { en: '💵 Lump Sum' },
  'faq.lumpSumDetail': { en: 'Receive about <b>45\u201360%</b> of the announced amount all at once. The option most winners choose' },
  'faq.annuityTitle':  { en: '📅 Annuity' },
  'faq.annuityDetail': { en: 'Receive the <b>full</b> announced amount over 30 payments across 29 years (first payment immediately, then <b>growing 5% each year</b>). Backed by US government bonds; remaining payments pass to heirs if you die' },
  'faq.payoutIrreversible': { en: 'This choice is irreversible (you can\u2019t switch from annuity to lump sum later) \u2014 so be sure to consult a tax and financial advisor before deciding' },
  'faq.sixStepsNote': { en: 'That\u2019s all 6 steps. The key point is that if step 1 (the prerequisite) isn\u2019t met, none of the later steps apply to you.' },
  'faq.payMethodTitle': { en: 'Do you get paid in cash or by bank transfer?' },
  'faq.payMethodDesc':  { en: 'Completely different depending on the amount' },
  'faq.small600':       { en: '💵 $600 or less' },
  'faq.small600Detail': { en: 'You can get <b>cash</b> right on the spot at the store where you bought the ticket.' },
  'faq.largeAmt':       { en: '🏦 Large amounts (hundreds of thousands to millions of dollars)' },
  'faq.largeAmtDetail': { en: 'You won\u2019t get cash. Payment comes via <b>check or bank transfer</b>, and processing usually takes <b>6\u20138 weeks</b>. You\u2019ll need a bank account to receive it.' },
  'faq.krResident':       { en: '🇰🇷 If you\u2019re a Korea resident?' },
  'faq.krResidentDetail': { en: 'Honestly, there\u2019s <b>no clearly published official procedure</b> for this. Having a US bank account helps, but without one, you\u2019ll likely need to arrange international wire transfer individually with the state lottery office. If this situation actually comes up, don\u2019t handle it alone \u2014 work with <b>the state lottery office, a bank capable of international transfers, and a tax/legal professional</b> together.' },
  'faq.howManyTitle': { en: 'How many tickets can I buy at once?' },
  'faq.howManyDesc':  { en: 'This is actually two different questions mixed together \u2014 let\u2019s answer them separately' },
  'faq.multiTicketQ': { en: 'Q. Can I buy multiple tickets at once?' },
  'faq.multiTicketA': { en: 'Yes, there\u2019s no legal limit. One play slip usually allows up to 5 games, and you can submit multiple slips to buy more. "Give me a thousand tickets" is theoretically possible (as long as the store has stock).' },
  'faq.multiDrawQ': { en: 'Q. Can I enter the same numbers into multiple future drawings at once?' },
  'faq.multiDrawA': { en: 'Yes, this is called "Multi-draw." You can enter the same numbers into up to <b>10\u201326 drawings at once</b> (varies by state) in a single purchase. It saves you from buying a new ticket every time.' },
  'faq.noRefundNote': { en: 'Note: tickets can\u2019t be refunded or canceled once purchased (all sales are final)' },
  'faq.finalDisclaimer': { en: 'If you have any other questions, feel free to reach out via Contact!' },
  'privacy.breadcrumb':    { en: 'Privacy Policy' },
  'privacy.title':         { en: 'Privacy Policy' },
  'privacy.effectiveDate': { en: 'Effective date: July 9, 2026' },
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
  'home.miniResultLabel': { en: '👉 Take-home' },
  'home.reverseSummary':  { en: '🎯 Or, start from how much you want to receive' },
  'home.reverseLabel':    { en: 'I want this much after tax' },
  'home.reversePlaceholder': { en: 'e.g. 100' },
  'home.reverseBtn':      { en: 'Calculate' },
  'home.reverseUnit':     { en: '(×₩100M)' },
  'home.detailSummary':   { en: '🔍 See the full breakdown' },
  'home.flowExplain1':    { en: '💡 The <b>advertised jackpot (annuity basis)</b> shown in the news isn\u2019t what you actually receive. Taking the lump sum gets you roughly 45\u201360% of that as the <b>pre-tax cash value</b>, and this calculator is based on that pre-tax cash amount.' },
  'home.calcBasisBox':    { en: '• Lump-sum basis (differs for installment payouts)' },
  'home.funMoneySummary': { en: '🤑 How much could you actually buy with this? (just for fun)' },
  'home.funSummaryMerged': { en: '🎉 Imagine winning (just for fun)' },
  'home.flexApt':      { en: 'Gangnam apartment (based on ₩2.5B)' },
  'home.flexCar':      { en: 'Ferrari Roma (based on ₩350M)' },
  'home.flexCoffee':   { en: 'Starbucks Americano (₩5,000)' },
  'home.flexNote':     { en: '* Just a fun calculation based on example prices' },
  'home.groundingNote': { en: '🌱 But honestly, what you already have might be more than enough for a good day' },
  'home.dreamSummary': { en: '🎬 What would you do first if you won? (just for fun)' },
  'home.dreamIntro':   { en: 'What would you do first if you won? Pick one:' },
  'home.dreamFreedom': { en: '🕊️ Hand in my resignation letter first' },
  'home.dreamFamily':  { en: '🏠 Buy a house for every family member' },
  'home.dreamTravel':  { en: '✈️ Leave on a world trip right away' },
  'home.dreamCalm':    { en: '💼 Just quietly check my bank balance' },
  'home.shareDreamBtn': { en: '📤 Share this result' },
  'home.jackpotToggle': { en: '🎟️ Check today\u2019s jackpot' },
  'home.manualCheck':   { en: 'Checked manually' },
  'home.powerballName': { en: 'Powerball' },
  'home.megaName':      { en: 'Mega Millions' },
  'home.officialLink':  { en: '🔗 Check the latest numbers on the official site' },
  'home.oddsTeaserTitle': { en: 'The 1-in-292M odds don\u2019t really register, do they?' },
  'home.oddsTeaserSub':   { en: 'Comparing it to things like lightning strikes makes it click' },
  'home.oddsTeaserLink':  { en: 'See the odds \u2192' },
  'home.faqTeaserTitle': { en: '❓ People usually wonder about this' },
  'home.faqTeaserDesc':  { en: 'Tap for the answer right away' },
  'home.faqTeaserLink':  { en: 'See more answers \u2192' },
  'home.trustToggle': { en: '✓ Why can I trust this?' },
  'home.trust1Name': { en: 'Reliable information' },
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

  // 언어 전환 시 환율 배지의 상태 문구(title)도 항상 다시 반영 (실패/성공/기본 상태와 무관하게 현재 언어로)
  updateExchangeRateBadges(exchangeRateFetchFailed);

  // 언어 전환 시 동적으로 생성되는 텍스트(CTA 버튼, 잭팟 패널, 추첨 카운트다운 등)도 다시 계산해서 갱신
  if (document.getElementById('view-home').classList.contains('on')) {
    updateHomeCalc();
    applyJackpotData();
    updateDrawCountdown();
    initJackpotCardAmt();
    refreshJackpotDrawerIfOpen();
  }
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
// 모바일에서는 title(툴팁)이 마우스 오버가 없어서 절대 안 보이므로, 상태 안내는 눈에 보이는
// 텍스트(trust-line)와 배지의 반짝임 애니메이션으로만 전달함 — 재시도가 다시 실패해도
// "탭이 씹혔나?" 싶지 않도록, 매번 눈에 띄는 반응을 줌
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

  // 결과가 이전과 같아 보여도(예: 재시도했는데 또 실패) "지금 막 반응했다"는 걸 눈으로 확인할 수 있게
  // 배지를 잠깐 반짝이고, 실패 시에는 trust-line에 "방금 다시 시도했다"는 문구를 잠깐 보여줌
  buttons.forEach(b => {
    b.classList.add('just-retried');
    setTimeout(() => b.classList.remove('just-retried'), 450);
  });
  if (!ok) {
    const trustLine = document.getElementById('home-trust-line');
    if (trustLine) {
      const isEnRetry = (typeof currentLang !== 'undefined' && currentLang === 'en');
      const retryMsg = isEnRetry ? '⚠️ Tried again, still couldn\u2019t connect — using default rate' : '⚠️ 방금 다시 시도했지만 여전히 연결이 안 돼요 — 기본값 적용 중';
      trustLine.textContent = retryMsg;
      setTimeout(() => { if (typeof updateHomeCalc === 'function') updateHomeCalc(); }, 2500);
    }
  }
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
  // 소수점이 사실상 0이면 정수로, 아니면 소수 1자리로 표시 (100.0억원 같은 어색한 표기 방지) + 천단위 콤마
  const rounded = Math.round(n * 10) / 10;
  const isWhole = rounded % 1 === 0;
  const numStr = isWhole
    ? Math.round(rounded).toLocaleString('ko-KR')
    : rounded.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
    numStr = (krw / 1e12).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    unit = 'trillion';
  } else if (abs >= 1e9) {
    numStr = (krw / 1e9).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    unit = 'billion';
  } else {
    numStr = (krw / 1e6).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
    unit = 'million';
  }
  return '₩' + numStr + ' ' + unit;
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
  }
};

// 실제 리서치 결과 (3~6주차) 기반 주별 복권 세율. 출처: 각 주 복권 공식 사이트, IRS Pub 515/519
const STATE_TAX_RATES = {
  AVG:   { label: '평균 (예시)', labelEn: 'Average (example)', rate: 0.08 },
  TX:    { label: '텍사스', labelEn: 'Texas', rate: 0 },
  FL:    { label: '플로리다', labelEn: 'Florida', rate: 0 },
  CA:    { label: '캘리포니아 (복권 당첨금 면제)', labelEn: 'California (lottery-exempt)', rate: 0 },
  WA:    { label: '워싱턴', labelEn: 'Washington', rate: 0 },
  NV:    { label: '네바다', labelEn: 'Nevada', rate: 0 },
  NY:    { label: '뉴욕', labelEn: 'New York', rate: 0.109 },
  NJ:    { label: '뉴저지', labelEn: 'New Jersey', rate: 0.1075 },
  OR:    { label: '오리건', labelEn: 'Oregon', rate: 0.099 },
  MN:    { label: '미네소타', labelEn: 'Minnesota', rate: 0.0985 },
  MD:    { label: '메릴랜드 (확인중)', labelEn: 'Maryland (unconfirmed)', rate: 0.0895 }, // 공식 출처마다 8.75~9.5%로 상이 — 최신 수치 재확인 필요
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

// ⚠️ [향후 국가 확장 시 필독 — 가장 큰 작업] 이 함수는 country==='us' 아니면 무조건
// 한국 세법(누진세+FTC)을 적용하는 이진 if/else 구조. 베트남처럼 3번째 국가를 추가하는 건
// 그냥 옵션 하나 늘리는 게 아니라, 그 나라가 해외 복권 당첨금을 어떻게 과세하는지
// (자체 세율표 구조, 미국과의 조세조약 여부, 원천징수 상계 방식 등)를 처음부터 리서치해서
// 완전히 새로운 계산 분기를 만들어야 함. 실제 세법 데이터 없이 구조부터 짜면 잘못된 형태로
// 미리 만들 위험이 있어 데이터가 확정되기 전까진 손대지 않기로 결정함 (2026년 7월).
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
      label2: isEn ? 'Korea additional tax (income + local, with FTC)' : '한국 추가 납부 (종합소득세+지방세, FTC 적용)',
      val2: koreaAdditionalNationalTaxWon > 0 ? '-' + koreaEffectivePct.toFixed(1) + '%' : (isEn ? '₩0 (offset by FTC)' : '0원 (FTC로 상계)'),
      basisSuffix: isEn ? 'Korea resident · Progressive income tax + Foreign Tax Credit applied' : '한국 거주자 · 종합소득세 누진세율 + 외국납부세액공제 반영'
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
    const formatted = decimals > 0
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
    animateCount(el, target, { prefix: '$' });
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

function checkHiddenMoney(){
  const checks = document.querySelectorAll('.refund-check-row input[type="checkbox"]');
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
  const titleEl = document.getElementById('refundStep2Title');
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
  titleEl.textContent = checkedCount === 0
    ? (isEnHm ? 'Go straight to the official application page' : '실제 신청 창구로 바로 이동하세요')
    : (isEnHm ? 'Based on what you checked, start here' : '체크하신 내용 기준으로 이 곳부터 확인해보세요');
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
    TX: '텍사스', FL: '플로리다', CA: '캘리포니아', WA: '워싱턴', NV: '네바다',
    NY: '뉴욕', NJ: '뉴저지', OR: '오리건', MN: '미네소타', MD: '메릴랜드',
  };
  const STATE_DISPLAY_NAMES_EN = {
    TX: 'Texas', FL: 'Florida', CA: 'California', WA: 'Washington', NV: 'Nevada',
    NY: 'New York', NJ: 'New Jersey', OR: 'Oregon', MN: 'Minnesota', MD: 'Maryland',
  };
  const NO_TAX_STATES = ['TX', 'FL', 'WA', 'NV'];
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
    const isEnDraw = (currentLang === 'en');
    if (drawDays.includes(todayDow)) return { label: isEnDraw ? '🚨 Drawing tonight!' : '🚨 오늘 밤 추첨!', urgent: true };
    let diff = 1;
    while (!drawDays.includes((todayDow + diff) % 7)) diff++;
    return { label: isEnDraw ? `Next draw in ${diff}d` : `다음 추첨 D-${diff}`, urgent: false };
  }
  const pb = nextDrawInfo([1,3,6]);
  const mg = nextDrawInfo([2,5]);
  const pbEl = document.getElementById('dday-powerball');
  const mgEl = document.getElementById('dday-mega');
  pbEl.textContent = pb.label;
  pbEl.classList.toggle('urgent', pb.urgent);
  mgEl.textContent = mg.label;
  mgEl.classList.toggle('urgent', mg.urgent);
}

// ============================================================================
// 🎟️ 오늘 잭팟 수동 업데이트 존 — 추첨(파워볼 월/수/토, 메가밀리언즈 화/금) 다음날
// 아래 값 4개(amountUsd, lastNumbers)만 공식 사이트 보고 고치면 30초로 끝납니다.
// checkedOn은 오늘 날짜(YYYY-MM-DD)로 바꿔주세요 — 화면의 "최근 확인" 문구에 그대로 씁니다.
// ============================================================================
const JACKPOT_DATA = {
  powerball:    { amountUsd: 1200000000, lastNumbers: '10·14·41·53·59 + PB 3',  checkedOn: '2026-07-04' },
  megamillions: { amountUsd: 450000000,  lastNumbers: '26·41·50·53·62 + MB 12', checkedOn: '2026-07-01' },
};

function applyJackpotData(){
  const isEnJp = (currentLang === 'en');
  document.getElementById('jp-powerball').setAttribute('data-target', JACKPOT_DATA.powerball.amountUsd);
  document.getElementById('jp-mega').setAttribute('data-target', JACKPOT_DATA.megamillions.amountUsd);
  document.getElementById('jp-powerball-lastnum').textContent = (isEnJp ? 'Last numbers: ' : '지난 당첨번호: ') + JACKPOT_DATA.powerball.lastNumbers;
  document.getElementById('jp-mega-lastnum').textContent = (isEnJp ? 'Last numbers: ' : '지난 당첨번호: ') + JACKPOT_DATA.megamillions.lastNumbers;

  const checkedDates = [JACKPOT_DATA.powerball.checkedOn, JACKPOT_DATA.megamillions.checkedOn].sort();
  const latest = checkedDates[checkedDates.length - 1];
  const [yyyy, mm, dd] = latest.split('-');
  document.getElementById('jp-update-time').textContent = isEnJp
    ? `🙋 Last checked: ${yyyy}.${mm}.${dd} (KST, updated manually) · Powerball Mon/Wed/Sat · Mega Millions Tue/Fri`
    : `🙋 최근 확인: ${yyyy}.${mm}.${dd} (한국 기준, 수동 업데이트) · 파워볼 월·수·토 / 메가밀리언즈 화·금 추첨`;

  // 패널을 펼치지 않은 상태에서도 "수동으로 업데이트된 정보"라는 걸 바로 알 수 있도록 접힌 summary 줄에도 같은 정보를 짧게 노출
  const summaryHint = document.getElementById('jp-summary-hint');
  if (summaryHint) {
    summaryHint.textContent = isEnJp
      ? ` · manually checked ${mm}.${dd}`
      : ` · ${mm}.${dd} 수동 확인`;
  }
}

const CASH_VALUE_RATIO = 0.58; // 일시불(lump sum)은 발표된 연금 기준 잭팟의 약 45~60% (현재가치 할인) — 중간값 사용, 화면 표시 문구와 일치

function initJackpotCardAmt(){
  const krw = getJackpotKRW();
  const isEnCard = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const 억 = isEnCard
    ? (n) => formatWonEn(n / 100000000)
    : (n) => (n / 100000000).toLocaleString('ko-KR') + '억원';
  document.getElementById('jackpot-card-amt').textContent = (isEnCard ? 'About ' : '약 ') + 억(krw * CASH_VALUE_RATIO);
  document.getElementById('jackpot-card-amt-note').textContent = isEnCard ? '(lump-sum, pre-tax)' : '(일시불 세전)';

  const pbUsd = Number(document.getElementById('jp-powerball').getAttribute('data-target'));
  const mgUsd = Number(document.getElementById('jp-mega').getAttribute('data-target'));
  document.getElementById('jp-powerball-krw').textContent = usdToKrwLabel(pbUsd);
  document.getElementById('jp-mega-krw').textContent = usdToKrwLabel(mgUsd);
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
      : (n) => (n / 100000000).toLocaleString('ko-KR') + '억원';
    const about = isEnJc ? 'About ' : '약 ';
    document.getElementById('jc-jackpot').textContent = about + 억(announcedKrw);
    document.getElementById('jc-cash').textContent = about + 억(cashKrw);
    document.getElementById('jc-final').textContent = about + formatWon(r.final);
    document.getElementById('jc-note-basis').textContent = isEnJc
      ? `Korea resident basis (${r.label1} ${r.val1} + ${r.label2} ${r.val2} assumed, rate ~${EXCHANGE_RATE.toLocaleString('en-US')} KRW, cash value ${(CASH_VALUE_RATIO*100).toFixed(0)}% applied)`
      : `한국 거주자 기준 (${r.label1} ${r.val1} + ${r.label2} ${r.val2} 가정, 환율 약 ${EXCHANGE_RATE.toLocaleString('ko-KR')}원, 현금가치 ${(CASH_VALUE_RATIO*100).toFixed(0)}% 적용)`;

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

function toggleJackpotCalc(){
  const box = document.getElementById('jackpot-calc-box');
  const isShowing = box.classList.toggle('show');
  if (isShowing) refreshJackpotDrawerIfOpen();
}

document.addEventListener('DOMContentLoaded', () => { applyJackpotData(); runCountUps(); updateHomeCalc(100000000); updateCalc(); initJackpotCardAmt(); updateDrawCountdown(); syncRateInputsDisplay(); fetchLiveExchangeRate(); });

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

function parseMillionsInput(str){
  // 소수점이 두 개 이상(예: "100.5.5") 들어오면, 뒤에 오는 숫자를 이어붙이지 않고 무시함.
  // "100.5.5"는 "100.5"를 치려다 마침표를 실수로 한 번 더 누른 경우일 가능성이 높아서,
  // 이걸 "100.55"로 이어붙여 해석하면 유저가 의도하지 않은 값이 될 수 있음
  const parts = str.replace(/[^0-9.]/g, '').split('.');
  const sanitized = parts.length > 1 ? parts[0] + '.' + parts[1] : parts[0];
  const n = Number(sanitized);
  return isNaN(n) ? 0 : n;
}

function parseRateInput(str){
  // 소수점을 지우면 "1,382.5" 같은 입력이 13825로 10배 뻥튀기되는 버그가 있었음(콤마와 마침표를
  // 구분 없이 한꺼번에 지워버렸기 때문) — parseMillionsInput과 동일하게 마침표는 보존하도록 수정
  const cleaned = str.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const sanitized = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
  const n = Number(sanitized);
  return isNaN(n) || n <= 0 ? EXCHANGE_RATE : n;
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

function onHomeSliderMoved(){
  const slider = document.getElementById('homeAmountSlider');
  slider.step = 10; // 유저가 슬라이더를 직접 조작하면 원래대로 10단위 스냅 복원
  const usdMillions = Number(slider.value);
  document.getElementById('homeAmountInput').value = usdMillions;
  updateHomeCalc(usdMillions * 1000000);
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

function updateFlexBox(finalEok){
  const wonAmount = finalEok * 100000000;
  const apt = Math.floor(wonAmount / 2500000000);
  const car = Math.floor(wonAmount / 350000000);
  const coffeeCups = Math.floor(wonAmount / 5000);
  const coffeeYears = Math.floor(coffeeCups / 3 / 365);
  const isEnFlex = (currentLang === 'en');
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
  if (isEnFlex) {
    document.getElementById('flex-capture').textContent = apt > 0
      ? `🏙️ At this result, you could sign the papers on ${apt.toLocaleString('en-US')} Gangnam apartments. Screenshot this 😉`
      : `🏙️ Try a bigger prize to see how many Gangnam apartments you could buy`;
  } else {
    document.getElementById('flex-capture').textContent = apt > 0
      ? `🏙️ 이 결과로 당첨되면 강남 아파트 ${apt.toLocaleString('ko-KR')}채 계약서 쓰러 갑니다. 미리 캡처해두세요 😉`
      : `🏙️ 당첨금 규모를 키워보면 강남 아파트도 몇 채 살 수 있는지 보여드려요`;
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

function pickDream(key){
  const data = DREAM_DATA[key];
  if (!data) return;
  const isEnDream = (currentLang === 'en');
  const finalAmt = document.getElementById('home-final-amt').textContent;
  document.getElementById('dream-title').textContent = data.emoji + ' ' + (isEnDream ? data.titleEn : data.title);
  document.getElementById('dream-desc').textContent = isEnDream ? data.descEn : data.desc;
  document.getElementById('dream-amt').textContent = isEnDream ? `The one taking home ${finalAmt}` : finalAmt + '의 주인공';
  const resultEl = document.getElementById('dream-result');
  resultEl.style.display = 'block';
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

function calcReverseJackpot(){
  const targetInput = document.getElementById('reverseTargetInput');
  const resultEl = document.getElementById('reverseCalcResult');
  const target억 = parseFloat(targetInput.value.replace(/[^0-9.]/g, ''));

  if (!target억 || target억 <= 0) {
    resultEl.style.display = 'block';
    resultEl.textContent = currentLang === 'en'
      ? 'Please enter a number for the amount you want to receive.'
      : '받고 싶은 금액을 숫자로 입력해주세요.';
    return;
  }

  const country = document.getElementById('homeCountrySelect').value;
  const stateCode = document.getElementById('homeStateSelect').value;

  // 세금 로직이 누진세율이라 단순 나눗셈이 안 됨 -> 이분 탐색으로 목표 실수령액에 맞는 당첨금(억원)을 찾음
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
  const requiredUsdM = (required억 * 100000000 / EXCHANGE_RATE) / 1000000;
  const usdText = requiredUsdM >= 1000 ? '$' + (requiredUsdM / 1000).toFixed(2) + 'B' : '$' + requiredUsdM.toFixed(0) + 'M';

  resultEl.style.display = 'block';
  resultEl.innerHTML = currentLang === 'en'
    ? `You\u2019d need to win about <b>${formatWon(required억)}</b> (roughly <b>${usdText}</b>) to take home <b>${formatWon(target억)}</b> after tax.`
    : `약 <b>${formatWon(required억)}</b> (달러로 약 <b>${usdText}</b>)에 당첨돼야, 세금 떼고 <b>${formatWon(target억)}</b>을 받을 수 있어요.`;
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
  const 억 = (usd * EXCHANGE_RATE) / 100000000;
  const r = calcTakeHome(억, country, stateCode);
  const { final, label1, val1, label2, val2, basisSuffix } = r;

  document.getElementById('home-krw-amt').textContent = formatWon(억);

  const trustLine = document.getElementById('home-trust-line');
  if (trustLine) {
    if (currentLang === 'en') {
      trustLine.textContent = exchangeRateIsLive
        ? `Live rate · ${exchangeRateSourceName ? exchangeRateSourceName.nameEn : 'source'}`
        : exchangeRateFetchFailed
          ? '⚠️ Couldn\u2019t fetch live rate — using default (as of 07.13)'
          : 'Default exchange rate (as of 07.13)';
    } else {
      trustLine.textContent = exchangeRateIsLive
        ? `실시간 환율 · ${exchangeRateSourceName ? exchangeRateSourceName.name : '출처 확인 중'}`
        : exchangeRateFetchFailed
          ? '⚠️ 실시간 환율 조회 실패 — 기본값(07.13 확인) 적용 중'
          : '환율 기본값(07.13 확인)';
    }
  }

  const compareCta = document.getElementById('home-compare-cta');
  if (compareCta) {
    if (currentLang === 'en') {
      compareCta.textContent = country === 'us' ? "🇰🇷 What if I lived in Korea? →" : "🇺🇸 What if I lived in the US? →";
    } else {
      compareCta.textContent = country === 'us' ? '🇰🇷 한국이면 얼마나 다를까? →' : '🇺🇸 미국이면 얼마나 다를까? →';
    }
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
  document.getElementById('home-tax1-label').textContent = label1;
  document.getElementById('home-tax1-val').textContent = val1;
  document.getElementById('home-tax2-label').textContent = label2;
  document.getElementById('home-tax2-val').textContent = val2;

  const taxImpactPct = 억 > 0 ? Math.round(100 - (final / 억 * 100)) : 0;
  document.getElementById('tax-impact-after').textContent = formatWon(final);
  document.getElementById('tax-impact-diff').textContent = '-' + formatWon(억 - final) + ` (${taxImpactPct}%)`;
  // 메인 숫자 바로 위에 취소선 그은 발표금액을 작게 병기 — "발표금액→실수령액" 낙차가
  // 결과 카드를 열어보지 않아도 첫눈에 느껴지도록 함(이 사이트의 핵심 임팩트 포인트)
  const announcedStrikeEl = document.getElementById('home-announced-strike');
  if (announcedStrikeEl) {
    announcedStrikeEl.textContent = (currentLang === 'en' ? 'Announced ' : '발표 ') + formatWon(억);
  }

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
}

function onCompareAmountTyped(){
  const millions = parseMillionsInput(document.getElementById('amountInput').value);
  updateCalc(millions * 1000000);
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
  { code: 'vn', flag: '🇻🇳', label: '베트남 거주자', labelEn: 'Vietnam resident', implemented: false, needsState: false },
];

function updateSideBySide(eok, stateCode){
  const isEn = (typeof currentLang !== 'undefined' && currentLang === 'en');
  const grid = document.getElementById('sideByCountryGrid');
  const breakdownContainer = document.getElementById('sideBreakdownContainer');
  if (!grid || !breakdownContainer) return;
  grid.innerHTML = '';
  breakdownContainer.innerHTML = '';

  COUNTRY_TAX_PROFILES.forEach(profile => {
    const baseLabel = profile.flag + ' ' + (isEn ? profile.labelEn : profile.label);

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
}

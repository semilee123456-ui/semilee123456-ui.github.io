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
  'nav.compare':   { en: 'Compare' , zh: '比较' },
  'nav.odds':      { en: 'Odds' , zh: '概率' },
  'nav.faq':       { en: 'FAQ' , zh: '常见问题' },
  'hero.tag':      { en: '🧮 US Lottery Tax Calculator' , zh: '🧮 美国彩票税金计算器' },
  'hero.title':    { en: 'how much would<br>you actually take home?' , zh: '我的账户里<br>实际能拿到多少？' },
  'intro.panelTitle': { en: '👋 Which one am I?' , zh: '👋 我是哪种情况？' },
  'intro.krLabel': { en: 'I live in Korea' , zh: '我住在韩国' },
  'intro.krAction': { en: 'Go straight to the calculator →' , zh: '直接去计算 →' },
  'intro.abroadLabel': { en: '✈️ I live abroad but I’m a Korean citizen' , zh: '✈️ 我住在国外，但持有韩国国籍' },
  'intro.abroadAction': { en: 'See your Korea tax duty →' , zh: '了解韩国纳税义务 →' },
  'intro.foreignerLabel': { en: '🌏 I’m a foreigner living in Korea' , zh: '🌏 我是住在韩国的外国人' },
  'intro.foreignerHint': { en: 'View in this language' , zh: '直接用这个语言查看' },
  'intro.realAbroadLabel': { en: '🌐 I’m a foreigner with no connection to Korea (US, China, etc.)' , zh: '🌐 我是与韩国没有关系的外国人（美国、中国等）' },
  'intro.realAbroadHint': { en: 'See it in my own country’s terms' , zh: '直接按我自己国家的标准查看' },
  'intro.realAbroadAction': { en: 'Or see the full country comparison →' , zh: '或查看完整的国家对比 →' },
  'result.label':      { en: '💰 Estimated take-home amount' , zh: '💰 预计实得金额' },
  'result.trustBadge': { en: 'Based on official IRS · Korea NTS data' , zh: '基于美国IRS·韩国国税厅官方数据' },
  'result.share':      { en: '📤 Share this result' , zh: '📤 分享这个结果' },
  'input.amountLabel': { en: 'Enter prize amount' , zh: '输入奖金金额' },
  'input.amountLabelFull': { en: 'Prize amount (pre-tax lump sum)' , zh: '奖金金额（税前一次性金额）' },
  'input.amountPlaceholder': { en: 'e.g. 100' , zh: '例：100' },
  'input.bridge': { en: '👇 The amount above is just an example — try entering your own' , zh: '👇 上面的金额只是示例——试着输入你自己的金额' },
  'input.orManualLabel': { en: 'Or enter an amount directly' , zh: '或直接输入金额' },
  'input.basisLabel':  { en: 'Tax basis' , zh: '计税基准' },
  'input.krwHint':     { en: '💡 The advertised jackpot isn\u2019t what you actually receive —' , zh: '💡 新闻里公布的奖金金额并不是你实际收到的——' },
  'input.krwHintFull': { en: 'Enter the actual lump-sum amount (about 45–60%) — not the jackpot number from the news' , zh: '请输入实际的一次性金额（约45~60%）——而不是新闻里的头奖金额' },
  'home.inputHint': { en: 'Enter your winnings directly' , zh: '请直接输入奖金金额' },
  'home.quickfillPowerball': { en: 'Powerball recent jackpot' , zh: '强力球最近头奖' },
  'home.quickfillMega': { en: 'Mega Millions recent jackpot' , zh: '超级百万最近头奖' },
  'input.optKorea':    { en: 'Korea basis' , zh: '韩国标准' },
  'input.optUS':       { en: 'US basis' , zh: '美国标准' },
  'input.optChina':    { en: 'China basis' , zh: '中国标准' },
  'input.basisHint':   { en: '💡 Pick the country whose tax law actually applies to you — if you live in Korea, just leave this as is' , zh: '💡 请按照实际需要缴税的国家选择 — 如果您住在韩国，保持默认即可' },
  'common.seeMore':    { en: 'See more' , zh: '查看更多' },
  'explore.title':      { en: '🧭 Curious about more?' , zh: '🧭 还想了解更多？' },
  'explore.compareLabel': { en: 'Country Compare' , zh: '国家比较' },
  'explore.compareSub':   { en: 'Where\u2019s better to live' , zh: '哪里生活更划算' },
  'explore.oddsLabel':    { en: 'Odds Sense' , zh: '概率体验' },
  'explore.oddsSub':      { en: 'Get a feel for the 1-in-292M odds' , zh: '感受一下1/2.92亿的概率' },
  'explore.faqLabel':     { en: 'FAQ' , zh: '常见问题' },
  'explore.faqSub':       { en: 'Taxes, refunds & more' , zh: '税金、退税等更多内容' },
  'common.backHome':   { en: '← Back to Home' , zh: '← 返回首页' },
  'common.home':       { en: 'Home' , zh: '首页' },
  'common.exchangeRate': { en: 'Rate' , zh: '汇率' },
  'common.won':        { en: 'KRW' , zh: '韩元' },
  'common.close':      { en: 'Close' , zh: '关闭' },
  'common.refreshRate': { en: 'Refresh exchange rate' , zh: '刷新汇率' },
  'common.adSlot':     { en: 'Ad Space (Google AdSense)' , zh: '广告位（Google AdSense）' },
  'compare.breadcrumb':  { en: 'Country Comparison' , zh: '国家比较' },
  'compare.panelTitle':  { en: 'Curious what actually lands in your pocket?' , zh: '好奇实际能揣进口袋多少钱？' },
  'compare.panelDesc':   { en: 'Type the prize amount or use the slider 👇' , zh: '输入奖金金额或拖动滑块 👇' },
  'compare.krwHint':     { en: '💡 Not the advertised annuity jackpot — enter the pre-tax lump-sum cash value.' , zh: '💡 不是新闻公布的年金头奖金额，请输入税前一次性现金金额' },
  'compare.selectHint':  { en: '💬 Your take-home amount depends on where you live' , zh: '💬 实得金额取决于你住在哪里' },
  'compare.stateLabel':  { en: 'State used for the US-resident calculation <span>(state tax ranges 0%~10.9%)</span>' , zh: '用于美国居民计算的州 <span>（州税从0%到10.9%不等）</span>' },
  'compare.filingLabel': { en: 'US resident filing status' , zh: '美国居民申报身份' },
  'compare.filingSmall': { en: '💬 For prizes this large, filing status (single/married) barely changes the result (bracket difference is under 0.1% of the total)' , zh: '💬 对于这么大金额的奖金，申报身份（单身/已婚）几乎不影响结果（税率级距差异不到总额的0.1%）' },
  'compare.filingRow':   { en: 'Single and Married Filing Jointly give nearly identical results, so no selection is needed' , zh: '单身和已婚联合申报的结果几乎相同，无需选择' },
  'compare.filingNote':  { en: '💡 Winners living outside the US are <b>subject to US nonresident withholding</b>, so there\u2019s no need to choose a filing status (Single/Married). (May vary by payout type or tax treaty.)' , zh: '💡 居住在美国以外的中奖者适用<b>美国非居民预扣税</b>，所以不需要另外选择申报身份（单身/已婚）。（可能因奖金支付方式或税收协定而有所不同）' },
  'compare.flowExplain': { en: 'The US withholds tax first, then Korea taxes the rest (with some credit available)' , zh: '美国先扣税，之后韩国对剩余部分征税（可抵免部分税款）' },
  'compare.sideTitle': { en: 'Korea vs. US, side by side' , zh: '韩国 vs 美国 对比' },
  'compare.otherLangTitle': { en: 'Living in Korea as a different nationality?' , zh: '住在韩国的其他国籍人士' },
  'compare.sideKRFlag': { en: '🇰🇷 Korea resident' , zh: '🇰🇷 韩国居民' },
  'compare.sideUSFlag': { en: '🇺🇸 US resident (average state tax)' , zh: '🇺🇸 美国居民（平均州税）' },
  'compare.sideRateLabel': { en: 'Take-home rate about' , zh: '实得比例约' },
  'compare.sideBreakdownTitle': { en: "Here's how the tax breaks down", zh: '税金是这样被扣除的' },
  'compare.sideFlowExplain': { en: '🇺🇸 The US withholds tax first, then 🇰🇷 Korea taxes the rest (with some credit available) — US residents only pay federal + state tax' , zh: '🇺🇸 美国先扣税，然后🇰🇷韩国对剩余部分征税（可抵免部分税款）——美国居民只需缴纳联邦税+州税' },
  'compare.sideUSFedLabel': { en: 'US Federal Tax' , zh: '美国联邦税' },
  'compare.sideUSStateLabel': { en: 'Average State Tax' , zh: '平均州税' },
  'compare.finalLabel':  { en: 'Final take-home amount' , zh: '最终实得金额' },
  'compare.simNote':     { en: '\ud83d\udca1 A reference calculation reflecting progressive Korean income tax and Foreign Tax Credit (FTC) \u2014 actual tax varies by situation, consult a tax professional.' , zh: '💡 反映韩国累进所得税和外国税收抵免（FTC）的参考计算——实际税额因个人情况而异，请咨询税务专业人士' },
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
  'compare.oddsHint':    { en: 'Curious? Try the <b>Odds Sense</b> menu too \u2192 it\u2019s pretty fun' , zh: '好奇的话，也可以试试<b>概率体验</b>菜单 → 也挺有意思的' },
  'compare.disclaimer':  { en: 'Built with reference to IRS and Korean NTS guidance (hope you get the chance to actually win!)' , zh: '参考IRS和韩国国税厅指引制作（希望你真的有机会中奖！）' },
  'state.AVG': { en: 'Average (example, 8%)' , zh: '平均值（示例，8%）' },
  'state.AL': { en: 'Alabama (5%)' , zh: '阿拉巴马州（5%）' },
  'state.AK': { en: 'Alaska (0%)' , zh: '阿拉斯加州（0%）' },
  'state.AZ': { en: 'Arizona (2.5%)' , zh: '亚利桑那州（2.5%）' },
  'state.AR': { en: 'Arkansas (3.9%)' , zh: '阿肯色州（3.9%）' },
  'state.CA': { en: 'California (lottery-exempt, 0%)' , zh: '加利福尼亚州（彩票免税，0%）' },
  'state.CO': { en: 'Colorado (4.4%)' , zh: '科罗拉多州（4.4%）' },
  'state.CT': { en: 'Connecticut (6.99%)' , zh: '康涅狄格州（6.99%）' },
  'state.DE': { en: 'Delaware (6.6%)' , zh: '特拉华州（6.6%）' },
  'state.FL': { en: 'Florida (0%)' , zh: '佛罗里达州（0%）' },
  'state.GA': { en: 'Georgia (5.39%)' , zh: '佐治亚州（5.39%）' },
  'state.HI': { en: 'Hawaii (11%)' , zh: '夏威夷州（11%）' },
  'state.ID': { en: 'Idaho (5.3%)' , zh: '爱达荷州（5.3%）' },
  'state.IL': { en: 'Illinois (4.95%)' , zh: '伊利诺伊州（4.95%）' },
  'state.IN': { en: 'Indiana (2.95%)' , zh: '印第安纳州（2.95%）' },
  'state.IA': { en: 'Iowa (3.8%)' , zh: '艾奥瓦州（3.8%）' },
  'state.KS': { en: 'Kansas (5.58%)' , zh: '堪萨斯州（5.58%）' },
  'state.KY': { en: 'Kentucky (3.5%)' , zh: '肯塔基州（3.5%）' },
  'state.LA': { en: 'Louisiana (3%)' , zh: '路易斯安那州（3%）' },
  'state.ME': { en: 'Maine (7.15%)' , zh: '缅因州（7.15%）' },
  'state.MD': { en: 'Maryland (8.95%, unconfirmed)' , zh: '马里兰州（8.95%，待确认）' },
  'state.MA': { en: 'Massachusetts (9%)' , zh: '马萨诸塞州（9%）' },
  'state.MI': { en: 'Michigan (4.25%)' , zh: '密歇根州（4.25%）' },
  'state.MN': { en: 'Minnesota (9.85%)' , zh: '明尼苏达州（9.85%）' },
  'state.MS': { en: 'Mississippi (4%)' , zh: '密西西比州（4%）' },
  'state.MO': { en: 'Missouri (4.7%)' , zh: '密苏里州（4.7%）' },
  'state.MT': { en: 'Montana (5.65%)' , zh: '蒙大拿州（5.65%）' },
  'state.NE': { en: 'Nebraska (4.55%)' , zh: '内布拉斯加州（4.55%）' },
  'state.NV': { en: 'Nevada (0%)' , zh: '内华达州（0%）' },
  'state.NH': { en: 'New Hampshire (0%)' , zh: '新罕布什尔州（0%）' },
  'state.NJ': { en: 'New Jersey (10.75%)' , zh: '新泽西州（10.75%）' },
  'state.NM': { en: 'New Mexico (5.9%)' , zh: '新墨西哥州（5.9%）' },
  'state.NY': { en: 'New York (10.9%)' , zh: '纽约州（10.9%）' },
  'state.NC': { en: 'North Carolina (3.99%)' , zh: '北卡罗来纳州（3.99%）' },
  'state.ND': { en: 'North Dakota (1.95%)' , zh: '北达科他州（1.95%）' },
  'state.OH': { en: 'Ohio (2.75%)' , zh: '俄亥俄州（2.75%）' },
  'state.OK': { en: 'Oklahoma (4.5%)' , zh: '俄克拉何马州（4.5%）' },
  'state.OR': { en: 'Oregon (9.9%)' , zh: '俄勒冈州（9.9%）' },
  'state.PA': { en: 'Pennsylvania (3.07%)' , zh: '宾夕法尼亚州（3.07%）' },
  'state.RI': { en: 'Rhode Island (5.99%)' , zh: '罗德岛州（5.99%）' },
  'state.SC': { en: 'South Carolina (6.2%)' , zh: '南卡罗来纳州（6.2%）' },
  'state.SD': { en: 'South Dakota (0%)' , zh: '南达科他州（0%）' },
  'state.TN': { en: 'Tennessee (0%)' , zh: '田纳西州（0%）' },
  'state.TX': { en: 'Texas (0%)' , zh: '得克萨斯州（0%）' },
  'state.UT': { en: 'Utah (4.55%)' , zh: '犹他州（4.55%）' },
  'state.VT': { en: 'Vermont (8.75%)' , zh: '佛蒙特州（8.75%）' },
  'state.VA': { en: 'Virginia (5.75%)' , zh: '弗吉尼亚州（5.75%）' },
  'state.WA': { en: 'Washington (0%)' , zh: '华盛顿州（0%）' },
  'state.DC': { en: 'Washington D.C. (10.75%)' , zh: '华盛顿特区（10.75%）' },
  'state.WV': { en: 'West Virginia (4.82%)' , zh: '西弗吉尼亚州（4.82%）' },
  'state.WI': { en: 'Wisconsin (7.65%)' , zh: '威斯康星州（7.65%）' },
  'state.WY': { en: 'Wyoming (0%)' , zh: '怀俄明州（0%）' },
  'odds.breadcrumb':  { en: 'Odds Sense Tool' },
  'odds.panelTitle':  { en: 'This probability doesn\u2019t really register, does it?' , zh: '这个概率，说实话没什么感觉吧？' },
  'odds.panelDesc':   { en: '1 in 292 million doesn\u2019t feel real. So we compared it to things that do.' , zh: '1/2.92亿这个数字，说实话没什么真实感。所以我们拿它跟一些更有真实感的东西比较了一下。' },
  'odds.barPowerball': { en: 'Powerball Jackpot' , zh: '强力球头奖' },
  'odds.barLightning': { en: 'Struck by lightning' , zh: '被闪电击中的概率' },
  'odds.barPlane':     { en: 'Plane crash' , zh: '飞机事故' },
  'odds.barShark':     { en: 'Shark attack' , zh: '被鲨鱼咬伤的概率' },
  'odds.oddsPowerball': { en: '1 / 292M' , zh: '1 / 2.92亿' },
  'odds.oddsLightning': { en: '1 / 15,000' , zh: '1 / 1.5万' },
  'odds.oddsPlane':     { en: '1 / 11M' , zh: '1 / 1100万' },
  'odds.oddsShark':     { en: '1 / 3.75M' , zh: '1 / 375万' },
  'odds.callout': { en: '💡 Winning the Powerball jackpot is about as likely as <b>getting struck by lightning 19,000 times in a row.</b> Yet several people still win every year 🍀' , zh: '💡 中强力球头奖的概率，大约相当于<b>连续被闪电击中19,000次。</b>不过每年仍有好几个人中奖 🍀' },
  'odds.winnersTitle': { en: '🏆 People really have won this much' , zh: '🏆 真的有人中过这么多钱' },
  'odds.winnersDesc':  { en: 'It does actually happen \u2014 here are some record-breaking real cases' , zh: '确实会发生 —— 这些是真实存在的历史级中奖案例' },
  'odds.historyTitle': { en: '📜 Past Jackpot Records' , zh: '📜 历史头奖查询记录' },
  'odds.historyDesc':  { en: 'Jackpot amounts we\u2019ve checked, with estimated take-home for both Korean and US residents (including the top 5 all-time records)' , zh: '记录了查询当天的头奖金额，以及韩国·美国居民标准下的实得金额（含历史最高5笔纪录）' },
  'odds.historyFullLink': { en: '📄 See the Top 5 all-time jackpots in detail →' , zh: '📄 查看历史最高头奖TOP5详情 →' },
  'odds.winner1Amt': { en: '$2.04 billion' , zh: '20.4亿美元' },
  'odds.winner1':    { en: 'November 2022, California \u2014 Edwin Castro, winner of the largest Powerball jackpot in history. He took the $997.6M lump sum and bought $25.5M and $47M houses back to back. Sued over a claim the ticket was stolen, he was confirmed the rightful owner in 2024, then in 2025 donated land to build homes for wildfire victims.' , zh: '2022年11月，加利福尼亚州——爱德温·卡斯特罗，历史最大强力球头奖得主。他选择一次性支付9.976亿美元，随后接连买下2550万和4700万美元的房子。曾被起诉称彩票是偷来的，但2024年被确认为合法所有者，2025年他还捐地为山火受灾者建房。' },
  'odds.winner2Amt': { en: '$758.7 million' , zh: '7.587亿美元' },
  'odds.winner2':    { en: 'August 2017, Massachusetts \u2014 Mavis Wanczyk quit her job at a hospital where she\u2019d worked for 32 years the moment she found out she\u2019d won. Once she became famous, though, dozens of fake accounts impersonating her popped up online, and police had to step in.' , zh: '2017年8月，马萨诸塞州——梅维斯·万奇克得知中奖的那一刻，立刻辞去了她干了32年的医院工作。可成名之后，网上冒出了几十个冒充她的假账号，警方不得不介入处理。' },
  'odds.winner3Amt': { en: '🍀 Anonymous winners' , zh: '🍀 匿名中奖者' },
  'odds.winner3':    { en: 'Some states let winners stay anonymous (Florida, Texas, Delaware, etc.). If you’d rather not end up like Castro or Wanczyk, this is the option many big winners choose.' , zh: '有些州允许中奖者匿名（佛罗里达、德克萨斯、特拉华等）。如果你不想像卡斯特罗或万奇克那样被曝光，很多大奖得主都会选择这个方式。' },
  'odds.lightningTitle': { en: '⚡ Today\u2019s Lightning Numbers' , zh: '⚡ 今日闪电抽号' },
  'odds.lightningDesc':  { en: 'Drawn just for fun, with today\u2019s "lightning" energy \u2014 6 random numbers' , zh: '借助你今天被闪电击中的运气，为你抽取6个号码，纯属娱乐' },
  'odds.drawBtn':  { en: '⚡⚡⚡ Draw numbers' , zh: '⚡⚡⚡ 抽取号码' },
  'odds.drawNote': { en: 'Your odds with these numbers are still 1 in 292 million \u2014 just for fun 😉' , zh: '用这些号码中奖的概率依然是1/2.92亿，纯属娱乐哦 😉' },
  'odds.payoutTitle': { en: 'How much do you win for each match?' , zh: '猜中几个能拿多少奖金？' },
  'odds.payoutDesc':  { en: 'Powerball prize tiers by numbers matched' , zh: '强力球各中奖等级对应的奖金' },
  'odds.megaNote':    { en: '💡 Mega Millions has different numbers and prizes — <a href="https://www.megamillions.com" target="_blank" rel="noopener noreferrer" style="color:var(--teal); font-weight:700; text-decoration:none;">check the official site →</a>' , zh: '💡 超级百万的号码和奖金体系不同 — <a href="https://www.megamillions.com" target="_blank" rel="noopener noreferrer" style="color:var(--teal); font-weight:700; text-decoration:none;">请查看官方网站 →</a>' },
  'odds.howtoTitle': { en: '🎱 First, how the game works' , zh: '🎱 首先，了解一下游戏规则' },
  'odds.howtoText':  { en: 'Powerball is a game of matching <b>5 regular numbers</b> (from 1\u201369) plus <b>1 Powerball number</b> (from 1\u201326) \u2014 6 numbers total. The prize depends on how many regular numbers you match, plus whether you match the Powerball.' , zh: '强力球是从<b>1~69中选5个普通号码</b> + <b>从1~26中选1个强力球号码</b>，总共猜中6个数字的游戏。根据猜中几个普通号码，以及是否猜中强力球号码，奖金会有所不同。' },
  'odds.jackpotTag':     { en: '🏆 Jackpot' , zh: '🏆 头奖' },
  'odds.jackpotMatch':   { en: '🎯 Match all 6 numbers' , zh: '🎯 6个数字全部猜中' },
  'odds.jackpotExplain': { en: 'Keeps growing until someone wins' , zh: '没有人中奖就会持续累积' },
  'odds.jcStep1': { en: '📢 Announced jackpot (annuity basis)' , zh: '📢 公布的头奖金额（年金基准）' },
  'odds.jcStep2': { en: '💰 Lump-sum option (present value, pre-tax, ~58%)' , zh: '💰 选择一次性支付时（现值，税前，约58%）' },
  'odds.jcStep3': { en: 'What actually lands in your hand after tax' , zh: '扣税后实际到手金额' },
  'odds.jcStep4': { en: '💡 What if you take the annuity instead of the lump sum?' , zh: '💡 如果选择年金（annuity）而不是一次性支付呢？' },
  'odds.jcAnnuityYear':    { en: '📅 30 payments, average per year (pre-tax)' , zh: '📅 分30次领取，税前年平均' },
  'odds.jcAnnuityYearNet': { en: 'What you actually get each year' , zh: '每年实际到手金额' },
  'odds.jcAnnuityMonth':   { en: '🗓️ Per month' , zh: '🗓️ 按每月计算' },
  'odds.jcAnnuityNote': { en: 'Unlike the discounted lump sum, an annuity pays out <b>the full announced jackpot</b> over 30 payments across 29 years (each payment grows 5% after the first). Spreading it out over years also spreads the tax burden \u2014 the amount above is a simple average, so the actual first payment is lower.' , zh: '与一次性支付（折现后的现值）不同，年金方式会在29年内分30次<b>足额领取公布的头奖总额</b>（首次之后每年递增5%）。因为不是一次性集中，税负也会分散——上面的金额是简单平均值，实际首次领取金额会比这个少。' },
  'odds.match5':      { en: 'Match 5 numbers' , zh: '猜中5个数字' },
  'odds.missedPB':    { en: 'Missed the Powerball' , zh: '强力球号码未中' },
  'odds.amt5':        { en: 'About \u20a91.5B' , zh: '约15亿韩元' },
  'odds.odds5':       { en: '1 / 11.69M' , zh: '1 / 1169万' },
  'odds.match4pb':    { en: 'Match 4 + Powerball' , zh: '猜中4个数字+强力球' },
  'odds.amt4pb':      { en: 'About \u20a975.2M' , zh: '约7500万韩元' },
  'odds.odds4pb':     { en: '1 / 910K' , zh: '1 / 91万' },
  'odds.match4':      { en: 'Match 4 numbers' , zh: '猜中4个数字' },
  'odds.amt4':        { en: 'About \u20a9150,000' , zh: '约15万韩元' },
  'odds.odds4':       { en: '1 / 36,525' , zh: '1 / 36525' },
  'odds.match3pb':    { en: 'Match 3 + Powerball' , zh: '猜中3个数字+强力球' },
  'odds.amt3pb':      { en: 'About \u20a9150,000' , zh: '约15万韩元' },
  'odds.odds3pb':     { en: '1 / 14,494' , zh: '1 / 14494' },
  'odds.matchPBonly': { en: 'Powerball number only' , zh: '只猜中强力球号码' },
  'odds.amtPBonly':   { en: 'About \u20a96,000' , zh: '约6000韩元' },
  'odds.oddsPBonly':  { en: '1 / 38' , zh: '1 / 38' },
  'odds.disclaimer': { en: 'Odds figures are based on official published data. KRW conversion uses a reference exchange rate and may differ from actual amounts.' , zh: '概率数值以官方公布资料为准。韩元换算采用参考汇率，可能与实际金额有所不同。' },
  'faq.breadcrumb':  { en: 'Frequently Asked Questions' },
  'faq.panelTitle':  { en: 'Questions people often ask' , zh: '大家都很好奇的问题' },
  'faq.panelDesc':   { en: 'Common questions from people who searched their way here · Confirmed based on National Tax Service consultations' , zh: '搜索到这里的朋友们经常问的问题 · 已通过韩国国税厅咨询确认' },
  'faq.basisNote':   { en: '💡 Showing only the questions relevant to the tax basis (Korea/US/China) you chose on the home screen' , zh: '💡 只显示与您在首页选择的计税基准（韩国·美国·中国）相关的问题' },
  'faq.searchPlaceholder': { en: '🔍 Search (e.g. tax, citizenship, Powerball)' , zh: '🔍 搜索（如：税金、国籍、强力球）' },
  'faq.catAll':      { en: 'All' , zh: '全部' },
  'faq.catTax':      { en: 'Tax & Double Taxation' , zh: '税金·双重征税' },
  'faq.catLife':     { en: 'Health, Pension & Gift Tax' , zh: '健康保险·年金·赠与税' },
  'faq.catRefund':   { en: 'Refunds & Deadlines' , zh: '退税·申领期限' },
  'faq.catPurchase': { en: 'Purchasing & Process' , zh: '购买·流程' },
  'faq.catGame':     { en: 'Game Info' , zh: '游戏信息' },
  'faq.noResult':    { en: 'No content.' , zh: '没有相关内容。' },
  'faq.q1': { en: 'How much tax is actually deducted? 😮' , zh: '税到底扣多少啊？😮' },
  'faq.a1': { en: 'US residents get 24% withheld upfront, settled up to 37% later. Non-US residents (including Korean and Chinese residents) generally face a 30% withholding rule.' , zh: '美国居民中奖时先预扣24%，之后最高结算至37%。包括韩国、中国居民在内的非美国居民，一般适用30%的预扣税规定。' },
  'faq.q2': { en: 'Wait, I pay tax in Korea too?' , zh: '啊，在韩国还要再交一次税？' },
  'faq.a2': { en: 'Yes. US lottery winnings aren\u2019t a domestic lottery, so they\u2019re combined into comprehensive income tax (up to 45%). Tax already paid in the US can offset via Foreign Tax Credit (FTC).' , zh: '是的。美国彩票不是韩国国内彩票，所以要计入综合所得税（最高45%）合并申报。已在美国缴纳的税款可以通过外国税收抵免（FTC）抵消。' },
  'faq.q3': { en: 'Can I get any of the tax back? 💸' , zh: '这税还能退回来一些吗？💸' },
  'faq.a3': { en: 'The 30% US federal withholding is practically non-refundable. State tax varies \u2014 Maryland and Arizona are unusual in taxing non-residents too. Pick your winning state below to check.' , zh: '美国联邦税（30%）基本上很难退回。州税（State Tax）因州而异——马里兰、亚利桑那比较特殊，即使不是当地居民也要交税。请在下方选择中奖的州查看。' },
  'faq.step': { en: 'STEP' , zh: 'STEP' },
  'faq.selectState': { en: 'Select the state you won in' , zh: '选择中奖的州' },
  'faq.selectStatePlaceholder': { en: 'Select the state you won in 👇' , zh: '选择中奖的州 👇' },
  'faq.wizardDefault': { en: 'Select a state to see your refund possibility instantly' , zh: '选择州之后，马上告诉您退税的可能性' },
  'faq.q4': { en: 'Will my health insurance premium spike if I win? 🏥' , zh: '中奖了健康保险费会不会暴涨？🏥' },
  'faq.a4': { en: 'Regional subscribers see winnings fully counted as income, raising premiums a lot. Employed subscribers pay extra premium above ₩20M/year in outside income too. If registered as a dependent, you may lose that status.' , zh: '地区加入者的话，中奖金额会100%计入收入，保险费可能大幅上涨。职场加入者若境外收入超过年2000万韩元，也要额外缴纳保险费。如果是被抚养人身份，可能会失去该资格。' },
  'faq.q5': { en: 'I\u2019m already receiving National Pension / Basic Pension \u2014 does this affect it? 👴' , zh: '我已经在领国民年金/基础年金了，会有影响吗？👴' },
  'faq.a5': { en: 'Depends on the program. National Pension \u2014 if already receiving it, the reduction rule applies to earned/business income, not a one-time windfall. Basic Pension / welfare benefits reassess eligibility by income and assets, so benefits could change. (Basic Pension is generally for Korean nationals only \u2014 foreign residents in Korea only need to check the National Pension reduction rule.)' , zh: '要看具体情况。国民年金（老龄年金）——如果已经在领取，减额制度适用于劳动/事业所得，不适用于一次性意外之财。基础年金/福利补贴会根据收入和财产重新评估资格，所以待遇可能会有变化。（基础年金原则上只适用于韩国国籍人士——在韩居住的外国人只需确认国民年金的减额规则即可。）' },
  'faq.q6': { en: 'How do I tell if a "you won" message is a scam? 🚨' , zh: '"你中奖了"这种联系，怎么判断是不是诈骗？🚨' },
  'faq.a6': { en: 'Common scam patterns: impersonating card companies asking for card info to "refund" a losing ticket, fake lottery commission asking for crypto purchases, or selling fake winning-number predictions. Real winnings are checked by you on the official site \u2014 unsolicited requests for money or info are 100% scams.' , zh: '常见的诈骗手法：冒充信用卡公司，以"退还未中奖彩票"为由索要卡号信息；冒充彩票委员会，要求用虚拟货币购买；出售虚假的预测中奖号码。真正的中奖信息是你自己在官方网站上查询确认的——凡是主动联系你索要钱财或信息的，100%是诈骗。' },
  'faq.q7': { en: 'How much gift tax if I share with family? 👨‍👩‍👧' , zh: '分给家人的话，赠与税要交多少？👨‍👩‍👧' },
  'faq.a7': { en: 'Spouse up to ₩600M, adult children up to ₩50M are tax-free. Amounts above that face a 10–50% progressive rate. Filing on time gets you a 3% credit.' , zh: '配偶6亿韩元、成年子女5000万韩元以内免税。超出部分适用10~50%的累进税率。在申报期限内自行申报可获得3%的税额抵免。' },
  'faq.q7us': { en: 'How much gift tax if I share with family? 👨‍👩‍👧' , zh: '分给家人的话，赠与税要交多少？👨‍👩‍👧' },
  'faq.a7us': { en: 'As of 2026, you can give up to $19,000 per person per year with no filing required at all. Give more than that, and you’ll need to file a gift tax return — but you still won’t actually owe any tax until your lifetime gifts pass the $15 million exemption. For almost everyone, that means you can share freely without worrying about gift tax.' , zh: '截至2026年，每人每年可赠与最多$19,000，完全无需申报。超过这个金额需要申报赠与税表，但实际需要缴税要等到您一生赠与总额超过1500万美元的终身免税额度才会发生。对绝大多数人来说，这意味着可以放心分享，不用担心赠与税。' },
  'faq.q7cn': { en: 'How much gift tax if I share with family? 👨‍👩‍👧' , zh: '分给家人的话，赠与税要交多少？👨‍👩‍👧' },
  'faq.a7cn': { en: 'China has no dedicated gift tax on cash gifts between individuals — you don’t need to worry about tax when giving cash to a spouse, parent, or child. Gifting real estate is a separate matter with its own taxes (like deed tax), so check that separately if it applies.' , zh: '中国对个人之间的现金赠与没有专门的赠与税——把现金分给配偶、父母或子女不需要担心税收问题。但赠与房产等不动产则涉及其他税种（如契税），需要另外确认。' },
  'faq.q8': { en: 'Is prize money subject to property division in a divorce? 💍' , zh: '中奖金，离婚时会被列入财产分割对象吗？💍' },
  'faq.a8': { en: 'In principle, no \u2014 courts treat it as personal property from pure luck. But if a spouse helped preserve or grow the money afterward, that contribution may be included.' , zh: '原则上不会——法院通常将其视为纯粹靠运气获得的个人"特有财产"，离婚时不列入财产分割对象。但如果配偶事后为保全或增值这笔钱做出了贡献，这部分贡献可能会被计入。' },
  'faq.q9': { en: 'By when do I have to claim the winnings? ⏰' , zh: '中奖金要在什么期限内领取？⏰' },
  'faq.deadlineBadge': { en: 'Has a deadline' , zh: '有期限' },
  'faq.a9': { en: 'Usually 90 days to 1 year. Miss it, and it reverts to the state \u2014 gone forever. One winner actually lost $138M by missing the deadline.' , zh: '通常是90天到1年之间。错过期限，奖金就会归属于该州，永远拿不回来了。曾有一位中奖者因错过期限，损失了1.38亿美元。' },
  'state.name.AL': { en: 'Alabama' , zh: '阿拉巴马' },
  'state.name.AK': { en: 'Alaska' , zh: '阿拉斯加' },
  'state.name.AZ': { en: 'Arizona' , zh: '亚利桑那' },
  'state.name.AR': { en: 'Arkansas' , zh: '阿肯色' },
  'state.name.CA': { en: 'California' , zh: '加利福尼亚' },
  'state.name.CO': { en: 'Colorado' , zh: '科罗拉多' },
  'state.name.CT': { en: 'Connecticut' , zh: '康涅狄格' },
  'state.name.DE': { en: 'Delaware' , zh: '特拉华' },
  'state.name.FL': { en: 'Florida' , zh: '佛罗里达' },
  'state.name.GA': { en: 'Georgia' , zh: '佐治亚' },
  'state.name.HI': { en: 'Hawaii' , zh: '夏威夷' },
  'state.name.ID': { en: 'Idaho' , zh: '爱达荷' },
  'state.name.IL': { en: 'Illinois' , zh: '伊利诺伊' },
  'state.name.IN': { en: 'Indiana' , zh: '印第安纳' },
  'state.name.IA': { en: 'Iowa' , zh: '艾奥瓦' },
  'state.name.KS': { en: 'Kansas' , zh: '堪萨斯' },
  'state.name.KY': { en: 'Kentucky' , zh: '肯塔基' },
  'state.name.LA': { en: 'Louisiana' , zh: '路易斯安那' },
  'state.name.ME': { en: 'Maine' , zh: '缅因' },
  'state.name.MD': { en: 'Maryland' , zh: '马里兰' },
  'state.name.MA': { en: 'Massachusetts' , zh: '马萨诸塞' },
  'state.name.MI': { en: 'Michigan' , zh: '密歇根' },
  'state.name.MN': { en: 'Minnesota' , zh: '明尼苏达' },
  'state.name.MS': { en: 'Mississippi' , zh: '密西西比' },
  'state.name.MO': { en: 'Missouri' , zh: '密苏里' },
  'state.name.MT': { en: 'Montana' , zh: '蒙大拿' },
  'state.name.NE': { en: 'Nebraska' , zh: '内布拉斯加' },
  'state.name.NV': { en: 'Nevada' , zh: '内华达' },
  'state.name.NH': { en: 'New Hampshire' , zh: '新罕布什尔' },
  'state.name.NJ': { en: 'New Jersey' , zh: '新泽西' },
  'state.name.NM': { en: 'New Mexico' , zh: '新墨西哥' },
  'state.name.NY': { en: 'New York' , zh: '纽约' },
  'state.name.NC': { en: 'North Carolina' , zh: '北卡罗来纳' },
  'state.name.ND': { en: 'North Dakota' , zh: '北达科他' },
  'state.name.OH': { en: 'Ohio' , zh: '俄亥俄' },
  'state.name.OK': { en: 'Oklahoma' , zh: '俄克拉何马' },
  'state.name.OR': { en: 'Oregon' , zh: '俄勒冈' },
  'state.name.PA': { en: 'Pennsylvania' , zh: '宾夕法尼亚' },
  'state.name.RI': { en: 'Rhode Island' , zh: '罗德岛' },
  'state.name.SC': { en: 'South Carolina' , zh: '南卡罗来纳' },
  'state.name.SD': { en: 'South Dakota' , zh: '南达科他' },
  'state.name.TN': { en: 'Tennessee' , zh: '田纳西' },
  'state.name.TX': { en: 'Texas' , zh: '得克萨斯' },
  'state.name.UT': { en: 'Utah' , zh: '犹他' },
  'state.name.VT': { en: 'Vermont' , zh: '佛蒙特' },
  'state.name.VA': { en: 'Virginia' , zh: '弗吉尼亚' },
  'state.name.WA': { en: 'Washington' , zh: '华盛顿' },
  'state.name.DC': { en: 'Washington D.C.' , zh: '华盛顿特区' },
  'state.name.WV': { en: 'West Virginia' , zh: '西弗吉尼亚' },
  'state.name.WI': { en: 'Wisconsin' , zh: '威斯康星' },
  'state.name.WY': { en: 'Wyoming' , zh: '怀俄明' },
  'faq.q10': { en: 'Aside from the lottery, might I have unclaimed money that\u2019s already mine?' , zh: '除了彩票，会不会还有本来就属于我、但没找回来的钱？' },
  'faq.a10': { en: 'Unlike the lottery, this is money already confirmed under your name — old tax refunds, forgotten bank accounts, unclaimed retirement plans, and more. Billions of dollars in unclaimed property sit unclaimed in the US every year. Check the list below.' , zh: '这和彩票不一样，这是已经确定归你所有的钱——比如以前的退税、被遗忘的银行账户、未领取的退休金账户等等。美国每年有数十亿美元的无人认领财产。可以查看下方列表。' },
  'faq.checklistTitle': { en: 'Check if any of these apply to you' , zh: '符合以下任意一项的话，可以确认一下' },
  'faq.check1': { en: 'Never claimed a state or federal tax refund you were actually owed' , zh: '最近5年内换过工作或离职' },
  'faq.check2': { en: 'Worked as a freelancer/contractor and might have skipped filing some year' , zh: '做过兼职·自由职业，但有的年份没有报税' },
  'faq.check3': { en: 'Left a job mid-year and never checked if you overpaid that year\u2019s taxes' , zh: '中途离职导致那一年没能进行年末汇算' },
  'faq.check4': { en: 'Might have missed deductions (medical, donations, etc.) in some year' , zh: '感觉有的年份漏报了医疗费·信用卡·捐赠等扣除项目' },
  'faq.check5': { en: 'Not sure where to even start \u2014 want a general starting point' , zh: '交过汽车税·财产税等地方税，但从没再核实过' },
  'faq.check6': { en: 'Have an old bank account, uncashed check, or insurance payout you forgot about' , zh: '以前用过的银行账户·保险，好几年没确认过了' },
  'faq.check7': { en: 'Changed jobs and never rolled over an old 401(k) or pension plan' , zh: '健康保险·国民年金资格发生过变化（换工作·离职等），但没确认过' },
  'faq.check8': { en: 'Own U.S. Savings Bonds that matured years ago and stopped earning interest' , zh: '信用卡积分好几年没用，就那么放着' },
  'faq.checkDefault': { en: 'If any apply, check for real below 👇' , zh: '如果有符合的项目，请在下方实际确认一下 👇' },
  'faq.recommend': { en: '⭐ Recommended' , zh: '⭐ 推荐' },
  'faq.linkHometax':   { en: 'IRS Refund<br>Status' , zh: '国税退税款<br>查找' },
  'faq.linkGov24':     { en: 'Unclaimed Money<br>Hub' , zh: '未退还款项<br>查询' },
  'faq.linkFine':      { en: 'Find Unclaimed<br>Property' , zh: '沉睡的我的钱<br>查找' },
  'faq.linkHealth':    { en: 'Old 401(k)/<br>Retirement Plans' , zh: '健康保险·年金<br>退款' },
  'faq.linkCardpoint': { en: 'Matured Savings<br>Bonds' , zh: '信用卡积分<br>统一查询' },
  'faq.checklistFooter': { en: 'We can\u2019t do the lookup for you \u2014 a couple of these (MissingMoney, USA.gov) just need your name, but others (IRS, retirement plans, savings bonds) will ask for your SSN, the same way Korean sites ask for your resident registration number. Either way, these are the real official channels. Takes about 10 minutes to check.' , zh: '我们没办法直接帮您查询（因为需要身份证号码认证的政府系统），不过已经为您直接连接到真正的官方渠道。大概10分钟就能确认完。' },
  'faq.shareChecklist': { en: '📤 Share this with a friend' , zh: '📤 分享给朋友' },
  'faq.q11': { en: 'Is it better to take it all at once, or in installments?' , zh: '是一次性领取好，还是分期领取好？' },
  'faq.a11': { en: 'The announced jackpot is the annuity total — lump sum is about 45–60% of that. Most winners choose lump sum — check the <button type="button" class="inline-link-btn" onclick="goToAnnuityInfo()">jackpot calculator under Odds</button> for a detailed comparison.' , zh: '公布的头奖金额是年金总额——一次性支付大约是这个金额的45~60%。大多数中奖者会选择一次性支付——详细比较请看<button type="button" class="inline-link-btn" onclick="goToAnnuityInfo()">"概率体验"里的头奖计算器</button>。' },
  'faq.q12': { en: 'Where can I buy a US lottery ticket?' , zh: '美国彩票在哪里能买到？' },
  'faq.a12': { en: 'Sold at convenience stores and gas stations in the US. Domestic purchase-agent services carry legal risk, so we don\u2019t refer them.' , zh: '在美国当地的便利店、加油站等地有售。国内的代购服务存在法律风险，我们不做相关介绍。' },
  'faq.q13': { en: 'What if a friend buys a ticket for me, or claims the prize on my behalf?' , zh: '如果朋友帮我买了彩票，或者代我领奖，会怎么样？' },
  'faq.a13': { en: 'Even a friend buying it personally creates complications. Ownership is usually determined by who signs to claim it. If they claim as a US resident, their tax rate applies, and transferring the money could trigger US gift tax on their end, plus gift tax rules in whichever country you live in.' , zh: '即使是朋友私下帮忙购买，也会产生复杂的问题。所有权通常取决于谁签字领奖。如果对方以美国居民身份领奖，适用的就是对方的税率，之后把钱转给你，可能会触发美国的赠与税，以及你所在国家的赠与税规定。' },
  'faq.q14': { en: 'Where can I check past winning numbers?' , zh: '之前的中奖号码在哪里查？' },
  'faq.a14b': { en: 'We show recent numbers on our home screen, but the official sites are the most accurate source.' , zh: '我们首页也会显示最近的开奖号码，但最准确的还是官方网站。' },
  'faq.linkPowerball': { en: '🔗 Powerball official site →' , zh: '🔗 强力球官方网站 →' },
  'faq.linkMega':      { en: '🔗 Mega Millions official site →' , zh: '🔗 超级百万官方网站 →' },
  'faq.q15': { en: 'Can I claim winnings without US citizenship?' , zh: '没有美国国籍也能领奖吗？' },
  'faq.a15': { en: 'Yes, foreigners who legally bought a ticket can claim. Non-resident aliens face the 30% withholding though.' , zh: '可以，合法购买彩票的外国人也能领奖。不过非居民外国人需要缴纳30%的预扣税。' },
  'faq.q16': { en: 'I\u2019m a Korean living in the US \u2014 which option should I choose? (students, expats, green card, citizens)' , zh: '我是住在美国的韩国人，应该选哪个选项？（留学生·常驻员工·绿卡·公民）' },
  'faq.a16': { en: '\u201cLiving in the US\u201d and \u201cUS tax resident\u201d can differ. Green card/citizenship holders should pick \u201cUS.\u201d Students or early-stage expats may still be non-resident aliens, making \u201cKorea (non-resident)\u201d more accurate. Consult a US tax pro if unsure.' , zh: '"住在美国"和"美国税法上的居民"可能是两回事。绿卡持有者、公民，以及长期居住的常驻员工可以选择"美国"；留学生或刚派驻不久的员工可能仍是非居民外国人，选择"韩国（非居民）"会更准确。如果不确定，请咨询美国税务专业人士。' },
  'faq.q17': { en: 'What is the "filing status (single/married)" option in the calculator?' , zh: '计算器里的"申报状态（单身/已婚）"选项是什么？' },
  'faq.a17': { en: 'US filing status affects tax brackets, but for lottery-size amounts it barely matters \u2014 the difference between single and joint top brackets is a rounding error.' , zh: '美国报税时申报状态会影响税率区间，但对彩票这种大金额来说几乎没有影响——单身和已婚联合申报最高税率区间的差异，几乎可以忽略不计。' },
  'faq.q18': { en: 'What actually happens, step by step, if I win?' , zh: '真的中奖了的话，具体要经过哪些步骤？' },
  'faq.a18': { en: 'It’s a 6-step process: buy in the US → confirm the win → claim it. See the full breakdown under <b>A closer look at the purchase process</b> below.' , zh: '一共分6个步骤：在美国购买 → 确认中奖 → 领奖。详细说明请看下方<b>"购买流程，仔细了解一下"</b>部分。' },
  'faq.q19': { en: 'How do I file these taxes?' , zh: '这个税到底该怎么申报？' },
  'faq.a19': { en: 'The US withholds 30% first; in Korea you report it as other income the following May. Tax paid in the US can offset via FTC. Consult a tax pro handling both countries.' , zh: '美国会先预扣30%；在韩国，需要在第二年5月作为其他所得申报。已在美国缴纳的税款可以通过外国税收抵免（FTC）抵消。请咨询同时熟悉两国税务的专业人士。' },
  'faq.q19us': { en: 'How do I file these taxes?' , zh: '这个税到底该怎么申报？' },
  'faq.a19us': { en: 'As a US resident, you report the winnings as "Other Income" on your federal return (Form 1040, Schedule 1). For large amounts you’ll typically get a W-2G showing 24% withheld upfront — that’s just a down payment against your actual tax rate (up to 37%), so you may owe more or get some back when you file. Depending on the state, you may also need to file a separate state return.' , zh: '作为美国居民，您需要在联邦报税表（Form 1040，Schedule 1）中将中奖金作为"其他收入"申报。大额奖金通常会收到W-2G表格，上面显示已预扣24%——这只是预付款，和您的实际税率（最高37%）可能有差异，报税时可能需要补税或退税。根据所在州的不同，可能还需要单独申报州税。' },
  'faq.q19cn': { en: 'How do I file these taxes?' , zh: '这个税到底该怎么申报？' },
  'faq.a19cn': { en: 'The US withholds 30% first. In China, this income is classified as "incidental income" (偶然所得) taxed at a flat 20%, which you self-report between March 1 and June 30 of the following year via the "个人所得税" app or the natural person e-tax portal (per MOF/STA Announcement No. 3 of 2020). Tax already paid in the US can offset this through the foreign tax credit.' , zh: '美国会先预扣30%。在中国，这笔所得属于"偶然所得"，适用20%的单一税率，需要在次年3月1日至6月30日期间通过"个人所得税"App或自然人电子税务局自行申报（根据财政部税务总局公告2020年第3号）。已在美国缴纳的税款可以通过境外税收抵免来抵消。' },
  'faq.q20': { en: 'How do I claim the Foreign Tax Credit (FTC)? What documents do I need?' , zh: '外国税收抵免（FTC）要怎么申请？需要哪些材料？' },
  'faq.a20': { en: 'To offset the US tax (30% withholding) against your Korean income tax filing, based on a July 2026 National Tax Service phone consultation you’ll need: <b>a certificate of tax payment issued by the foreign (US) government, a payment receipt, a withholding tax receipt, and proof of the prize itself</b>. The exchange rate used is <b>the rate on the day you actually received the prize money</b> (per Enforcement Decree of the Income Tax Act, Article 50). This isn’t an official written ruling, so confirm the exact document list with a tax professional before filing.' , zh: '要在韩国综合所得税申报时抵免已在美国缴纳的税款（30%预扣税），根据2026年7月国税厅电话咨询的答复，需要准备：<b>外国政府（美国）出具的纳税事实证明、缴税收据、预扣税收据，以及中奖事实证明材料</b>。适用的汇率是<b>实际收到奖金当天的汇率</b>（根据《所得税法施行令》第50条）。这不是正式的书面解释，请在申报前与税务师再次确认具体材料清单。' },
  'faq.moreTitle':  { en: '📚 Learn more (terms, purchase process, payout methods, etc.)' , zh: '📚 深入了解（术语·购买流程·支付方式等）' },
  'faq.termsTitle': { en: 'Let\u2019s start with the basic terms' , zh: '先从基本术语了解一下吧' },
  'faq.termsDesc':  { en: 'The part people mix up the most \u2014 here\u2019s a side-by-side comparison of the two games' , zh: '大家最容易搞混的部分——把两款游戏放在一起比较了一下' },
  'faq.gamePowerball':  { en: '🔴 Powerball' , zh: '🔴 强力球' },
  'faq.gamePrice':      { en: 'Price' , zh: '价格' },
  'faq.gameDrawDay':    { en: 'Draw days' , zh: '开奖日' },
  'faq.gameNumFormat':  { en: 'Number format' , zh: '选号方式' },
  'faq.pbDrawDays':     { en: 'Mon, Wed, Sat' , zh: '周一·周三·周六' },
  'faq.pbNumFormat':    { en: '5 of 1\u201369<br>+ 1 of 1\u201326' , zh: '1~69中选5个<br>+ 1~26中选1个' },
  'faq.gameOdds':    { en: 'Jackpot odds' , zh: '头奖概率' },
  'faq.gameMega':    { en: '🟡 Mega Millions' , zh: '🟡 超级百万' },
  'faq.multiplierOption': { en: '(includes Megaplier option)' , zh: '（含倍数选项 Megaplier）' },
  'faq.mgDrawDays':  { en: 'Tue, Fri' , zh: '周二·周五' },
  'faq.mgNumFormat': { en: '5 of 1\u201370<br>+ 1 of 1\u201324' , zh: '1~70中选5个<br>+ 1~24中选1个' },
  'faq.mgOdds':      { en: '1 / 290.47M' , zh: '1 / 2.9047亿' },
  'faq.samePlace': { en: '📍 Where to buy: <b>Same place!</b> Both are sold at the same convenience stores and gas stations' , zh: '📍 购买地点：<b>一样！</b>两款游戏都在同样的便利店、加油站有售' },
  'faq.sameStoreCallout': { en: '\ud83d\udca1 Many wonder "where do I buy Powerball vs Mega Millions?" \u2014 they\u2019re actually sold at the same stores. Just tell the cashier which game you want.' , zh: '💡 很多人好奇"强力球和超级百万要去不同的地方买吗？"——其实是在同一家店买的。只要告诉店员你想买哪款游戏就行。' },
  'faq.otherGamesNote': { en: 'Note: there\u2019s also Millionaire for Life, Lotto America, and state-specific lotteries, but only these two make Korean news, so that\u2019s our focus.' , zh: '参考：除了这两款，还有"终身百万富翁"、"美国乐透"等联合多州游戏，各州也有自己的彩票，但在韩国只有这两款游戏会成为话题，所以本网站只介绍这两款。' },
  'faq.trivia': { en: 'Trivia you don\u2019t need to know this month: Millionaire for Life replaced the previous "Lucky for Life" and "Cash4Life," which ended and merged on February 21, 2026.' , zh: '这个月不知道也没关系的冷知识：终身百万富翁取代了之前的"Lucky for Life"和"Cash4Life"，这两款游戏已于2026年2月21日结束并合并。' },
  'faq.taxGuideTitle': { en: 'The tax basics, in a nutshell' , zh: '税务指南，知道这些就够了' },
  'faq.tg1Title': { en: 'How is US tax calculated?' , zh: '美国的税是怎么算的？' },
  'faq.tg1Sub':   { en: 'Federal 24\u201337% + 30% nonresident withholding' , zh: '联邦税24~37% + 非居民预扣税30%' },
  'faq.tg3Title': { en: 'Lump sum vs. annuity \u2014 what\u2019s the difference?' , zh: '一次性支付 vs 年金，有什么区别？' },
  'faq.tg3Sub':   { en: 'Different tax brackets apply, so total tax owed can differ' , zh: '适用的税率区间不同，总税额可能有差异' },
  'faq.purchaseGuideTitle': { en: 'A closer look at the purchase process' , zh: '购买流程，仔细了解一下' },
  'faq.purchaseGuideDesc':  { en: 'A step-by-step guide for first-timers' , zh: '为完全第一次尝试的朋友准备的流程说明' },
  'faq.gateLabel': { en: '⚠️ Prerequisite' , zh: '⚠️ 前提条件' },
  'faq.gateText':  { en: 'You need to actually be in the US<br>(travel, business trip, studying abroad, etc.)' , zh: '需要人实际在美国<br>（旅行、出差、留学等）' },
  'faq.gateSub':   { en: 'There\u2019s no legal way to buy remotely from Korea' , zh: '没有能在韩国远程购买的合法方式' },
  'faq.step1Title':  { en: 'Find a retailer' , zh: '寻找销售点' },
  'faq.step1Detail': { en: 'Any convenience store, gas station, or supermarket with a \u2018Lottery\u2019 sign works' , zh: '任何挂有"Lottery"标志的便利店、加油站、超市都可以' },
  'faq.ticketTitle': { en: '🎫 What the ticket looks like' , zh: '🎫 彩票长这样' },
  'faq.ticketMeta':  { en: 'Draw date: MON JUL 06 2026  |  QP (Quick Pick)  |  $2.00' , zh: '开奖日：MON JUL 06 2026  |  QP（快选）  |  $2.00' },
  'faq.ticketDetail': { en: 'The front shows <b>your chosen numbers (or Quick Pick random numbers), the draw date, price, and a scannable barcode</b>. That barcode is essential for verifying a win later \u2014 keep it safe!' , zh: '正面印有<b>你选的号码（或快选随机号码）、开奖日期、价格，以及用于扫描的条形码</b>。这个条形码是之后确认中奖的关键——请务必妥善保管！' },
  'faq.step2FlowTitle':  { en: 'Pay' , zh: '付款' },
  'faq.step2FlowDetail': { en: 'Usually $2\u2013$5 per ticket. You pay right at the counter.' , zh: '一张通常$2~$5左右，当场直接付款。' },
  'faq.tagCash':      { en: '✓ Cash accepted' , zh: '✓ 可用现金' },
  'faq.tagCard':      { en: '✓ Card accepted' , zh: '✓ 可用信用卡' },
  'faq.tagNoInstall': { en: '✗ No installment payments' , zh: '✗ 不能分期付款' },
  'faq.phraseTitle': { en: '🗣️ Useful phrases even if you don\u2019t speak English' , zh: '🗣️ 不会说英语也没关系，记住这几句就行' },
  'faq.phrase1': { en: 'One Powerball, quick pick, please' , zh: 'One Powerball, quick pick, please（给我一张强力球，电脑随机选号）' },
  'faq.phrase2': { en: 'One Mega Millions, please' , zh: 'One Mega Millions, please（给我一张超级百万）' },
  'faq.phrase3': { en: 'Cash / Card, please' , zh: 'Cash / Card, please（现金/刷卡）' },
  'faq.phraseTip': { en: '\ud83d\udca1 Just say "quick pick" and the computer picks random numbers \u2014 most people buy this way!' , zh: '💡 只要说"quick pick"，电脑就会随机帮你选号——大部分人都是这样买的！' },
  'faq.playslipTitle': { en: '✏️ Want to pick your own numbers? (How to fill out a play slip)' , zh: '✏️ 想自己选号码？（投注单填写方法）' },
  'faq.psRegular':   { en: '5 regular numbers (1\u201369)' , zh: '5个普通号码（1~69）' },
  'faq.psPowerball': { en: '1 Powerball number (1\u201326)' , zh: '1个强力球号码（1~26）' },
  'faq.psStep1': { en: 'Grab a <b>free play slip</b> from the store, and fill in bubbles with a black or blue pen (or pencil) \u2014 <b>fill the circles solidly</b> (red pen won\u2019t scan)' , zh: '在店里拿一张<b>免费投注单</b>，用黑色或蓝色的笔（或铅笔）填涂圆圈——<b>要涂实</b>（红笔无法识别）' },
  'faq.psStep2': { en: 'You can pick some numbers yourself and mark <b>QP (Quick Pick)</b> for the rest \u2014 only those get filled randomly' , zh: '你可以自己选一部分号码，剩下的标记<b>QP（快选）</b>——只有这部分会随机填号' },
  'faq.psStep3': { en: 'If you make a mistake, don\u2019t erase \u2014 mark the <b>VOID</b> box and fill in the next row' , zh: '如果填错了，不要涂改——请标记<b>VOID（作废）</b>栏，然后在下一行重新填写' },
  'faq.psStep4': { en: 'Hand the completed slip to <b>the cashier</b>, who scans it on the spot to turn it into a real ticket (the slip itself isn\u2019t a ticket!)' , zh: '把填好的投注单交给<b>收银员</b>，当场扫描后就会变成正式彩票（投注单本身不是彩票！）' },
  'faq.signBackNote': { en: '💡 If you win, <b>sign the back of the ticket immediately</b> \u2014 this is an important step to prove ownership if lost' , zh: '💡 中奖的话，<b>请立刻在彩票背面签名</b>——这是万一遗失时证明所有权的重要步骤' },
  'faq.step3Title':  { en: 'Age verification' , zh: '年龄确认' },
  'faq.step3Detail': { en: 'Most states require you to be <b>18 or older</b> (some require 21). You can buy regardless of nationality.' , zh: '大多数州要求<b>年满18岁</b>（部分州要求21岁）。国籍不限，都可以购买。' },
  'faq.step4Title':  { en: '📢 Want to check past winning numbers?' , zh: '📢 想查以前的中奖号码？' },
  'faq.step4Detail': { en: 'You can check winning numbers directly on the official sites.' , zh: '可以直接在官方网站查询中奖号码。' },
  'faq.newTabNote':  { en: '(opens in a new tab)' , zh: '（在新标签页打开）' },
  'faq.checkWinTitle': { en: '💡 Here\u2019s how to check if your ticket won' , zh: '💡 这样确认你的彩票是否中奖' },
  'faq.checkMethod1': { en: '<b>Compare the numbers yourself</b> \u2014 the most reliable method' , zh: '<b>亲自对比号码</b>——最可靠的方法' },
  'faq.checkMethod2': { en: 'Scan the barcode with the state lottery\u2019s official app' , zh: '用该州彩票官方App扫描条形码' },
  'faq.checkMethod3': { en: 'Use the store\u2019s self-service scanner or ask staff' , zh: '使用店内自助扫描仪，或请店员帮忙' },
  'faq.step5Title':  { en: 'If you won, claim it' , zh: '中奖了的话，去领奖' },
  'faq.step5Detail': { en: 'Visit the <b>lottery office for that state</b> in person with your ID and ticket. The deadline is usually <b>180 days to 1 year</b>' , zh: '需携带身份证件和彩票，亲自前往<b>该州的彩票办公室</b>。期限通常是<b>180天到1年</b>' },
  'faq.step6Title':  { en: 'Lump sum or annuity? You must choose when claiming' , zh: '一次性支付？年金？领奖时必须选择' },
  'faq.step6Detail': { en: 'After claiming, you usually have <b>60 days</b> to choose one or the other. If you don\u2019t choose in time, it defaults to the annuity.' , zh: '领奖后通常有<b>60天</b>时间可以二选一。如果没有在期限内做出选择，会自动按年金方式支付。' },
  'faq.lumpSumTitle':  { en: '💵 Lump Sum' , zh: '💵 一次性支付' },
  'faq.lumpSumDetail': { en: 'Receive about <b>45\u201360%</b> of the announced amount all at once. The option most winners choose' , zh: '一次性领取公布金额的<b>约45~60%</b>。大多数中奖者会选择这个方式' },
  'faq.annuityTitle':  { en: '📅 Annuity' , zh: '📅 年金' },
  'faq.annuityDetail': { en: 'Full announced amount paid over 29 years in 30 installments (first immediate, +5%/year after)' , zh: '公布金额在29年内分30次全额支付（首次立即支付，之后每年+5%）' },
  'faq.payoutIrreversible': { en: 'This choice is irreversible \u2014 decide only after consulting a tax/financial professional' , zh: '这个选择无法撤回——请务必咨询税务/财务专业人士后再决定' },
  'faq.sixStepsNote': { en: 'That\u2019s all 6 steps. The key point is that if step 1 (the prerequisite) isn\u2019t met, none of the later steps apply to you.' , zh: '这6个步骤就是全部了。关键在于，如果第1步（前提条件）不满足，后面的步骤对你来说就都不成立。' },
  'faq.payMethodTitle': { en: 'Do you get paid in cash or by bank transfer?' , zh: '中奖金是给现金，还是打到账户？' },
  'faq.payMethodDesc':  { en: 'Completely different depending on the amount' , zh: '根据金额完全不同' },
  'faq.small600':       { en: '💵 $600 or less' , zh: '💵 $600以下小额' },
  'faq.small600Detail': { en: 'You can get <b>cash</b> right on the spot at the store where you bought the ticket.' , zh: '可以在购买彩票的便利店当场领取<b>现金</b>。' },
  'faq.largeAmt':       { en: '🏦 Large amounts (hundreds of thousands to millions of dollars)' , zh: '🏦 大额（数十万~数百万美元）' },
  'faq.largeAmtDetail': { en: 'Not paid in cash. Paid by check or bank transfer, usually taking 6\u20138 weeks.' , zh: '不会给现金。会通过<b>支票或银行账户转账</b>支付，处理通常需要<b>6~8周</b>。' },
  'faq.krResident':       { en: 'If you\u2019re a Korea resident?' , zh: '如果是韩国居民呢？' },
  'faq.krResidentDetail': { en: 'There\u2019s no clearly published official process. If this happens, proceed together with the lottery office, a bank capable of international transfer, and a tax/legal professional.' , zh: '目前没有公开明确的官方流程。如果遇到这种情况，建议与<b>该州彩票办公室、能办理国际汇款的银行、税务/法律专业人士</b>一起处理。' },
  'faq.howManyTitle': { en: 'How many tickets can I buy at once?' , zh: '一次最多能买几张？' },
  'faq.howManyDesc':  { en: 'Actually two different questions mixed together' , zh: '其实这里混合了两个不同的问题' },
  'faq.multiTicketQ': { en: 'Q. Can I buy multiple tickets at once?' , zh: 'Q. 可以一次买好几张吗？' },
  'faq.multiTicketA': { en: 'Yes, no legal limit. A play slip usually allows up to 5 games per slip.' , zh: '可以，法律上没有限制。一张投注单通常最多可以填5个游戏。' },
  'faq.multiDrawQ': { en: 'Q. Can I enter the same numbers into multiple future drawings at once?' , zh: 'Q. 可以用同一组号码一次性投注多期吗？' },
  'faq.multiDrawA': { en: 'Yes, via \u2018multi-draw\u2019 \u2014 usually 10\u201326 draws at once depending on the state.' , zh: '可以，这叫"多期投注（Multi-draw）"。同一组号码<b>根据州的不同，通常可以一次投注10~26期</b>。' },
  'faq.noRefundNote': { en: 'Note: tickets can\u2019t be refunded or canceled once purchased (all sales are final)' , zh: '提示：彩票一旦购买不能退款或取消（all sales are final）' },
  'faq.finalDisclaimer': { en: 'If you have any other questions, feel free to reach out via Contact!' , zh: '还有其他疑问的话，欢迎随时通过"联系我们"告诉我们！' },
  'privacy.breadcrumb':    { en: 'Privacy Policy' , zh: '隐私政策' },
  'privacy.title':         { en: 'Privacy Policy' , zh: '隐私政策' },
  'privacy.effectiveDate': { en: 'Effective date: July 9, 2026' , zh: '生效日期：2026年7月9日' },
  'disclaimer.effectiveDate': { en: 'Effective date: July 9, 2026' , zh: '生效日期：2026年7月9日' },
  'privacy.h1': { en: '1. Personal information collected' , zh: '1. 收集的个人信息项目' },
  'privacy.b1': { en: 'ChamTax (the "Site") does <b>not store calculator input values (prize amount, country of residence, exchange rate, etc.) on any server.</b> All calculations happen only within the visitor\u2019s browser and disappear when you leave the page.<br>However, if you contact us via "Contact," we collect only the <b>email address and message content</b> you provide.', zh: 'ChamTax（以下简称"本网站"）<b>不会将计算器输入内容（奖金金额、居住国、汇率等）保存在服务器上。</b>所有计算仅在访问者的浏览器内处理，离开页面后即消失。<br>但如果您通过"联系我们"与我们联系，我们只会收集您填写的<b>邮箱地址和咨询内容</b>。' },
  'privacy.h2': { en: '2. Purpose of collection' , zh: '2. 收集目的' },
  'privacy.b2': { en: 'Used only to review and respond to inquiries \u2014 never for marketing or other purposes.' , zh: '仅用于确认和回复咨询内容，不会用于营销或其他用途。' },
  'privacy.h3': { en: '3. Retention period' , zh: '3. 保留和使用期限' },
  'privacy.b3': { en: 'Retained for up to 1 year after the inquiry is resolved, then promptly destroyed.' , zh: '咨询处理完成后最多保留1年，此后将立即销毁。' },
  'privacy.h4': { en: '4. Sharing with third parties' , zh: '4. 向第三方提供' },
  'privacy.b4': { en: 'We do not share collected personal information with third parties. However, ads displayed on the site (Google AdSense) may independently collect visit information via cookies through Google, which is handled under Google\u2019s privacy policy, not this site\u2019s.' , zh: '我们不会将收集的个人信息提供给第三方。但网站上展示的广告（Google AdSense）中，Google可能会通过自己的Cookie收集访问信息，这部分内容依据的是Google的隐私政策，而非本网站的政策。' },
  'privacy.h5': { en: '5. Use of cookies' , zh: '5. Cookie（网络跟踪工具）的使用' },
  'privacy.b5': { en: 'Cookies from third-party ad services such as Google may be used to serve ads. You can refuse or delete cookies in your browser settings, though this may limit ad personalization.' , zh: '为投放广告，可能会使用Google等第三方广告服务的Cookie。您可以在浏览器设置中拒绝保存或删除Cookie，这种情况下广告个性化功能可能会受到限制。' },
  'privacy.h6': { en: '6. User rights' , zh: '6. 用户的权利' },
  'privacy.b6': { en: 'You may request to view, correct, or delete any personal information you provided via inquiries at any time. Please contact us via the Contact page below.' , zh: '对于您通过咨询提供的个人信息，您可以随时要求查阅、更正或删除。请通过下方"联系我们"与我们联系。' },
  'privacy.h7': { en: '7. Privacy officer' , zh: '7. 个人信息保护负责人' },
  'common.inquiry': { en: 'Contact' , zh: '咨询' },
  'common.contactPageLink': { en: 'Please use the Contact page' , zh: '请使用"联系我们"页面' },
  'disclaimer.breadcrumb': { en: 'Disclaimer' , zh: '免责声明' },
  'disclaimer.title':      { en: 'Disclaimer' , zh: '免责声明' },
  'disclaimer.h1': { en: '1. Purpose of information' , zh: '1. 信息提供目的' },
  'disclaimer.b1': { en: 'All calculation results and information provided on this site are a <b>reference simulation</b>, not tax, legal, or financial advice.', zh: '本网站提供的所有计算结果和信息均为<b>仅供参考的模拟计算</b>，并非税务、法律或财务方面的专业意见（Advice）。' },
  'disclaimer.h2': { en: '2. Accuracy of calculations' , zh: '2. 计算结果的准确性' },
  'disclaimer.b2': { en: 'The tax rates, exchange rates, etc. used in the calculator are simplified examples based on tax law and may differ from actual tax owed. Regarding how foreign lottery winnings are taxed under Korean law, the calculator reflects an answer received via a July 2026 NTS online consultation ("comprehensive income tax combined, Foreign Tax Credit applicable"), but this is a consultation response, not an official binding ruling, and actual application may vary by circumstance (see FAQ for details).' , zh: '计算器中使用的税率、汇率等均为简化后的示例基准，可能与实际税额有所不同。关于韩国税法下境外彩票中奖金的计税方式，本计算器参考了2026年7月通过韩国国税厅网络咨询获得的答复（"计入综合所得税、可适用外国税收抵免"），但这只是咨询答复，并非正式的法律解释，实际适用可能因具体情况而异（详见FAQ）。' },
  'disclaimer.h3': { en: '3. Recommendation to consult a professional' , zh: '3. 建议咨询专业人士' },
  'disclaimer.b3': { en: 'If you actually win a lottery and need to make decisions such as tax filing, please be sure to consult a professional such as a tax accountant who handles both Korean and US tax matters. This site is not liable for decisions made based solely on information provided here.' , zh: '如果您真的中了彩票，需要就报税等事项做出决定，请务必咨询同时熟悉韩美两国税务的税务师等专业人士。仅凭本网站信息做出的决定，本网站概不负责。' },
  'disclaimer.h4': { en: '4. No purchase agency or brokerage' , zh: '4. 禁止代购或中介' },
  'disclaimer.b4': { en: 'This site does not act as an agent or broker for lottery ticket purchases and does not provide any purchase channels. Acting as a purchase agent for foreign lotteries within Korea may be subject to penalties under relevant law (e.g., Criminal Act Article 248).' , zh: '本网站不代理或中介彩票购买，也不提供任何购买渠道。在韩国境内代购境外彩票的行为，可能根据相关法律（《刑法》第248条等）受到处罚。' },
  'disclaimer.h5': { en: '5. Trademarks and third-party services' , zh: '5. 商标及第三方服务' },
  'disclaimer.b5': { en: 'Powerball®, Mega Millions®, etc. are registered trademarks of their respective operating organizations (MUSL, etc.). This site is an independent information service with no affiliation or partnership with those organizations.' , zh: 'Powerball®、Mega Millions®等均为各运营机构（MUSL等）的注册商标，本网站是独立的信息提供网站，与上述机构没有任何合作或关联关系。' },
  'disclaimer.h6': { en: '6. Limitation of liability' , zh: '6. 责任限制' },
  'disclaimer.b6': { en: 'To the extent permitted by law, the operator of this site is not liable for direct or indirect damages arising from use of the site, reliance on calculation results, or errors in information.' , zh: '因使用本网站、信赖计算结果或信息错误而产生的直接或间接损失，本网站运营者在法律允许的范围内不承担责任。' },
  'disclaimer.h7': { en: '7. Changes to content' , zh: '7. 内容变更' },
  'disclaimer.b7': { en: 'The content, tax rate information, and policies of this site may change without prior notice.' , zh: '本网站的内容、税率信息及政策可能会在不预先通知的情况下变更。' },
  'contact.breadcrumb': { en: 'Contact' , zh: '联系我们' },
  'contact.title': { en: 'Let us know if something\u2019s off or you have questions' , zh: '有疑问或发现异常，欢迎告诉我们' },
  'contact.desc':  { en: 'If a calculation seems wrong or you\u2019re curious about something, feel free to leave a message :)' , zh: '如果计算结果有问题或有任何疑问，请随时留言 :)' },
  'contact.leaveEmpty': { en: 'Leave this field empty' , zh: '请将此栏留空' },
  'contact.emailPlaceholder':   { en: 'Email address (for our reply)' , zh: '邮箱地址（用于回复）' },
  'contact.messagePlaceholder': { en: 'Type your message here' , zh: '请输入咨询内容' },
  'contact.send':    { en: 'Send' , zh: '发送' },
  'contact.success': { en: '✓ Your message was sent, thank you!' , zh: '✓ 咨询已成功发送，谢谢！' },
  'contact.error':   { en: 'Something went wrong sending this \u2014 please try again shortly.' , zh: '发送失败，请稍后再试。' },
  'footer.copy': { en: 'This site is an informational simulator and does not act as an agent or broker for lottery purchases.' , zh: '本网站是信息提供性质的模拟计算工具，不代理或中介彩票购买。' },
  'home.taxBefore': { en: 'Announced' , zh: '公布金额' },
  'home.taxAfter':  { en: 'Take-home' , zh: '实得金额' },
  'home.taxDiff':   { en: 'Taxes' , zh: '税金' },
  'home.miniResultLabel': { en: '✏️ Or, want to start from your desired take-home amount?' , zh: '✏️ 或者，想从希望的实得金额开始计算？' },
  'home.reverseUnit':     { en: '(×₩100M)' , zh: '（×1亿韩元）' },
  'home.sliderMin': { en: '$10M' , zh: '$1000万' },
  'home.sliderMax': { en: '$2B' , zh: '$20亿' },
  'home.detailSummary':   { en: '🔍 See the full breakdown' , zh: '🔍 查看详细明细' },
  'home.flowExplain1':    { en: '💡 The <b>advertised jackpot (annuity basis)</b> shown in the news isn\u2019t what you actually receive. Taking the lump sum gets you roughly 45\u201360% of that as the <b>pre-tax cash value</b>, and this calculator is based on that pre-tax cash amount.' , zh: '💡 新闻里报道的<b>公布头奖金额（年金基准）</b>并不是你实际能拿到的金额。选择一次性支付的话，大约能拿到公布金额的45~60%作为<b>税前现金金额</b>，本计算器就是以这个税前现金金额为基准计算的。' },
  'home.annuityInfoLink': { en: '\ud83d\udcc5 How is it different if you take the annuity? \u2192' , zh: '📅 如果选择年金支付会有什么不同？→' },
  'home.calcBasisBox':    { en: '• Lump-sum basis (differs for installment payouts)' , zh: '• 以一次性支付为基准（分期支付另有不同）' },
  'home.funMoneySummary': { en: '🤑 How much could you actually buy with this? (just for fun)' , zh: '🤑 这笔钱实际能买到什么？（纯属娱乐）' },
  'home.groundingNote': { en: '🌱 But honestly, what you already have might be more than enough for a good day' , zh: '🌱 不过说真的，现在拥有的可能已经足够拥有美好的一天了' },
  'home.dreamSummary': { en: '🎬 What would you do first if you won? (just for fun)' , zh: '🎬 如果中奖了，你会先做什么？（纯属娱乐）' },
  'home.dreamIntro':   { en: 'What would you do first if you won?' , zh: '如果中奖了，你会先做什么？' },
  'home.dreamFreedom': { en: '<span class="dream-emoji">🕊️</span> Hand in my resignation letter first' , zh: '<span class="dream-emoji">🕊️</span> 先递交辞职信' },
  'home.dreamFamily':  { en: '<span class="dream-emoji">🏠</span> Buy a house for every family member' , zh: '<span class="dream-emoji">🏠</span> 给每位家人都买套房子' },
  'home.dreamTravel':  { en: '<span class="dream-emoji">✈️</span> Leave on a world trip right away' , zh: '<span class="dream-emoji">✈️</span> 马上出发环游世界' },
  'home.dreamCalm':    { en: '<span class="dream-emoji">💼</span> Just quietly check my bank balance' , zh: '<span class="dream-emoji">💼</span> 只是安静地看看银行余额' },
  'home.shareDreamBtn': { en: '📤 Share this result' , zh: '📤 分享这个结果' },
  'home.jackpotToggle': { en: '🎟️ Check the recent jackpot' , zh: '🎟️ 查看最近头奖' },
  'home.powerballName': { en: 'Powerball' , zh: '强力球' },
  'home.megaName':      { en: 'Mega Millions' , zh: '超级百万' },
  'home.officialLink':  { en: '\ud83d\udd17 Check the official site' , zh: '🔗 查看官方网站' },
  'home.oddsTeaserTitle': { en: 'The 1-in-292M odds don\u2019t really register, do they?' , zh: '1/2.92亿的概率没什么真实感对吧？' },
  'home.oddsTeaserSub':   { en: 'Comparing it to things like lightning strikes makes it click' , zh: '和被闪电击中做个对比就更有感觉了' },
  'home.oddsTeaserLink':  { en: 'See the odds \u2192' , zh: '查看概率 →' },
  'home.faqTeaserTitle': { en: '❓ People usually wonder about this' , zh: '❓ 大家通常会好奇这些问题' },
  'home.faqTeaserDesc':  { en: 'Tap for the answer right away' , zh: '点击立即查看答案' },
  'home.faqTeaserLink':  { en: 'See more answers \u2192' , zh: '查看更多答案 →' },
  'home.trustToggle': { en: '✓ Why can I trust this?' , zh: '✓ 为什么可以信任这个计算器？' },
  'home.trust1Name': { en: 'Reliable info' , zh: '可靠的信息' },
  'home.trust1Desc': { en: 'Based on IRS · Korea NTS' , zh: '基于IRS·韩国国税厅数据' },
  'home.trust2Name': { en: 'Accurate calculations' , zh: '精准的计算' },
  'home.trust2Desc': { en: 'Reflects current tax rates' , zh: '反映最新税率' },
  'home.trust3Name': { en: 'No personal data' , zh: '不收集个人信息' },
  'home.trust3Desc': { en: 'Calculates only, nothing stored' , zh: '仅用于计算，不做任何存储' },
  'home.trust4Name': { en: 'No purchase/brokerage' , zh: '不代理购买' },
  'home.trust4Desc': { en: 'No agency or connection service' , zh: '不提供代购或中介服务' },
  'home.sourceLabel': { en: 'Sources:' , zh: '参考来源：' },
  'home.ntsLink':      { en: 'Korea NTS Hometax' , zh: '韩国国税厅 Hometax' },
};

// 언어 드롭다운 선택(onchange) 및 ?lang= URL 파라미터에서 공통으로 사용.
// zh는 1단계(핵심 화면)만 번역돼 있고, 아직 번역 안 된 항목은 resolveI18n()이 undefined를
// 반환해 자동으로 한국어로 폴백됨(2단계에서 항목을 채우면 그대로 반영됨).
function setLanguage(lang){
  if (currentLang === lang) return;
  currentLang = lang;
  applyTranslations();
}

function resolveI18n(entry){
  if (currentLang === 'zh' && entry.zh) return entry.zh;
  if (currentLang === 'en' && entry.en) return entry.en;
  return undefined;
}

function applyTranslations(){
  const toggleBtn = document.getElementById('lang-toggle');
  document.documentElement.lang = currentLang;
  if (toggleBtn) toggleBtn.value = currentLang;

  const activeView = document.querySelector('.view.on');
  if (activeView) applyCurrentViewTitle(activeView.id.replace('view-', ''));

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const entry = I18N[key];
    if (!entry) return;
    el.textContent = resolveI18n(entry) || el.getAttribute('data-i18n-ko') || el.textContent;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const entry = I18N[key];
    if (!entry) return;
    const translated = resolveI18n(entry);
    if (translated) {
      if (!el.getAttribute('data-i18n-ko-html')) el.setAttribute('data-i18n-ko-html', el.innerHTML);
      el.innerHTML = translated;
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
    el.placeholder = resolveI18n(entry) || el.getAttribute('data-i18n-ko-placeholder');
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    const entry = I18N[key];
    if (!entry) return;
    if (!el.getAttribute('data-i18n-ko-aria-label')) el.setAttribute('data-i18n-ko-aria-label', el.getAttribute('aria-label'));
    el.setAttribute('aria-label', resolveI18n(entry) || el.getAttribute('data-i18n-ko-aria-label'));
  });

  // 역대 잭팟 TOP5 링크는 영문 모드일 때 별도로 만들어둔 영어 페이지로 이어지게 함
  // (텍스트만 번역되고 href는 그대로 한국어 페이지를 가리키던 문제 수정)
  const jackpotFullLink = document.getElementById('jackpot-history-full-link');
  if (jackpotFullLink) {
    jackpotFullLink.href = (currentLang === 'en') ? 'biggest-lottery-jackpots-after-tax.html' : 'biggest-jackpot-payouts.html';
  }

  // "해외 거주 한국인" 배너 링크도 같은 이유로 언어별 페이지로 이어지게 함 — 이게 없으면
  // 영어 페이지 하나로 고정되어 있어서 한국어·중국어로 보던 사람이 링크를 누르면 갑자기
  // 전부 영어로 된 페이지로 넘어가버리는 문제가 있었음
  const introAbroadLink = document.getElementById('introAbroadLink');
  if (introAbroadLink) {
    introAbroadLink.href = (currentLang === 'ko') ? 'korean_abroad_us_lottery_tax_ko.html'
      : (currentLang === 'zh') ? 'korean_abroad_us_lottery_tax_zh.html'
      : 'korean-abroad-us-lottery-tax.html';
  }

  // 언어 전환 시 환율 배지의 상태 문구(title)도 항상 다시 반영 (실패/성공/기본 상태와 무관하게 현재 언어로)
  updateExchangeRateBadges(exchangeRateFetchFailed);

  // 언어 전환 시 동적으로 생성되는 텍스트(CTA 버튼, 잭팟 패널, 추첨 카운트다운 등)도 다시 계산해서 갱신.
  // 홈 화면이 켜져 있을 때만 갱신하면, 확률체감 페이지의 잭팟 카드(#jackpot-card-amt 등 — 홈과 ID를
  // 공유함)가 언어 전환 시 갱신되지 않고 예전 언어로 남아있다가, 나중에 환율 자동갱신 등 무관한
  // 이벤트가 발생할 때에야 그 시점의 언어로 갑자기 바뀌어 "언어가 왔다갔다 하는" 것처럼 보이는
  // 버그가 있었음 — 뷰와 무관하게 항상 갱신해서 어느 화면에 있든 즉시 반영되게 함
  updateHomeCalc();
  updateCalc(); // 국가별 비교 화면(나라별 카드·다른 언어로 보기 패널)도 같은 이유로 뷰와 무관하게 항상 갱신 —
                // 이게 빠져있어서 "비교 화면에 머문 채로 언어를 바꾸면 카드는 그대로 예전 언어로 남는" 버그가 있었음
  updateFaqTg2Card(); // FAQ "세금 가이드" 요약 카드도 언어만 바뀌는 경우까지 커버(기준 변경 시엔 filterFaq()에서 이미 호출됨)
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
let EXCHANGE_RATE_CNY = 6.77; // 기본값(fallback), USD/CNY (2026-07-17 확인). 중국 거주자 기준 결과에서 위안화 참고 환산용 — KRW와 마찬가지로 실시간 조회 시도, 실패하면 이 기본값 사용

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
// 막히거나(지역 차단) 타임아웃 나면 순서대로 다음 걸 시도. 응답 형식이 달라서 각자 getRate로 KRW/CNY 환율을 뽑아냄
// (두 API 모두 한 번의 응답에 여러 통화 환율을 같이 내려주므로, 별도 API 호출 없이 CNY도 같이 얻을 수 있음)
const EXCHANGE_RATE_SOURCES = [
  { url: 'https://api.frankfurter.app/latest?from=USD&to=KRW,CNY', getRate: (data) => data && data.rates && data.rates.KRW, getRateCny: (data) => data && data.rates && data.rates.CNY, name: 'Frankfurter (중앙은행 기준환율)', nameEn: 'Frankfurter (central bank reference rate)' },
  { url: 'https://open.er-api.com/v6/latest/USD', getRate: (data) => data && data.rates && data.rates.KRW, getRateCny: (data) => data && data.rates && data.rates.CNY, name: 'open.er-api.com', nameEn: 'open.er-api.com' },
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
        // fetch가 진행되는 동안(최대 약 12초, 소스 2개 × 6초 타임아웃) 사용자가 환율을 직접
        // 수정했을 수 있음 — 맨 위의 isRateManuallyEdited 체크는 fetch 시작 "전"에 한 번만
        // 확인하므로, 진행 중에 수정된 경우를 못 잡아서 사용자 입력이 뒤늦게 덮어써지는
        // 레이스 컨디션이 있었음. await 이후 여기서 한 번 더 확인해서 방지함
        if (isRateManuallyEdited && !force) return false;
        EXCHANGE_RATE = Math.round(rate * 100) / 100; // 소수점 둘째자리까지 유지 (기준환율은 보통 소수점 단위로 고시됨)
        const rateCny = source.getRateCny(data);
        if (rateCny) EXCHANGE_RATE_CNY = Math.round(rateCny * 10000) / 10000; // CNY는 소수점 넷째자리까지(보통 6.xx대라 소수점 둘째자리로는 정밀도 부족)
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
  const buttons = document.querySelectorAll('.rate-live-badge');
  buttons.forEach(b => {
    b.disabled = true; b.classList.remove('is-live','is-fail','just-retried');
    b.innerHTML = '<span class="spin" aria-hidden="true">🔄</span>';
    b.title = pickLang('환율 확인 중...', 'Checking exchange rate...', '正在查询汇率...');
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
  document.querySelectorAll('.rate-live-badge').forEach(el => {
    el.disabled = false;
    el.classList.remove('is-live','is-fail');
    el.innerHTML = '<span aria-hidden="true">🔄</span>';
    if (failed) {
      el.classList.add('is-fail');
      el.title = pickLang('환율 조회 실패 · 탭해서 재시도', 'Couldn\u2019t fetch live rate · tap to retry', '汇率获取失败 · 点击重试');
    } else if (exchangeRateIsLive) {
      el.classList.add('is-live');
      el.title = pickLang('실시간 환율 적용 중 · 탭하면 새로고침', 'Live exchange rate applied · tap to refresh', '正在使用实时汇率 · 点击刷新');
    } else {
      el.title = pickLang('기본값 사용 중 · 탭하면 실시간 환율로 갱신', 'Using default rate · tap to fetch live rate', '正在使用默认汇率 · 点击获取实时汇率');
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
  document.querySelectorAll('#homeCountryToggle .country-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.country === sharedCountry);
  });
  document.getElementById('homeStateSelect').value = sharedState;
  document.getElementById('home-rate-input').value = EXCHANGE_RATE.toLocaleString('ko-KR');
  updateHomeCalc(sharedAmountUsd);
  filterFaq();
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
  // 중국어도 억(亿)=10^8 단위 체계가 한국과 동일해서, 영어처럼 별도 million/billion 변환 없이
  // 접미사만 "亿韩元"으로 바꿔주면 됨
  if (typeof currentLang !== 'undefined' && currentLang === 'zh') return Math.round(n).toLocaleString('zh-CN') + '亿韩元';
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
  AVG:   { label: '평균 (예시)', labelEn: 'Average (example)', labelZh: '平均（示例）', rate: 0.08 },
  AL:  { label: '앨라배마', labelEn: 'Alabama', labelZh: '阿拉巴马', rate: 0.05 },
  AK:  { label: '알래스카', labelEn: 'Alaska', labelZh: '阿拉斯加', rate: 0.0 },
  AZ:  { label: '애리조나', labelEn: 'Arizona', labelZh: '亚利桑那', rate: 0.025 },
  AR:  { label: '아칸소', labelEn: 'Arkansas', labelZh: '阿肯色', rate: 0.039 },
  CA:  { label: '캘리포니아 (복권 당첨금 면제)', labelEn: 'California (lottery-exempt)', labelZh: '加利福尼亚（彩票免税）', rate: 0.0 },
  CO:  { label: '콜로라도', labelEn: 'Colorado', labelZh: '科罗拉多', rate: 0.044 },
  CT:  { label: '코네티컷', labelEn: 'Connecticut', labelZh: '康涅狄格', rate: 0.0699 },
  DE:  { label: '델라웨어', labelEn: 'Delaware', labelZh: '特拉华', rate: 0.066 },
  FL:  { label: '플로리다', labelEn: 'Florida', labelZh: '佛罗里达', rate: 0.0 },
  GA:  { label: '조지아', labelEn: 'Georgia', labelZh: '佐治亚', rate: 0.0539 },
  HI:  { label: '하와이', labelEn: 'Hawaii', labelZh: '夏威夷', rate: 0.11 },
  ID:  { label: '아이다호', labelEn: 'Idaho', labelZh: '爱达荷', rate: 0.053 },
  IL:  { label: '일리노이', labelEn: 'Illinois', labelZh: '伊利诺伊', rate: 0.0495 },
  IN:  { label: '인디애나', labelEn: 'Indiana', labelZh: '印第安纳', rate: 0.0295 },
  IA:  { label: '아이오와', labelEn: 'Iowa', labelZh: '艾奥瓦', rate: 0.038 },
  KS:  { label: '캔자스', labelEn: 'Kansas', labelZh: '堪萨斯', rate: 0.0558 },
  KY:  { label: '켄터키', labelEn: 'Kentucky', labelZh: '肯塔基', rate: 0.035 },
  LA:  { label: '루이지애나', labelEn: 'Louisiana', labelZh: '路易斯安那', rate: 0.03 },
  ME:  { label: '메인', labelEn: 'Maine', labelZh: '缅因', rate: 0.0715 },
  MD:  { label: '메릴랜드 (확인중)', labelEn: 'Maryland (unconfirmed)', labelZh: '马里兰（待确认）', rate: 0.0895 }, // 공식 출처마다 8.75~9.5%로 상이 — 최신 수치 재확인 필요
  MA:  { label: '매사추세츠', labelEn: 'Massachusetts', labelZh: '马萨诸塞', rate: 0.09 },
  MI:  { label: '미시간', labelEn: 'Michigan', labelZh: '密歇根', rate: 0.0425 },
  MN:  { label: '미네소타', labelEn: 'Minnesota', labelZh: '明尼苏达', rate: 0.0985 },
  MS:  { label: '미시시피', labelEn: 'Mississippi', labelZh: '密西西比', rate: 0.04 },
  MO:  { label: '미주리', labelEn: 'Missouri', labelZh: '密苏里', rate: 0.047 },
  MT:  { label: '몬태나', labelEn: 'Montana', labelZh: '蒙大拿', rate: 0.0565 },
  NE:  { label: '네브래스카', labelEn: 'Nebraska', labelZh: '内布拉斯加', rate: 0.0455 },
  NV:  { label: '네바다', labelEn: 'Nevada', labelZh: '内华达', rate: 0.0 },
  NH:  { label: '뉴햄프셔', labelEn: 'New Hampshire', labelZh: '新罕布什尔', rate: 0.0 },
  NJ:  { label: '뉴저지', labelEn: 'New Jersey', labelZh: '新泽西', rate: 0.1075 },
  NM:  { label: '뉴멕시코', labelEn: 'New Mexico', labelZh: '新墨西哥', rate: 0.059 },
  NY:  { label: '뉴욕', labelEn: 'New York', labelZh: '纽约', rate: 0.109 },
  NC:  { label: '노스캐롤라이나', labelEn: 'North Carolina', labelZh: '北卡罗来纳', rate: 0.0399 },
  ND:  { label: '노스다코타', labelEn: 'North Dakota', labelZh: '北达科他', rate: 0.0195 },
  OH:  { label: '오하이오', labelEn: 'Ohio', labelZh: '俄亥俄', rate: 0.0275 },
  OK:  { label: '오클라호마', labelEn: 'Oklahoma', labelZh: '俄克拉何马', rate: 0.045 },
  OR:  { label: '오리건', labelEn: 'Oregon', labelZh: '俄勒冈', rate: 0.099 },
  PA:  { label: '펜실베이니아', labelEn: 'Pennsylvania', labelZh: '宾夕法尼亚', rate: 0.0307 },
  RI:  { label: '로드아일랜드', labelEn: 'Rhode Island', labelZh: '罗德岛', rate: 0.0599 },
  SC:  { label: '사우스캐롤라이나', labelEn: 'South Carolina', labelZh: '南卡罗来纳', rate: 0.062 },
  SD:  { label: '사우스다코타', labelEn: 'South Dakota', labelZh: '南达科他', rate: 0.0 },
  TN:  { label: '테네시', labelEn: 'Tennessee', labelZh: '田纳西', rate: 0.0 },
  TX:  { label: '텍사스', labelEn: 'Texas', labelZh: '得克萨斯', rate: 0.0 },
  UT:  { label: '유타', labelEn: 'Utah', labelZh: '犹他', rate: 0.0455 },
  VT:  { label: '버몬트', labelEn: 'Vermont', labelZh: '佛蒙特', rate: 0.0875 },
  VA:  { label: '버지니아', labelEn: 'Virginia', labelZh: '弗吉尼亚', rate: 0.0575 },
  WA:  { label: '워싱턴', labelEn: 'Washington', labelZh: '华盛顿', rate: 0.0 },
  DC:  { label: '워싱턴 D.C.', labelEn: 'Washington D.C.', labelZh: '华盛顿特区', rate: 0.1075 },
  WV:  { label: '웨스트버지니아', labelEn: 'West Virginia', labelZh: '西弗吉尼亚', rate: 0.0482 },
  WI:  { label: '위스콘신', labelEn: 'Wisconsin', labelZh: '威斯康星', rate: 0.0765 },
  WY:  { label: '와이오밍', labelEn: 'Wyoming', labelZh: '怀俄明', rate: 0.0 },
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
// currentLang에 따라 ko/en/zh 중 하나를 고름. zh가 없으면(2단계 미번역 구간) ko로 폴백.
function pickLang(ko, en, zh){
  if (currentLang === 'zh') return zh || ko;
  if (currentLang === 'en') return en || ko;
  return ko;
}

function calcTakeHome(amount, country, stateCode){
  if (country === 'us') {
    const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
    const afterUS = amount * (1 - TAX_MODEL.us_resident.federal);
    const final = afterUS * (1 - stateInfo.rate);
    // stateInfo.label이 "평균 (예시)"처럼 이미 괄호를 포함하는 경우 "주세"를 그냥 붙이면
    // "평균 (예시) 주세"처럼 어색해지므로, 괄호 설명은 떼어내고 순수 지역명만 사용
    const cleanStateLabel = stateInfo.label.replace(/\s*\(예시\)|\s*\(예시,[^)]*\)/, '');
    const cleanStateLabelEn = stateInfo.labelEn.replace(/\s*\(example\)|\s*\(example,[^)]*\)/i, '');
    const cleanStateLabelZh = (stateInfo.labelZh || cleanStateLabel).replace(/\s*（示例）/, '');
    return {
      afterUS, final,
      label1: pickLang('미국 연방세', 'US Federal Tax', '美国联邦税'), val1: '-' + (TAX_MODEL.us_resident.federal * 100) + '%',
      label2: pickLang(`${cleanStateLabel} 주세`, `${cleanStateLabelEn} State Tax`, `${cleanStateLabelZh}州税`),
      val2: '-' + (stateInfo.rate * 100).toFixed(stateInfo.rate * 100 % 1 === 0 ? 0 : 2) + '%',
      basisSuffix: pickLang('미국 거주자', 'US resident', '美国居民')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('중국 추가 납부 (FTC 적용)', 'China additional tax (FTC applied)', '中国追加缴税（已抵免FTC）'),
      val2: chinaAdditionalTaxWon > 0 ? '-' + chinaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）'),
      basisSuffix: pickLang('중국 거주자', 'China resident', '中国居民')
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
      label1: pickLang('미국 연방세 (비거주자)', 'US Federal Tax (nonresident)', '美国联邦税（非居民）'), val1: '-' + (TAX_MODEL.nonresident.us_withholding * 100) + '%',
      label2: pickLang('한국 추가 납부 (FTC 적용)', 'Korea additional tax (FTC applied)', '韩国追加缴税（已抵免FTC）'),
      val2: koreaAdditionalNationalTaxWon > 0 ? '-' + koreaEffectivePct.toFixed(1) + '%' : pickLang('0원 (세액공제로 상계)', '₩0 (offset by tax credit)', '0元（已被税收抵免抵消）'),
      basisSuffix: pickLang('한국 거주자', 'Korea resident', '韩国居民')
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

// 브라우저 탭 제목 — 뷰가 바뀔 때(go())뿐 아니라 같은 화면에 머문 채로 언어만 바꿀 때도
// (applyTranslations()) 항상 현재 언어로 다시 반영해야 함. 예전엔 go()에서만, 그것도 한국어
// 문구로 고정 세팅해서 영어·중국어로 보고 있어도 화면 전환마다 탭 제목이 한국어로 돌아가던 버그가 있었음
const PAGE_TITLES = {
  home: { ko: '미국 복권 세금 계산기 | 참택스 - 미국 파워볼·메가밀리언즈 실수령액', en: 'US Lottery Tax Calculator | ChamTax — Powerball & Mega Millions Take-Home', zh: '美国彩票税金计算器 | ChamTax — 强力球·超级百万实得金额' },
  compare: { ko: '미국 복권 이중과세·국가별 실수령액 비교 | 참택스', en: 'US Lottery Double Taxation & Country Comparison | ChamTax', zh: '美国彩票双重征税·各国实得金额对比 | ChamTax' },
  odds: { ko: '미국 파워볼 당첨 확률 체감 | 참택스', en: 'US Powerball Odds, Visualized | ChamTax', zh: '美国强力球中奖概率体验 | ChamTax' },
  faq: { ko: '미국 복권 세금 FAQ - 이중과세·원천징수 | 참택스', en: 'US Lottery Tax FAQ — Double Taxation & Withholding | ChamTax', zh: '美国彩票税金FAQ — 双重征税·预扣税 | ChamTax' },
  privacy: { ko: '개인정보처리방침 | 참택스', en: 'Privacy Policy | ChamTax', zh: '隐私政策 | ChamTax' },
  disclaimer: { ko: '면책조항 | 참택스', en: 'Disclaimer | ChamTax', zh: '免责声明 | ChamTax' },
  contact: { ko: '문의하기 | 참택스', en: 'Contact | ChamTax', zh: '联系我们 | ChamTax' }
};

function applyCurrentViewTitle(view){
  const entry = PAGE_TITLES[view];
  if (!entry) return;
  document.title = entry[currentLang] || entry.ko;
}

function go(view){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.getElementById('view-' + view).classList.add('on');
  setupRevealAnimation();
  document.getElementById('nav-compare').classList.toggle('active', view === 'compare');
  document.getElementById('nav-odds').classList.toggle('active', view === 'odds');
  document.getElementById('nav-faq').classList.toggle('active', view === 'faq');
  applyCurrentViewTitle(view);

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
  } else if (view === 'faq') {
    // 국가 토글을 한 번도 안 건드린 상태로 FAQ 탭을 바로 누르면 filterFaq()가 아직 한 번도
    // 실행된 적이 없어서, 세금 기준(kr/us/cn)과 무관한 질문까지 전부 보이던 버그가 있었음
    filterFaq();
  }

  document.querySelector('.page').scrollIntoView({behavior:'smooth', block:'start'});
}

// "나는 어떤 경우일까요?" 안내 배너에서 "한국에 살아요" 카드를 누르면, 배너를 접고
// 바로 아래 입력창으로 스크롤해줌 — 이미 홈 화면에 있으니 페이지 이동은 필요 없음
function goToCalculatorInput(){
  const accordion = document.getElementById('introPersonaAccordion');
  if (accordion) accordion.open = false;
  const inputCard = document.querySelector('.input-card');
  if (inputCard) inputCard.scrollIntoView({behavior:'smooth', block:'start'});
}

// "실제로 다른 나라에 살아요" 카드의 US/CN 버튼 — 한국이랑 아무 상관없는 진짜 외국인(예: 순수
// 미국인·중국인)을 위한 원클릭 진입점. 언어와 세금 기준을 그 나라에 맞게 한 번에 맞춰주고
// 계산기로 스크롤함 — 이게 없으면 한국어 화면만 보고 이탈할 위험이 있었음
function goToRealAbroad(country, lang){
  setLanguage(lang);
  setHomeCountry(country);
  goToCalculatorInput();
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
  // 중국어도 亿(=억) 단위 체계가 같아서, "조" 자리만 현대 중국어 관행상 "万亿"(만조)으로 표기
  if (typeof currentLang !== 'undefined' && currentLang === 'zh') {
    if (조 > 0 && 억 === 0) return `(约${조}万亿韩元)`;
    if (조 > 0) return `(约${조}万亿${억.toLocaleString('zh-CN')}亿韩元)`;
    return `(约${억.toLocaleString('zh-CN')}亿韩元)`;
  }
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
  gov24:     { href: 'https://www.usa.gov/unclaimed-money', icon: '🏢', sub: 'USA.gov' },
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

  if (checkedCount === 0) {
    resultEl.textContent = pickLang(
      '\uD558\uB098\uB77C\uB3C4 \uD574\uB2F9\uB418\uBA74, \uC544\uB798\uC5D0\uC11C \uC2E4\uC81C\uB85C \uD655\uC778\uD574\uBCF4\uC138\uC694 \uD83D\uDC47',
      'If even one applies to you, check below to find out \uD83D\uDC47',
      '\u5982\u679C\u6709\u7B26\u5408\u7684\u9879\u76EE\uFF0C\u8BF7\u5728\u4E0B\u65B9\u5B9E\u9645\u786E\u8BA4\u4E00\u4E0B \uD83D\uDC47'
    );
    resultEl.className = 'refund-wizard-result';
  } else if (checkedCount === 1) {
    resultEl.textContent = pickLang(
      '\u2705 \uD574\uB2F9\uD558\uC2DC\uB294 \uAC8C \uC788\uB124\uC694 \u2014 \uBABB \uBC1B\uC740 \uB3C8\uC774 \uC788\uC744 \uAC00\uB2A5\uC131\uC774 \uC788\uC5B4\uC694. \uC544\uB798\uC5D0\uC11C \uD68C\uC6D0\uB2D8\uD55C\uD14C \uB9DE\uB294 \uACF3\uC744 \uCD94\uCC9C\uD574\uB4DC\uB838\uC5B4\uC694',
      '\u2705 You checked one \u2014 there may be money you haven\u2019t claimed. We\u2019ve highlighted the right place for you below',
      '\u2705 \u6709\u4E00\u9879\u7B26\u5408\u2014\u2014\u53EF\u80FD\u6709\u60A8\u8FD8\u6CA1\u9886\u53D6\u7684\u94B1\u3002\u6211\u4EEC\u5DF2\u7ECF\u5728\u4E0B\u65B9\u4E3A\u60A8\u6807\u51FA\u4E86\u5BF9\u5E94\u7684\u67E5\u8BE2\u6E20\u9053'
    );
    resultEl.className = 'refund-wizard-result tag-hit';
  } else {
    resultEl.textContent = pickLang(
      `\u2705 ${checkedCount}\uAC1C\uB098 \uD574\uB2F9\uB418\uC2DC\uB124\uC694 \u2014 \uC2E4\uC81C\uB85C \uBABB \uBC1B\uC740 \uB3C8\uC774 \uC788\uC744 \uAC00\uB2A5\uC131\uC774 \uAF64 \uB192\uC544\uC694. \uC544\uB798\uC5D0\uC11C \uD68C\uC6D0\uB2D8\uD55C\uD14C \uB9DE\uB294 \uACF3\uC744 \uCD94\uCC9C\uD574\uB4DC\uB838\uC5B4\uC694`,
      `\u2705 You checked ${checkedCount} \u2014 there\u2019s a good chance you have unclaimed money. We\u2019ve highlighted the right places for you below`,
      `\u2705 \u6709${checkedCount}\u9879\u7B26\u5408\u2014\u2014\u5F88\u6709\u53EF\u80FD\u6709\u60A8\u8FD8\u6CA1\u9886\u53D6\u7684\u94B1\u3002\u6211\u4EEC\u5DF2\u7ECF\u5728\u4E0B\u65B9\u4E3A\u60A8\u6807\u51FA\u4E86\u5BF9\u5E94\u7684\u67E5\u8BE2\u6E20\u9053`
    );
    resultEl.className = 'refund-wizard-result tag-hit';
  }

  // \uCCB4\uD06C\uD55C \uD56D\uBAA9\uC5D0 \uC5F0\uACB0\uB41C \uC0AC\uC774\uD2B8\uB9CC \uCD94\uCC9C(\uAC15\uC870)\uD558\uACE0, \uB098\uBA38\uC9C0\uB294 \uD750\uB9AC\uAC8C
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
  if (!stateCode) {
    resultEl.textContent = pickLang(
      '\uC8FC\uB97C \uC120\uD0DD\uD558\uBA74 \uD658\uAE09 \uAC00\uB2A5\uC131\uC744 \uBC14\uB85C \uC54C\uB824\uB4DC\uB824\uC694',
      'Select a state and we\u2019ll tell you right away whether a refund is likely',
      '\u9009\u62E9\u5DDE\u4E4B\u540E\uFF0C\u9A6C\u4E0A\u544A\u8BC9\u60A8\u9000\u7A0E\u7684\u53EF\u80FD\u6027'
    );
    resultEl.className = 'refund-wizard-result';
    return;
  }

  const STATE_DISPLAY_NAMES = {
    AL: '\uC575\uB77C\uBC14\uB9C8', AK: '\uC54C\uB798\uC2A4\uCE74', AZ: '\uC560\uB9AC\uC870\uB098', AR: '\uC544\uCE78\uC18C', CA: '\uCE98\uB9AC\uD3EC\uB2C8\uC544',
    CO: '\uCF5C\uB85C\uB77C\uB3C4', CT: '\uCF54\uB124\uD2F0\uCEF7', DE: '\uB378\uB77C\uC6E8\uC5B4', FL: '\uD50C\uB85C\uB9AC\uB2E4', GA: '\uC870\uC9C0\uC544',
    HI: '\uD558\uC640\uC774', ID: '\uC544\uC774\uB2E4\uD638', IL: '\uC77C\uB9AC\uB178\uC774', IN: '\uC778\uB514\uC544\uB098', IA: '\uC544\uC774\uC624\uC640',
    KS: '\uCE94\uC790\uC2A4', KY: '\uCF00\uD130\uD0A4', LA: '\uB8E8\uC774\uC9C0\uC544\uB098', ME: '\uBA54\uC778', MD: '\uBA54\uB9B4\uB79C\uB4DC',
    MA: '\uB9E4\uC0AC\uCD94\uC138\uCE20', MI: '\uBBF8\uC2DC\uAC74', MN: '\uBBF8\uB124\uC18C\uD0C0', MS: '\uBBF8\uC2DC\uC2DC\uD53C', MO: '\uBBF8\uC8FC\uB9AC',
    MT: '\uBAAC\uD0C0\uB098', NE: '\uB124\uBE0C\uB798\uC2A4\uCE74', NV: '\uB124\uBC14\uB2E4', NH: '\uB274\uD584\uD504\uC154', NJ: '\uB274\uC800\uC9C0',
    NM: '\uB274\uBA55\uC2DC\uCF54', NY: '\uB274\uC695', NC: '\uB178\uC2A4\uCE90\uB864\uB77C\uC774\uB098', ND: '\uB178\uC2A4\uB2E4\uCF54\uD0C0', OH: '\uC624\uD558\uC774\uC624',
    OK: '\uC624\uD074\uB77C\uD638\uB9C8', OR: '\uC624\uB9AC\uAC74', PA: '\uD39C\uC2E4\uBC14\uB2C8\uC544', RI: '\uB85C\uB4DC\uC544\uC77C\uB79C\uB4DC', SC: '\uC0AC\uC6B0\uC2A4\uCE90\uB864\uB77C\uC774\uB098',
    SD: '\uC0AC\uC6B0\uC2A4\uB2E4\uCF54\uD0C0', TN: '\uD14C\uB124\uC2DC', TX: '\uD14D\uC0AC\uC2A4', UT: '\uC720\uD0C0', VT: '\uBC84\uBAAC\uD2B8',
    VA: '\uBC84\uC9C0\uB2C8\uC544', WA: '\uC6CC\uC2F1\uD134', DC: '\uC6CC\uC2F1\uD134 D.C.', WV: '\uC6E8\uC2A4\uD2B8\uBC84\uC9C0\uB2C8\uC544', WI: '\uC704\uC2A4\uCEE8\uC2E0',
    WY: '\uC640\uC774\uC624\uBC0D',
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
  const STATE_DISPLAY_NAMES_ZH = {
    AL: '\u963F\u62C9\u5DF4\u9A6C', AK: '\u963F\u62C9\u65AF\u52A0', AZ: '\u4E9A\u5229\u6851\u90A3', AR: '\u963F\u80AF\u8272', CA: '\u52A0\u5229\u798F\u5C3C\u4E9A',
    CO: '\u79D1\u7F57\u62C9\u591A', CT: '\u5EB7\u6D85\u72C4\u683C', DE: '\u7279\u62C9\u534E', FL: '\u4F5B\u7F57\u91CC\u8FBE', GA: '\u4F50\u6CBB\u4E9A',
    HI: '\u590F\u5A01\u5937', ID: '\u7231\u8FBE\u8377', IL: '\u4F0A\u5229\u8BFA\u4F0A', IN: '\u5370\u7B2C\u5B89\u7EB3', IA: '\u827E\u5965\u74E6',
    KS: '\u5821\u8428\u65AF', KY: '\u80AF\u5854\u57FA', LA: '\u8DEF\u6613\u65AF\u5B89\u90A3', ME: '\u7F05\u56E0', MD: '\u9A6C\u91CC\u5170',
    MA: '\u9A6C\u8428\u8BF8\u585E', MI: '\u5BC6\u6B47\u6839', MN: '\u660E\u5C3C\u82CF\u8FBE', MS: '\u5BC6\u897F\u897F\u6BD4', MO: '\u5BC6\u82CF\u91CC',
    MT: '\u8499\u5927\u62FF', NE: '\u5185\u5E03\u62C9\u65AF\u52A0', NV: '\u5185\u534E\u8FBE', NH: '\u65B0\u7F55\u5E03\u4EC0\u5C14', NJ: '\u65B0\u6CFD\u897F',
    NM: '\u65B0\u58A8\u897F\u54E5', NY: '\u7EBD\u7EA6', NC: '\u5317\u5361\u7F57\u6765\u7EB3', ND: '\u5317\u8FBE\u79D1\u4ED6', OH: '\u4FC4\u4EA5\u4FC4',
    OK: '\u4FC4\u514B\u62C9\u4F55\u9A6C', OR: '\u4FC4\u52D2\u5188', PA: '\u5BBE\u5915\u6CD5\u5C3C\u4E9A', RI: '\u7F57\u5FB7\u5C9B', SC: '\u5357\u5361\u7F57\u6765\u7EB3',
    SD: '\u5357\u8FBE\u79D1\u4ED6', TN: '\u7530\u7EB3\u897F', TX: '\u5F97\u514B\u8428\u65AF', UT: '\u72B9\u4ED6', VT: '\u4F5B\u8499\u7279',
    VA: '\u5F17\u5409\u5C3C\u4E9A', WA: '\u534E\u76DB\u987F', DC: '\u534E\u76DB\u987F\u7279\u533A', WV: '\u897F\u5F17\u5409\u5C3C\u4E9A', WI: '\u5A01\u65AF\u5EB7\u661F',
    WY: '\u6021\u4FC4\u660E',
  };
  const NO_TAX_STATES = ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY'];
  const EXEMPT_STATES = ['CA'];
  const UNCERTAIN_STATES = ['MD'];
  const stateInfo = STATE_TAX_RATES[stateCode];
  const stateName = pickLang(STATE_DISPLAY_NAMES[stateCode], STATE_DISPLAY_NAMES_EN[stateCode], STATE_DISPLAY_NAMES_ZH[stateCode]);

  let msg, cls;
  if (NO_TAX_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u2715 \uC774 \uC8FC(${stateName})\uB294 \uC8FC \uC18C\uB4DD\uC138 \uC790\uCCB4\uAC00 \uC5C6\uB294 \uBB34\uACFC\uC138 \uC8FC\uC608\uC694. \uC560\uCD08\uC5D0 \uC6D0\uCC9C\uC9D5\uC218\uB41C \uAC8C \uC5C6\uC5B4\uC11C \uB3CC\uB824\uBC1B\uC744 \uAC83\uB3C4 \uC5C6\uC5B4\uC694.`,
      `\u2715 This state (${stateName}) has no state income tax at all. Nothing was withheld in the first place, so there\u2019s nothing to get back.`,
      `\u2715 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u6839\u672C\u6CA1\u6709\u5DDE\u6240\u5F97\u7A0E\u3002\u672C\u6765\u5C31\u6CA1\u6709\u9884\u6263\u8FC7\u7A0E\u6B3E\uFF0C\u6240\u4EE5\u6CA1\u6709\u53EF\u9000\u7684\u90E8\u5206\u3002`
    );
    cls = 'tag-none';
  } else if (EXEMPT_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u2715 \uC774 \uC8FC(${stateName})\uB294 \uC8FC \uC18C\uB4DD\uC138\uB294 \uC788\uC9C0\uB9CC \uBCF5\uAD8C \uB2F9\uCCA8\uAE08\uC740 \uBCC4\uB3C4\uB85C \uBA74\uC81C\uD574\uC918\uC694. \uC774\uAC83\uB3C4 \uB3CC\uB824\uBC1B\uC744 \uAC8C \uC5C6\uB294 \uACBD\uC6B0\uC608\uC694.`,
      `\u2715 This state (${stateName}) has state income tax, but exempts lottery winnings specifically. This is also a case where there\u2019s nothing to get back.`,
      `\u2715 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u6709\u5DDE\u6240\u5F97\u7A0E\uFF0C\u4F46\u5F69\u7968\u4E2D\u5956\u91D1\u5355\u72EC\u514D\u7A0E\u3002\u8FD9\u4E5F\u662F\u6CA1\u6709\u53EF\u9000\u90E8\u5206\u7684\u60C5\u51B5\u3002`
    );
    cls = 'tag-none';
  } else if (UNCERTAIN_STATES.includes(stateCode)) {
    msg = pickLang(
      `\u26A0 \uC774 \uC8FC(${stateName})\uB294 \uC6D0\uCC9C\uC9D5\uC218\uC728 \uC815\uBCF4\uAC00 \uACF5\uC2DD \uC790\uB8CC\uB9C8\uB2E4 \uC870\uAE08\uC529 \uB2EC\uB77C\uC11C(8.75~9.5%) \uC815\uD655\uD55C \uD655\uC778\uC774 \uB354 \uD544\uC694\uD574\uC694. \uB2F9\uCCA8 \uC2DC \uC8FC \uBCF5\uAD8C \uACF5\uC2DD \uC0AC\uC774\uD2B8\uC5D0\uC11C \uC2E4\uC81C \uC6D0\uCC9C\uC9D5\uC218\uC728\uC744 \uAF2D \uD655\uC778\uD558\uC138\uC694.`,
      `\u26A0 This state (${stateName}) has withholding rate figures that vary slightly across official sources (8.75~9.5%), so it needs more checking. Be sure to confirm the actual withholding rate on the state lottery\u2019s official site if you win.`,
      `\u26A0 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u7684\u9884\u6263\u7A0E\u7387\u5728\u5B98\u65B9\u8D44\u6599\u4E2D\u7565\u6709\u5DEE\u5F02\uFF088.75~9.5%\uFF09\uFF0C\u9700\u8981\u8FDB\u4E00\u6B65\u786E\u8BA4\u3002\u4E2D\u5956\u65F6\u8BF7\u52A1\u5FC5\u5728\u8BE5\u5DDE\u5F69\u7968\u5B98\u7F51\u786E\u8BA4\u5B9E\u9645\u9884\u6263\u7A0E\u7387\u3002`
    );
    cls = 'tag-maybe';
  } else {
    msg = pickLang(
      `\u2139 \uC774 \uC8FC(${stateName})\uB294 \uC6D0\uCC9C\uC9D5\uC218\uC728\uC774 \uC57D ${(stateInfo.rate*100).toFixed(2)}%\uC608\uC694. \uBE44\uAC70\uC8FC\uC790\uB294 \uB300\uCCB4\uB85C \uC774 \uC6D0\uCC9C\uC9D5\uC218\uC728 \uC790\uCCB4\uAC00 \uCD5C\uC885 \uC138\uAE08\uC73C\uB85C \uD655\uC815\uB418\uB294 \uACBD\uC6B0\uAC00 \uB9CE\uC9C0\uB9CC, \uC2E4\uC81C\uB85C \uB354 \uB0C8\uB294\uC9C0\uB294 \uBBF8\uAD6D \uBE44\uAC70\uC8FC\uC790 \uC138\uAE08\uC2E0\uACE0(1040-NR)\uB85C \uC815\uC0B0\uD574\uBD10\uC57C \uC815\uD655\uD788 \uC54C \uC218 \uC788\uC5B4\uC694 \u2014 \uBB34\uC870\uAC74 \uD658\uAE09\uB41C\uB2E4\uB294 \uB73B\uC740 \uC544\uB2C8\uC5D0\uC694.`,
      `\u2139 This state (${stateName}) withholds about ${(stateInfo.rate*100).toFixed(2)}%. For nonresidents, this withholding often ends up being the final tax, but you can only know for sure by settling it through a US nonresident tax return (1040-NR) \u2014 a refund isn\u2019t guaranteed.`,
      `\u2139 \u8BE5\u5DDE\uFF08${stateName}\uFF09\u7684\u9884\u6263\u7A0E\u7387\u7EA6\u4E3A${(stateInfo.rate*100).toFixed(2)}%\u3002\u5BF9\u4E8E\u975E\u5C45\u6C11\u6765\u8BF4\uFF0C\u8FD9\u4E2A\u9884\u6263\u7A0E\u7387\u5F88\u591A\u65F6\u5019\u5C31\u662F\u6700\u7EC8\u7A0E\u989D\uFF0C\u4F46\u5B9E\u9645\u662F\u5426\u591A\u4EA4\u4E86\u7A0E\uFF0C\u9700\u8981\u901A\u8FC7\u7F8E\u56FD\u975E\u5C45\u6C11\u62A5\u7A0E\uFF081040-NR\uFF09\u6765\u7ED3\u7B97\u624D\u80FD\u786E\u5B9A \u2014 \u5E76\u4E0D\u610F\u5473\u7740\u4E00\u5B9A\u4F1A\u9000\u7A0E\u3002`
    );
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
  updateFaqTg2Card(); // 검색/카테고리와 무관하게, 세금 기준이 바뀌었을 수 있는 시점마다 같이 갱신
  const query = document.getElementById('faqSearch').value.trim().toLowerCase();
  // 세금 계산 기준(홈 화면의 KR/US/CN 토글)에 따라, 그 나라와 무관한 질문(예: CN 기준인데
  // 한국 국민연금 질문)은 아예 숨김. data-basis가 없으면 어느 기준에서나 다 관련 있는
  // 공통 질문이라는 뜻이라 항상 보여줌
  const currentBasis = sharedCountry || 'kr';
  const items = document.querySelectorAll('#view-faq .faq-item, #view-faq .refund-step-card[data-basis]');
  let visibleCount = 0;
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    const searchMatch = query === '' || text.includes(query);
    const catMatch = activeFaqCategory === 'all' || !item.dataset.cat || item.dataset.cat === activeFaqCategory;
    const basisMatch = !item.dataset.basis || item.dataset.basis.split(',').includes(currentBasis);
    const match = searchMatch && catMatch && basisMatch;
    item.style.display = match ? '' : 'none';
    if (match && item.classList.contains('faq-item')) visibleCount++;
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
  { date: '2022-11-07', game: 'powerball', amountUsd: 2040000000, cashUsd: 997600000, stateCode: 'CA', noteKo: '역대 최고액 (캘리포니아, 1인)', noteEn: 'All-time record (California, single winner)', noteZh: '历史最高纪录（加利福尼亚，1人独得）' },
  { date: '2025-09-06', game: 'powerball', amountUsd: 1787000000, cashUsd: 820600000, stateCode: 'AVG', noteKo: '역대 2위 (미주리·텍사스 2인 분할)', noteEn: '2nd all-time (Missouri & Texas, split 2 ways)', noteZh: '历史第二（密苏里·得克萨斯 2人平分）' },
  { date: '2016-01-13', game: 'powerball', amountUsd: 1586000000, cashUsd: 983400000, stateCode: 'AVG', noteKo: '캘리포니아·플로리다·테네시 3인 분할', noteEn: 'California, Florida & Tennessee, split 3 ways', noteZh: '加利福尼亚·佛罗里达·田纳西 3人平分' },
  { date: '2023-10-11', game: 'powerball', amountUsd: 1765000000, cashUsd: 774100000, stateCode: 'CA', noteKo: '캘리포니아, 1인', noteEn: 'California, single winner', noteZh: '加利福尼亚，1人独得' },
  { date: '2023-08-08', game: 'megamillions', amountUsd: 1602000000, cashUsd: 794200000, stateCode: 'FL', noteKo: '역대 메가밀리언즈 최고액 (플로리다, 1인)', noteEn: 'Mega Millions all-time record (Florida, single winner)', noteZh: '超级百万历史最高纪录（佛罗里达，1人独得）' },
  { date: '2026-07-16', game: 'powerball', amountUsd: 1200000000 },
  { date: '2026-07-16', game: 'megamillions', amountUsd: 450000000 },
];

function renderJackpotHistory(){
  const listEl = document.getElementById('jackpot-history-list');
  if (!listEl) return;
  if (!JACKPOT_HISTORY.length) {
    listEl.innerHTML = `<p class="jackpot-history-empty">${pickLang('아직 기록이 없어요.', 'No records yet.', '暂无记录。')}</p>`;
    return;
  }
  const gameNameKo = { powerball: '파워볼', megamillions: '메가밀리언즈' };
  const gameNameEn = { powerball: 'Powerball', megamillions: 'Mega Millions' };
  const gameNameZh = { powerball: '强力球', megamillions: '超级百万' };
  const sorted = [...JACKPOT_HISTORY].sort((a, b) => b.date.localeCompare(a.date));
  listEl.innerHTML = sorted.map(entry => {
    const cashUsd = entry.cashUsd || entry.amountUsd * CASH_VALUE_RATIO;
    const cashKrw = cashUsd * EXCHANGE_RATE;
    const rKr = calcTakeHome(cashKrw / 100000000, 'kr');
    const rUs = calcTakeHome(cashKrw / 100000000, 'us', entry.stateCode || 'AVG');
    const krLabel = formatWon(rKr.final);
    const usLabel = formatWon(rUs.final);
    const gameLabel = pickLang(gameNameKo[entry.game], gameNameEn[entry.game], gameNameZh[entry.game]);
    const note = pickLang(entry.noteKo, entry.noteEn, entry.noteZh);
    const noteHtml = note ? `<p class="jh-note">${note}</p>` : '';
    return `<div class="jackpot-history-row">
      <div class="jh-top">
        <span class="jh-date">${entry.date}</span>
        <span class="jh-game">${gameLabel}</span>
      </div>
      ${noteHtml}
      <div class="jh-amounts">
        <span class="jh-amt-item"><span class="jh-amt-label">${pickLang('한국 거주자', 'Korea resident', '韩国居民')}</span><span class="jh-amt">${krLabel}</span></span>
        <span class="jh-amt-item"><span class="jh-amt-label">${pickLang('미국 거주자', 'US resident', '美国居民')}</span><span class="jh-amt">${usLabel}</span></span>
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
  const isZhCard = (typeof currentLang !== 'undefined' && currentLang === 'zh');
  const 억 = isEnCard
    ? (n) => formatWonEn(n / 100000000)
    : (n) => Math.round(n / 100000000).toLocaleString(isZhCard ? 'zh-CN' : 'ko-KR') + (isZhCard ? '亿韩元' : '억원');
  document.getElementById('jackpot-card-amt').textContent = pickLang('약 ', 'About ', '约') + 억(krw * CASH_VALUE_RATIO);
  document.getElementById('jackpot-card-amt-note').textContent = pickLang('(일시불 세전)', '(lump-sum, pre-tax)', '(一次性支付，税前)');

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
    const isZhJc = (typeof currentLang !== 'undefined' && currentLang === 'zh');
    const 억 = isEnJc
      ? (n) => formatWonEn(n / 100000000)
      : (n) => Math.round(n / 100000000).toLocaleString(isZhJc ? 'zh-CN' : 'ko-KR') + (isZhJc ? '亿韩元' : '억원');
    const about = pickLang('약 ', 'About ', '约');
    document.getElementById('jc-jackpot').textContent = about + 억(announcedKrw);
    document.getElementById('jc-cash').textContent = about + 억(cashKrw);
    document.getElementById('jc-final').textContent = about + formatWon(r.final);
    document.getElementById('jc-note-basis').textContent = pickLang(
      `한국 거주자 기준 (미국 비거주자 원천징수 30% + 한국 종합소득세 누진세율/FTC 적용, 환율 약 ${EXCHANGE_RATE.toLocaleString('ko-KR')}원 적용)`,
      `Korea resident basis (30% US non-resident withholding + Korean progressive income tax/FTC, ~${EXCHANGE_RATE.toLocaleString('en-US')} KRW/USD)`,
      `以韩国居民为基准（美国非居民预扣30% + 韩国累进所得税/FTC 抵免，汇率约${EXCHANGE_RATE.toLocaleString('zh-CN')}韩元/美元）`
    );

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
  if (isOpen) {
    el.textContent = pickLang('👆 카드를 다시 누르면 접혀요', '👆 Tap the card again to collapse', '👆 再次点击卡片可收起');
  } else {
    el.textContent = pickLang('👇 눌러서 세후 실수령액 보기', '👇 Tap to see your after-tax take-home', '👇 点击查看税后实得金额');
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

// 영어/중국어 랜딩페이지(korean-abroad-lottery-tax.html, china-resident-us-lottery-tax.html 등)에서
// "index.html?lang=en" 또는 "index.html?lang=zh"로 들어왔을 때 기본값인 한국어 화면이 아니라
// 바로 해당 언어로 보이도록 함
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang');
  if (lang === 'en' || lang === 'zh') {
    setLanguage(lang);
    // 한 번 적용한 뒤엔 URL에서 ?lang= 을 지워야 함 — 남겨두면, 방문자가 이후 언어 토글로
    // 직접 다른 언어를 골라도 새로고침하는 순간 주소창에 남아있는 이 값이 다시 강제로
    // 적용되면서 "내가 방금 고른 언어가 마음대로 바뀌는" 것처럼 보이는 문제가 있었음
    params.delete('lang');
    const newSearch = params.toString();
    history.replaceState(null, '', location.pathname + (newSearch ? '?' + newSearch : '') + location.hash);
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
  el.textContent = pickLang(
    `🤑 ${amt}이면 얼마나 살 수 있을까요? (재미로 보기)`,
    `🤑 What could ${amt} buy? (just for fun)`,
    `🤑 ${amt}能买到什么？（纯属娱乐）`
  );
}

// 재미로 보는 "이 돈이면 뭘 살 수 있나" 비교 대상 — 표시 언어가 아니라 실제 세금 계산 기준(country)에
// 맞춰야 함(예: 중국 기준으로 계산했는데 한국 강남 아파트/원화 가격이 나오면 앞뒤가 안 맞음).
// 가격은 참고용 대략치이며 출처: 페라리 로마 — 한국 공식가 약 3.5억원, 미국 MSRP 약 $275,000,
// 중국 공식가 약 RMB 276만(수입세 포함 실제 거래가는 더 높음); 스타벅스 아메리카노 — 한국 5,000원,
// 미국 평균 약 $3.75, 중국 30위안(2026년 기준 동결); 아파트는 각 나라에서 "부의 상징"으로 통하는
// 기준을 사용 — 강남 25억원, 맨해튼 $1.5M, 상하이 고급 아파트 3,000만 위안.
const FLEX_REF = {
  kr: {
    apt:    { currency: 'krw', price: 2500000000, label: () => pickLang('강남 아파트 (25억 기준)', 'Gangnam apartment (based on ₩2.5B)', '江南公寓（按25亿韩元计算）') },
    car:    { currency: 'krw', price: 350000000,  label: () => pickLang('페라리 로마 (3.5억원 기준)', 'Ferrari Roma (based on ₩350M)', '法拉利Roma（按3.5亿韩元计算）') },
    coffee: { currency: 'krw', price: 5000,        label: () => pickLang('스타벅스 아메리카노 (5천원)', 'Starbucks Americano (₩5,000)', '星巴克美式咖啡（5,000韩元）') }
  },
  us: {
    apt:    { currency: 'usd', price: 1500000, label: () => pickLang('맨해튼 아파트 (150만 달러 기준)', 'Manhattan apartment (based on $1.5M)', '曼哈顿公寓（按150万美元计算）') },
    car:    { currency: 'usd', price: 275000,  label: () => pickLang('페라리 로마 (27.5만 달러 기준)', 'Ferrari Roma (based on $275,000)', '法拉利Roma（按27.5万美元计算）') },
    coffee: { currency: 'usd', price: 3.75,    label: () => pickLang('스타벅스 아메리카노 (3.75달러)', 'Starbucks Americano ($3.75)', '星巴克美式咖啡（3.75美元）') }
  },
  cn: {
    apt:    { currency: 'cny', price: 30000000, label: () => pickLang('상하이 고급 아파트 (3천만 위안 기준)', 'Shanghai luxury apartment (based on ¥30M)', '上海高档公寓（按3000万元计算）') },
    car:    { currency: 'cny', price: 2760000,  label: () => pickLang('페라리 로마 (276만 위안 기준)', 'Ferrari Roma (based on ¥2.76M)', '法拉利Roma（按276万元计算）') },
    coffee: { currency: 'cny', price: 30,       label: () => pickLang('스타벅스 아메리카노 (30위안)', 'Starbucks Americano (¥30)', '星巴克美式咖啡（30元）') }
  }
};

function updateFlexBox(finalEok, country){
  updateFunSummary(finalEok);
  const wonAmount = finalEok * 100000000;
  const usdAmount = wonAmount / EXCHANGE_RATE;
  const cnyAmount = usdAmount * EXCHANGE_RATE_CNY;
  const amountByCurrency = { krw: wonAmount, usd: usdAmount, cny: cnyAmount };
  const ref = FLEX_REF[country] || FLEX_REF.kr;
  const localeStr = currentLang === 'en' ? 'en-US' : (currentLang === 'zh' ? 'zh-CN' : 'ko-KR');

  const apt = Math.floor(amountByCurrency[ref.apt.currency] / ref.apt.price);
  const car = Math.floor(amountByCurrency[ref.car.currency] / ref.car.price);
  const coffeeCups = Math.floor(amountByCurrency[ref.coffee.currency] / ref.coffee.price);
  const coffeeYears = Math.floor(coffeeCups / 3 / 365);

  document.getElementById('flex-apt-label').textContent = ref.apt.label();
  document.getElementById('flex-car-label').textContent = ref.car.label();
  document.getElementById('flex-coffee-label').textContent = ref.coffee.label();

  document.getElementById('flex-apt').textContent = apt.toLocaleString(localeStr) + pickLang('채', ' units', '套');
  document.getElementById('flex-car').textContent = car.toLocaleString(localeStr) + pickLang('대', ' cars', '辆');
  document.getElementById('flex-coffee').textContent = coffeeYears > 0
    ? pickLang(`하루 3잔씩 ${coffeeYears.toLocaleString(localeStr)}년`, `3/day for ${coffeeYears.toLocaleString(localeStr)} years`, `每天3杯，喝${coffeeYears.toLocaleString(localeStr)}年`)
    : coffeeCups.toLocaleString(localeStr) + pickLang('잔', ' cups', '杯');
}

// FAQ "세금 가이드" 3칸 요약 카드의 2번째 칸 — "다른 나라에서도 또 내는지"는 세금 계산
// 기준(kr/us/cn)에 따라 완전히 다른 질문이라(한국은 종합소득세, 미국은 이미 federal에 다 포함,
// 중국은 우연소득세), 항상 "한국에서도 또 내요?"로 고정돼 있으면 미국·중국 기준에서는 내용이 안 맞음
const FAQ_TG2 = {
  kr: {
    title: () => pickLang('한국에서도 또 내요?', 'Do I also pay in Korea?', '在韩国也要交税吗？'),
    sub: () => pickLang('종합소득세 누진세율(최고 45%), 외국납부세액공제(FTC)로 조정 — 참고용 계산', 'Progressive comprehensive income tax (up to 45%), adjusted by Foreign Tax Credit (FTC) — reference estimate', '综合所得税累进税率（最高45%），通过外国税收抵免（FTC）调整 — 仅供参考')
  },
  us: {
    title: () => pickLang('주(State) 세금은 얼마나 붙어요?', 'How much does state tax add?', '州税会加多少？'),
    sub: () => pickLang('주에 따라 0%~10.9%까지 다양해요 — 텍사스·플로리다 등은 아예 없어요', 'Ranges from 0%–10.9% depending on the state — some states like Texas and Florida have none', '因州而异，从0%到10.9%不等 — 德克萨斯、佛罗里达等州完全没有州税')
  },
  cn: {
    title: () => pickLang('중국에서도 또 내요?', 'Do I also pay in China?', '在中国也要交税吗？'),
    sub: () => pickLang('우연소득 20% 단일세율 — 미국에서 낸 세금은 세액공제로 상계 가능', 'Flat 20% rate on incidental income — the US tax already paid can offset it via tax credit', '偶然所得20%单一税率 — 已在美国缴纳的税款可通过税收抵免抵消')
  }
};

// FAQ 상단 소개문 — "국세청 상담 기준"이라는 출처 표기가 세금 기준(kr/us/cn)과 무관하게
// 항상 똑같이 나오고 있었음. us/cn 기준 방문자에게는 실제로 확인 근거가 국세청이 아니라
// IRS·중국 국가세무총국 쪽인데 "국세청"이라고만 말하는 건 부정확해서, 기준별로 출처를 다르게 표기함
const FAQ_PANEL_DESC = {
  kr: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 국세청 상담 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on Korea’s National Tax Service consultations', '搜索到这里的朋友们经常问的问题 · 已通过韩国国税厅咨询确认'),
  us: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · IRS 공식 자료 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on official IRS sources', '搜索到这里的朋友们经常问的问题 · 已根据美国国税局（IRS）官方资料确认'),
  cn: () => pickLang('검색하다 오신 분들이 자주 물어보는 질문 모았어요 · 중국 국가세무총국 공고 기준으로 확인된 정보예요', 'Common questions from people who searched their way here · Confirmed based on China’s State Taxation Administration notices', '搜索到这里的朋友们经常问的问题 · 已根据中国国家税务总局公告确认')
};

function updateFaqPanelDesc(){
  const el = document.getElementById('faq-panel-desc');
  if (!el) return;
  const entry = FAQ_PANEL_DESC[sharedCountry] || FAQ_PANEL_DESC.kr;
  el.textContent = entry();
}

function updateFaqTg2Card(){
  const titleEl = document.getElementById('faq-tg2-title');
  const subEl = document.getElementById('faq-tg2-sub');
  updateFaqPanelDesc();
  if (!titleEl || !subEl) return;
  const entry = FAQ_TG2[sharedCountry] || FAQ_TG2.kr;
  titleEl.textContent = entry.title();
  subEl.textContent = entry.sub();
}

const DREAM_DATA = {
  freedom: {
    emoji: '🕊️',
    title: '자유의 몸', desc: '월요일 아침이 더 이상 두렵지 않은 삶. 사표는 이미 냈어요.',
    titleEn: 'Free at last', descEn: 'Monday mornings don\u2019t scare you anymore. You already handed in your resignation.',
    titleZh: '自由之身', descZh: '不再害怕星期一早晨的生活。辞职信已经交了。'
  },
  family:  {
    emoji: '🏠',
    title: '가족 부동산왕', desc: '온 가족이 집 걱정 없이 사는 명절, 그 주인공이 바로 나예요.',
    titleEn: 'Family real-estate mogul', descEn: 'The whole family lives worry-free about housing \u2014 and you\u2019re the reason why.',
    titleZh: '家族房产大亨', descZh: '全家人过节不再为住房发愁，而这一切都是因为你。'
  },
  travel:  {
    emoji: '✈️',
    title: '지구 한 바퀴 클럽', desc: '여권에 도장이 모자랄 지경이에요. 다음 목적지는 어디로 갈까요?',
    titleEn: 'Around-the-world club', descEn: 'Your passport is running out of pages for stamps. Where\u2019s next?',
    titleZh: '环游世界俱乐部', descZh: '护照上的印章都快盖不下了。下一站去哪里呢？'
  },
  calm:    {
    emoji: '💼',
    title: '현실주의자', desc: '화려하게 안 살아도 괜찮아요. 잔고만 봐도 웃음이 나요.',
    titleEn: 'The realist', descEn: 'No need for a flashy lifestyle \u2014 just checking your balance makes you smile.',
    titleZh: '现实主义者', descZh: '不用活得多风光也没关系。光是看着余额就会笑出来。'
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
  const finalAmt = finalAmtOverride !== undefined ? finalAmtOverride : document.getElementById('home-final-amt').textContent;
  document.getElementById('dream-title').textContent = data.emoji + ' ' + pickLang(data.title, data.titleEn, data.titleZh);
  document.getElementById('dream-desc').textContent = pickLang(data.desc, data.descEn, data.descZh);
  document.getElementById('dream-amt').textContent = pickLang(finalAmt + '의 주인공', `The one taking home ${finalAmt}`, `坐拥${finalAmt}的人`);
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
  const shareText = pickLang(
    `나는 [${title}]! ${amt}. 너는 당첨되면 뭐부터 할래?`,
    `I'm [${title}]! ${amt}. What would you do first if you won?`,
    `我是[${title}]！${amt}。如果你中奖了，会先做什么？`
  );
  const shareUrl = location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: pickLang('당첨되면 나는?', 'What would I do if I won?', '如果中奖了，我会……'), text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    alert(pickLang('복사됐어요! 카톡에 붙여넣기 해보세요 :)', 'Copied! Paste it anywhere you like :)', '已复制！粘贴到任何地方分享吧 :)'));
  } catch (e) {
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享'), `${shareText} ${shareUrl}`);
  }
}

async function shareResult(){
  const amountText = document.getElementById('homeAmountInput').value || '100';
  const finalAmt = document.getElementById('home-final-amt').textContent;
  const homeCountryVal = document.getElementById('homeCountrySelect').value;
  const country = homeCountryVal === 'us'
    ? pickLang('미국 거주자', 'US resident', '美国居民')
    : homeCountryVal === 'cn'
    ? pickLang('중국 거주자', 'China resident', '中国居民')
    : pickLang('한국 거주자', 'Korea resident', '韩国居民');
  const shareText = pickLang(
    `미국 복권(${amountText} Million USD) 당첨되면 ${country} 기준 실수령액이 약 ${finalAmt}이래요. 세금 떼고 나면 실제로 얼마 남는지 참택스에서 계산해보세요! (참고용 시뮬레이션 결과예요)`,
    `If I won the US lottery (${amountText} Million USD), my take-home as a ${country} would be about ${finalAmt}. See how much you'd actually keep after tax on ChamTax! (This is a reference simulation)`,
    `如果中了美国彩票（${amountText} Million USD），按${country}计算实得金额大约是${finalAmt}。来ChamTax算算你扣税后实际能拿到多少吧！（仅供参考的模拟计算）`
  );
  const shareUrl = location.href;

  if (navigator.share) {
    try {
      await navigator.share({ title: pickLang('미국 복권 세금 계산기 - 참택스', 'US Lottery Tax Calculator - ChamTax', '美国彩票税金计算器 - ChamTax'), text: shareText, url: shareUrl });
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
      btn.textContent = pickLang('✅ 링크가 복사됐어요', '✅ Link copied', '✅ 链接已复制');
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    // 클립보드 API까지 막힌 환경(카카오톡 등 인앱 브라우저 등) — 사용자가 직접 보고 복사할 수 있게 표시
    window.prompt(pickLang('아래 내용을 길게 눌러 복사해서 공유해주세요', 'Press and hold to copy, then share it', '长按下方内容复制后分享'), `${shareText} ${shareUrl}`);
  }
}

async function shareRefundChecklist(){
  const shareText = pickLang(
    '\uB098\uB3C4 \uBAA8\uB974\uAC8C \uBABB \uBC1B\uC740 \uB3C8\uC774 \uC788\uB294\uC9C0 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8\uB85C \uD655\uC778\uD574\uBD10\uC694. \uAD6D\uC138\uD658\uAE09\uAE08\uB9CC \uB9E4\uB144 \uC218\uCC9C\uC5B5 \uC6D0\uB300\uAC00 \uC548 \uCC3E\uC544\uAC00\uC11C \uC0AC\uB77C\uC9C4\uB300\uC694 (5\uB144 \uC9C0\uB098\uBA74 \uAD6D\uACE0\uB85C \uADC0\uC18D). \uCC38\uD0DD\uC2A4 FAQ\uC5D0\uC11C 10\uBD84\uC774\uBA74 \uD655\uC778 \uB05D\uB098\uC694!',
    'I checked whether I had unclaimed money using this checklist. Apparently hundreds of billions of won in unclaimed tax refunds go unclaimed every year in Korea (reverts to the treasury after 5 years). Takes 10 minutes to check on the ChamTax FAQ!',
    '\u6211\u7528\u8FD9\u4E2A\u6E05\u5355\u786E\u8BA4\u4E86\u81EA\u5DF1\u662F\u5426\u6709\u4E0D\u77E5\u9053\u7684\u672A\u9886\u53D6\u7684\u94B1\u3002\u636E\u8BF4\u97E9\u56FD\u6BCF\u5E74\u90FD\u6709\u6570\u767E\u4EBF\u97E9\u5143\u7684\u7A0E\u6B3E\u6CA1\u4EBA\u9886\u53D6\uFF085\u5E74\u540E\u5F52\u56FD\u5E93\uFF09\u3002\u5728ChamTax\u7684FAQ\u91CC10\u5206\u949F\u5C31\u80FD\u786E\u8BA4\u5B8C\uFF01'
  );
  const shareUrl = location.href;
  const btn = document.getElementById('refund-share-btn');

  if (navigator.share) {
    try {
      await navigator.share({ title: pickLang(
        '\uB098\uB3C4 \uBAA8\uB974\uB294 \uC7A0\uC790\uB294 \uB0B4 \uB3C8 \uCC3E\uAE30 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8',
        'Find money you didn\u2019t know you had \u2014 checklist',
        '\u627E\u51FA\u4F60\u4E0D\u77E5\u9053\u7684\u6C89\u7761\u8D44\u4EA7 \u2014 \u68C0\u67E5\u6E05\u5355'
      ), text: shareText, url: shareUrl });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    if (btn) {
      const original = btn.textContent;
      btn.textContent = pickLang('\u2705 \uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB410\uC5B4\uC694', '\u2705 Link copied', '\u2705 \u94FE\u63A5\u5DF2\u590D\u5236');
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('copied'); }, 2000);
    }
  } catch (e) {
    window.prompt(pickLang(
      '\uC544\uB798 \uB0B4\uC6A9\uC744 \uAE38\uAC8C \uB20C\uB7EC \uBCF5\uC0AC\uD574\uC11C \uACF5\uC720\uD574\uC8FC\uC138\uC694',
      'Press and hold to copy, then share it',
      '\u957F\u6309\u4E0B\u65B9\u5185\u5BB9\u590D\u5236\u540E\u5206\u4EAB'
    ), `${shareText} ${shareUrl}`);
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
  document.querySelectorAll('#homeCountryToggle .country-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.country === country);
  });
  updateHomeCalc();
  filterFaq(); // FAQ가 세금 기준(KR/US/CN)에 따라 관련 없는 질문은 숨기므로, 기준 바뀔 때마다 다시 걸러줌
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
    const rateStr = EXCHANGE_RATE.toLocaleString(currentLang === 'zh' ? 'zh-CN' : 'ko-KR');
    // 국가별로 실제 근거가 되는 과세당국이 다름 — 중국 거주자 시나리오에 한국 국세청 자료가
    // 근거인 것처럼 표기하면 사실과 다르므로, 국가에 맞는 과세당국만 표기함
    const authorityText = (country === 'cn')
      ? pickLang('중국 국가세무총국·IRS', 'China State Taxation Administration/IRS', '中国国家税务总局·IRS')
      : (country === 'us')
      ? pickLang('IRS', 'IRS', 'IRS')
      : pickLang('국세청·IRS', 'IRS/NTS', 'IRS·韩国国税厅');
    // 환율은 한국 거주자 시나리오에서만 실제 세액(누진세율 구간) 산정에 실질적으로 쓰임 —
    // 미국·중국 거주자는 세금 자체가 달러 기준 정률로 정해지고, 원화 환산은 비교를 위한 표시일 뿐이라
    // (아래 usdNote에서 별도 안내) "공식 자료 기반" 문구에 환율을 같이 넣으면 마치 환율이 그 나라
    // 세법 계산에 쓰인 것처럼 오해될 수 있어 kr에서만 환율 문구를 붙임
    trustLine.textContent = (country === 'kr')
      ? pickLang(
          `${authorityText} 공식 자료 기반 · 2026년 세율 · 환율 ${rateStr}원 적용`,
          `Based on ${authorityText} official data · 2026 tax rates · rate ${rateStr} KRW/USD`,
          `基于${authorityText}官方数据 · 2026年税率 · 汇率${rateStr}韩元/美元`
        )
      : pickLang(
          `${authorityText} 공식 자료 기반 · 2026년 세율 (원화 환산은 비교용)`,
          `Based on ${authorityText} official data · 2026 tax rates (KRW figure is for comparison only)`,
          `基于${authorityText}官方数据 · 2026年税率（韩元金额仅供对比参考）`
        );
  }

  const milestoneEl = document.getElementById('home-milestone');
  const newMilestoneTier = final >= 10000 ? 2 : (final >= 1000 ? 1 : 0);
  if (newMilestoneTier === 2) {
    milestoneEl.textContent = pickLang('🎉 실수령액만 1조원이 넘어요!', '🎉 Your take-home tops ₩1 trillion!', '🎉 实得金额突破1万亿韩元！');
    milestoneEl.style.display = 'block';
  } else if (newMilestoneTier === 1) {
    milestoneEl.textContent = pickLang('💎 실수령액이 1,000억원을 넘었어요', '💎 Your take-home tops ₩100 billion', '💎 实得金额突破1000亿韩元');
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
  document.getElementById('home-final-basis').textContent = pickLang(
    formatWon(억) + ' 당첨 기준 · ' + basisSuffix,
    formatWon(억) + ' prize basis · ' + basisSuffix,
    formatWon(억) + ' 中奖基准 · ' + basisSuffix
  );
  const usdMillions = Math.round(usd / 1000000).toLocaleString(currentLang === 'en' ? 'en-US' : (currentLang === 'zh' ? 'zh-CN' : 'ko-KR'));
  document.getElementById('home-final-basis-mini').textContent = pickLang(
    `${usdMillions}M USD 당첨 · ${basisSuffix}`,
    `${usdMillions}M USD prize · ${basisSuffix}`,
    `${usdMillions}M USD 中奖 · ${basisSuffix}`
  );
  document.getElementById('home-tax1-label').textContent = label1;
  document.getElementById('home-tax1-val').textContent = val1;
  document.getElementById('home-tax2-label').textContent = label2;
  document.getElementById('home-tax2-val').textContent = val2;

  const taxImpactPct = 억 > 0 ? Math.round(100 - (final / 억 * 100)) : 0;
  document.getElementById('tax-impact-before').textContent = formatWon(억);
  document.getElementById('tax-impact-after').textContent = formatWon(final);
  document.getElementById('tax-impact-diff').textContent = '-' + formatWon(억 - final) + ` (${taxImpactPct}%)`;

  const usdNote = document.getElementById('home-usd-note');
  const cnyNote = document.getElementById('home-cny-note');
  if (country === 'us' || country === 'cn') {
    // 미국·중국 거주자 모두 실제로는 달러(USD)로 그대로 받고, 자국 세법상 세액도 원래는
    // 그 나라 통화 기준으로 계산됨 — 여기 보이는 원화 금액은 한국 기준과 비교하기 위한 표시일 뿐이라
    // 실수령률(final/억)을 그대로 USD 원금에 곱해서 실제 달러 수령액을 구함 (국가별 세율 하드코딩 없이 공통 처리)
    const finalUsd = Math.round(usd * (final / 억));
    usdNote.textContent = pickLang(
      `💵 실제로는 달러($${finalUsd.toLocaleString('en-US')})로 그대로 받아요 — 원화는 한국 기준과 비교하기 위한 참고용이에요`,
      `💵 You actually receive USD ($${finalUsd.toLocaleString('en-US')}) directly — the KRW figure is just for comparison with the Korea basis`,
      `💵 实际上会直接以美元（$${finalUsd.toLocaleString('en-US')}）收到 —— 韩元金额仅供与韩国标准对比参考`
    );
    usdNote.style.display = 'block';

    // 중국 거주자는 실제 생활 통화가 위안화라, 달러 수령액만 보여주면 감이 잘 안 옴 —
    // 위안화 참고 환산액도 같이 보여줌(실시간 환율 시도, 실패 시 기본값 사용 — KRW와 동일한 방식)
    if (country === 'cn') {
      const finalCny = Math.round(finalUsd * EXCHANGE_RATE_CNY);
      cnyNote.textContent = pickLang(
        `💴 위안화로는 대략 ¥${finalCny.toLocaleString('zh-CN')}위안이에요 (참고용 환율)`,
        `💴 That's roughly ¥${finalCny.toLocaleString('en-US')} CNY (reference exchange rate)`,
        `💴 折合人民币约¥${finalCny.toLocaleString('zh-CN')}元（仅供参考的汇率）`
      );
      cnyNote.style.display = 'block';
    } else {
      cnyNote.style.display = 'none';
    }
  } else {
    usdNote.style.display = 'none';
    cnyNote.style.display = 'none';
  }

  const showFiling = (country === 'us');
  document.getElementById('home-state-row').style.display = showFiling ? 'flex' : 'none';
  document.getElementById('home-state-label').style.display = showFiling ? 'block' : 'none';
  updateFlexBox(final, country);
  document.getElementById('home-filing-label').style.display = showFiling ? 'block' : 'none';
  document.getElementById('home-filing-small').style.display = showFiling ? 'block' : 'none';
  const filingNote = document.getElementById('home-filing-note');
  if (!showFiling) {
    filingNote.textContent = (country === 'cn')
      ? pickLang(
          '💡 중국 거주자는 어느 주(State)에서 당첨되든 미국 비거주자 원천징수(30%)가 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 China residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 中国税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税'
        )
      : pickLang(
          '💡 한국 거주자는 어느 주(State)에서 당첨되든 미국 비거주자 원천징수(30%)가 동일하게 적용돼요 — 주세는 따로 계산하지 않아도 돼요.',
          '💡 Korean residents face the same 30% US non-resident withholding regardless of which state they won in — no need to factor in state tax.',
          '💡 韩国税收居民无论在哪个州中奖，都统一适用美国非居民30%预扣税——不需要另外考虑州税'
        );
  }
  filingNote.style.display = showFiling ? 'none' : 'block';
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
  // 입력창이 비어있을 땐 0으로 계산하지 않고 마지막 유효값(sharedAmountUsd)을 씀 — updateHomeCalc()와
  // 동일한 패턴. 이게 없으면 입력칸을 지웠을 때 실수령액이 0으로 고정되고, 그 상태로 홈 화면에
  // 돌아가도(공유 상태라) 0이 그대로 유지되는 버그가 있었음
  const typedValue = parseMillionsInput(document.getElementById('amountInput').value);
  const usd = usdOverride !== undefined ? usdOverride : (typedValue > 0 ? typedValue * 1000000 : sharedAmountUsd);
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
  { code: 'kr', flagCode: 'KR', label: '한국 거주자', labelEn: 'Korea resident', labelZh: '韩国居民', implemented: true, needsState: false },
  { code: 'us', flagCode: 'US', label: '미국 거주자', labelEn: 'US resident', labelZh: '美国居民', implemented: true, needsState: true },
  { code: 'vn', flagCode: 'VN', label: '베트남 거주자 (실제 베트남 거주 기준)', labelEn: 'Vietnam resident (living in Vietnam)', labelZh: '越南居民（实际住在越南）', implemented: false, needsState: false },
  { code: 'cn', flagCode: 'CN', label: '중국 거주자 (실제 중국 거주 기준)', labelEn: 'China resident (living in China)', labelZh: '中国居民（实际住在中国）', implemented: true, needsState: false, detailPage: 'china-resident-us-lottery-tax.html', detailLabel: '中文详情 →' },
];

// "한국에 사는 OO 국적자" 안내 페이지 목록 — 실제 그 나라 세법이 아니라 한국 세법(위 kr 기준)을
// 그대로 따르는 번역 콘텐츠라서, COUNTRY_TAX_PROFILES(진짜 다른 나라 세금 비교)와는 완전히 분리해서 관리함.
// 새 언어 추가할 땐 이 배열에 한 줄만 추가하면 됨.
const LANGUAGE_CONTENT_PAGES = [
  { flagCode: 'VN', label: '한국에 사는 베트남분이라면', labelEn: 'Living in Korea as a Vietnamese national', labelZh: '住在韩国的越南人', contentPage: 'vietnamese-in-korea-lottery-tax.html', contentLabel: 'Tiếng Việt →' },
];

// 국기 이모지(regional indicator 시퀀스)는 기기·브라우저에 따라 실제 국기 대신 "KR" 같은
// 문자로 깨져서 나오는 경우가 있어서(특히 일부 임베디드 웹뷰), 이모지 대신 항상 동일하게
// 렌더링되는 색 배지(span.flag-badge)로 통일해서 씀
function makeFlagBadge(code){
  const span = document.createElement('span');
  span.className = 'flag-badge';
  span.textContent = code;
  return span;
}

function renderLanguageContentLinks(){
  const container = document.getElementById('otherLanguagesList');
  if (!container) return;
  container.innerHTML = '';
  LANGUAGE_CONTENT_PAGES.forEach(item => {
    const row = document.createElement('div');
    row.className = 'other-lang-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'other-lang-label';
    labelEl.append(makeFlagBadge(item.flagCode), document.createTextNode(' ' + pickLang(item.label, item.labelEn, item.labelZh)));
    const linkEl = document.createElement('a');
    linkEl.className = 'other-lang-link';
    linkEl.href = item.contentPage;
    linkEl.textContent = item.contentLabel;
    row.append(labelEl, linkEl);
    container.appendChild(row);
  });
}

function updateSideBySide(eok, stateCode){
  const grid = document.getElementById('sideByCountryGrid');
  const breakdownContainer = document.getElementById('sideBreakdownContainer');
  if (!grid || !breakdownContainer) return;
  grid.innerHTML = '';
  breakdownContainer.innerHTML = '';

  COUNTRY_TAX_PROFILES.forEach(profile => {
    const baseLabelText = pickLang(profile.label, profile.labelEn, profile.labelZh);
    // labelText가 뒤에 (주 이름) 등 접미사가 붙을 수 있어서, 배지+본문 텍스트를 한번에 만들어주는
    // 헬퍼로 side-card-flag/side-group-label 양쪽에 그대로 재사용함
    function buildLabelNode(suffix){
      const frag = document.createDocumentFragment();
      frag.append(makeFlagBadge(profile.flagCode), document.createTextNode(' ' + baseLabelText + (suffix || '')));
      return frag;
    }

    if (!profile.implemented) {
      // 데이터가 아직 준비 안 된 나라 — 카드만 "준비 중"으로 보여주고 breakdown은 생략
      const card = document.createElement('div');
      card.className = 'side-card';
      const amtEl = document.createElement('p');
      amtEl.className = 'side-card-amt';
      amtEl.style.cssText = 'color:var(--text-muted); font-size:16px;';
      amtEl.textContent = pickLang('준비 중', 'Coming soon', '准备中');
      const flagP = document.createElement('p'); flagP.className = 'side-card-flag'; flagP.appendChild(buildLabelNode());
      card.appendChild(flagP);
      card.appendChild(amtEl);
      grid.appendChild(card);
      return;
    }

    const result = calcTakeHome(eok, profile.code, profile.needsState ? (stateCode || 'AVG') : null);
    const pct = eok > 0 ? (result.final / eok * 100) : 0;
    let stateSuffix = '';
    if (profile.needsState) {
      const stateInfo = STATE_TAX_RATES[stateCode] || STATE_TAX_RATES.AVG;
      const stateLabelRaw = pickLang(stateInfo.label, stateInfo.labelEn, stateInfo.labelZh);
      const stateLabel = stateLabelRaw.replace(/\s*\(예시\)|\s*\(example\)/i, '').replace(/\s*（示例）/, '');
      stateSuffix = ` (${stateLabel})`;
    }

    const card = document.createElement('div');
    card.className = 'side-card';
    const flagEl = document.createElement('p'); flagEl.className = 'side-card-flag'; flagEl.appendChild(buildLabelNode(stateSuffix));
    const amtEl = document.createElement('p'); amtEl.className = 'side-card-amt'; amtEl.textContent = formatWon(result.final);
    const rateEl = document.createElement('p'); rateEl.className = 'side-card-rate';
    rateEl.textContent = pickLang('실수령률 약 ', 'Take-home rate about ', '实得比例约') + pct.toFixed(1) + '%';
    card.append(flagEl, amtEl, rateEl);
    if (profile.detailPage) {
      const detailEl = document.createElement('a');
      detailEl.className = 'side-card-detail-link';
      detailEl.href = profile.detailPage;
      detailEl.textContent = profile.detailLabel;
      card.appendChild(detailEl);
    }
    grid.appendChild(card);

    const groupLabel = document.createElement('p'); groupLabel.className = 'side-group-label'; groupLabel.appendChild(buildLabelNode(stateSuffix));
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

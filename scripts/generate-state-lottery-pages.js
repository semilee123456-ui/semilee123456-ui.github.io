#!/usr/bin/env node
/*
 * scripts/generate-state-lottery-pages.js
 *
 * 언제 다시 쓰나: *-lottery-tax.html류(주별 복권세금 랜딩페이지, california-lottery-tax.html이
 * 원본 템플릿)를 다음 인구 상위 주 묶음으로 더 늘릴 때. 2026-08-18 세션에서 처음 작성 —
 * 상위 10개 주(california/texas/florida/new-york/pennsylvania/illinois/ohio/georgia/
 * north-carolina/michigan)에 이어 그다음 12개 주(new-jersey/virginia/washington/arizona/
 * massachusetts/tennessee/indiana/missouri/maryland/wisconsin/colorado/minnesota)를
 * 이 스크립트로 생성함.
 *
 * 하는 일: california-lottery-tax.html을 원본 텍스트 그대로 읽어서, 정확히 알려진 CA
 * 전용 문자열(제목/메타/JSON-LD/본문/FAQ/공유문구/관련링크)만 앵커 기반으로
 * state config 값으로 치환. 못 찾는 앵커가 있으면 즉시 throw(템플릿이 그새 바뀐 것 —
 * 이 스크립트의 앵커 목록도 같이 갱신할 것). <style> 블록·헤드 트래킹 스니펫·FAQ 2~4번
 * 문항·federal/lump-sum 단락 등 주 공통 보일러플레이트는 전혀 건드리지 않음(캘리포니아
 * 원본을 그대로 물려받음).
 *
 * 세율 출처: script.js의 STATE_TAX_RATES(2026-07 컴파일, 각 주 공식 최고 한계세율)를
 * 그대로 재사용 — 계산기 자체와 랜딩페이지 숫자가 어긋나지 않게 하기 위함. 원천징수율
 * (withholding, 주 복권위원회가 당첨 시점에 실제로 떼는 정액 비율)은 WebSearch로 별도
 * 확인해 STATES 배열의 note 문단에 반영(2026-08-18 세션 리서치, 출처는 세션 최종 보고
 * 참고 — 이 파일 자체엔 출처 URL을 남기지 않음, 공개 저장소 코멘트에 외부 링크 나열
 * 대신 사용자에게 채팅으로 요약).
 *
 * 사용법: node scripts/generate-state-lottery-pages.js
 * (ROOT/california-lottery-tax.html을 읽어서 ROOT/{state.file}에 씀 — 실행마다 덮어씀)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_FILE = path.join(ROOT, 'california-lottery-tax.html');
const UPDATED_DATE = '2026-08-18';

function usd(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// rate: script.js STATE_TAX_RATES의 top marginal 소수값. rateDisplay: 페이지에 보여줄 문자열.
// zeroTax: 주소득세 자체가 없는 주(TX/FL류 문구 패턴 사용). h2: 첫 섹션 제목+본문(복수 단락 가능).
// links: related-links 3개(파일명+표시라벨).
const STATES = [
  {
    name: 'New Jersey', abbr: 'NJ', file: 'new-jersey-lottery-tax.html',
    rate: 0.1075, rateDisplay: '10.75%', zeroTax: false,
    h2Title: 'How much does New Jersey take from a lottery jackpot?',
    h2Body: [
      "New Jersey taxes lottery winnings at a 10.75% top state rate in this calculator's model, applied on top of the federal tax bite.",
      'The New Jersey Lottery only withholds 8% at the time you claim a prize over $500,000 — but that\'s just the up-front withholding, not the final bill. Like the federal 24%, a jackpot-sized win is actually taxed at New Jersey\'s real top rate of 10.75% once you file, so most winners owe additional state tax beyond what was withheld.',
    ],
    links: [
      { file: 'maryland-lottery-tax.html', label: 'Maryland lottery tax calculator' },
      { file: 'new-york-lottery-tax.html', label: 'New York lottery tax calculator' },
      { file: 'pennsylvania-lottery-tax.html', label: 'Pennsylvania lottery tax calculator' },
    ],
  },
  {
    name: 'Virginia', abbr: 'VA', file: 'virginia-lottery-tax.html',
    rate: 0.0575, rateDisplay: '5.75%', zeroTax: false,
    h2Title: 'How much does Virginia take from a lottery jackpot?',
    h2Body: [
      "Virginia taxes lottery winnings at a 5.75% top state rate in this calculator's model, applied on top of the federal tax bite.",
      'The Virginia Lottery withholds only 4% from prizes over $5,000 at the time you claim them — but that\'s just the up-front withholding. A jackpot-sized win is actually taxed at Virginia\'s real top rate of 5.75% once you file, so most winners owe additional state tax beyond what was withheld.',
    ],
    links: [
      { file: 'tennessee-lottery-tax.html', label: 'Tennessee lottery tax calculator' },
      { file: 'maryland-lottery-tax.html', label: 'Maryland lottery tax calculator' },
      { file: 'new-jersey-lottery-tax.html', label: 'New Jersey lottery tax calculator' },
    ],
  },
  {
    name: 'Washington', abbr: 'WA', file: 'washington-lottery-tax.html',
    rate: 0.0, rateDisplay: '0%', zeroTax: true,
    h2Title: 'Does Washington tax lottery winnings?',
    h2Body: [
      'Washington has no state income tax at all — on lottery winnings or anything else. A Washington resident who wins Powerball or Mega Millions keeps 100% of the state-level share; only the federal government taxes the win.',
    ],
    links: [
      { file: 'california-lottery-tax.html', label: 'California lottery tax calculator' },
      { file: 'arizona-lottery-tax.html', label: 'Arizona lottery tax calculator' },
      { file: 'colorado-lottery-tax.html', label: 'Colorado lottery tax calculator' },
    ],
  },
  {
    name: 'Arizona', abbr: 'AZ', file: 'arizona-lottery-tax.html',
    rate: 0.025, rateDisplay: '2.5%', zeroTax: false,
    h2Title: 'How much does Arizona take from a lottery jackpot?',
    h2Body: [
      "Arizona taxes lottery winnings at a flat 2.5% state rate in this calculator's model, applied on top of the federal tax bite.",
      "Arizona is one of the few states where the lottery withholding rate (2.5%) already matches the state's flat top income tax rate, so there's little gap between what's withheld at claim time and what you actually owe when you file.",
    ],
    links: [
      { file: 'washington-lottery-tax.html', label: 'Washington lottery tax calculator' },
      { file: 'colorado-lottery-tax.html', label: 'Colorado lottery tax calculator' },
      { file: 'texas-lottery-tax.html', label: 'Texas lottery tax calculator' },
    ],
  },
  {
    name: 'Massachusetts', abbr: 'MA', file: 'massachusetts-lottery-tax.html',
    rate: 0.09, rateDisplay: '9%', zeroTax: false,
    h2Title: 'How much does Massachusetts take from a lottery jackpot?',
    h2Body: [
      "Massachusetts taxes most income at a flat 5%, but a \"millionaires surtax\" adds another 4% on the portion of income above $1,107,750 (2026 threshold). Since any jackpot-sized win clears that threshold many times over, this calculator models Massachusetts at a combined 9% top rate, applied on top of the federal tax bite.",
      'The Massachusetts Lottery only withholds the base 5% at the time you claim a prize — the extra 4% surtax portion is typically settled when you file, similar to how the IRS withholds 24% up front while the real top federal rate is 37%.',
    ],
    links: [
      { file: 'pennsylvania-lottery-tax.html', label: 'Pennsylvania lottery tax calculator' },
      { file: 'ohio-lottery-tax.html', label: 'Ohio lottery tax calculator' },
      { file: 'michigan-lottery-tax.html', label: 'Michigan lottery tax calculator' },
    ],
  },
  {
    name: 'Tennessee', abbr: 'TN', file: 'tennessee-lottery-tax.html',
    rate: 0.0, rateDisplay: '0%', zeroTax: true,
    h2Title: 'Does Tennessee tax lottery winnings?',
    h2Body: [
      'Tennessee has no state income tax at all — on lottery winnings or anything else. Tennessee fully repealed its old "Hall tax" (which applied only to interest and dividend income, never to lottery winnings) back in 2021, so today a Tennessee resident who wins Powerball or Mega Millions keeps 100% of the state-level share; only the federal government taxes the win.',
    ],
    links: [
      { file: 'north-carolina-lottery-tax.html', label: 'North Carolina lottery tax calculator' },
      { file: 'virginia-lottery-tax.html', label: 'Virginia lottery tax calculator' },
      { file: 'maryland-lottery-tax.html', label: 'Maryland lottery tax calculator' },
    ],
  },
  {
    name: 'Indiana', abbr: 'IN', file: 'indiana-lottery-tax.html',
    rate: 0.0295, rateDisplay: '2.95%', zeroTax: false,
    h2Title: 'How much does Indiana take from a lottery jackpot?',
    h2Body: [
      "Indiana taxes lottery winnings at a flat 2.95% state rate in this calculator's model, applied on top of the federal tax bite — one of the lowest rates among states that do tax lottery winnings.",
      "Indiana's flat individual income tax rate has been stepping down each year under a state law tied to revenue targets (3.05% in 2024, 3.00% in 2025, 2.95% in 2026, scheduled to reach 2.90% in 2027 if the state keeps hitting its targets), so this rate can move slightly in future tax years.",
    ],
    links: [
      { file: 'michigan-lottery-tax.html', label: 'Michigan lottery tax calculator' },
      { file: 'illinois-lottery-tax.html', label: 'Illinois lottery tax calculator' },
      { file: 'wisconsin-lottery-tax.html', label: 'Wisconsin lottery tax calculator' },
    ],
  },
  {
    name: 'Missouri', abbr: 'MO', file: 'missouri-lottery-tax.html',
    rate: 0.047, rateDisplay: '4.7%', zeroTax: false,
    h2Title: 'How much does Missouri take from a lottery jackpot?',
    h2Body: [
      "Missouri taxes lottery winnings at a 4.7% top state rate in this calculator's model, applied on top of the federal tax bite.",
      'The Missouri Lottery withholds only 4% from prizes over $600 at the time you claim them — but that\'s just the up-front withholding. A jackpot-sized win is actually taxed at Missouri\'s real top rate of 4.7% once you file, so most winners owe a bit of additional state tax beyond what was withheld.',
    ],
    links: [
      { file: 'minnesota-lottery-tax.html', label: 'Minnesota lottery tax calculator' },
      { file: 'california-lottery-tax.html', label: 'California lottery tax calculator' },
      { file: 'washington-lottery-tax.html', label: 'Washington lottery tax calculator' },
    ],
  },
  {
    name: 'Maryland', abbr: 'MD', file: 'maryland-lottery-tax.html',
    rate: 0.065, rateDisplay: '6.5%', zeroTax: false,
    h2Title: 'How much does Maryland take from a lottery jackpot?',
    h2Body: [
      "Maryland taxes lottery winnings at a 6.5% top state rate in this calculator's model — a new top bracket added in 2025 for taxable income over $1,000,000 — applied on top of the federal tax bite.",
    ],
    noteBox: 'Maryland counties also levy their own local income tax (roughly 2.25%–3.20% depending on where you live), and this calculator, like the rest of ChamTax, models state-level tax only — it does not add county tax on top, for consistency with how every other state here is calculated. That\'s also part of why the Maryland Lottery\'s actual withholding on a resident\'s prize (9.5%) is higher than the 6.5% state-only rate shown above: the withholding table bakes in an assumed average local tax. Your real total will depend on your specific county, so budget for a bit more than this page\'s estimate.',
    links: [
      { file: 'virginia-lottery-tax.html', label: 'Virginia lottery tax calculator' },
      { file: 'new-jersey-lottery-tax.html', label: 'New Jersey lottery tax calculator' },
      { file: 'new-york-lottery-tax.html', label: 'New York lottery tax calculator' },
    ],
  },
  {
    name: 'Wisconsin', abbr: 'WI', file: 'wisconsin-lottery-tax.html',
    rate: 0.0765, rateDisplay: '7.65%', zeroTax: false,
    h2Title: 'How much does Wisconsin take from a lottery jackpot?',
    h2Body: [
      "Wisconsin taxes lottery winnings at a 7.65% top state rate in this calculator's model, applied on top of the federal tax bite.",
      "The Wisconsin Lottery already withholds at that same 7.65% top rate for prizes of $2,000 or more, so — unlike most other states on this site — there's little gap between what's withheld at claim time and what you actually owe when you file.",
    ],
    links: [
      { file: 'illinois-lottery-tax.html', label: 'Illinois lottery tax calculator' },
      { file: 'minnesota-lottery-tax.html', label: 'Minnesota lottery tax calculator' },
      { file: 'missouri-lottery-tax.html', label: 'Missouri lottery tax calculator' },
    ],
  },
  {
    name: 'Colorado', abbr: 'CO', file: 'colorado-lottery-tax.html',
    rate: 0.044, rateDisplay: '4.4%', zeroTax: false,
    h2Title: 'How much does Colorado take from a lottery jackpot?',
    h2Body: [
      "Colorado taxes lottery winnings at a flat 4.4% state rate in this calculator's model, applied on top of the federal tax bite.",
      'The Colorado Lottery withholds only 4% from prizes over $5,000 at the time you claim them — but that\'s just the up-front withholding. Colorado\'s actual flat income tax rate is 4.4%, so most winners owe a small amount of additional state tax when they file.',
    ],
    links: [
      { file: 'arizona-lottery-tax.html', label: 'Arizona lottery tax calculator' },
      { file: 'texas-lottery-tax.html', label: 'Texas lottery tax calculator' },
      { file: 'florida-lottery-tax.html', label: 'Florida lottery tax calculator' },
    ],
  },
  {
    name: 'Minnesota', abbr: 'MN', file: 'minnesota-lottery-tax.html',
    rate: 0.0985, rateDisplay: '9.85%', zeroTax: false,
    h2Title: 'How much does Minnesota take from a lottery jackpot?',
    h2Body: [
      "Minnesota taxes lottery winnings at a 9.85% top state rate in this calculator's model, applied on top of the federal tax bite.",
      'The Minnesota Lottery withholds only 7.25% at the time you claim a prize — but that\'s just the up-front withholding, not the final bill. A jackpot-sized win is actually taxed at Minnesota\'s real top rate of 9.85% once you file, the same "withheld now, more owed later" pattern as the federal 24%-withheld/37%-real-rate split.',
    ],
    links: [
      { file: 'wisconsin-lottery-tax.html', label: 'Wisconsin lottery tax calculator' },
      { file: 'missouri-lottery-tax.html', label: 'Missouri lottery tax calculator' },
      { file: 'california-lottery-tax.html', label: 'California lottery tax calculator' },
    ],
  },
];

function must(content, oldStr, label) {
  if (content.indexOf(oldStr) === -1) {
    throw new Error(`Anchor not found (${label}): ${oldStr.slice(0, 80)}...`);
  }
}

function replaceOnce(content, oldStr, newStr, label) {
  must(content, oldStr, label);
  return content.replace(oldStr, newStr);
}

const base = fs.readFileSync(BASE_FILE, 'utf8');

for (const st of STATES) {
  let out = base;

  // 1) 전역 치환: "California" -> 주 이름 (제목/메타/JSON-LD/본문 대부분이 한 번에 해결됨)
  out = out.split('California').join(st.name);
  // 2) 파일명/URL
  out = out.split('california-lottery-tax.html').join(st.file);
  // 3) 계산기 프리셋 쿼리 파라미터
  out = out.split('state=CA').join(`state=${st.abbr}`);
  // 4) 업데이트 날짜
  out = replaceOnce(out, 'Last updated: 2026-08-16', `Last updated: ${UPDATED_DATE}`, 'updated-date');

  const stateTaxAmount = Math.round(1000000 * st.rate);
  const takeHome = 1000000 - 370000 - stateTaxAmount;
  const stateTaxRowVal = st.zeroTax ? '$0' : `-${usd(stateTaxAmount)}`;
  const takeHomeDisplay = usd(takeHome);

  // 5) HowToStep: "(0%)." -> 실제 세율
  out = replaceOnce(
    out,
    `See ${st.name}'s state tax rate on lottery winnings (0%).`,
    `See ${st.name}'s state tax rate on lottery winnings (${st.rateDisplay}).`,
    'HowTo rate'
  );

  // 6) lead 문단의 "(which is $0)" -> 비영세율 주는 실제 세율로 교체(영세율 주는 그대로 둠)
  if (!st.zeroTax) {
    out = replaceOnce(
      out,
      `${st.name}'s own lottery tax rate (which is $0)`,
      `${st.name}'s own lottery tax rate (${st.rateDisplay})`,
      'lead rate'
    );
  }

  // 7) quick-answer 박스
  out = replaceOnce(
    out,
    `<div class="row"><span>${st.name} state tax (0%)</span><b>$0</b></div>`,
    `<div class="row"><span>${st.name} state tax (${st.rateDisplay})</span><b>${stateTaxRowVal}</b></div>`,
    'quick-answer row'
  );
  out = replaceOnce(
    out,
    '<div class="row"><span>Estimated take-home</span><b>about $630,000</b></div>',
    `<div class="row"><span>Estimated take-home</span><b>about ${takeHomeDisplay}</b></div>`,
    'quick-answer take-home'
  );

  // 8) 첫 번째 H2 섹션(주세 설명) 전체 교체
  const oldH2Block =
    `  <h2>Does ${st.name} tax lottery winnings?</h2>\n` +
    `  <p>${st.name} has a state income tax on most income, but it specifically carves out an exemption for ${st.name} Lottery winnings — so a ${st.name} resident's Powerball or Mega Millions jackpot isn't taxed by the state at all. (Winnings from other states' lotteries, bought while in ${st.name}, generally follow the same state-level treatment for ${st.name} residents.) The only tax bite comes from the federal government.</p>`;
  const newH2Paras = st.h2Body.map((p) => `  <p>${p}</p>`).join('\n');
  const noteBoxHtml = st.noteBox
    ? `\n  <div class="note-box">\n    <p style="margin:0;">${st.noteBox}</p>\n  </div>`
    : '';
  const newH2Block = `  <h2>${st.h2Title}</h2>\n${newH2Paras}${noteBoxHtml}`;
  out = replaceOnce(out, oldH2Block, newH2Block, 'h2 state-tax section');

  // 9) FAQ JSON-LD 첫 문항
  out = replaceOnce(
    out,
    `plus ${st.name}'s state tax, which is $0, for an estimated take-home of about $630,000.`,
    st.zeroTax
      ? `plus ${st.name}'s state tax, which is $0, for an estimated take-home of about ${takeHomeDisplay}.`
      : `plus ${st.name}'s state tax of ${st.rateDisplay} (${usd(stateTaxAmount)}), for an estimated take-home of about ${takeHomeDisplay}.`,
    'FAQ jsonld answer'
  );
  // 10) FAQ 아코디언(화면 표시) 첫 문항 — JSON-LD와 동일 문구가 본문에도 있음(같은 old/new 매칭 재사용 불가하므로 2번째 등장 처리)
  out = replaceOnce(
    out,
    `plus ${st.name}'s state tax, which is $0, for an estimated take-home of about ${st.zeroTax ? takeHomeDisplay : '$630,000'}. Use the calculator above for other amounts.`,
    st.zeroTax
      ? `plus ${st.name}'s state tax, which is $0, for an estimated take-home of about ${takeHomeDisplay}. Use the calculator above for other amounts.`
      : `plus ${st.name}'s state tax of ${st.rateDisplay} (${usd(stateTaxAmount)}), for an estimated take-home of about ${takeHomeDisplay}. Use the calculator above for other amounts.`,
    'FAQ visible answer'
  );

  // 11) 공유 문구 take-home 금액
  out = replaceOnce(
    out,
    `about $630,000 after federal and state tax`,
    `about ${takeHomeDisplay} after federal and state tax`,
    'share text amount'
  );

  // 12) related-links 3개 전부 교체 (California/Texas/New York 고정 링크 -> 주별 계산)
  const oldLinksBlock =
    `  <div class="related-links">\n` +
    `    <a href="texas-lottery-tax.html">→ Texas lottery tax calculator</a>\n` +
    `    <a href="florida-lottery-tax.html">→ Florida lottery tax calculator</a>\n` +
    `    <a href="new-york-lottery-tax.html">→ New York lottery tax calculator</a>\n` +
    `    <a href="lump-sum-vs-annuity-lottery-tax.html">→ Lump sum vs. annuity: which saves more on taxes?</a>\n` +
    `    <a href="nonresident-lottery-tax-refund.html">→ How nonresidents claim a prize (and any tax refund)</a>\n` +
    `    <a href="index.html?lang=en#faq">→ More US lottery tax FAQs (calculator, in English)</a>\n` +
    `    <a href="sitemap.html">→ Full sitemap</a>\n` +
    `  </div>`;
  const newLinksBlock =
    `  <div class="related-links">\n` +
    st.links.map((l) => `    <a href="${l.file}">→ ${l.label}</a>`).join('\n') +
    `\n    <a href="index.html?lang=en#faq">→ More US lottery tax FAQs (calculator, in English)</a>\n` +
    `    <a href="sitemap.html">→ Full sitemap</a>\n` +
    `  </div>`;
  out = replaceOnce(out, oldLinksBlock, newLinksBlock, 'related-links');

  fs.writeFileSync(path.join(ROOT, st.file), out, 'utf8');
  console.log('wrote', st.file, '| state tax:', stateTaxRowVal, '| take-home:', takeHomeDisplay);
}

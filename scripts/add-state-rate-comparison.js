#!/usr/bin/env node
/*
 * scripts/add-state-rate-comparison.js
 *
 * 언제 다시 쓰나: 51개 주+DC의 *-lottery-tax.html 랜딩페이지들이 구글 애드센스로부터
 * "가치가 별로 없는 콘텐츠"(low-value content) 판정을 받은 것을 계기로(2026-09-20),
 * generate-state-lottery-pages.js가 캘리포니아 템플릿을 그대로 복제해 주 이름/세율
 * 숫자만 바꿔 넣은 결과 51개 페이지가 773줄 중 h2Body 1~2문장 + noteBox만 다르고
 * 나머지는 100% 동일 바이트라는 걸 확인 — 전형적인 thin/doorway content 패턴.
 *
 * 하는 일: 각 주 페이지의 "Federal tax: 24% withheld..." H2 섹션(전 페이지 공통,
 * 안전한 삽입 앵커) 바로 앞에 새 H2 섹션을 추가 — script.js의 STATE_TAX_RATES(이미
 * 출처 확인된 데이터)만 갖고 계산으로 도출한, 주마다 실제로 다른 숫자/문장을 담은
 * "이 주의 세율이 다른 주와 비교해 어디쯤인지" 비교 섹션. 외부 리서치·새 사실 주장을
 * 전혀 추가하지 않음(WebSearch로 찾은 익명성/청구기한 등 2차 출처 정보는 신뢰도가
 * 낮아 의도적으로 채택 안 함) — 이미 이 저장소에 있는 1차 데이터를 산술 비교로 재구성한
 * 것뿐이라 사실관계 오류 위험이 0에 가까움. 재실행 가능(idempotent) — 이미 삽입된
 * 페이지는 자기 섹션을 지우고 다시 계산해서 넣으므로, STATE_TAX_RATES가 나중에
 * 갱신되면 이 스크립트도 다시 돌려서 비교 문구를 최신 숫자로 맞출 것.
 *
 * 대상에서 제외: lump-sum-vs-annuity/korean-abroad/vietnamese-in-korea-lottery-tax.html
 * (주 세율 페이지가 아님), *-resident-us-lottery-tax.html(국가별 페이지, 별도 사안).
 *
 * 사용법: node scripts/add-state-rate-comparison.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MARKER_START = '<!-- rate-comparison:start -->';
const MARKER_END = '<!-- rate-comparison:end -->';
const ANCHOR = '  <h2>Federal tax: 24% withheld now, 37% owed at filing time</h2>';
// 이 스크립트를 실제로 돌리는 날짜로 맞출 것 — 콘텐츠가 실제로 바뀌었는데 날짜를 안 올리면
// "업데이트됐다고 써있는데 실제로는 몇 주 전 그대로"인 신뢰도 문제가 생김
const RUN_DATE = '2026-09-20';

function usd(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// 1) STATE_TAX_RATES를 script.js에서 직접 파싱 (2차 사본을 쓰지 않고 원본 소스 그대로 사용)
const scriptSrc = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const m = scriptSrc.match(/const STATE_TAX_RATES = (\{[\s\S]*?\n\});/);
if (!m) throw new Error('STATE_TAX_RATES를 script.js에서 찾지 못함 — 템플릿이 바뀌었는지 확인할 것');
const rawRates = new Function('return ' + m[1])();

const entries = Object.keys(rawRates)
  .filter((k) => k !== 'AVG')
  .map((abbr) => ({ abbr, name: rawRates[abbr].labelEn.replace(/\s*\(.*?\)\s*$/, ''), rate: rawRates[abbr].rate }));
if (entries.length !== 51) throw new Error(`50개 주+DC가 아니라 ${entries.length}개 — STATE_TAX_RATES 변경 확인 필요`);

const sorted = entries.slice().sort((a, b) => a.rate - b.rate);
const ZERO_GROUP = sorted.filter((e) => e.rate === 0); // AK/CA/FL/NV/NH/SD/TN/TX/WA/WY, 10개
const MAX_RATE = sorted[sorted.length - 1].rate;
const TOP_GROUP = sorted.filter((e) => e.rate === MAX_RATE); // 최고세율(현재 하와이 단독 11%)
// parseFloat(toFixed(2))로 4.70 -> 4.7, 5.00 -> 5 처럼 불필요한 후행 0을 자동으로 없앰
const pct = (r) => parseFloat((r * 100).toFixed(2)) + '%';
const listNames = (arr) => {
  if (arr.length === 1) return arr[0].name;
  if (arr.length === 2) return `${arr[0].name} and ${arr[1].name}`;
  return arr.slice(0, -1).map((e) => e.name).join(', ') + ', and ' + arr[arr.length - 1].name;
};
// 콤마 나열 미리보기용 — "X, Y, and Z, and others"처럼 and가 중복되는 걸 피하려고
// listNames()의 "and Z" 접속 없이 단순 콤마로만 나열
const listNamesPlain = (arr) => arr.map((e) => e.name).join(', ');
const ZERO_GROUP_NO_CA = ZERO_GROUP.filter((e) => e.abbr !== 'CA');
// "Washington D.C."처럼 이름 자체가 마침표로 끝나는 경우 문장 끝에 마침표가 겹치는 걸(".."）
// 막기 위한 헬퍼 — 항상 이 함수로 문장을 마무리할 것
const endSentence = (text) => (text.endsWith('.') ? text : text + '.');

function buildSection(state) {
  const { name, abbr, rate } = state;
  const rateDisplay = pct(rate);
  const lowerCount = sorted.filter((e) => e.rate < rate).length;
  const higherCount = sorted.filter((e) => e.rate > rate).length;
  const tiedOthers = sorted.filter((e) => e.rate === rate && e.abbr !== abbr);

  let body;
  if (rate === 0) {
    if (abbr === 'CA') {
      body = `California is unusual: it has a state income tax on most income (a top rate over 13%), but it specifically carves out an exemption for California Lottery winnings, so the effective rate here is 0% — the same practical outcome as the nine states with no state income tax at all (${listNamesPlain(ZERO_GROUP_NO_CA)}). ` +
        endSentence(`At the other end of the range, Hawaii has the highest rate in this calculator's model, at ${pct(MAX_RATE)}`);
    } else {
      const others = ZERO_GROUP.filter((e) => e.abbr !== abbr && e.abbr !== 'CA');
      body = `${name} is one of ten states (out of 50 + D.C.) where a lottery jackpot faces no state-level tax at all in this calculator's model — the others are ${listNamesPlain(others)}, plus California (which does have a state income tax, but specifically exempts lottery winnings from it). ` +
        endSentence(`At the other end of the range, Hawaii has the highest rate, at ${pct(MAX_RATE)}`);
    }
  } else if (rate === MAX_RATE) {
    const isTied = tiedOthers.length > 0;
    const openLine = isTied
      ? endSentence(`${name}'s ${rateDisplay} rate ties with ${listNamesPlain(tiedOthers)} for the highest in this calculator's model — no state or D.C. taxes lottery winnings more heavily`)
      : endSentence(`${name}'s ${rateDisplay} rate is the highest in this calculator's model — no other state or D.C. taxes lottery winnings more heavily`);
    body = `${openLine} At the other end of the range, ten states (including ${listNamesPlain(ZERO_GROUP.slice(0, 3))}, and others) don't tax lottery winnings at the state level at all.`;
  } else {
    let neighborSentence;
    if (tiedOthers.length > 0) {
      neighborSentence = endSentence(`That rate exactly matches ${listNamesPlain(tiedOthers)}`);
    } else {
      const idx = sorted.findIndex((e) => e.abbr === abbr);
      const prev = idx > 0 ? sorted[idx - 1] : null;
      const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;
      const bits = [];
      if (prev) bits.push(`${prev.name} (${pct(prev.rate)})`);
      if (next) bits.push(`${next.name} (${pct(next.rate)})`);
      neighborSentence = bits.length ? endSentence(`That puts it close to ${bits.join(' and ')} in this calculator's ranking`) : '';
    }
    body = `Among the 50 states and D.C. in this calculator, ${name}'s ${rateDisplay} top rate on lottery winnings is higher than ${lowerCount} of them and lower than ${higherCount}. ${neighborSentence} ` +
      endSentence(`Ten states pay no state-level tax on lottery winnings at all (${listNamesPlain(ZERO_GROUP.slice(0, 4))}, and others), while Hawaii has the highest rate, at ${pct(MAX_RATE)}`);
  }

  return (
    `${MARKER_START}\n` +
    `  <h2>How ${name}'s ${rateDisplay} rate compares to other states</h2>\n` +
    `  <p>${body}</p>\n` +
    `${MARKER_END}\n`
  );
}

const files = fs
  .readdirSync(ROOT)
  .filter((f) => f.endsWith('-lottery-tax.html'))
  .filter((f) => !f.includes('resident-us-lottery-tax'))
  .filter((f) => !['lump-sum-vs-annuity-lottery-tax.html', 'korean-abroad-us-lottery-tax.html', 'vietnamese-in-korea-lottery-tax.html'].includes(f));

let count = 0;
for (const file of files) {
  const filePath = path.join(ROOT, file);
  let content = fs.readFileSync(filePath, 'utf8');

  const abbrMatch = content.match(/state=([A-Z]{2})"/);
  if (!abbrMatch) throw new Error(`${file}: state=XX 앵커를 못 찾음`);
  const abbr = abbrMatch[1];
  const state = entries.find((e) => e.abbr === abbr);
  if (!state) throw new Error(`${file}: STATE_TAX_RATES에 ${abbr} 없음`);

  // 재실행 시 기존 삽입분 제거(idempotent) — 아래 삽입 시 항상 "MARKER_END\n\n"(빈 줄
  // 하나 포함) 형태로 넣으므로, 제거도 그 빈 줄까지 정확히 같이 지워야 재실행할 때마다
  // 빈 줄이 누적되지 않음
  const markerRe = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}\\n\\n`, '');
  content = content.replace(markerRe, '');

  if (content.indexOf(ANCHOR) === -1) throw new Error(`${file}: 삽입 앵커를 못 찾음`);
  // 다른 h2 섹션 사이 관례(빈 줄 하나)에 맞춰 MARKER_END와 다음 h2 사이에 빈 줄 하나 추가
  content = content.replace(ANCHOR, buildSection(state) + '\n' + ANCHOR);

  // 실제로 콘텐츠가 바뀌었으니 "Last updated" 날짜도 오늘로 갱신
  content = content.replace(/Last updated: \d{4}-\d{2}-\d{2}/, `Last updated: ${RUN_DATE}`);

  fs.writeFileSync(filePath, content, 'utf8');
  count++;
  console.log('updated', file, '(' + abbr + ')');
}
console.log('total files updated:', count);

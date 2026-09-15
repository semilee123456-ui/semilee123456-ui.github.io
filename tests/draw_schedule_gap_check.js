// draw_archive_integrity_check.js는 중복 날짜/정렬/형식만 검사하고, "그 회차 자체가 통째로
// 빠진" 경우(양쪽 배열 다 누락)는 못 잡는다 — 두 배열 다 비어있으면 비교할 대상이 없어서다.
// 이 스크립트는 파워볼(월/수/토, 2021-08-23 월요일 추첨 도입 이후)·메가밀리언즈(화/금,
// 2017-10-31 스케줄 변경 이후)의 실제 요일 패턴이 안정된 구간만 골라, 그 구간에 있어야 할
// 모든 추첨일을 계산해서 DRAW_ARCHIVE/JACKPOT_ARCHIVE 양쪽에 다 있는지 확인한다.
// (안정 구간 이전은 두 게임 다 스케줄이 여러 번 바뀌어서 요일 패턴으로 기대값을 계산할 수
// 없음 — 그 구간 누락 탐지는 별도 방법 필요, 이 스크립트 범위 밖.)
// 사용 시점: "로또 데이터 빠짐없이 다 있는지 확인해줘" 류 요청이 올 때마다 재실행.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'odds-data.js'), 'utf8');

const issues = [];

function extractArray(varName) {
  const re = new RegExp(`const ${varName} = (\\[.*?\\]);`, 's');
  const m = src.match(re);
  if (!m) {
    issues.push(`${varName}: 배열을 odds-data.js에서 찾지 못함`);
    return null;
  }
  return JSON.parse(m[1]);
}

function checkGaps(varName, arr, validDows, sinceDate) {
  if (!arr) return;
  const dates = arr.map(e => e[0]).filter(d => d >= sinceDate);
  if (dates.length === 0) {
    issues.push(`${varName}: ${sinceDate} 이후 항목이 하나도 없음`);
    return;
  }
  const dateSet = new Set(dates);
  const start = new Date(sinceDate + 'T00:00:00Z');
  const end = new Date(dates[dates.length - 1] + 'T00:00:00Z');
  const missing = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (validDows.includes(d.getUTCDay())) {
      const ds = d.toISOString().slice(0, 10);
      if (!dateSet.has(ds)) missing.push(ds);
    }
  }
  console.log(`--- ${varName} (since ${sinceDate}) ---`);
  console.log('entries in window:', dates.length, 'range:', dates[0], '~', dates[dates.length - 1]);
  console.log('missing expected draw dates:', missing.length ? JSON.stringify(missing) : 'none');
  missing.forEach(ds => issues.push(`${varName}: 기대되는 추첨일 누락 - ${ds}`));
}

const PB_SINCE = '2021-08-23'; // 파워볼 월요일 추첨 도입일
const MM_SINCE = '2017-10-31'; // 메가밀리언즈 화/금 스케줄 변경일

checkGaps('POWERBALL_DRAW_ARCHIVE', extractArray('POWERBALL_DRAW_ARCHIVE'), [1, 3, 6], PB_SINCE);
checkGaps('POWERBALL_JACKPOT_ARCHIVE', extractArray('POWERBALL_JACKPOT_ARCHIVE'), [1, 3, 6], PB_SINCE);
checkGaps('MEGAMILLIONS_DRAW_ARCHIVE', extractArray('MEGAMILLIONS_DRAW_ARCHIVE'), [2, 5], MM_SINCE);
checkGaps('MEGAMILLIONS_JACKPOT_ARCHIVE', extractArray('MEGAMILLIONS_JACKPOT_ARCHIVE'), [2, 5], MM_SINCE);

console.log('');
console.log(JSON.stringify(issues, null, 2));
console.log('TOTAL ARRAYS CHECKED: 4 ISSUES:', issues.length);
process.exitCode = issues.length > 0 ? 1 : 0;

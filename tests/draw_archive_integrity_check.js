// MEGAMILLIONS_DRAW_ARCHIVE / POWERBALL_DRAW_ARCHIVE 무결성 재검증 (브라우저 불필요, 정적 분석).
// odds-data.js를 직접 파싱해서: 날짜 유효성, 중복 날짜, 5개 번호 배열 여부, 날짜 오름차순 정렬,
// 알려진 기준 범위(카운트/최초·최후 날짜)를 확인한다. 향후 세션이 백필 데이터를 병합하기 전에
// 이 스크립트를 먼저 돌려서 회귀를 잡는 용도의 영구 회귀 테스트.
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
  let arr;
  try {
    arr = JSON.parse(m[1]);
  } catch (e) {
    issues.push(`${varName}: JSON 파싱 실패 - ${e.message}`);
    return null;
  }
  return arr;
}

function checkArchive(varName, arr, expected, tupleLen) {
  if (!arr) return;
  tupleLen = tupleLen || 3;

  console.log(`--- ${varName} ---`);
  console.log('entries:', arr.length);
  if (arr.length === 0) {
    issues.push(`${varName}: 배열이 비어있음`);
    return;
  }
  console.log('first date:', arr[0][0], 'last date:', arr[arr.length - 1][0]);

  const seenDates = new Set();
  let prevDate = null;
  let ascending = true;

  arr.forEach((entry, i) => {
    if (!Array.isArray(entry) || entry.length !== tupleLen) {
      issues.push(`${varName}[${i}]: 항목이 [date, nums[5], special${tupleLen === 4 ? ', jackpotMillions' : ''}] 형태가 아님 - ${JSON.stringify(entry)}`);
      return;
    }
    const [dateStr, nums, special, jackpotMillions] = entry;

    // 날짜 유효성
    if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      issues.push(`${varName}[${i}]: 날짜 형식이 아님 - ${JSON.stringify(dateStr)}`);
      return;
    }
    const d = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dateStr) {
      issues.push(`${varName}[${i}]: 유효하지 않은 달력 날짜 - ${dateStr}`);
      return;
    }

    // 중복 날짜
    if (seenDates.has(dateStr)) {
      issues.push(`${varName}[${i}]: 중복 날짜 - ${dateStr}`);
    }
    seenDates.add(dateStr);

    // 정렬 순서 (오름차순 기대)
    if (prevDate !== null && dateStr <= prevDate) {
      ascending = false;
      issues.push(`${varName}[${i}]: 날짜 오름차순 위반 - ${prevDate} -> ${dateStr}`);
    }
    prevDate = dateStr;

    // 5개 번호 배열
    if (!Array.isArray(nums) || nums.length !== 5) {
      issues.push(`${varName}[${i}] (${dateStr}): 메인 번호 배열이 5개가 아님 - ${JSON.stringify(nums)}`);
    } else {
      nums.forEach((n) => {
        if (!Number.isInteger(n) || n <= 0) {
          issues.push(`${varName}[${i}] (${dateStr}): 유효하지 않은 메인 번호 - ${n}`);
        }
      });
      if (new Set(nums).size !== nums.length) {
        issues.push(`${varName}[${i}] (${dateStr}): 같은 행 안에 중복 번호 - ${JSON.stringify(nums)}`);
      }
    }

    // 보너스 번호(메가볼/파워볼)
    if (!Number.isInteger(special) || special <= 0) {
      issues.push(`${varName}[${i}] (${dateStr}): 유효하지 않은 보너스 번호 - ${JSON.stringify(special)}`);
    }

    // 잭팟 발표액(JACKPOT_ARCHIVE류, 4번째 항목 — 백만 달러 단위)
    if (tupleLen === 4 && (typeof jackpotMillions !== 'number' || !(jackpotMillions > 0))) {
      issues.push(`${varName}[${i}] (${dateStr}): 유효하지 않은 잭팟 발표액 - ${JSON.stringify(jackpotMillions)}`);
    }
  });

  console.log('날짜 오름차순 정렬:', ascending);
  console.log('중복 날짜 없음:', seenDates.size === arr.length);

  if (expected) {
    if (arr.length < expected.minCount) {
      issues.push(`${varName}: 건수(${arr.length})가 기대 최소치(${expected.minCount})보다 적음 - 데이터 유실 의심`);
    }
    if (arr[0][0] > expected.maxFirstDate) {
      issues.push(`${varName}: 최초 날짜(${arr[0][0]})가 기대 기준(${expected.maxFirstDate})보다 늦음 - 백필 데이터 유실 의심`);
    }
  }
}

const mm = extractArray('MEGAMILLIONS_DRAW_ARCHIVE');
checkArchive('MEGAMILLIONS_DRAW_ARCHIVE', mm, {
  // 2026-07-27 갱신: MEGAMILLIONS_JACKPOT_ARCHIVE에는 있는데 이 배열에는 빠져있던
  // 2007-12-25/2009-12-25/2013-10-18 3건 보정 + 최신 회차(07-21, 07-24) 추가.
  // 기준선: 2002-05-17 ~ 2026-07-24, 2,525건.
  minCount: 2525,
  maxFirstDate: '2002-05-17',
});

const pb = extractArray('POWERBALL_DRAW_ARCHIVE');
checkArchive('POWERBALL_DRAW_ARCHIVE', pb, {
  // 2026-07-23 3차 백필(제3자 GitHub 데이터셋) 이후 기준선: 1992-04-22 ~ 2026-07-20, 3,825건.
  // 2026-07-23 추가 보정: 누락 확인된 2014-06-28, 2017-06-10 토요일 추첨 2건 추가, 3,827건.
  // 2026-07-27 갱신: POWERBALL_JACKPOT_ARCHIVE에는 있는데 이 배열에는 빠져있던
  // 2021-04-28/2022-03-12/2022-04-09/2022-11-07 4건 보정 + 최신 회차(07-25) 추가.
  // 기준선: 1992-04-22 ~ 2026-07-25, 3,833건.
  // 2026-07-28 갱신: 사용자가 채팅으로 직접 전달한 07-27 회차 추가. 기준선: 1992-04-22 ~
  // 2026-07-27, 3,834건.
  minCount: 3834,
  maxFirstDate: '1992-04-22',
});

// 2026-08-04 신설: DRAW_ARCHIVE(당첨번호만)와 JACKPOT_ARCHIVE(당첨번호+그 회차 잭팟 발표액)는
// odds-data.js 안에서 완전히 별개로 관리되는 배열이라, 한쪽만 갱신하고 다른 쪽을 빠뜨리는 사고가
// 실제로 여러 번 반복됐음(이번에도 자동 백필 루틴이 POWERBALL_DRAW_ARCHIVE에는 2026-08-03
// 회차를 넣었는데 POWERBALL_JACKPOT_ARCHIVE는 빠뜨림 — HANDOFF.md "알려진 미해결 항목"에
// 문서화된 패턴). 이 위쪽 두 checkArchive() 호출은 여태 DRAW_ARCHIVE만 검사하고 JACKPOT_ARCHIVE
// 자체의 형식도, 두 배열 사이의 정합성도 전혀 검사하지 않고 있었음 — 그래서 이번 사고를
// 놓쳤던 것. 아래에서 (1) JACKPOT_ARCHIVE 자체 형식 검증 + (2) DRAW_ARCHIVE 최신 20건이
// JACKPOT_ARCHIVE에도 전부 있는지 교차검증(과거 "Big Game" 시절처럼 JACKPOT_ARCHIVE에만 있고
// DRAW_ARCHIVE엔 없는 오래된 항목은 정상이므로 반대 방향은 검사 안 함 — 최신 방향 누락만 실제
// 버그이므로 그쪽만 검사)한다.
const mmJackpot = extractArray('MEGAMILLIONS_JACKPOT_ARCHIVE');
checkArchive('MEGAMILLIONS_JACKPOT_ARCHIVE', mmJackpot, null, 4);

const pbJackpot = extractArray('POWERBALL_JACKPOT_ARCHIVE');
checkArchive('POWERBALL_JACKPOT_ARCHIVE', pbJackpot, null, 4);

function checkDrawJackpotSync(gameLabel, drawArr, jackpotArr, recentN) {
  if (!drawArr || !jackpotArr) return;
  const jackpotDates = new Set(jackpotArr.map(e => e[0]));
  const recent = drawArr.slice(-recentN);
  recent.forEach(([dateStr]) => {
    if (!jackpotDates.has(dateStr)) {
      issues.push(`${gameLabel}: DRAW_ARCHIVE의 최근 회차(${dateStr})가 JACKPOT_ARCHIVE에 없음 - 두 배열이 어긋남(한쪽만 갱신됨)`);
    }
  });
}
checkDrawJackpotSync('POWERBALL', pb, pbJackpot, 20);
checkDrawJackpotSync('MEGAMILLIONS', mm, mmJackpot, 20);

console.log('');
console.log(JSON.stringify(issues, null, 2));
console.log('TOTAL ARCHIVES CHECKED:', 4, 'ISSUES:', issues.length);
process.exitCode = issues.length > 0 ? 1 : 0;

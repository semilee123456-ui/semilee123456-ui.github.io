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

function checkArchive(varName, arr, expected) {
  if (!arr) return;

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
    if (!Array.isArray(entry) || entry.length !== 3) {
      issues.push(`${varName}[${i}]: 항목이 [date, nums[5], megaBall] 형태가 아님 - ${JSON.stringify(entry)}`);
      return;
    }
    const [dateStr, nums, special] = entry;

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
  // 2026-07-23 백필 이후 기준선: 2002-05-17 ~ 2026-07-17, 2,520건.
  minCount: 2520,
  maxFirstDate: '2002-05-17',
});

const pb = extractArray('POWERBALL_DRAW_ARCHIVE');
checkArchive('POWERBALL_DRAW_ARCHIVE', pb, {
  // 2026-07-23 3차 백필(제3자 GitHub 데이터셋) 이후 기준선: 1992-04-22 ~ 2026-07-20, 3,825건.
  minCount: 3825,
  maxFirstDate: '1992-04-22',
});

console.log('');
console.log(JSON.stringify(issues, null, 2));
console.log('TOTAL ARCHIVES CHECKED:', 2, 'ISSUES:', issues.length);
process.exitCode = issues.length > 0 ? 1 : 0;

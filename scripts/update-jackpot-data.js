// GitHub Actions("jackpot-update.yml")에서만 도는 자동 잭팟 갱신 스크립트.
// scripts/lottery-sources.js로 공식 사이트에서 "다음 추첨 예상 잭팟"과 "최신 추첨 결과"를 받아와
// script.js의 JACKPOT_DATA/LATEST_DRAW, odds-data.js의 POWERBALL_JACKPOT_ARCHIVE/
// MEGAMILLIONS_JACKPOT_ARCHIVE를 갱신한다(당첨번호 원장인 *_DRAW_ARCHIVE는 이미 있는
// lottery-backfill.yml/scripts/backfill-lottery.js가 담당하므로 여기선 손대지 않음 — 같은
// 데이터를 두 워크플로가 따로 쓰면 충돌 위험만 커짐).
//
// 새 회차가 아직 안 열렸으면(=사이트의 최신 결과 날짜가 LATEST_DRAW와 같으면) JACKPOT_DATA의
// 예상 잭팟 금액만 최신화하고(판매량에 따라 추첨 전에도 계속 오르내림), 회차 자체는 안 건드림.
// 새 회차가 감지되면: 그 회차에 걸려 있던 실제 잭팟(파워볼은 "덮어쓰기 직전의" JACKPOT_DATA 값 —
// 발표 전엔 그게 곧 그 회차의 잭팟이었으므로, 사람이 수동 갱신할 때 하던 방식과 동일. 메가밀리언즈는
// API가 CurrentPrizePool로 직접 줘서 그걸 그대로 씀)를 아카이브에 추가하고, LATEST_DRAW를 새
// 회차로, JACKPOT_DATA를 새로 받아온 "다음 추첨" 예상값으로 교체한다.
//
// 모든 단계가 방어적: 파싱 실패·범위 이상·날짜 역행 등 뭔가 이상하면 값을 추측해서 쓰지 않고
// 바로 에러를 던지고 exit 1로 끝난다(파일은 안 건드린 채로) — Actions 탭에 실패로만 남고
// 커밋은 안 됨. 정상 종료 시 "CHANGED"/"NO_CHANGE"를 stdout 마지막 줄에 찍어서 워크플로가
// build:min·커밋 여부를 판단할 수 있게 한다.
const fs = require('fs');
const path = require('path');
const { fetchPowerball, fetchMegaMillions } = require('./lottery-sources');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'script.js');
const ODDS_PATH = path.join(ROOT, 'odds-data.js');
const INDEX_PATH = path.join(ROOT, 'index.html');

// "20260901-4" 같은 캐시버스팅 버전 문자열을 오늘 날짜 기준으로 새로 만듦(같은 날 두 번째
// 실행이면 시퀀스만 증가) — 이걸 안 올리면 script.js/odds-data.js 내용이 바뀌어도 이미 방문한
// 브라우저가 캐시된 옛 파일을 계속 씀.
function nextVersion(oldVersion) {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const m = oldVersion.match(/^(\d{8})-(\d+)$/);
  const seq = m && m[1] === today ? parseInt(m[2], 10) + 1 : 1;
  return `${today}-${seq}`;
}

// `${label}?v=OLDVERSION` 형태를 찾아 다음 버전으로 교체. 못 찾으면 캐시버스팅 관례 자체가
// 깨졌다는 뜻이라 값을 추측하지 않고 에러.
function bumpCacheBust(src, label) {
  const re = new RegExp(`(${label.replace(/\./g, '\\.')}\\?v=)(\\d{8}-\\d+)`);
  const m = src.match(re);
  if (!m) throw new Error(`${label}: 캐시버스팅 버전 문자열을 못 찾음`);
  return src.replace(re, `$1${nextVersion(m[2])}`);
}

function extractBlock(src, varName) {
  const startMarker = `const ${varName} = {`;
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`${varName}: script.js에서 선언을 못 찾음`);
  const closeIdx = src.indexOf('\n};', start);
  if (closeIdx === -1) throw new Error(`${varName}: 닫는 "};"를 못 찾음`);
  const end = closeIdx + 3; // '\n};'까지 포함
  return { text: src.slice(start, end), start, end };
}

function parseJackpotDataBlock(text) {
  const out = {};
  for (const game of ['powerball', 'megamillions']) {
    const re = new RegExp(`${game}:\\s*\\{\\s*amountUsd:\\s*(\\d+),\\s*cashUsd:\\s*(\\d+)\\s*\\}`);
    const m = text.match(re);
    if (!m) throw new Error(`JACKPOT_DATA.${game} 파싱 실패`);
    out[game] = { amountUsd: parseInt(m[1], 10), cashUsd: parseInt(m[2], 10) };
  }
  return out;
}

function parseLatestDrawBlock(text) {
  const out = {};
  for (const game of ['powerball', 'megamillions']) {
    const re = new RegExp(`${game}:\\s*\\{\\s*date:\\s*'([\\d-]+)',\\s*numbers:\\s*\\[([\\d,\\s]+)\\],\\s*special:\\s*(\\d+)\\s*\\}`);
    const m = text.match(re);
    if (!m) throw new Error(`LATEST_DRAW.${game} 파싱 실패`);
    out[game] = {
      date: m[1],
      numbers: m[2].split(',').map(s => parseInt(s.trim(), 10)),
      special: parseInt(m[3], 10),
    };
  }
  return out;
}

function renderJackpotDataBlock(data) {
  return [
    'const JACKPOT_DATA = {',
    `  powerball:    { amountUsd: ${data.powerball.amountUsd}, cashUsd: ${data.powerball.cashUsd} },`,
    `  megamillions: { amountUsd: ${data.megamillions.amountUsd}, cashUsd: ${data.megamillions.cashUsd} },`,
    '};',
  ].join('\n');
}

function renderLatestDrawBlock(data) {
  const fmt = g => `{ date: '${g.date}', numbers: [${g.numbers.join(', ')}], special: ${g.special} }`;
  return [
    'const LATEST_DRAW = {',
    `  powerball:    ${fmt(data.powerball)},`,
    `  megamillions: ${fmt(data.megamillions)},`,
    '};',
  ].join('\n');
}

function readJsonArray(src, varName) {
  const idx = src.indexOf(`const ${varName}`);
  if (idx === -1) throw new Error(`${varName}: odds-data.js에서 못 찾음`);
  const eq = src.indexOf('=', idx);
  const end = src.indexOf('];', eq);
  if (end === -1) throw new Error(`${varName}: 닫는 "];"를 못 찾음`);
  const jsonText = src.slice(eq + 1, end + 1).trim();
  let arr;
  try { arr = JSON.parse(jsonText); } catch (e) { throw new Error(`${varName}: JSON 파싱 실패 (${e.message})`); }
  return { arr, start: eq + 1, end: end + 1 };
}

function appendJackpotArchiveEntry(src, varName, entry) {
  const { arr, start, end } = readJsonArray(src, varName);
  const lastDate = arr.length ? arr[arr.length - 1][0] : '0000-00-00';
  if (entry[0] <= lastDate) {
    throw new Error(`${varName}: 새 회차(${entry[0]})가 마지막 기록(${lastDate})보다 뒤가 아님 — 중복이거나 날짜 역행, 수동 확인 필요`);
  }
  arr.push(entry);
  const newJson = JSON.stringify(arr);
  return src.slice(0, start) + newJson + src.slice(end);
}

function toMillions(usd) {
  // 기존 아카이브 표기(131, 97.9 등)와 맞춰 소수 첫째 자리까지만.
  return Math.round(usd / 1e6 * 10) / 10;
}

async function main() {
  let scriptSrc = fs.readFileSync(SCRIPT_PATH, 'utf8');
  let oddsSrc = fs.readFileSync(ODDS_PATH, 'utf8');

  const jackpotBlock = extractBlock(scriptSrc, 'JACKPOT_DATA');
  const latestDrawBlock = extractBlock(scriptSrc, 'LATEST_DRAW');
  const oldJackpotData = parseJackpotDataBlock(jackpotBlock.text);
  const oldLatestDraw = parseLatestDrawBlock(latestDrawBlock.text);

  console.log('[update-jackpot] fetching official sources...');
  const [pb, mm] = await Promise.all([fetchPowerball(), fetchMegaMillions()]);
  const fetched = { powerball: pb, megamillions: mm };

  const newJackpotData = { powerball: { ...oldJackpotData.powerball }, megamillions: { ...oldJackpotData.megamillions } };
  const newLatestDraw = { powerball: { ...oldLatestDraw.powerball }, megamillions: { ...oldLatestDraw.megamillions } };
  const archiveAppends = []; // { varName, entry }
  let changed = false;

  for (const game of ['powerball', 'megamillions']) {
    const f = fetched[game];
    const oldDraw = oldLatestDraw[game];

    if (f.latestDraw.date !== oldDraw.date) {
      if (f.latestDraw.date < oldDraw.date) {
        throw new Error(`${game}: 사이트의 최신 회차(${f.latestDraw.date})가 저장된 값(${oldDraw.date})보다 과거 — 파싱 오류 의심, 중단`);
      }
      // 새 회차 감지 — 그 회차에 걸려 있던 실제 잭팟을 아카이브에 넣음.
      const ownAmountUsd = game === 'megamillions' ? f.ownJackpot.amountUsd : oldJackpotData[game].amountUsd;
      const varName = game === 'powerball' ? 'POWERBALL_JACKPOT_ARCHIVE' : 'MEGAMILLIONS_JACKPOT_ARCHIVE';
      archiveAppends.push({
        varName,
        entry: [f.latestDraw.date, f.latestDraw.numbers, f.latestDraw.special, toMillions(ownAmountUsd)],
      });
      newLatestDraw[game] = f.latestDraw;
      changed = true;
      console.log(`[update-jackpot] ${game}: 새 회차 감지 ${oldDraw.date} -> ${f.latestDraw.date}`);
    }

    if (f.next.amountUsd !== newJackpotData[game].amountUsd || f.next.cashUsd !== newJackpotData[game].cashUsd) {
      newJackpotData[game] = { amountUsd: f.next.amountUsd, cashUsd: f.next.cashUsd };
      changed = true;
      console.log(`[update-jackpot] ${game}: 다음 추첨 예상 잭팟 갱신 -> $${(f.next.amountUsd / 1e6).toFixed(1)}M (현금가치 $${(f.next.cashUsd / 1e6).toFixed(1)}M)`);
    }
  }

  if (!changed) {
    console.log('[update-jackpot] 변경 없음 — 이미 최신 상태');
    console.log('NO_CHANGE');
    return;
  }

  // script.js: 두 블록 교체. LATEST_DRAW가 JACKPOT_DATA보다 뒤에 있어서 뒤에서부터 잘라야
  // 앞 블록의 위치 인덱스가 안 틀어짐.
  scriptSrc = scriptSrc.slice(0, latestDrawBlock.start) + renderLatestDrawBlock(newLatestDraw) + scriptSrc.slice(latestDrawBlock.end);
  scriptSrc = scriptSrc.slice(0, jackpotBlock.start) + renderJackpotDataBlock(newJackpotData) + scriptSrc.slice(jackpotBlock.end);

  const archiveChanged = archiveAppends.length > 0;
  for (const { varName, entry } of archiveAppends) {
    oddsSrc = appendJackpotArchiveEntry(oddsSrc, varName, entry);
  }
  // odds-data.js 내용이 바뀌었으면(=아카이브에 새 회차 추가) script.js 안의 지연로드 캐시버스팅
  // 버전도 같이 올려야 브라우저가 옛 odds-data.js를 계속 쓰지 않음.
  if (archiveChanged) {
    scriptSrc = bumpCacheBust(scriptSrc, 'odds-data.js');
  }

  fs.writeFileSync(SCRIPT_PATH, scriptSrc);
  fs.writeFileSync(ODDS_PATH, oddsSrc);

  // 문법 검증 — 깨진 파일이 그대로 커밋되는 걸 막는 마지막 안전장치.
  require('child_process').execFileSync(process.execPath, ['--check', SCRIPT_PATH], { stdio: 'inherit' });
  require('child_process').execFileSync(process.execPath, ['--check', ODDS_PATH], { stdio: 'inherit' });

  // index.html: script.js 내용이 바뀌면 build:min 이후 script.min.js 바이트도 바뀌므로,
  // 그걸 불러오는 캐시버스팅 버전도 같이 올림(script.js는 항상 바뀐 상태로 여기 도달함 — 위
  // !changed 조기 종료를 통과했다는 것 자체가 JACKPOT_DATA/LATEST_DRAW 중 하나는 바뀌었다는 뜻).
  let indexSrc = fs.readFileSync(INDEX_PATH, 'utf8');
  indexSrc = bumpCacheBust(indexSrc, 'script.min.js');
  fs.writeFileSync(INDEX_PATH, indexSrc);

  console.log('[update-jackpot] script.js / odds-data.js / index.html 갱신 완료');
  console.log('CHANGED');
}

main().catch(err => {
  console.error('[update-jackpot] 실패:', err.message);
  process.exit(1);
});

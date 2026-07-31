// GitHub Actions("lottery-backfill.yml")에서만 도는 자동 백필 스크립트.
// 공식 오픈데이터(data.ny.gov, NY주 정부 — 이 프로젝트가 최초 로또 아카이브를 채울 때도 썼던 것과
// 같은 데이터셋)에서 odds-data.js에 없는 새 회차만 찾아서 당첨번호 아카이브(POWERBALL_DRAW_ARCHIVE/
// MEGAMILLIONS_DRAW_ARCHIVE)에 추가함.
//
// ⚠️ 잭팟 금액 아카이브(POWERBALL_JACKPOT_ARCHIVE 등), JACKPOT_DATA(현재 광고 잭팟), LATEST_DRAW
// (홈 화면 위젯)는 이 스크립트가 손대지 않음 — 저 데이터엔 신뢰할 수 있는 구조화 API가 없어서(사람이
// 공식 사이트를 직접 보고 확인해야 함) 지금처럼 수동 유지.
//
// ⚠️ data.ny.gov가 이 저장소를 개발하는 샌드박스 환경에서는 네트워크 정책으로 막혀있어서, 이 스크립트
// 자체를 로컬에서 실행/검증하지 못한 채로 작성됨(2026-07-29). 아래 파싱 로직은 이 데이터셋의 공개적으로
// 알려진 스키마를 근거로 짰지만, 실제 필드명이 다르면 조용히 잘못된 값을 쓰지 않고 바로 에러를 던지고
// exit code 1로 끝나도록(=커밋 없이 Actions 탭에 실패 표시만) 방어적으로 작성함. 최초 1회는 반드시
// GitHub Actions 탭에서 "Run workflow"로 수동 실행해서 로그를 직접 확인할 것.

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const ODDS_PATH = path.join(ROOT, 'odds-data.js');

const SOURCES = {
  powerball: { resourceId: 'd6yy-54nr', archiveVar: 'POWERBALL_DRAW_ARCHIVE' },
  megamillions: { resourceId: '5xaw-6ayf', archiveVar: 'MEGAMILLIONS_DRAW_ARCHIVE' },
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'chamtax-lottery-backfill/1.0 (+https://chamtax.com)' } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// odds-data.js에서 "const NAME = [...];" 배열 리터럴 하나를 찾아서
// { arr, start, end }로 반환. start/end는 "= " 바로 뒤부터 닫는 "]"까지의 문자열 위치(교체용).
function readArchive(src, varName) {
  const idx = src.indexOf(`const ${varName}`);
  if (idx === -1) throw new Error(`${varName} not found in odds-data.js`);
  const eq = src.indexOf('=', idx);
  if (eq === -1) throw new Error(`${varName}: "=" not found`);
  const end = src.indexOf('];', eq);
  if (end === -1) throw new Error(`${varName}: closing "];" not found`);
  const jsonText = src.slice(eq + 1, end + 1).trim();
  let arr;
  try { arr = JSON.parse(jsonText); } catch (e) { throw new Error(`${varName}: failed to parse existing array (${e.message})`); }
  return { arr, start: eq + 1, end: end + 1 };
}

// winning_numbers 문자열("05 08 15 22 25 12" 형태)을 [메인 5개 숫자], 특수볼 하나로 분리.
// 데이터셋 공개 스키마 기준: 파워볼은 6번째 숫자가 파워볼, 메가밀리언즈는 winning_numbers에
// 백볼 5개만 있고 mega_ball이 별도 필드 — 단, 혹시 스키마가 바뀌어 6개가 다 들어있는 경우도 대비함.
function parseNumbers(rec, game) {
  const raw = String(rec.winning_numbers || '').trim();
  if (!raw) throw new Error(`record missing winning_numbers: ${JSON.stringify(rec)}`);
  const tokens = raw.split(/\s+/).map(n => parseInt(n, 10));
  if (tokens.length < 5 || tokens.some(n => Number.isNaN(n))) {
    throw new Error(`unexpected winning_numbers format "${raw}" for ${JSON.stringify(rec)}`);
  }

  if (game === 'powerball') {
    if (tokens.length !== 6) throw new Error(`powerball winning_numbers expected 6 tokens, got ${tokens.length}: "${raw}"`);
    return { main: tokens.slice(0, 5), special: tokens[5] };
  }

  // megamillions
  if (tokens.length === 6) return { main: tokens.slice(0, 5), special: tokens[5] };
  if (tokens.length === 5) {
    const mb = parseInt(rec.mega_ball, 10);
    if (Number.isNaN(mb)) throw new Error(`megamillions record has 5-token winning_numbers but no valid mega_ball field: ${JSON.stringify(rec)}`);
    return { main: tokens, special: mb };
  }
  throw new Error(`megamillions winning_numbers unexpected token count ${tokens.length}: "${raw}"`);
}

async function findNewEntries(game, { resourceId, archiveVar }, src) {
  const { arr: archive } = readArchive(src, archiveVar);
  const lastDate = archive.length ? archive[archive.length - 1][0] : '1900-01-01';
  const known = new Set(archive.map(d => d[0]));

  const url = `https://data.ny.gov/resource/${resourceId}.json?$where=draw_date > '${lastDate}T00:00:00.000'&$order=draw_date ASC&$limit=60`;
  const records = await fetchJson(url);
  if (!Array.isArray(records)) throw new Error(`${game}: expected an array response, got ${typeof records}`);

  const newEntries = [];
  for (const rec of records) {
    const date = String(rec.draw_date || '').slice(0, 10);
    if (!date || known.has(date)) continue;
    const { main, special } = parseNumbers(rec, game);
    newEntries.push([date, main, special]);
  }
  return newEntries;
}

async function main() {
  let src = fs.readFileSync(ODDS_PATH, 'utf8');
  let totalNew = 0;

  for (const [game, cfg] of Object.entries(SOURCES)) {
    const newEntries = await findNewEntries(game, cfg, src);
    if (!newEntries.length) {
      console.log(`[${game}] no new draws`);
      continue;
    }
    console.log(`[${game}] +${newEntries.length}: ${newEntries.map(e => e[0]).join(', ')}`);

    const { arr, start, end } = readArchive(src, cfg.archiveVar);
    const merged = arr.concat(newEntries);
    src = src.slice(0, start) + ' ' + JSON.stringify(merged) + src.slice(end);
    totalNew += newEntries.length;
  }

  if (totalNew === 0) {
    console.log('No new draws found — nothing to write.');
    return;
  }

  fs.writeFileSync(ODDS_PATH, src);
  console.log(`Wrote ${totalNew} new draw(s) to odds-data.js`);
}

main().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});

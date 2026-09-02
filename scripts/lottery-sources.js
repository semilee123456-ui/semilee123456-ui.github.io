// 파워볼(powerball.com)·메가밀리언즈(megamillions.com) 공식 사이트에서 "현재 잭팟(다음 추첨
// 예상 금액)"과 "최신 추첨 결과"를 가져오는 순수 fetch/parse 모듈(파일 쓰기는 안 함 — 그건
// update-jackpot-data.js 담당). scripts/update-jackpot-data.js에서만 씀(GitHub Actions
// "jackpot-update.yml").
//
// 공식 API가 따로 없어서(파워볼은 홈페이지 서버사이드 HTML에 이미 값이 박혀 있고, 메가밀리언즈는
// 홈페이지가 클라이언트에서 부르는 내부 ASMX 엔드포인트를 그대로 씀) 둘 다 스크레이핑 성격이라,
// 마크업이 바뀌면 조용히 틀린 값을 쓰지 않고 바로 에러를 던지도록 모든 필드에 방어적 검증을 둠
// (scripts/backfill-lottery.js와 같은 원칙). robots.txt 둘 다 일반 크롤링 전면 허용 확인함
// (2026-09 조사) — 하루 한 번 정도의 조회 빈도는 사람이 브라우저로 보는 것과 다를 바 없음.
const https = require('https');
const zlib = require('zlib');

const UA = 'chamtax-jackpot-update/1.0 (+https://chamtax.com)';

// Azure Front Door(두 사이트 다 뒤에 있음)가 Accept-Encoding 요청 헤더와 무관하게 응답을
// 압축해서 줄 때가 있어서(2026-09 조사 중 실제로 겪음 — 압축 안 풀면 이진 쓰레기가 됨), 항상
// content-encoding을 보고 알아서 풀어줌.
function readBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
      const buf = Buffer.concat(chunks);
      const enc = (res.headers['content-encoding'] || '').toLowerCase();
      try {
        if (enc === 'gzip') resolve(zlib.gunzipSync(buf).toString('utf8'));
        else if (enc === 'br') resolve(zlib.brotliDecompressSync(buf).toString('utf8'));
        else if (enc === 'deflate') resolve(zlib.inflateSync(buf).toString('utf8'));
        else resolve(buf.toString('utf8'));
      } catch (e) {
        reject(new Error(`응답 압축 해제 실패 (content-encoding: ${enc || 'none'}): ${e.message}`));
      }
    });
    res.on('error', reject);
  });
}

function get(url, extraHeaders) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate, br', ...extraHeaders } }, res => {
      // 리다이렉트 최대 1홉만 따라감(그 이상이면 대상 사이트 구조가 크게 바뀐 것으로 보고 에러)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        get(next, extraHeaders).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        return;
      }
      readBody(res).then(resolve, reject);
    }).on('error', reject);
  });
}

function post(url, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj || {});
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Accept-Encoding': 'gzip, deflate, br',
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`${url} -> HTTP ${res.statusCode}`));
        return;
      }
      readBody(res).then(resolve, reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// "$146 Million" / "$1.02 Billion" 같은 표기를 실제 USD 정수로.
function parseUsdAmount(numStr, unitStr) {
  const n = parseFloat(numStr);
  if (!Number.isFinite(n)) throw new Error(`parseUsdAmount: "${numStr}" 파싱 실패`);
  const mult = unitStr.toLowerCase().startsWith('billion') ? 1e9 : 1e6;
  return Math.round(n * mult);
}

function assertJackpotRange(usd, label) {
  // 역대 최저~최고 기록(수천만~20억 달러대)보다 넉넉하게 잡은 방어 범위 — 이 밖이면
  // 파싱이 엉뚱한 숫자를 집었을 가능성이 높다고 보고 에러.
  if (!Number.isFinite(usd) || usd < 10_000_000 || usd > 10_000_000_000) {
    throw new Error(`${label}: 잭팟 금액이 상식적 범위를 벗어남 (${usd})`);
  }
}

function assertBalls(numbers, special, mainCount, label) {
  if (!Array.isArray(numbers) || numbers.length !== mainCount) {
    throw new Error(`${label}: 메인 번호 개수가 ${mainCount}개가 아님 (${JSON.stringify(numbers)})`);
  }
  if (new Set(numbers).size !== numbers.length) {
    throw new Error(`${label}: 메인 번호에 중복 있음 (${JSON.stringify(numbers)})`);
  }
  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error(`${label}: 번호 범위 이상 (${n})`);
  }
  if (!Number.isInteger(special) || special < 1 || special > 99) {
    throw new Error(`${label}: 보너스볼 범위 이상 (${special})`);
  }
}

function assertIsoDate(dateStr, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || Number.isNaN(Date.parse(dateStr))) {
    throw new Error(`${label}: 날짜 형식 이상 (${dateStr})`);
  }
}

async function fetchPowerball() {
  const html = await get('https://www.powerball.com/');

  const jackpotM = html.match(/Estimated Jackpot[\s\S]{0,300}?game-jackpot-number[^>]*>\s*\$([\d.]+)\s*(Million|Billion)/);
  if (!jackpotM) throw new Error('powerball: Estimated Jackpot 파싱 실패 — 사이트 구조가 바뀌었을 수 있음');
  const cashM = html.match(/Cash Value[\s\S]{0,300}?game-jackpot-number[^>]*>\s*\$([\d.]+)\s*(Million|Billion)/);
  if (!cashM) throw new Error('powerball: Cash Value 파싱 실패');

  const nextAmountUsd = parseUsdAmount(jackpotM[1], jackpotM[2]);
  const nextCashUsd = parseUsdAmount(cashM[1], cashM[2]);
  assertJackpotRange(nextAmountUsd, 'powerball nextAmountUsd');
  assertJackpotRange(nextCashUsd, 'powerball nextCashUsd');
  if (nextCashUsd >= nextAmountUsd) throw new Error('powerball: cashUsd가 amountUsd보다 크거나 같음 — 파싱 오류 의심');

  const lastDateM = html.match(/draw-result\?gc=powerball&date=(\d{4}-\d{2}-\d{2})/);
  if (!lastDateM) throw new Error('powerball: 최신 추첨 날짜 파싱 실패');
  const date = lastDateM[1];
  assertIsoDate(date, 'powerball latestDraw.date');

  const whiteBalls = [...html.matchAll(/class="form-control col white-balls item-powerball">\s*<div>\s*(\d+)\s*<\/div>/g)].map(m => parseInt(m[1], 10));
  const pbM = html.match(/class="form-control col powerball item-powerball">\s*<div>\s*(\d+)\s*<\/div>/);
  if (!pbM) throw new Error('powerball: 파워볼 번호 파싱 실패');
  const special = parseInt(pbM[1], 10);
  assertBalls(whiteBalls, special, 5, 'powerball latestDraw');

  return {
    latestDraw: { date, numbers: whiteBalls, special },
    next: { amountUsd: nextAmountUsd, cashUsd: nextCashUsd },
  };
}

async function fetchMegaMillions() {
  const raw = await post('https://www.megamillions.com/cmspages/utilservice.asmx/GetLatestDrawData', {});
  let outer;
  try { outer = JSON.parse(raw); } catch (e) { throw new Error(`megamillions: 응답 JSON 파싱 실패 (${e.message})`); }
  if (typeof outer.d !== 'string') throw new Error('megamillions: 응답에 "d" 필드가 없음 — API 구조가 바뀌었을 수 있음');
  let data;
  try { data = JSON.parse(outer.d); } catch (e) { throw new Error(`megamillions: 내부 "d" JSON 파싱 실패 (${e.message})`); }

  const drawing = data.Drawing;
  const jackpot = data.Jackpot;
  if (!drawing || !jackpot) throw new Error('megamillions: Drawing/Jackpot 필드가 없음');

  const date = String(drawing.PlayDate).slice(0, 10);
  assertIsoDate(date, 'megamillions latestDraw.date');
  const numbers = [drawing.N1, drawing.N2, drawing.N3, drawing.N4, drawing.N5].map(n => parseInt(n, 10));
  const special = parseInt(drawing.MBall, 10);
  assertBalls(numbers, special, 5, 'megamillions latestDraw');

  const nextAmountUsd = Math.round(jackpot.NextPrizePool);
  const nextCashUsd = Math.round(jackpot.NextCashValue);
  assertJackpotRange(nextAmountUsd, 'megamillions nextAmountUsd');
  assertJackpotRange(nextCashUsd, 'megamillions nextCashUsd');
  if (nextCashUsd >= nextAmountUsd) throw new Error('megamillions: cashUsd가 amountUsd보다 크거나 같음 — 파싱 오류 의심');

  // CurrentPrizePool/CurrentCashValue = 방금 끝난 추첨(위 Drawing.PlayDate) 그 회차에 걸려 있던
  // 실제 잭팟 — 파워볼과 달리 API가 직접 줘서 이전 실행값에 의존하지 않고 바로 아카이브에 씀.
  const ownAmountUsd = Math.round(jackpot.CurrentPrizePool);
  const ownCashUsd = Math.round(jackpot.CurrentCashValue);
  assertJackpotRange(ownAmountUsd, 'megamillions ownAmountUsd');

  return {
    latestDraw: { date, numbers, special },
    next: { amountUsd: nextAmountUsd, cashUsd: nextCashUsd },
    ownJackpot: { amountUsd: ownAmountUsd, cashUsd: ownCashUsd },
  };
}

module.exports = { fetchPowerball, fetchMegaMillions };

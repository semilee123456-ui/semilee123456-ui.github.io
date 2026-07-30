// 로또 관련 "사실" 몇 개(일시불이 발표금액의 몇 %인지, 미국 연방세·한국 종합소득세 최고구간)가
// index.html·script.js·여러 랜딩페이지에 각각 따로 텍스트로 박혀있어서, 나중에 하나만 갱신하고
// 나머지를 놓치는 드리프트를 잡기 위한 정적 텍스트 회귀 테스트(브라우저 불필요).
//
// 2026-07-29 세션에서 사이트 전체를 실제로 grep해서 만든 최초 버전 — 이때 기준으로는 전부
// 이미 일치했음(드리프트 없음), 이 테스트는 "지금부터" 어긋나는 걸 잡기 위한 것. 첫 버전은
// 문맥 창(앞뒤 N자)이 옆 절(clause)까지 잘못 집어삼기거나("최고 37%, ... 최고 45%"에서 37%
// 매치가 뒤쪽 "한국"까지 문맥에 걸려 45%를 기대하는 오탐), script.js 주석에서 "최고" 근처의
// 엉뚱한 숫자(37%가 아니라 24% 원천징수율)를 집는 등 네거티브 컨트롤로 직접 두 가지 오탐을
// 잡아서 아래처럼 다시 짬 — HTML 프로즈는 "최고" 바로 앞쪽 문맥만 보고(이 사이트 문장은 항상
// "OO은 최고 NN%" 순서라 앞쪽만 봐도 충분), script.js는 프로즈 매칭 대신 실제 계산에 쓰이는
// 상수(TAX_MODEL.us_resident.federal, KOREA_TAX_BRACKETS 마지막 구간)를 직접 파싱해서 검사함.
//
// ⚠️ 아래 두 값과 비슷해 보이지만 실제로는 다른 사실이라 이 테스트가 일부러 건드리지 않는 것:
//   - "40~47%"(powerball-tax.html, us-lottery-take-home.html): 일시불 전환 + 한국 세금까지
//     반영한 "최종 실수령률"이라 순수 일시불 비율(45~60%)과는 다른 복합 지표
//   - "44~62%"(biggest-jackpot-payouts.html): "금리 등에 따라 달라진다"고 명시적으로 캐빗한
//     더 넓은 추정 범위 — 오타가 아니라 의도된 다른 표현
// 새로 이런 "비슷하지만 다른" 숫자를 추가하게 되면 여기 주석에도 같이 적어둘 것(안 그러면
// 다음 세션이 이 테스트가 왜 그 숫자를 안 잡는지 다시 조사해야 함).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') || f.endsWith('.js'));

const issues = [];

// ---- 1. 일시불 비율(45~60%, 영어권은 45-60%) — "일시불"/"lump sum" 문맥에서만 검사 ----
const LUMP_SUM_RE = /.{0,80}(\d{2})[~-](\d{2})%.{0,40}/g;
for (const file of files) {
  if (file === 'fact_consistency_audit.js') continue;
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let m;
  LUMP_SUM_RE.lastIndex = 0;
  while ((m = LUMP_SUM_RE.exec(content))) {
    const snippet = m[0];
    if (!/일시불|lump[\s-]?sum/i.test(snippet)) continue;
    const lo = m[1], hi = m[2];
    if (`${lo}~${hi}` === '40~47' || `${lo}~${hi}` === '44~62') continue; // 위 주석 참고 — 다른 사실
    if (lo !== '45' || hi !== '60') {
      issues.push({ fact: 'lumpSumRange', file, found: `${lo}~${hi}%`, expected: '45~60 (구분자 ~ 또는 -)' });
    }
  }
}

// ---- 2. HTML 프로즈에 있는 "최고 NN%" — 이 사이트 문장은 항상 "[나라/세목]은/는 최고 NN%"
// 순서로 쓰여있어서, "최고" 바로 앞쪽 30자 문맥만 보면 어느 나라 얘기인지 안전하게 판단 가능
// (뒤쪽까지 보면 "미국 연방세는 최고 37%, 한국 종합소득세도 최고 45%"처럼 바로 다음 절의
// "한국"까지 같이 걸려서 37%인데 45%를 기대하는 오탐이 남 — 실제로 겪은 버그, 아래 주석 참고)
const TOP_RATE_RE = /(최고|top)\s*\(?(\d{2})%/gi;
for (const file of files) {
  if (!file.endsWith('.html')) continue;
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let tm;
  TOP_RATE_RE.lastIndex = 0;
  while ((tm = TOP_RATE_RE.exec(content))) {
    const before = content.slice(Math.max(0, tm.index - 30), tm.index);
    const num = tm[2];
    // "미국 연방세는 최고 37%, 한국 종합소득세도 최고 45%"처럼 두 절이 30자 안에 붙어있으면
    // "연방"과 "한국" 둘 다 창 안에 들어와 버림 — 이 매치와 실제로 같은 절인 쪽(더 가까운
    // 쪽, lastIndexOf 값이 더 큰 쪽)만 채택해서 앞 절의 나라 이름이 뒷 절 매치에 잘못
    // 걸리는 걸 막음
    const federalPos = Math.max(before.toLowerCase().lastIndexOf('연방'), before.toLowerCase().lastIndexOf('federal'));
    const koreaPos = Math.max(before.toLowerCase().lastIndexOf('한국'), before.toLowerCase().lastIndexOf('종합소득세'), before.toLowerCase().lastIndexOf('korea'));
    const isFederal = federalPos >= 0 && federalPos > koreaPos;
    const isKorea = koreaPos >= 0 && koreaPos > federalPos;
    if (isFederal && num !== '37') {
      issues.push({ fact: 'usFederalTop', file, found: tm[0], before, expected: '37%' });
    }
    if (isKorea && num !== '45') {
      issues.push({ fact: 'krTop', file, found: tm[0], before, expected: '45%' });
    }
  }
}

// ---- 3. script.js 실제 계산 상수 — 프로즈 문맥 매칭 대신 상수 자체를 직접 파싱(더 정확함) ----
const scriptContent = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const federalMatch = scriptContent.match(/federal:\s*(0\.\d+)/);
if (federalMatch && Number(federalMatch[1]) !== 0.37) {
  issues.push({ fact: 'usFederalTop (TAX_MODEL constant)', file: 'script.js', found: federalMatch[1], expected: '0.37' });
}
const bracketsBlock = scriptContent.match(/const KOREA_TAX_BRACKETS = \[([\s\S]*?)\];/);
if (bracketsBlock) {
  const rates = [...bracketsBlock[1].matchAll(/rate:\s*(0\.\d+)/g)].map(m => Number(m[1]));
  const topRate = rates[rates.length - 1];
  if (topRate !== 0.45) {
    issues.push({ fact: 'krTop (KOREA_TAX_BRACKETS constant)', file: 'script.js', found: topRate, expected: '0.45' });
  }
}

console.log(JSON.stringify(issues, null, 2));
console.log('FILES CHECKED:', files.length, 'ISSUES:', issues.length);

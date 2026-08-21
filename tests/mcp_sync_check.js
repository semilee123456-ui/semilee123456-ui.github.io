// script.js의 TAX_MODEL과 mcp-server/tax-data.js의 FLAT_COUNTRY_MODEL이 어긋나는(drift) 걸
// 잡는 정적 분석 테스트(브라우저 불필요) — 2026-08-21, id/uz/kg/mm 4개국이 2026-08-20 세션에서
// script.js는 ftc_available:false로 정정됐는데 mcp-server/tax-data.js(수동 동기화 파일)엔
// 반영이 안 돼 있던 걸 계기로 추가. 이 drift가 data/country-lottery-tax-rates.{json,csv}
// (scripts/build-lottery-tax-data-hub.js가 tax-data.js에서 생성)에도 그대로 전파돼, MCP 툴과
// 공개 데이터셋 둘 다 4개국에서 "FTC 적용됨(실제는 이중과세)"이라는 틀린 답을 내고 있었음.
//
// 원리: script.js의 각 `{cc}_resident` 객체에서 "세율" 필드(이름에 rate가 들어간 첫 필드)와
// `ftc_available` 플래그를, mcp-server/tax-data.js의 `FLAT_COUNTRY_MODEL[cc]`의 `rate`/
// `ftcAvailable`과 비교. 세율(오차 허용 0.05%p)이나 FTC 가용 여부가 다르면 drift로 보고함.
// kr/pk/us/other처럼 FLAT_COUNTRY_MODEL 밖에서 별도 분기로 계산되는 나라는 건너뜀(둘 다 각
// 파일에 통짜 로직으로 있어 이 필드 비교 방식이 안 맞음 — 수동 대조 필요).
// ⚠️ 커버리지 한계: script.js 쪽 세율 필드가 단순 소수 리터럴(0.25 등)인 나라만 잡음 —
// 인도처럼 `0.30 * 1.25 * 1.04` 같은 수식이거나, "과세표준 없음"이라 세율 필드 자체가 없는
// 나라(캐나다·영국·호주 등 no-domestic-tax-base 그룹)는 이 정규식이 못 잡아서 스킵됨(41개국
// 중 실제로 약 16개국만 체크됨) — 저비용 스모크 테스트로 설계된 것, 전수 검증 아님.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const scriptSrc = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const taxDataPath = path.join(ROOT, 'mcp-server', 'tax-data.js');
const taxDataSrc = fs.readFileSync(taxDataPath, 'utf8');

function extractTaxModelBlock(src) {
  const startTag = 'const TAX_MODEL = {';
  const start = src.indexOf(startTag);
  if (start === -1) throw new Error('TAX_MODEL not found in script.js');
  let i = start + startTag.length - 1;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  return src.slice(start, i + 1);
}

const scriptRates = {};
{
  const block = extractTaxModelBlock(scriptSrc);
  const re = /(\w+)_resident:\s*\{([\s\S]*?)\n  \},?\n/g;
  let m;
  while ((m = re.exec(block))) {
    const cc = m[1];
    const body = m[2];
    const rateMatch = body.match(
      /(?:flat_rate|top_bracket_rate|unverified_approx_rate|unverified_rate|lottery_final_tax_rate|approx_top_bracket_rate|incidental_income_rate|winnings_rate):\s*([\d.]+)/
    );
    const ftcMatch = body.match(/ftc_available:\s*(true|false)/);
    if (rateMatch) {
      scriptRates[cc] = {
        rate: parseFloat(rateMatch[1]),
        ftc: ftcMatch ? ftcMatch[1] === 'true' : null,
      };
    }
  }
}

const flatRates = {};
{
  const flatIdx = taxDataSrc.indexOf('const FLAT_COUNTRY_MODEL = {');
  const flatEnd = taxDataSrc.indexOf('\n};', flatIdx);
  const flatBody = taxDataSrc.slice(flatIdx, flatEnd);
  const re = /^\s*(\w+):\s*\{\s*rate:\s*([^,]+),\s*ftcAvailable:\s*(true|false)/gm;
  let m;
  while ((m = re.exec(flatBody))) {
    let rateVal;
    try { rateVal = eval(m[2].trim()); } catch (e) { rateVal = NaN; }
    flatRates[m[1]] = { rate: rateVal, ftc: m[3] === 'true' };
  }
}

const SKIP = new Set(['kr', 'pk', 'us', 'nonresident', 'other']);
const issues = [];
let checked = 0;

Object.keys(scriptRates).forEach(cc => {
  if (SKIP.has(cc)) return;
  const s = scriptRates[cc];
  const f = flatRates[cc];
  if (!f) {
    issues.push(`${cc}: script.js TAX_MODEL.${cc}_resident에 있지만 mcp-server/tax-data.js FLAT_COUNTRY_MODEL엔 없음 — 새 국가 추가 시 tax-data.js 동기화 누락 가능성`);
    return;
  }
  checked++;
  if (s.ftc !== null && s.ftc !== f.ftc) {
    issues.push(`${cc}: FTC 불일치 — script.js ftc_available=${s.ftc}, mcp-server/tax-data.js ftcAvailable=${f.ftc} (data/country-lottery-tax-rates.json도 같이 확인할 것)`);
  }
  if (Math.abs(s.rate - f.rate) > 0.0005) {
    issues.push(`${cc}: 세율 불일치 — script.js=${s.rate}, mcp-server/tax-data.js=${f.rate}`);
  }
});

console.log(JSON.stringify(issues, null, 2));
console.log('COUNTRIES CHECKED:', checked, 'ISSUES:', issues.length);
process.exit(issues.length > 0 ? 1 : 0);

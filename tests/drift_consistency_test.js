// script.js의 TAX_MODEL(국가별 세율)과 각 랜딩페이지 본문 서술이 어긋나는(drift) 걸 잡는
// 정적 분석 테스트(브라우저 불필요) — 2026-08-20 몽골 페이지 사례(script.js가 10%→40%로
// 정정된 지 2주 넘게 랜딩페이지엔 반영이 안 돼 있었음, fact_consistency_audit.js는 페이지
// 내부 일관성만 보고 script.js와의 교차검증은 안 하는 구조라 못 잡았음)를 계기로 추가.
//
// 원리: TAX_MODEL의 각 `{cc}_resident` 객체에서 "세율" 성격 필드(이름에 rate가 들어간
// 첫 필드 — incidental_income_rate/top_bracket_rate/unverified_approx_rate 등 필드명이
// 나라마다 달라도 전부 "*rate*" 패턴을 따름)를 뽑아 백분율로 변환하고, 그 숫자가 해당
// 국가의 랜딩페이지 본문 어딘가에 "NN%" 형태로 등장하는지만 확인함. 세율 자체가 0(과세표준
// 없음/근거 불명확)인 나라는 검사할 구체적 숫자가 없어 건너뜀. 정교한 세금 계산 검증이
// 아니라 "계산기가 쓰는 핵심 숫자가 페이지에서 최소 한 번은 언급되는가"만 보는 저비용
// 스모크 테스트 — 이 숫자가 아예 없으면 오래된 세율 서술이 남아있을 가능성이 높다는 신호.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const scriptSrc = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');

// 국가 코드 → 랜딩페이지 파일명 매핑 (us는 주(State)별 세율이라 단일 세율 필드가 없어 제외)
const COUNTRY_PAGE = {
  cn: 'china-resident-us-lottery-tax.html',
  in: 'india-resident-us-lottery-tax.html',
  vn: 'vietnam-resident-us-lottery-tax.html',
  id: 'indonesia-resident-us-lottery-tax.html',
  ph: 'philippines-resident-us-lottery-tax.html',
  th: 'thailand-resident-us-lottery-tax.html',
  jp: 'japan-resident-us-lottery-tax.html',
  ru: 'russia-resident-us-lottery-tax.html',
  np: 'nepal-resident-us-lottery-tax.html',
  lk: 'srilanka-resident-us-lottery-tax.html',
  uz: 'uzbekistan-resident-us-lottery-tax.html',
  kz: 'kazakhstan-resident-us-lottery-tax.html',
  kg: 'kyrgyzstan-resident-us-lottery-tax.html',
  mm: 'myanmar-resident-us-lottery-tax.html',
  bd: 'bangladesh-resident-us-lottery-tax.html',
  pk: 'pakistan-resident-us-lottery-tax.html',
  kh: 'cambodia-resident-us-lottery-tax.html',
  mn: 'mongolia-resident-us-lottery-tax.html',
  la: 'laos-resident-us-lottery-tax.html',
  ca: 'us-lottery-tax-for-canadians.html',
  tw: 'taiwan-resident-us-lottery-tax.html',
  hk: 'hongkong-resident-us-lottery-tax.html',
  uk: 'us-lottery-tax-for-uk-residents.html',
  au: 'us-lottery-tax-for-australians.html',
  mx: 'mexico-resident-us-lottery-tax.html',
  fr: 'france-resident-us-lottery-tax.html',
  nz: 'us-lottery-tax-for-nz-residents.html',
  ie: 'us-lottery-tax-for-irish-residents.html',
  sg: 'us-lottery-tax-for-singapore-residents.html',
  za: 'us-lottery-tax-for-south-africans.html',
  my: 'us-lottery-tax-for-malaysians.html',
  de: 'germany-resident-us-lottery-tax.html',
  nl: 'netherlands-resident-us-lottery-tax.html',
  sv: 'sweden-resident-us-lottery-tax.html',
  no: 'norway-resident-us-lottery-tax.html',
  da: 'denmark-resident-us-lottery-tax.html',
  fi: 'finland-resident-us-lottery-tax.html',
  it: 'italy-resident-us-lottery-tax.html',
  pl: 'poland-resident-us-lottery-tax.html',
  tr: 'turkey-resident-us-lottery-tax.html',
};

// 아라비아 숫자가 아닌 고유 숫자 체계를 쓰는 언어(미얀마어 등) — 해당 언어 페이지에서는
// "25%" 대신 "၂၅%"처럼 고유 숫자로 적히므로, 그 나라 코드일 때만 숫자를 변환해서 같이 검색.
// 다른 나라(네팔·라오스·캄보디아 등)는 실제로 아라비아 숫자를 그대로 쓰고 있어서 별도 처리
// 불필요 — 이 목록에서 새로 이슈가 뜨는 나라가 생기면 그때 해당 스크립트만 추가할 것.
const NATIVE_DIGITS = {
  mm: ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'],
};
function toNativeDigits(code, s) {
  const map = NATIVE_DIGITS[code];
  if (!map) return null;
  return s.replace(/[0-9]/g, d => map[Number(d)]);
}

function extractBalancedBlock(src, startMarker) {
  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) return null;
  let depth = 0, end = -1;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  return src.slice(startIdx, end + 1);
}

const taxModelBlock = extractBalancedBlock(scriptSrc, 'const TAX_MODEL = {');
if (!taxModelBlock) {
  console.log(JSON.stringify(['TAX_MODEL 블록을 script.js에서 찾지 못함 — 상수 이름이 바뀌었는지 확인']));
  console.log('ISSUES: 1');
  process.exit(1);
}

// 각 {cc}_resident 서브객체를 통째로 잘라내서, 그 안에서 "*rate*" 패턴의 첫 숫자 필드를 뽑음
const countryChunkRe = /(\w+)_resident:\s*\{/g;
const chunkStarts = [];
let cm;
while ((cm = countryChunkRe.exec(taxModelBlock))) {
  chunkStarts.push({ code: cm[1], start: cm.index });
}

const rates = {}; // code -> { field, value }
for (let i = 0; i < chunkStarts.length; i++) {
  const { code, start } = chunkStarts[i];
  const end = i + 1 < chunkStarts.length ? chunkStarts[i + 1].start : taxModelBlock.length;
  const chunk = taxModelBlock.slice(start, end);
  const fieldMatch = chunk.match(/(\w*rate\w*)\s*:\s*([\d.]+)/);
  if (fieldMatch) rates[code] = { field: fieldMatch[1], value: parseFloat(fieldMatch[2]) };
}

const issues = [];
let checked = 0;

Object.keys(COUNTRY_PAGE).forEach(code => {
  const rateInfo = rates[code];
  if (!rateInfo) {
    issues.push(`${code}: TAX_MODEL.${code}_resident에서 세율 필드를 못 찾음 (필드명 패턴이 바뀌었을 수 있음, 수동 확인 필요)`);
    return;
  }
  if (rateInfo.value === 0) return; // 과세표준 없음/근거 불명확 — 검사할 구체적 숫자 없음

  const filePath = path.join(ROOT, COUNTRY_PAGE[code]);
  if (!fs.existsSync(filePath)) {
    issues.push(`${code}: 매핑된 페이지 ${COUNTRY_PAGE[code]}가 존재하지 않음`);
    return;
  }
  const html = fs.readFileSync(filePath, 'utf8');
  checked++;

  const pct = rateInfo.value * 100;
  // 0/1/2자리 반올림 후보 전부 만들어서(정수면 소수점 후보는 정수와 같아짐) 하나라도 페이지에 있으면 통과.
  // 유럽어권(독일/네덜란드/북유럽 등)은 소수점을 쉼표로 쓰므로("37,8%") 점/쉼표 둘 다 후보에 넣음.
  const candidates = new Set([
    String(Math.round(pct)),
    pct.toFixed(1),
    pct.toFixed(2),
  ]);
  const found = [...candidates].some(c => {
    const dot = c.replace('.', '\\.');
    const comma = c.replace('.', ',');
    // "20%"(대부분 언어) 뿐 아니라 튀르키예어처럼 "%20"으로 기호가 숫자 앞에 오는 표기도 확인
    const patterns = [
      new RegExp(dot + '\\s*%'), new RegExp(comma + '\\s*%'),
      new RegExp('%\\s*' + dot), new RegExp('%\\s*' + comma),
    ];
    const native = toNativeDigits(code, c);
    if (native) {
      patterns.push(new RegExp(native + '\\s*%'), new RegExp('%\\s*' + native));
    }
    return patterns.some(re => re.test(html));
  });

  if (!found) {
    issues.push(
      `${code} (${COUNTRY_PAGE[code]}): script.js의 TAX_MODEL.${code}_resident.${rateInfo.field} = ${rateInfo.value} ` +
      `(${pct}%)가 페이지 본문 어디에도 "${pct}%" 형태로 등장하지 않음 — 랜딩페이지 세율 서술이 낡았을 가능성, ` +
      `직접 확인 필요(몽골 10%→40% 미반영 사례와 같은 패턴)`
    );
  }
});

console.log(JSON.stringify(issues, null, 2));
console.log('COUNTRIES CHECKED:', checked, 'ISSUES:', issues.length);
process.exit(issues.length > 0 ? 1 : 0);

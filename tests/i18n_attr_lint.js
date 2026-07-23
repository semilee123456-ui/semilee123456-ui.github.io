// plain data-i18n(html 아님)인데 한국어 원문에 "단어(설명)"처럼 괄호/%가 공백 없이 붙어있는
// 패턴이 있는 곳을 찾아 data-i18n-html + nowrap span 전환 후보로 사전경고.
// 브라우저 불필요 (정적 분석) — 실제로 줄이 끊기는지는 wrap_audit.js가 렌더링 기준으로 확인함.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// data-i18n="key">텍스트< 형태만 대상 (data-i18n-html은 이미 마크업 가능하므로 제외)
const re = /data-i18n="([^"]+)"([^>]*)>([^<]*)</g;
const HANGUL = /[가-힣]/;
const candidates = [];
let m;
while ((m = re.exec(html))) {
  const [, key, restAttrs, text] = m;
  if (restAttrs.includes('data-i18n-html')) continue; // data-i18n-html이 같은 태그에 같이 있는 경우 방지
  if (!text || !HANGUL.test(text)) continue;
  // "단어(설명)"처럼 한글 바로 뒤에 여는 괄호/%가 붙거나, 닫는 괄호 바로 뒤에 공백 없이
  // 한글이 이어지는 경우만 대상 — 닫는 괄호 앞에 한글이 붙는 것(예: "...등)의")은 유니코드
  // 줄바꿈 규칙상 그 자리에서 거의 끊기지 않아 노이즈가 커서 제외.
  const risky = /[가-힣][(%]/.test(text) || /\)[가-힣]/.test(text);
  if (risky) {
    candidates.push({ key, text: text.trim() });
  }
}

// 같은 key가 여러 군데(홈/비교 탭 중복 등) 나오면 한 번만 보고
const seen = new Set();
const unique = candidates.filter(c => {
  if (seen.has(c.key)) return false;
  seen.add(c.key);
  return true;
});

console.log(JSON.stringify(unique, null, 2));
console.log('CANDIDATES (data-i18n-html 전환 검토 대상, 버그 확정 아님):', unique.length);
console.log('ISSUES:', unique.length);

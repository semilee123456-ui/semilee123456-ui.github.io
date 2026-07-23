// 로컬 href/src 참조 중 실제로 저장소에 없는 파일을 찾음. 브라우저 불필요 (정적 분석).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));

const ATTR_RE = /\b(?:href|src)="([^"]+)"/g;
const issues = [];

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  let m;
  while ((m = ATTR_RE.exec(content))) {
    let ref = m[1];
    if (!ref) continue;
    if (/^(https?:)?\/\//.test(ref)) continue; // 외부 링크
    if (ref.startsWith('mailto:') || ref.startsWith('tel:') || ref.startsWith('javascript:') || ref.startsWith('data:')) continue;
    if (ref.startsWith('#')) continue; // 페이지 내 앵커
    ref = ref.split('#')[0].split('?')[0];
    if (!ref) continue;
    const resolved = path.join(ROOT, decodeURIComponent(ref));
    if (!fs.existsSync(resolved)) {
      issues.push({ file, ref });
    }
  }
}

console.log(JSON.stringify(issues, null, 2));
console.log('FILES CHECKED:', htmlFiles.length, 'ISSUES:', issues.length);

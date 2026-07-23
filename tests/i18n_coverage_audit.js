// data-i18n* 키가 i18n-source/translations.json에 아예 없거나, 일부 언어만 채워진 경우를 검출.
// 브라우저 불필요 (정적 분석). ko는 기본 언어라 HTML에 직접 박혀있으므로 대상에서 제외.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const translations = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n-source/translations.json'), 'utf8'));
const LANG_CODES = fs.readdirSync(path.join(ROOT, 'i18n'))
  .filter(f => f.endsWith('.json'))
  .map(f => f.replace('.json', ''))
  .sort();
const builtI18n = {};
for (const code of LANG_CODES) {
  builtI18n[code] = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', code + '.json'), 'utf8'));
}

const ATTRS = ['data-i18n', 'data-i18n-html', 'data-i18n-placeholder', 'data-i18n-aria-label'];
const keysByAttr = {};
for (const attr of ATTRS) {
  const re = new RegExp(attr + '="([^"]+)"', 'g');
  const found = new Set();
  let m;
  while ((m = re.exec(html))) found.add(m[1]);
  keysByAttr[attr] = found;
}

const issues = [];
for (const attr of ATTRS) {
  for (const key of keysByAttr[attr]) {
    const entry = translations[key];
    if (!entry) {
      issues.push({ key, attr, problem: 'missing from translations.json' });
      continue;
    }
    const have = new Set(Object.keys(entry).filter(c => c !== 'ko'));
    const missingLangs = LANG_CODES.filter(c => !have.has(c));
    if (missingLangs.length) {
      issues.push({ key, attr, problem: 'partial coverage in translations.json', missingLangs });
    }
    const missingFromBuild = LANG_CODES.filter(c => !(key in builtI18n[c]));
    if (missingFromBuild.length) {
      issues.push({ key, attr, problem: 'missing from built i18n/*.json (run scripts/build-i18n.js?)', missingFromBuild });
    }
  }
}

console.log(JSON.stringify(issues, null, 2));
console.log('KEYS CHECKED:', Object.values(keysByAttr).reduce((s, set) => s + set.size, 0), 'ISSUES:', issues.length);

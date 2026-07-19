// i18n-source/translations.json (마스터 소스, {키: {언어코드: 번역문}} 형태)을 읽어서
// i18n/<lang>.json 22개 파일(방문자가 실제로 fetch()하는 파일)을 다시 생성함.
//
// 새 번역 키를 추가하거나 기존 번역을 고칠 때는 i18n/*.json을 직접 건드리지 말고
// i18n-source/translations.json만 수정한 뒤 이 스크립트를 실행하세요:
//   node scripts/build-i18n.js
//
// 언어에 없는 키는 en(영어) 값으로 자동 채워짐 — 번역이 아직 없는 언어라도
// 최소 영어로는 보이게 하기 위함 (한국어보다 국제 방문자에게 더 유용하다고 판단).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'i18n-source', 'translations.json');
const OUT_DIR = path.join(ROOT, 'i18n');

// script.js의 ADDITIONAL_LANGS와 반드시 일치해야 함 (새 언어 추가 시 여기와 script.js 양쪽 다 갱신)
const LANGS = ['en','zh','vi','th','ru','km','ne','id','my','si','uz','mn','kk','ky','ur','bn','lo','ja','ar','hi','fr','tl'];

const I18N = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
const keys = Object.keys(I18N);

let hadError = false;
for (const lang of LANGS) {
  const flat = {};
  let missingEn = 0;
  for (const key of keys) {
    const entry = I18N[key];
    const val = entry[lang] || entry.en;
    if (val === undefined) { missingEn++; continue; }
    flat[key] = val;
  }
  if (missingEn > 0) {
    console.error(`[build-i18n] ${lang}: ${missingEn}개 키가 영어값조차 없음 — i18n-source/translations.json 확인 필요`);
    hadError = true;
  }
  fs.writeFileSync(path.join(OUT_DIR, `${lang}.json`), JSON.stringify(flat));
}

console.log(`[build-i18n] ${LANGS.length}개 언어 파일을 ${keys.length}개 키 기준으로 재생성함 -> ${OUT_DIR}`);
if (hadError) process.exit(1);

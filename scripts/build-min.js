// script.js/styles.css(사람이 읽고 고치는 원본 — 주석 그대로 유지)를 minify해서
// script.min.js/styles.min.css(실제로 방문자가 받는 파일)를 다시 생성함.
//
// script.js 또는 styles.css를 고쳤으면 반드시 이 스크립트를 실행한 뒤 minify된 결과물도
// 같이 커밋하세요:
//   npm install   (devDependencies가 아직 없으면 한 번만)
//   node scripts/build-min.js
//
// index.html은 script.min.js/styles.min.css를 불러오므로, 이 단계를 빠뜨리면 원본 파일을
// 아무리 고쳐도 라이브 사이트엔 반영되지 않음(i18n-source/translations.json → i18n/*.json과
// 완전히 같은 실수 패턴 — build-i18n.js 상단 주석 참고). 원본(script.js/styles.css)의
// 캐시버스팅 버전을 올렸으면 이 스크립트를 돌린 뒤 index.html의 실제 참조도 확인할 것.
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const ROOT = path.resolve(__dirname, '..');

function human(bytes) {
  return (bytes / 1024).toFixed(1) + 'KB';
}

async function buildJs() {
  const srcPath = path.join(ROOT, 'script.js');
  const outPath = path.join(ROOT, 'script.min.js');
  const src = fs.readFileSync(srcPath, 'utf8');
  const result = await minify(src, { compress: true, mangle: true });
  if (result.error) throw result.error;
  fs.writeFileSync(outPath, result.code);
  // 안전장치: minify 결과물이 실제로 유효한 JS인지 한 번 더 확인(구문 오류가 있으면
  // 여기서 바로 걸러짐 — 라이브에 깨진 스크립트가 올라가는 걸 막음)
  new Function(result.code); // eslint-disable-line no-new-func
  console.log(`[build-min] script.js ${human(Buffer.byteLength(src))} -> script.min.js ${human(Buffer.byteLength(result.code))}`);
}

function buildCss() {
  const srcPath = path.join(ROOT, 'styles.css');
  const outPath = path.join(ROOT, 'styles.min.css');
  const src = fs.readFileSync(srcPath, 'utf8');
  const output = new CleanCSS({ level: 2 }).minify(src);
  if (output.errors.length) throw new Error('[build-min] styles.css minify 실패: ' + output.errors.join('; '));
  fs.writeFileSync(outPath, output.styles);
  console.log(`[build-min] styles.css ${human(Buffer.byteLength(src))} -> styles.min.css ${human(Buffer.byteLength(output.styles))}`);
}

(async () => {
  await buildJs();
  buildCss();
  console.log('[build-min] 완료 — script.min.js/styles.min.css가 실제로 바뀐 파일인지 git status로 확인하고, 바뀌었으면 index.html 캐시버스팅 버전과 함께 커밋할 것.');
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});

// script.js/styles.css(사람이 직접 고치는 소스)를 읽어서 script.min.js/styles.min.css
// (방문자가 실제로 받는 압축본)를 다시 생성함.
//
// script.js나 styles.css를 고쳤으면 커밋 전에 이 스크립트를 실행하세요:
//   npm install (최초 1회) && node scripts/build-min.js
//
// GitHub Actions(.github/workflows/minify-assets.yml)가 main에 push될 때 script.js/styles.css
// 변경을 감지해서 이 스크립트를 자동 실행 후 커밋하므로, 로컬에서 깜빡해도 결국 반영되지만
// index.html은 script.min.js/styles.min.css를 직접 로드하므로 로컬 미리보기(Artifact 등)에서
// 최신 상태를 보려면 이 스크립트를 직접 돌려야 함.
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const ROOT = path.resolve(__dirname, '..');
const JS_SRC = path.join(ROOT, 'script.js');
const JS_OUT = path.join(ROOT, 'script.min.js');
const CSS_SRC = path.join(ROOT, 'styles.css');
const CSS_OUT = path.join(ROOT, 'styles.min.css');

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

async function buildJs() {
  const src = fs.readFileSync(JS_SRC, 'utf8');
  const result = await minify(src, { compress: true, mangle: true });
  if (result.error) throw result.error;
  fs.writeFileSync(JS_OUT, result.code);
  console.log(`[build-min] script.js ${fmtKB(Buffer.byteLength(src))} -> script.min.js ${fmtKB(Buffer.byteLength(result.code))}`);
}

function buildCss() {
  const src = fs.readFileSync(CSS_SRC, 'utf8');
  const result = new CleanCSS({ level: 2 }).minify(src);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  fs.writeFileSync(CSS_OUT, result.styles);
  console.log(`[build-min] styles.css ${fmtKB(Buffer.byteLength(src))} -> styles.min.css ${fmtKB(Buffer.byteLength(result.styles))}`);
}

(async () => {
  await buildJs();
  buildCss();
})().catch(err => {
  console.error('[build-min] 실패:', err);
  process.exit(1);
});

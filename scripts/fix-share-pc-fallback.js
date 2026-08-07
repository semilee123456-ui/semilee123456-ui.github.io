#!/usr/bin/env node
// 2026-08-07: 재사용 스크립트. 개별 랜딩페이지들이 각자 자체 <script>에 독립적인
// shareThisPage()를 갖고 있고(script.js 공유 안 함), `if (navigator.share) {` 패턴이
// PC(마우스+hover) 환경에서도 네이티브 OS 공유창을 띄워버리는 문제가 있었음(2026-08-07
// index.html 쪽은 이미 고쳤는데 독립 랜딩페이지들은 빠져있었음 — HANDOFF.md 참고).
// 같은 패턴의 새 랜딩페이지를 또 이 문제로 만들게 되면 이 스크립트를 재사용할 것:
//   node scripts/fix-share-pc-fallback.js <file1.html> <file2.html> ...
// `  if (navigator.share) {` 줄 바로 위에 isDesktopPointerEnv 판별 상수를 넣고,
// 조건을 `if (navigator.share && !isDesktopPointerEnv) {`로 바꿈. 파일당 정확히 1개
// 매치를 기대하며, 0개나 2개 이상이면 에러로 멈춤(조용히 잘못 건드리는 것 방지).

const fs = require('fs');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node scripts/fix-share-pc-fallback.js <file1.html> <file2.html> ...');
  process.exit(1);
}

const NEEDLE = '  if (navigator.share) {';
const GUARD_LINE = "  const isDesktopPointerEnv = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;";
const REPLACEMENT = `${GUARD_LINE}\n  if (navigator.share && !isDesktopPointerEnv) {`;

let okCount = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const matches = src.split(NEEDLE).length - 1;
  if (matches !== 1) {
    console.error(`SKIP ${file}: expected exactly 1 match of "${NEEDLE}", found ${matches}`);
    continue;
  }
  if (src.includes('isDesktopPointerEnv')) {
    console.error(`SKIP ${file}: already has isDesktopPointerEnv`);
    continue;
  }
  const next = src.replace(NEEDLE, REPLACEMENT);
  fs.writeFileSync(file, next);
  console.log(`FIXED ${file}`);
  okCount++;
}
console.log(`\n${okCount}/${files.length} files fixed.`);

#!/usr/bin/env node
// 2026-08-07: 일회성이지만 재사용 가능한 형태로 남겨둠. us-lottery-basics.html(+26개
// 언어) 템플릿에서 "당첨 확률" 섹션이 stat-grid 카드(파워볼 vs 한국 로또, 숫자만)와
// compare-bar-row 막대그래프(같은 두 숫자 + 벼락 확률까지 시각적으로 비교)가 같은
// 정보를 2번 반복하고 있어서(사이트 전체 심플화 감사에서 발견), 정보량이 더 많은
// 막대그래프만 남기고 카드 그리드를 지움. 27개 파일 전부 구조가 동일(<div
// class="stat-grid"> 다음 줄에 stat-card 2개, 그다음 줄에 </div> 정확히 3줄)해서
// 정규식으로 안전하게 일괄 제거. 이 스크립트는 --dry-run으로 먼저 확인 후 실행할 것.
//
//   node scripts/remove-stat-grid-dup.js [--dry-run] <file1.html> <file2.html> ...

const fs = require('fs');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const files = args.filter(a => a !== '--dry-run');
if (files.length === 0) {
  console.error('Usage: node scripts/remove-stat-grid-dup.js [--dry-run] <file1.html> ...');
  process.exit(1);
}

// stat-grid div (2개 stat-card 자식, 정확히 4줄) + 이제 안 쓰게 되는 CSS 규칙 4개 제거
const HTML_BLOCK_RE = /  <div class="stat-grid">\n(?:    <div class="stat-card">.*<\/div>\n){2}  <\/div>\n/;
const CSS_BLOCK_RE = /  \.stat-grid\{[^}]*\}\n  \.stat-card\{[^}]*\}\n  \.stat-card \.k\{[^}]*\}\n  \.stat-card \.v\{[^}]*\}\n/;

let okCount = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const htmlMatches = (src.match(new RegExp(HTML_BLOCK_RE, 'g')) || []).length;
  const cssMatches = (src.match(new RegExp(CSS_BLOCK_RE, 'g')) || []).length;
  if (htmlMatches !== 1 || cssMatches !== 1) {
    console.error(`SKIP ${file}: expected 1 HTML block + 1 CSS block, found html=${htmlMatches} css=${cssMatches}`);
    continue;
  }
  const next = src.replace(HTML_BLOCK_RE, '').replace(CSS_BLOCK_RE, '');
  if (dryRun) {
    console.log(`[dry-run] would fix ${file}`);
  } else {
    fs.writeFileSync(file, next);
    console.log(`FIXED ${file}`);
  }
  okCount++;
}
console.log(`\n${okCount}/${files.length} files ${dryRun ? 'would be' : ''} fixed.`);

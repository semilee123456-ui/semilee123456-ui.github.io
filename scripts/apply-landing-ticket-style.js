#!/usr/bin/env node
/*
 * scripts/apply-landing-ticket-style.js
 *
 * 언제 다시 쓰나: 국가/언어별 콘텐츠 랜딩페이지(90여 개 — *-resident-us-lottery-tax.html,
 * *_in_korea_lottery_tax.html, us-lottery-basics*.html, us-lottery-take-home.html,
 * powerball-tax.html, megamillions-tax.html)의 "정산 티켓" 인라인 스타일을 다시 손봐야
 * 할 때. scripts/landing-ticket-template.css를 고친 뒤 이 스크립트를 다시 돌리면 대상
 * 파일 전부에 한 번에 재전파됨(2026-08 세션에서 처음 작성).
 *
 * 하는 일 (본문 텍스트는 절대 안 건드림 — <style> 블록 교체 + 폰트 <link> 삽입뿐):
 *   1. 각 대상 파일의 <style>...</style> 블록 전체를 landing-ticket-template.css
 *      내용으로 통째로 교체.
 *   2. Space Grotesk / IBM Plex Mono 웹폰트 <link>(index.html과 동일한 URL)를
 *      <style> 바로 앞에 삽입 — 이미 있으면(재실행 시) 중복 삽입하지 않음.
 *
 * 사용법:
 *   node scripts/apply-landing-ticket-style.js <file1.html> <file2.html> ...
 *   node scripts/apply-landing-ticket-style.js --glob "*-resident-us-lottery-tax.html"
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(__dirname, 'landing-ticket-template.css');
const FONT_LINK_MARKER = 'family=Space+Grotesk';
const FONT_LINK_BLOCK = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap" onload="this.onload=null; this.rel=\'stylesheet\';">',
  '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap"></noscript>',
].join('\n');

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/apply-landing-ticket-style.js <file1.html> [file2.html ...]');
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8').replace(/\s+$/, '');
  const results = { changed: [], skipped: [], errors: [] };

  for (const rel of args) {
    const filePath = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
    try {
      let html = fs.readFileSync(filePath, 'utf8');
      const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
      if (!styleMatch) {
        results.errors.push(`${rel}: no <style> block found`);
        continue;
      }
      const newStyleBlock = `<style>\n${template}\n</style>`;
      html = html.replace(styleMatch[0], newStyleBlock);

      if (!html.includes(FONT_LINK_MARKER)) {
        // Insert the font <link> block immediately before <style> (which now
        // exists exactly once, right after we just replaced it).
        html = html.replace('<style>\n' + template, FONT_LINK_BLOCK + '\n<style>\n' + template);
      }

      fs.writeFileSync(filePath, html, 'utf8');
      results.changed.push(rel);
    } catch (e) {
      results.errors.push(`${rel}: ${e.message}`);
    }
  }

  console.log(`Changed: ${results.changed.length}`);
  if (results.skipped.length) console.log(`Skipped: ${results.skipped.length}`);
  if (results.errors.length) {
    console.log(`Errors: ${results.errors.length}`);
    results.errors.forEach((e) => console.log('  ' + e));
    process.exit(1);
  }
}

main();

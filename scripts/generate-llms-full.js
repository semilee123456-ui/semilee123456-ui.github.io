// Regenerates llms-full.txt (AI/RAG full-text mirror) from a fixed set of source HTML
// pages, extracting only human-readable body text (title, meta description, headings,
// paragraphs, quick-answer boxes, tables, FAQ summary/answer pairs) and skipping nav/
// footer/script chrome. Uses plain regex (no HTML parser dependency, per package.json's
// "don't add deps" rule) since every target page shares the same simple hand-authored
// section structure.
//
// Deliberately excludes the 34-language translations of shared pages (e.g. every
// us-lottery-basics-XX.html, lottery-tax-by-country-XX.html) to avoid repeating the same
// content dozens of times — see PAGES below for the exact included set and the reasoning
// comments next to each group. Per-country / per-state pages ARE all included because each
// one has genuinely different tax content, not just a different language.
//
// Re-run this any time: a page in PAGES is edited (numbers, FAQ, wording), a new US state
// or country-resident/country-in-Korea page is added (add its filename to the matching
// array below), or lottery-tax-data-hub.html's rate tables are refreshed.
//
// Usage: node scripts/generate-llms-full.js   (run from repo root)

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SITE = 'https://chamtax.com';

// ---------------------------------------------------------------------------------------
// Page selection. Deliberately excludes language-suffixed duplicates of the same content
// (see CLAUDE.md-style reasoning in the header comment above and in HANDOFF.md).
// ---------------------------------------------------------------------------------------

// 1. Core calculator / methodology pages (English versions — these are the canonical,
//    most-linked-to pages; index.html itself is the Korean-default homepage).
const CORE_PAGES = [
  'index.html',
  'powerball-tax.html',
  'megamillions-tax.html',
  'us-lottery-tax-rate.html',
  'us-lottery-take-home.html',
  'biggest-lottery-jackpots-after-tax.html',
  'lottery-tax-data-hub.html',
  'lottery-prize-tiers.html',
  'lump-sum-vs-annuity-lottery-tax.html',
  'nonresident-lottery-tax-refund.html',
  'korea-resident-us-lottery-tax.html',
  'korean-abroad-us-lottery-tax.html',
];

// 2. All 22 US-state pages that exist today (`*-lottery-tax.html`, excluding the
//    resident/abroad/lump-sum/vietnamese-in-korea pages that also match that suffix).
//    Each state has genuinely different withholding rules, so all are kept.
const STATE_EXCLUDE = /(resident-us-lottery-tax|korean-abroad|lump-sum-vs-annuity|vietnamese-in-korea)/;
const STATE_PAGES = fs.readdirSync(root)
  .filter((f) => f.endsWith('-lottery-tax.html') && !STATE_EXCLUDE.test(f))
  .sort();

// 3. All country-resident pages (`*-resident-us-lottery-tax.html`) except Korea, which is
//    already listed in CORE_PAGES above (avoid duplicating the same file twice).
const RESIDENT_PAGES = fs.readdirSync(root)
  .filter((f) => f.endsWith('-resident-us-lottery-tax.html') && f !== 'korea-resident-us-lottery-tax.html')
  .sort();

// 4. All "foreign national living in Korea" pages (`*_in_korea_lottery_tax.html`). Checked
//    by hand against the full directory listing: every filename here is a distinct
//    nationality/language slug (arabic, bengali, cambodian, china, english, french, hindi,
//    indonesian, japanese, kazakh, kyrgyz, lao, mongolian, myanmar, nepali, philippines,
//    portuguese, russian, spanish, srilanka, taiwan_hk, thai, timor, ukrainian, urdu,
//    uzbek) with no overlapping/duplicate pair (e.g. no separate "chinese_in_korea" next to
//    "china_in_korea") — so all are kept as unique content.
const KOREA_IN_PAGES = fs.readdirSync(root)
  .filter((f) => f.endsWith('_in_korea_lottery_tax.html'))
  .sort();

// 5. Non-US-resident guidance pages (`us-lottery-tax-for-*.html`).
const NONUS_PAGES = fs.readdirSync(root)
  .filter((f) => /^us-lottery-tax-for-.*\.html$/.test(f))
  .sort();

// 6. Base (language-suffix-free) versions of shared explainer pages.
const BASE_PAGES = ['us-lottery-basics.html', 'lottery-tax-by-country.html'];

const PAGES = [
  ...CORE_PAGES,
  ...STATE_PAGES,
  ...RESIDENT_PAGES,
  ...KOREA_IN_PAGES,
  ...NONUS_PAGES,
  ...BASE_PAGES,
];

// ---------------------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------------------

function decodeEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)));
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).trim();
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).replace(/\s*\|\s*ChamTax\s*$/i, '').trim() : '(no title)';
}

function extractDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"\s*\/?>/i);
  return m ? decodeEntities(m[1]).trim() : '';
}

// Scan for all <div class="CLASSNAME">...</div> blocks, tracking nested <div> depth so a
// naive non-greedy regex doesn't stop at the first inner </div> (quick-answer boxes and
// cta-box/related-links all contain nested <div>/<a> children).
function extractDivBlocks(html, className) {
  const results = [];
  const openTag = new RegExp(`<div class="${className}">`, 'g');
  let match;
  while ((match = openTag.exec(html)) !== null) {
    const start = match.index;
    const innerStart = openTag.lastIndex;
    const tagRe = /<div[ >]|<\/div>/g;
    tagRe.lastIndex = innerStart;
    let depth = 1;
    let end = -1;
    let m2;
    while ((m2 = tagRe.exec(html)) !== null) {
      depth += m2[0].startsWith('<div') ? 1 : -1;
      if (depth === 0) {
        end = tagRe.lastIndex;
        break;
      }
    }
    if (end === -1) break; // unbalanced markup — bail rather than corrupt output
    results.push({ start, end, inner: html.slice(innerStart, end - '</div>'.length) });
    openTag.lastIndex = end;
  }
  return results;
}

// Convert a quick-answer box's rows (<span>label</span><b>value</b>) into "label: value" lines.
function formatQuickAnswer(inner) {
  const label = inner.match(/<p class="label">([\s\S]*?)<\/p>/i);
  const rows = [...inner.matchAll(/<div class="row">\s*<span>([\s\S]*?)<\/span>\s*<b>([\s\S]*?)<\/b>\s*<\/div>/gi)];
  const lines = [];
  if (label) lines.push(stripTags(label[1]));
  for (const r of rows) lines.push(`- ${stripTags(r[1])}: ${stripTags(r[2])}`);
  return lines.join('\n');
}

// Convert an HTML <table> into pipe-separated text rows.
function formatTable(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  const lines = [];
  for (const r of rows) {
    const cells = [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => stripTags(c[1]));
    if (cells.some((c) => c.length)) lines.push(cells.join(' | '));
  }
  return lines.join('\n');
}

// Convert a <details class="faq-item"> block into "Q: ...\nA: ..." text.
function formatFaqItem(block) {
  const q = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
  const a = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const qText = q ? stripTags(q[1].replace(/<br\s*\/?>/gi, ' ')) : '';
  const aText = a ? stripTags(a[1].replace(/<br\s*\/?>/gi, ' ')) : '';
  if (!qText && !aText) return '';
  return `Q: ${qText}\nA: ${aText}`;
}

function extractBody(html) {
  // Drop everything before the first <h1> (head, nav bar, share button) and any
  // <script>...</script> blocks anywhere in what remains.
  const h1Idx = html.search(/<h1[ >]/i);
  let body = h1Idx >= 0 ? html.slice(h1Idx) : html;
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Drop nav-ish chrome blocks entirely (balanced-div extraction, since both contain
  // nested <a>/<span> children a naive non-greedy regex would stop inside).
  for (const className of ['cta-box', 'related-links']) {
    for (const block of extractDivBlocks(body, className).reverse()) {
      body = body.slice(0, block.start) + body.slice(block.end);
    }
  }

  // Replace each quick-answer box with a plain-text <p> so the single block-walking pass
  // below picks it up in its correct document position without needing special-casing.
  for (const block of extractDivBlocks(body, 'quick-answer').reverse()) {
    const text = formatQuickAnswer(block.inner).replace(/</g, '&lt;');
    body = `${body.slice(0, block.start)}<p class="qa-block">${text}</p>${body.slice(block.end)}`;
  }

  const lines = [];

  // Walk the body picking out the block types we care about, in document order, so the
  // output preserves the page's natural reading order.
  const blockRe = /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>|<table>([\s\S]*?)<\/table>|<details class="faq-item"[^>]*>([\s\S]*?)<\/details>|<p[^>]*>([\s\S]*?)<\/p>|<li[^>]*>([\s\S]*?)<\/li>/gi;

  let m;
  while ((m = blockRe.exec(body)) !== null) {
    if (m[1]) {
      // heading
      const level = m[1] === 'h1' ? '#' : m[1] === 'h2' ? '##' : '###';
      const text = stripTags(m[2]);
      if (text) lines.push(`${level} ${text}`);
    } else if (m[3] !== undefined) {
      const text = formatTable(`<table>${m[3]}</table>`);
      if (text) lines.push(text);
    } else if (m[4] !== undefined) {
      const text = formatFaqItem(m[0]);
      if (text) lines.push(text);
    } else if (m[5] !== undefined) {
      // stripTags also decodes the &lt; that qa-block text escaped, back to a literal "<".
      const text = stripTags(m[5].replace(/<br\s*\/?>/gi, ' '));
      if (text) lines.push(text);
    } else if (m[6] !== undefined) {
      const text = stripTags(m[6].replace(/<br\s*\/?>/gi, ' '));
      if (text) lines.push(`- ${text}`);
    }
  }

  return lines.join('\n\n');
}

// ---------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------

function buildEntry(filename) {
  const filePath = path.join(root, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ! skipping missing file: ${filename}`);
    return null;
  }
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  const title = extractTitle(html);
  const description = extractDescription(html);
  const body = extractBody(html);
  const url = `${SITE}/${filename === 'index.html' ? '' : filename}`;

  let entry = `## ${title}\nURL: ${url}\n`;
  if (description) entry += `\n${description}\n`;
  if (body) entry += `\n${body}\n`;
  return entry;
}

function main() {
  const header = `# ChamTax (참택스) — 전체 콘텐츠 (AI/RAG 수집용 풀텍스트)

> 이 파일은 llms.txt(요약)와 별개로, 사이트의 핵심 콘텐츠 본문 전체를 하나로 모은
> 파일입니다. AI 검색엔진/RAG 시스템이 이 사이트를 페이지마다 하나씩 크롤링하지 않고도
> 전체 내용을 한 번에 참조할 수 있도록 제공합니다. 서비스 개요와 인용 시 유의사항은
> https://chamtax.com/llms.txt 를 참고하세요.
>
> ChamTax는 35개 언어를 지원하지만, 같은 페이지의 언어별 번역본(예:
> us-lottery-basics-ko.html / -en.html / -zh.html 등)은 내용이 동일하므로 이 파일에는
> 중복 포함하지 않았습니다. 대신 실제로 내용이 서로 다른 페이지 — 미국 50개 주 중
> 전용 페이지가 있는 주, 42개국 중 거주자 전용 페이지가 있는 국가, 한국 거주 외국인
> 국적별 페이지, 미국 외 거주자 대상 페이지, 그리고 핵심 계산기/방법론 페이지 —
> 만을 각 1개 버전(영문 우선)으로 모았습니다.
>
> 세율·세법은 수시로 바뀔 수 있으니, 확정 사실이 아니라 참고용 추정치로 다뤄주시고
> 가능하면 이 파일보다 실제 라이브 페이지(각 URL)를 우선하세요. ⚠️ 표시가 있는 수치는
> 사이트에서도 확정 법령이 아닌 추정으로 명시한 값입니다.

---

`;

  const sections = [];
  let included = 0;
  for (const filename of PAGES) {
    const entry = buildEntry(filename);
    if (entry) {
      sections.push(entry);
      included++;
    }
  }

  const output = header + sections.join('\n---\n\n');
  const outPath = path.join(root, 'llms-full.txt');
  fs.writeFileSync(outPath, output, 'utf8');

  console.log(`Wrote ${outPath}`);
  console.log(`Pages included: ${included} / ${PAGES.length} attempted`);
  console.log(`  core: ${CORE_PAGES.length}, states: ${STATE_PAGES.length}, resident: ${RESIDENT_PAGES.length}, korea-in: ${KOREA_IN_PAGES.length}, non-us: ${NONUS_PAGES.length}, base: ${BASE_PAGES.length}`);
  const stat = fs.statSync(outPath);
  const lineCount = output.split('\n').length;
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB, ${lineCount} lines`);
}

main();

// changelog.html의 날짜별 변경 이력을 RSS(feed.xml)/JSON Feed(feed.json)로 변환.
// petscan-ai 저장소(사용자의 다른 프로젝트)가 guide 글마다 feed.xml/json을 관리하길래
// 2026-08-22에 참택스에도 이식 — 참택스는 별도 블로그 글이 없어서 이미 있는
// changelog.html("세율 데이터가 언제, 왜 바뀌었나요?")을 피드 소스로 재사용함.
//
// 재실행 시점: changelog.html에 새 날짜 항목을 추가할 때마다(정기 세율/데이터 점검 세션
// 등에서) 같이 재실행할 것 — 자동 훅 없음, 수동으로 돌려야 함.
// 실행: node scripts/generate-feed.js   (repo 루트에서)

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'changelog.html'), 'utf8');

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}
function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// changelog.html은 <h2>날짜(또는 날짜 범위)</h2> 다음에 그 날짜의 .changelog-entry들이
// 이어지는 구조. h2로 섹션을 자른 뒤 각 섹션 안의 entry를 파싱함.
const sections = html.split(/<h2>([^<]+)<\/h2>/).slice(1); // [날짜1, 본문1, 날짜2, 본문2, ...]

const items = [];
for (let i = 0; i < sections.length; i += 2) {
  const dateLabel = sections[i].trim();
  const body = sections[i + 1];
  // 범위 표기("2026-08-06 ~ 2026-08-18")면 더 최근인 끝 날짜를 pubDate로 씀
  const dates = dateLabel.match(/\d{4}-\d{2}-\d{2}/g) || [];
  const isoDate = dates.length ? dates[dates.length - 1] : null;
  if (!isoDate) continue;

  const entryRe = /<div class="changelog-entry">\s*<span class="country">([^<]*)<\/span><span class="badge ([^"]+)">([^<]*)<\/span>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/g;
  let m;
  while ((m = entryRe.exec(body)) !== null) {
    const country = stripTags(m[1]);
    const badgeLabel = stripTags(m[3]);
    const desc = stripTags(m[4]);
    items.push({
      title: `[${badgeLabel}] ${country}`,
      description: desc,
      dateLabel,
      isoDate,
    });
  }
}

if (items.length === 0) {
  console.error('changelog.html에서 항목을 하나도 못 뽑았음 — HTML 구조가 바뀌었는지 확인할 것');
  process.exit(1);
}

const SITE = 'https://chamtax.com';
const CHANGELOG_URL = `${SITE}/changelog.html`;

function toRfc822(iso) {
  // 시:분 정보가 없어 정오(KST) 고정 — 상대적 순서만 의미 있고 절대 시각은 중요하지 않음
  return new Date(iso + 'T12:00:00+09:00').toUTCString();
}

const rssItems = items.map((it) => `  <item>
    <title>${escapeXml(it.title)}</title>
    <link>${CHANGELOG_URL}</link>
    <guid isPermaLink="false">chamtax-changelog-${it.isoDate}-${escapeXml(it.title).replace(/[^a-zA-Z0-9가-힣]+/g, '-')}</guid>
    <pubDate>${toRfc822(it.isoDate)}</pubDate>
    <description>${escapeXml(it.description)}</description>
  </item>`).join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>참택스(ChamTax) 세율 데이터 변경 이력</title>
  <link>${CHANGELOG_URL}</link>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
  <description>참택스가 51개국 세율·환율·계산 로직을 갱신할 때마다 실제 계산 결과에 영향을 준 변경만 선별해 정리한 이력</description>
  <language>ko-kr</language>
  <lastBuildDate>${toRfc822(items[0].isoDate)}</lastBuildDate>
${rssItems}
</channel>
</rss>
`;

const jsonFeed = {
  version: 'https://jsonfeed.org/version/1.1',
  title: '참택스(ChamTax) 세율 데이터 변경 이력',
  home_page_url: CHANGELOG_URL,
  feed_url: `${SITE}/feed.json`,
  description: '참택스가 51개국 세율·환율·계산 로직을 갱신할 때마다 실제 계산 결과에 영향을 준 변경만 선별해 정리한 이력',
  language: 'ko',
  items: items.map((it) => ({
    id: `chamtax-changelog-${it.isoDate}-${it.title.replace(/[^a-zA-Z0-9가-힣]+/g, '-')}`,
    url: CHANGELOG_URL,
    title: it.title,
    content_text: it.description,
    date_published: new Date(it.isoDate + 'T12:00:00+09:00').toISOString(),
  })),
};

fs.writeFileSync(path.join(root, 'feed.xml'), rss);
fs.writeFileSync(path.join(root, 'feed.json'), JSON.stringify(jsonFeed, null, 2) + '\n');

console.log(`feed.xml/feed.json 생성 완료 — 항목 ${items.length}개, 날짜 섹션 ${sections.length / 2}개`);

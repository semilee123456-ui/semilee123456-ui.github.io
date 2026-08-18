// Inserts <meta name="robots" content="max-image-preview:large"> right after the
// viewport meta tag on every root *.html page that lacks a robots meta tag already
// (pages with an existing robots tag are left untouched — they're deliberate
// noindex utility pages: 404/contact/press-kit/widget-embed).
// Reuse this whenever a fresh batch of landing pages is added without this tag —
// check first with: grep -L 'name="robots"' *.html | xargs grep -L 'name="viewport"'
// to confirm which files still need it before rerunning.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = fs.readdirSync(root).filter((f) => f.endsWith('.html'));

const VIEWPORT_RE = /^<meta name="viewport" content="width=device-width, initial-scale=1\.0">$/m;
const ROBOTS_TAG = '<meta name="robots" content="max-image-preview:large">';

let changed = 0;
let skippedHasRobots = 0;
let skippedNoViewport = 0;

for (const file of files) {
  const full = path.join(root, file);
  const content = fs.readFileSync(full, 'utf8');

  if (content.includes('name="robots"')) {
    skippedHasRobots++;
    continue;
  }
  if (!VIEWPORT_RE.test(content)) {
    skippedNoViewport++;
    continue;
  }

  const updated = content.replace(VIEWPORT_RE, (match) => `${match}\n${ROBOTS_TAG}`);
  fs.writeFileSync(full, updated, 'utf8');
  changed++;
}

console.log(`Updated: ${changed}, skipped (already has robots): ${skippedHasRobots}, skipped (no viewport tag): ${skippedNoViewport}`);

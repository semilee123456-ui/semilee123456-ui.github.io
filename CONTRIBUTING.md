# Contributing

ChamTax is a small, solo-maintained project. Contributions are welcome, but please
open an issue before starting on anything beyond a typo/link fix — the site has a
few non-obvious conventions that are easy to break by accident.

## Before you send a PR

- This is a static site: plain HTML/CSS/JS, no framework, deployed as-is via GitHub
  Pages. `package.json` exists only to minify `script.js`/`styles.css`
  (`npm run build:min`) — don't add other dependencies or a build pipeline.
- Translations live in `i18n-source/translations.json` and are compiled to
  `i18n/*.json` via `scripts/build-i18n.js`. Don't hand-edit the compiled
  `i18n/*.json` files directly.
- Lottery draw/jackpot data (`odds-data.js`) must come from an official source
  (state lottery sites, `data.ny.gov`, or equivalent) — no unsourced numbers.
- There's a `tests/` directory of Playwright/Node audit scripts (broken links,
  i18n coverage, layout overflow, etc.). Run the relevant ones before submitting
  a change that touches HTML/CSS/JS across many pages.
- After editing `script.js` or `styles.css`, run `npm run build:min` so the
  minified files stay in sync, and bump the cache-busting query string
  (`?v=YYYYMMDD-N`) on the affected `<script>`/`<link>` tags.

## Reporting bugs / suggesting content

Open a [GitHub issue](https://github.com/semilee123456-ui/semilee123456-ui.github.io/issues).
For tax-figure corrections, please include the official source you're comparing
against.

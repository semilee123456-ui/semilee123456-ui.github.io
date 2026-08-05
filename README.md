# ChamTax (참택스)

**[chamtax.com](https://chamtax.com)** — a free calculator for how much of a US Powerball / Mega Millions jackpot a winner actually keeps after tax.

Lottery headlines only ever show the announced jackpot. What you actually receive depends on US federal withholding (30% flat for non-resident aliens, or graduated up to 37% for US residents), the state the ticket was bought in, and — for non-US winners — their home country's own tax treatment of foreign lottery income. ChamTax runs all of that in one place.

- **21 countries/jurisdictions** of residence supported, US included (all 50 states + DC)
- **26 languages**
- Full **Powerball draw history since 1992** and **Mega Millions since 2002**, cross-checked against official open data
- Dedicated guides for foreign nationals living in Korea (by nationality) and for Korean nationals living abroad

## Other things in this repo

- [`press-kit.html`](https://chamtax.com/press-kit.html) — quick reference table for journalists/bloggers, plus an embeddable mini-calculator widget (`widget-embed.html`) anyone can drop into their own site with an `<iframe>`
- The per-country take-home data is also published as an open dataset (CC0): [us-lottery-tax-data](https://github.com/semilee123456-ui/us-lottery-tax-data)
- [`llms.txt`](https://chamtax.com/llms.txt) — a structured summary for AI assistants/search tools citing this site

## Stack

Static HTML/CSS/JS, no framework, deployed via GitHub Pages. `package.json` exists only to minify `script.js`/`styles.css` for production (`npm run build:min`) — not a build system in the usual sense. GitHub Actions handle IndexNow pings on content changes and daily lottery-archive backfills from official open data (see `.github/workflows/`).

This is not a lottery retailer or tax advisory service — figures are reference estimates, not tax advice.

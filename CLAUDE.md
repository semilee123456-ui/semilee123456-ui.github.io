# Working on this repo — token-efficiency notes

This is a solo-maintained static site with a very long-running `HANDOFF.md` session
log. These notes are about keeping *this session's own context* small — not about
`HANDOFF.md`'s content, which has its own upkeep rules at the top of that file.

## What actually burns tokens here

- **Dumping large JSON/output straight into the terminal.** Redirect it to a file
  (scratch dir, not this repo) and only print the fields you need
  (`node -e "... console.log(JSON.stringify(x.someField))"`), instead of letting a
  full dump land in the transcript.
- **Reading many screenshots when a few would answer the question.** When
  eyeballing a batch of generated/changed pages (og-image cards, i18n variants,
  RTL vs LTR, different scripts), a handful of representative samples is enough —
  reading all of them rarely finds more than the first few do.
- **Re-deriving a one-off script from scratch every time the same kind of fix comes
  up.** If you build something non-trivial (e.g. `scripts/fix-og-logo.js`'s pixel-scan
  logo detector), save it in `scripts/` with a comment explaining when to reuse it,
  instead of leaving it in a scratchpad to be reinvented next session.
- **Reading whole long files when you only need one section.** `HANDOFF.md` and
  `script.js` are both large. Grep for a section heading or symbol first, then
  `Read` with `offset`/`limit` around the match, rather than reading the whole file.
- **Running slow scripts (Playwright audits, batch image generation) in the
  foreground and polling.** Use background execution and wait for the completion
  notification instead of repeated status checks — each check that finds "still
  running" is wasted turns.

## Repo-specific setup this sandbox needs

- Playwright is **not** a listed dependency in `package.json` (by design — see the
  comment there). `tests/*.png` audits and `scripts/fix-og-logo.js` all assume a
  global install. In this sandbox that's `/opt/node22/lib/node_modules`, so run:
  `NODE_PATH=/opt/node22/lib/node_modules node tests/whatever.js`
- Playwright-based audits that `page.goto()` a local file need a static server
  running first, e.g. `python3 -m http.server 9000` from the repo root, since
  `tests/*.js` hits `http://127.0.0.1:9000/...`.
- Before starting work, `git fetch origin main` and check `git log --oneline
  HEAD..origin/main` — multiple sessions can be active on this repo at once (see
  the `og-image-hook.png` collision recorded in `HANDOFF.md`'s "OG 카드 로고"
  item), so don't assume `HANDOFF.md`'s "known issues" section is still accurate
  without checking.

## Delegation

For open-ended exploration, multi-file audits, or "look over X and tell me what's
wrong" style requests, prefer spawning a subagent over doing the whole
search/read/compare loop in the main session — the intermediate output stays in
the subagent's context and only the summary comes back.

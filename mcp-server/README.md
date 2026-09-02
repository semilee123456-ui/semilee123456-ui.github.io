# ChamTax lottery-tax MCP server

An [MCP](https://modelcontextprotocol.io) server that exposes [ChamTax](https://chamtax.com)'s
US lottery (Powerball / Mega Millions) after-tax take-home calculation as a tool an AI agent
can call directly, for 51 countries plus all 50 US states + DC.

This is a **read-only, offline calculator** — no network calls, no API keys, no data collection.
It runs entirely on your machine.

## What it's for

If someone asks an AI agent something like *"If I win a $500M Powerball jackpot as a non-US
resident living in Vietnam, how much would I actually take home?"*, this tool lets the agent
compute a real answer instead of guessing or quoting the pre-tax announced number.

## Install & run

No install step needed beyond Node.js 18+ — it has zero dependencies.

```bash
git clone https://github.com/semilee123456-ui/semilee123456-ui.github.io.git
cd semilee123456-ui.github.io/mcp-server
node index.js
```

It speaks newline-delimited JSON-RPC 2.0 over stdin/stdout, per the MCP stdio transport spec.
You normally don't run it by hand — an MCP client (Claude Desktop, Cursor, etc.) launches it
as a subprocess.

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "chamtax-lottery-tax": {
      "command": "node",
      "args": ["/absolute/path/to/semilee123456-ui.github.io/mcp-server/index.js"]
    }
  }
}
```

Other MCP clients follow the same shape — a command + args pointing at `index.js`.

## The tool: `calculate_lottery_takehome`

| Argument | Type | Required | Notes |
|---|---|---|---|
| `amountUsd` | number | yes | The actual payout to evaluate (e.g. lump-sum cash value), **not** an announced annuity total. |
| `country` | string | yes | One of: `kr, us, cn, in, vn, id, ph, th, jp, ru, np, lk, uz, kz, kg, mm, bd, pk, kh, mn, la, ca, tw, hk, uk, au, mx, fr, nz, ie, sg, za, my, de, nl, sv, no, da, fi, it, pl, tr, other` |
| `stateCode` | string | no | US state code (e.g. `"CA"`). Only used when `country` is `"us"`. Defaults to the 50-state average. |
| `krwPerUsd` | number | no | USD→KRW exchange rate. Only used when `country` is `"kr"` — every other country's rate is a flat percentage, so it doesn't need currency conversion. Defaults to an approximate, deliberately-stale placeholder if omitted. |

Returns a JSON object with a tax breakdown, `takeHomeUsd`, `effectiveTaxRatePct`, and a `note`
field — several countries (Thailand, Sri Lanka, Cambodia, Mongolia, Laos, Pakistan, Netherlands,
Turkey) carry an explicit ⚠️ in their note because either no fully confirmed legal basis was
found for their treatment of foreign lottery winnings, or the tax head involved (e.g. Dutch
kansspelbelasting, Turkish VİVK) sits outside the ordinary income-tax foreign-tax-credit
machinery; those are flagged approximations or structurally-uncertain cases, not confirmed
figures. Several other countries (Canada, Hong Kong, UK, Australia, France, New Zealand,
Ireland, Singapore, South Africa, Malaysia, Germany) return `takeHomeUsd` equal to the amount
after the 30% US withholding only — their home country simply has no domestic tax base for
lottery/gambling winnings, so nothing is added on top.

## Not tax advice

This is a simplified, informational estimate — not tax, legal, or financial advice. Several
country rates are explicitly marked as unverified approximations in the tool's own output.
Anyone actually facing this situation should talk to a professional who covers both US and
their home-country tax law. See [chamtax.com](https://chamtax.com)'s disclaimer page for more.

## Keeping this in sync with the main site

**This file's numbers are hand-copied from the main site's `script.js`, not generated from
it.** The site's tax logic lives in `script.js`'s `TAX_MODEL`, `STATE_TAX_RATES`,
`KOREA_TAX_BRACKETS`, and `calcTakeHome()` (roughly lines 1158–2429 as of 2026-08-18),
which is written for a browser DOM context, not headless Node. `tax-data.js` in this
directory is a numeric-only re-derivation for that reason — if a country's rate changes in
`script.js`, someone needs to update `mcp-server/tax-data.js` by hand to match. There is no
build step or test that enforces the two stay in sync; check the last-synced date at the top
of `tax-data.js` before trusting an old checkout.

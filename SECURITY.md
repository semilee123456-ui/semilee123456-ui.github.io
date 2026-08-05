# Security Policy

ChamTax (chamtax.com) is a static site (HTML/CSS/JS, no backend, no user accounts, no
database). There's no login flow, no server-side code, and no stored personal data —
the calculator runs entirely in the visitor's browser.

## Reporting a vulnerability

If you find a security issue (e.g. an XSS vector, a dependency vulnerability in
`package.json`'s dev tooling, or a DNS/hosting misconfiguration), please open a
[GitHub issue](https://github.com/semilee123456-ui/semilee123456-ui.github.io/issues)
on this repository. Since there's no sensitive user data involved, public disclosure
via an issue is fine for most cases — but if you'd rather report privately, mention
that in the issue title and details can follow by other means.

## Scope

In scope: this repository's HTML/CSS/JS and its GitHub Actions workflows.
Out of scope: third-party services the site links to or embeds (Google AdSense,
Formspree, exchange-rate APIs, etc.) — please report those to the relevant vendor.

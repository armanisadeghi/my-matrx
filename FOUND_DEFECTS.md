# FOUND_DEFECTS — my-matrx

Find-it-own-it. This file is for defects that are genuinely **uncertain** or **decision-gated** —
never a parking lot for work whose fix is known (that gets fixed, or spun off as a task).

---

## ❓ UNCERTAIN — two client sites 404 at `/c/{slug}` on the platform host while iopbm 200s (2026-08-19)

On `www.mymatrx.com`, `/c/iopbm` serves 200 but `/c/prp-injection-md` and `/c/dev-website` both 404.

**Not a live outage, and not new.** Both real client sites are healthy on their own domains
(`prpinjectionmd.com` 200, `www.iopbm.com` 200 including `sitemap.xml` / `robots.txt`), and the
behavior is byte-identical between deployments `6a591fd` and `4080b78` when each is hit on its own
`*.vercel.app` URL (both 200 there) — so it is a **host-dependent** condition, not a regression from
the API-auth work, which touched no file under `lib/render/`, `lib/domains.js`, `pages/c/`,
`pages/_sites/`, or `next.config.js`.

**Why it is filed rather than fixed:** it is not clear this is a bug at all. The most likely cause is
the custom-domain verification gate added in `25a77bd` ("verify custom domains before routing
traffic") — a domain-mapped site may be *intended* to stop answering on the platform host once its
domain verifies. If so the defect is only that `iopbm` is inconsistent with it. Answering that needs
a look at `client_sites` rows (`domain`, verification state, `is_active`) plus the intent behind
`25a77bd`, and getting it wrong on a live client site is not worth a guess.

**Who should pick this up:** whoever owns domain routing. Start at `lib/domains.js` +
`proxy.js`'s host block and `docs/DOMAIN_ROUTING_DESIGN.md`, and compare the three sites' rows.

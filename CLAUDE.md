# CLAUDE.md — My Matrx

Simple Next.js app for serving dynamic HTML pages. Deployed on Vercel.

> **Cross-repo system-of-record:** this app is one third of the CMS platform (with matrx-frontend
> + aidream) — read `/Users/armanisadeghi/code/common-docs/systems/cms-system/FEATURE.md` before touching
> the `/c/`, `/p/`, or API surfaces in ANY repo. Cross-repo docs rules: invoke the
> `cross-repo-docs` skill.

---

## Global Overrides

This project differs from the global engineering standards:
- **JavaScript** (not TypeScript) — uses `jsconfig.json`
- **Pages Router** (not App Router)
- **No Tailwind CSS**
- **No Redux or complex state management**

---

## Project Structure

```
pages/
  index.js            → Landing page
  admin.js            → Admin interface
  api/                → API routes (page creation, DB operations)
  c/                  → Dynamic content routes
  p/                  → Dynamic content routes
  utilities/          → Utility pages
public/               → Static HTML files (games/, iopbm/, samples/)
lib/                  → Supabase client and utilities
database/             → Schema and migration files
scripts/              → CLI tools for page management
```

---

## URL Rewriting

Clean URLs via `next.config.js` rewrites:
- `/games/:path` → `/games/:path.html`
- `/iopbm/:path` → `/iopbm/:path.html`
- `/samples/:path` → `/samples/:path.html`

---

## Supabase Integration

- HTML page content stored in Supabase database
- SEO fields: `meta_title`, `meta_description`, `meta_keywords`, `og_image`, `canonical_url`
- API endpoints handle CRUD operations for pages

---

## Client-site rendering — the data is authoritative

One renderer serves every client site: `lib/render/clientSiteRenderer.js` (both `pages/c/…` and the
custom-domain `pages/_sites/…` route are thin wrappers). Two columns that used to sit inert now
drive it. `pnpm test:render` covers both.

### `theme_config` → CSS variables (`lib/render/themeCss.js`)

The CSS cascade is `theme → global_css → header css → footer css → page css`, assembled by
`buildCombinedCss` in `lib/render/cascade.js`. The `theme` layer is a `:root{}` block generated from
`client_sites.theme_config` — naming contract, allowlist and examples in
[docs/CSS_ARCHITECTURE.md](docs/CSS_ARCHITECTURE.md).

- **`use_client_header`/`use_client_footer` gate the component's CSS, not just its HTML.** A page
  that opted out of the header does not carry header CSS. `lib/render/cascade.js` is the only place
  that decides this; the renderer never pre-gates.

- **Mirrored in aidream** (`aidream/services/cms_introspect/cascade.py` `resolve_cascade`, powering
  `cms_inspect css_cascade`). **Change both or they drift.** They did drift once, on exactly the
  gating above (fixed 2026-07-27) — the tool is contractually required to mirror the renderer, so a
  change here that skips the twin makes the tool lie.
- It comes FIRST on purpose: a site's own hand-written `:root` in `global_css` re-declares later and
  wins, so enabling the column changed nothing visually on any live site.

### `navigation` / `show_in_nav` → a menu (`lib/render/siteNav.js`)

**Nav is NEVER auto-injected.** It replaces the literal token `<!--matrx:nav-->` in a header or
footer component's `html_content`. No token → output is byte-identical to before the feature
existed, which is what keeps hand-written menus (iopbm) working untouched. Do not "helpfully" widen
this — a site that did not ask for a menu must not grow one.

- Resolution: a non-empty `client_sites.navigation` array of `{label, href}` wins verbatim;
  otherwise derived from pages where `is_published` AND `show_in_nav`, ordered by `sort_order` then
  `title`, href = `nav.basePath` + `pagePath(page)` (correct on `/c/{slug}/…` AND a custom domain).
- Markup is `<nav class="matrx-nav"><ul><li><a>…` with `aria-current="page"`, no inline styles —
  sites style `.matrx-nav` themselves.
- Every label and href is escaped server-side; non-navigating href schemes are neutralized.

### Live-site safety

`iopbm` and `prp-injection-md` are REAL client sites — treat them as read-only. `dev-website` is the
sandbox (`agent_write_policy=full`) and carries the nav-token fixture. Prove any renderer change by
diffing a rendered `/c/iopbm/…` page before and after.

---

## Integration

Pages from this site are embedded via iframe in the main AI Matrx admin app. See `MAIN_APP_INTEGRATION_INSTRUCTIONS.md` for the full integration guide.

---

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm test:render` | Theme-CSS + nav-token render-layer tests |
| `node -e "..."` | Generate UUID for new pages (`pnpm generate-uuid`) |
| `pnpm env:pull` | Pull env from Doppler |

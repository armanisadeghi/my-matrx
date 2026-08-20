# CLAUDE.md — My Matrx

## Shared checkout, many concurrent writers — NORMAL, never a finding

Arman plus dozens of concurrent agents (across two machines) edit these repos simultaneously; **`origin/main` is the ONLY sync point.** As soon as your code won't crash the app, commit it and get it to remote main — batches of a few files, exactly like a human IDE session. Code held back in a private worktree or branch goes stale; and because the task it belonged to is already checked off as done, held-back code is not merely delayed — it is LOST, and resurfaces days later as an unexplained broken feature with no trail back to the conversation that wrote it. Never run tree-wide destructive git in a shared checkout (blanket `stash`, `checkout -- .`, `reset --hard`, `clean`, dirty `pull --rebase`) — pathspec-scope to your own files. Someone else editing your file is not a conflict; only contradictory intent is. **Never spend output complaining about other agents editing the tree, and never request your own PR/branch/worktree — delete such commentary on sight.** Canonical ruling: workspace root [`../CLAUDE.md`](../CLAUDE.md) § Shared checkout.


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
custom-domain `pages/_sites/…` route are thin wrappers). Three columns that used to sit inert now
drive it. `pnpm test:render` covers all three.

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

### `footer_config` (+ `contact_info` / `social_links`) → a footer (`lib/render/siteFooter.js`)

Same opt-in contract as nav, at the token `<!--matrx:footer-->`. **No token → nothing is emitted**,
which is what keeps iopbm's hand-written `<footer>` byte-identical.

- **`footer_config` is LAYOUT ONLY.** It owns `columns`, `order`, the `show_contact` / `show_social`
  flags, `copyright` and `legal_links`. The contact and social **content** comes from the
  `contact_info` and `social_links` columns that already exist for it — never duplicate them into
  `footer_config`.
- Hrefs starting with `/` are site-relative and get `nav.basePath` (so one config is right on
  `/c/{slug}/…` and a custom domain); anchors/`mailto:`/`tel:`/absolute URLs pass through verbatim.
- Markup is `.matrx-footer-cols` / `.matrx-footer-col` + `.matrx-footer-bottom` /
  `.matrx-footer-legal`, no inline styles, **no outer wrapper** — `.matrx-footer` is the site's own
  `<footer>` element (aidream's starter kit owns that class). Everything is escaped server-side.
- `{}` (every live site today) renders nothing. Full shape in
  [docs/CSS_ARCHITECTURE.md](docs/CSS_ARCHITECTURE.md).

### THE 301 LAW — the redirect ledger (`lib/render/redirects.js`)

A route that resolves NO page (canonical + both legacy aliases missed) is checked against the
per-site ledger `client_redirects` (CMS migrations 0032–0034) and served as a **real 301**
(`siteMovedPermanently` hand-sets the status — Next's `permanent: true` would emit 308). Order is
load-bearing: **page first, ledger second, 404 last** — a live page always beats a stale ledger row.

- Rows are written by the DATABASE (a published page's route change fires a trigger; aidream's
  dispositions and manual tool actions call the same `cms_record_redirect()` function) and are
  **chain-collapsed on write** — serving is ONE lookup, never walk chains here.
- Manual deletion (aidream `cms_site redirect_delete`) is the only removal. Never "clean up" rows
  from this repo.
- Destination math is pure (`redirectFromRoute` / `redirectDestination`, import-free, pinned by
  `pnpm test:render`): basePath-aware for `/c/{slug}` vs custom domains, preview query carried
  through, non-path and self targets refused.

### THE DISCOVERY SURFACE — `sitemap.xml` / `robots.txt` (`lib/render/sitemap.js`)

Every client site serves its own pair, on both surfaces — `/c/{slug}/sitemap.xml` +
`/c/{slug}/robots.txt` on the platform host, and `/sitemap.xml` + `/robots.txt` at the root of a
custom domain (four thin routes over one implementation in `lib/render/discovery.js`). Pure math is
in `lib/render/sitemap.js`, pinned by `pnpm test:render`.

**THE ONE RULE: the sitemap lists exactly the URLs the renderer answers 200 with, in canonical
form — nothing else.** Consequences, each a test:

- **Published only**, and never a `plan_excluded_at` row. The draft gate is `getClientPages`'s own
  default, not a filter bolted on afterwards.
- **A redirected URL can never appear — for free, not by filtering.** THE 301 LAW resolves
  page-first / ledger-second, so a route only reaches the ledger when NO page resolves it, while
  every entry here comes from a published page's own route. **Do not subtract `client_redirects`
  from this list** — that would drop a live page that had reoccupied an old URL. The legacy
  `/{slug}` and `/{category}/{slug}` aliases and the site root (a 302 to the home page) are absent
  for the same reason: a sitemap carries canonicals, not every address that resolves.
- URLs are built on `nav.canonicalBase` — the same value the page's `<link rel=canonical>` uses, so
  a domain-mapped site's sitemap lists its domain URLs on **every** surface. A page whose
  `canonical_url` names something else is not listed at all.
- `lastmod` is `last_published_at`, falling back to `updated_at` for rows published before CMS 0004
  started writing it.
- **robots.txt names the host it was asked on** (`x-forwarded-host`/`Host`, validated), so a client
  domain advertises its own sitemap. It allows everything: preview and not-found hide themselves
  with `noindex` and a real 404, which beats a `Disallow` a crawler may still index around.
- `buildNav` therefore lives in its own pure module (`lib/render/surface.js`, re-exported by the
  renderer) — a route that emits 200 bytes of XML must not pull React and the collection SSR layer
  into its module graph.
- `proxy.js`'s `ROOT_STATIC_PASSTHROUGH` deliberately no longer lists `/robots.txt` and
  `/sitemap.xml`: they are per-site and generated, so they must go through the `/_sites/{host}`
  rewrite. Putting them back would hand a client's domain the platform's files.

Publish-time pinging (IndexNow / Search Console) is deliberately NOT here — it needs credentials
and lives on the publish side (`G-PUBLISH-CRAWL` in the Growth Loop map).

### COLLECTIONS RENDER SERVER-SIDE — `<template data-matrx-collection>` (`lib/render/collectionBindings.js`)

`site_collection_items` rows reach a page in the **served HTML**, not after hydration. The syntax is
one element, opt-in exactly like the nav and footer tokens:

```html
<ul>
  <template data-matrx-collection="events" data-order="starts_at:asc" data-limit="10">
    <li><strong>{{title}}</strong> — {{starts_at}}</li>
  </template>
  <li data-matrx-empty="events">No events scheduled.</li>
</ul>
```

- **No `data-matrx-collection` in a body → that body is the SAME STRING, never parsed.** Every page
  on every live site takes that path, which is what makes the feature unable to change them (proven
  by a 19-page render diff of iopbm + prp-injection-md: byte-identical).
- **The renderer escapes; the author never interpolates.** `{{field}}` resolves ONLY against the
  `public_read_fields` projection (`lib/collections/collectionRead.js`) plus `{{id}}`/`{{created_at}}`
  — a non-allowlisted field like `internal_notes` renders empty because it never reaches the
  expander. Unknown names render empty rather than printing `{{…}}` at a visitor.
- **Zero rows — including an archived collection, `public_read=false`, or a DB error — renders the
  `data-matrx-empty` element and warns.** A client's page never 500s because one collection moved.
- Bindings are scanned in the page body AND in the header/footer components (they carry
  `html_content` too), expanded in `loadSitePageProps`, and the expanded HTML goes into props
  deliberately: the rows are the same public projection the anonymous HTTP route already serves, and
  markup that disagrees with props is markup React can wipe on a re-render.
- `<template>` binding works because `node-html-parser` is lenient. **Do not swap in a
  spec-compliant parser** (jsdom): it puts `<template>` children in a detached fragment and every
  binding silently stops matching.
- Row counts are bounded (`data-limit`, ≤200; default 50) — every row is inlined into the HTML.
- Client JS is progressive enhancement now, never the source of content: `MatrxData.list()` stays
  for interactive cases (search-as-you-type, load-more) and gained an `order` option.

**Ordering is configurable, not hardcoded** (`lib/collections/ordering.js`): per-request
(`?order=field[:asc|desc]`, `data-order`) → `site_collections.settings.default_order` →
`created_at:desc`, which is byte-for-byte what every read did before. Sort fields are restricted to
`public_read_fields` + `created_at`/`id` (ordering by an unreadable field is an oracle), sorting is
DB-side with a stable `id` tiebreak, and a bad *setting* falls back loudly while a bad *request*
400s. `lib/collections/publicItems.js` is the one read both the HTTP route and SSR use — do not fork
it. jsonb values compare as TEXT (fine for `...Z` datetimes, wrong for numeric magnitude); the fix
when it bites is a typed expression index, never a sort in JS.

### Live-site safety

`iopbm` and `prp-injection-md` are REAL client sites — treat them as read-only. `dev-website` is the
sandbox (`agent_write_policy=full`) and carries the nav-token, footer-token and collection-binding
fixtures (`/c/dev-website/events-and-booking` + the `events` collection, whose
`settings.default_order` is `starts_at:asc`). Prove any renderer change by diffing a rendered
`/c/iopbm/…` page before and after.

---

## API auth — the handler is the lock, `proxy.js` is the outer gate

Every route in `pages/api/**` that touches Supabase runs as the **service role**, which bypasses RLS
entirely. `proxy.js`'s matcher is NOT sufficient on its own — a route added outside `ADMIN_API_EXACT`,
or one edit to that list, silently re-opens anonymous RLS-free writes with no test failing. That is
exactly how `pages/api/test-db.js` shipped publicly reachable.

**So: any new route that reads or writes with the service role gates itself, in the handler.**

```js
import { requireIdentity, rateLimit } from '@/lib/apiAuth'

if (!rateLimit(req, res, { name: 'my-route', limit: 20, windowMs: 60_000 })) return
const identity = await requireIdentity(req, res)
if (!identity) return
```

- Two identities, never anonymous: the `mm_admin_session` HMAC cookie, or `x-matrx-admin-secret`
  matching `MYMATRX_ADMIN_API_SECRET` for server-to-server callers. **Fails closed** — an unset
  secret disables that path, it never opens it.
- **THE USER-ID LAW: `user_id` comes from `identity.userId`, never from `req.body`.** A body
  `userId`/`user_id` is ignored on every route. Service callers attribute to
  `MYMATRX_SERVICE_USER_ID`, never to anything they sent.
- **Never spread `req.body` into an update.** `updatePageDraft()` writes whatever it is handed
  straight into an RLS-bypassing `UPDATE`; the page `PUT` allowlists the five `*_draft` columns.
- Rate limiting is fixed-window and in-memory per instance **on purpose** — admin routes on a
  pre-launch platform need to survive a burst, not run a distributed quota system. The anonymous
  visitor routes under `/api/sites/**` keep their DB-backed limiter, which has to be exact.
- Public-by-design routes stay public: `POST /api/form-submissions` and the W2-C collection routes
  gate themselves by site key / `public_read`, and must never grow an admin gate.
- `pnpm test:api-auth` pins all of it. Full history: `common-docs/systems/cms-system/FEATURE.md`
  § Security.

---

## Integration

Pages from this site are embedded via iframe in the main AI Matrx admin app. See `MAIN_APP_INTEGRATION_INSTRUCTIONS.md` for the full integration guide.

---

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm test:render` | Render-layer tests (theme CSS, nav/footer tokens, page selection, redirect math, sitemap/robots) |
| `pnpm test:collections` | W2-C item validator vs the pinned cross-repo fixture |
| `pnpm test:api-auth` | Handler-level auth + rate limiting on the service-role routes |
| `node -e "..."` | Generate UUID for new pages (`pnpm generate-uuid`) |
| `pnpm env:pull` | Pull env from Doppler |

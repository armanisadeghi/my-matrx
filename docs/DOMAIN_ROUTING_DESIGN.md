# Domain-Based Routing for Client Sites (W2-E)

> Status: SHIPPED 2026-07-14. A `client_sites` row with `domain` set (e.g. `www.clientsite.com`)
> serves at that domain — same renderer, same data, no `/c/{slug}` prefix — with domain-correct
> canonicals and og:url. Path-based `/c/{slug}/...` keeps working for every site.

## The one mental model

`proxy.js` (Next middleware, the security gate) looks at the request Host. Platform hosts
(`mymatrx.com`, `www.mymatrx.com`, `localhost`, `*.vercel.app`) behave exactly as before.
Any OTHER host is a candidate custom domain: the request is internally **rewritten** to
`/_sites/{host}{path}` and `pages/_sites/[host]/[[...slug]].js` resolves the site by the
`client_sites.domain` column. Unknown domain → 404. No DB call in middleware — resolution
happens server-side in `getServerSideProps` (the standard Vercel multi-tenant pattern).

Both `/c/[client]/[[...slug]].js` and `/_sites/[host]/[[...slug]].js` are thin wrappers over
ONE shared module: `lib/render/clientSiteRenderer.js` (component + data loader). Never fork
the renderer; extend the shared module.

## Decisions (each one deliberate)

1. **Rewrite, not redirect; middleware, not per-page hacks.** `proxy.js` is extended, not
   weakened: its existing gates (blocked debug/client-write routes, admin auth) run FIRST for
   every request, before host routing. The matcher widened from a path list to
   "everything except `_next/` and dotted static files" — the old gates are pure pathname
   checks, so behavior on platform hosts is unchanged.
2. **Host normalization.** Lowercase, strip `:port`, strip one trailing dot. Hosts must match
   `^[a-z0-9.-]+$` after normalization or the request is treated as a platform request (no
   lookup). IDN domains are matched in their punycode (ASCII) form — store `domain` as
   punycode. `client_sites.domain` stores the **canonical serving host, lowercase**
   (e.g. `www.clientsite.com` or apex `clientsite.com` — owner's choice; whichever is stored
   is canonical).
3. **www/apex counterpart → 308 to canonical.** If the exact host has no site but its
   counterpart does (`www.x.com` stored, request for `x.com`, or vice versa), the request
   308-redirects to the stored canonical host, preserving path + query. Requires both hosts
   attached to the Vercel project (see ops).
4. **`/c/{slug}` keeps serving 200 for domain-mapped sites** — no redirect. Admin iframes,
   the screenshot/verify loop, and preview flows all use `/c/` paths; a redirect would break
   them the day a domain is attached. Instead the `/c/` render emits a **cross-domain
   canonical** (`https://{domain}/...`) so search engines consolidate onto the domain.
   Duplicate-content risk is handled by the canonical tag, the standard mechanism.
5. **Canonical / og:url on a custom domain:** `https://{domain}/{category?}/{slug}` (page's
   explicit `canonical_url` column still wins when set). Home page: the domain root `/`
   302-redirects to `/{homeSlug}` (exact parity with `/c/{site}` behavior); canonical lives on
   the slug URL.
6. **Preview stays on mymatrx.com.** aidream/FE-built `preview_url` is always
   `https://mymatrx.com/c/{slug}/...?preview=true` — it must work before DNS is attached and
   is an internal/admin concern. `?preview=true` on the custom domain also works (same
   renderer, noindex), but no tool builds those URLs.
7. **Custom domains serve ONLY site pages.** On a custom host, EVERY path (including `/api/*`,
   `/admin`, `/c/*`, `/p/*`) is rewritten into `/_sites/{host}/...` and resolves as site
   content or 404s. Platform endpoints are unreachable on client domains — smaller surface,
   no host-dependent API behavior. Exception: a small allowlist of root static files
   (`ROOT_STATIC_PASSTHROUGH` in `proxy.js` — `/favicon.ico`, `/robots.txt`, `/sitemap.xml`)
   passes through to `public/` before the rewrite, so the renderer's `/favicon.ico` fallback
   works on a custom domain. The matcher itself only excludes `_next/` (it CANNOT exclude all
   dotted paths — `/_sites/{host}` targets contain dots — so the allowlist lives in code).
   `?preview=true` is IGNORED on custom domains (decision 6): honoring it on a client's
   production domain would expose unpublished/draft content anonymously (adversarial finding #1).
8. **Direct `/_sites/*` requests are 404'd in middleware** on any host — the path exists only
   as an internal rewrite target (prevents `mymatrx.com/_sites/{host}/...` duplicate-content
   URLs; middleware rewrites don't re-enter middleware).
9. **DB guard (CMS project `viyklljfdhtidwecakwx`, migration `cms/0013`):** partial unique
   index on `lower(domain)` (two sites claiming one domain is a routing ambiguity — refused at
   the DB) + CHECK `domain = lower(btrim(domain))` and no `/`,`:`,`@`,whitespace (a
   non-normalized write fails loudly instead of silently never matching). The FE settings
   editor also trims/lowercases on save (two layers).
10. **Leak posture unchanged.** The `_sites` page reuses the same whitelists
    (`toRenderClientProps` — now including the public `domain` field — and `stripDraftFields`).
    A spoofed Host can only ever reach data already public at `/c/{slug}`.

## C4 URL contract (cross-repo, updated in the same change)

- `aidream/aidream/services/cms/urls.py` — `page_urls(..., domain=None)`: when `domain` is
  set, `path` is domain-rooted (`/{category?}/{slug}`), `live_url = https://{domain}{path}`,
  `root_url = https://{domain}` (home pages), and `preview_url` stays on mymatrx `/c/` form.
  `SiteSummary.live_url` becomes `https://{domain}` when set; site `preview_url` unchanged.
- `aidream/aidream/services/cms/url-rules.json` — fixture gained `domain` cases; both suites
  test against it.
- `matrx-frontend/features/cms/utils/pageUrls.ts` — TS twin gained `domain`; the fixture drift
  test (`features/cms/utils/__tests__/pageUrls.test.ts` + committed fixture copy) now exists
  (it was mandated by C4 but never built).

## Ops — attaching a real domain (Arman)

The code path is live; attaching a domain is pure Vercel + DNS:

1. **Set the domain on the site** in the admin UI (`/cms/{siteId}/settings` → Domain), as the
   canonical host, lowercase — e.g. `www.clientsite.com`. Save.
2. **Vercel:** project `my-matrx` → Settings → Domains → Add → enter BOTH `www.clientsite.com`
   and `clientsite.com` (the non-canonical one can use Vercel's own redirect OR just be
   attached — our middleware 308s it to the stored canonical either way). No env vars, no
   redeploy needed: middleware routes by Host at request time.
3. **DNS (at the client's registrar):** `www` → CNAME `cname.vercel-dns.com`; apex → A
   `76.76.21.21` (or ALIAS/ANAME to `cname.vercel-dns.com` where supported). Vercel
   provisions TLS automatically once DNS propagates.
4. **Verify:** `curl -sI https://www.clientsite.com/` → 302 to the home slug; the page HTML
   contains `<link rel="canonical" href="https://www.clientsite.com/...">`; and
   `https://mymatrx.com/c/{slug}/...` still renders with canonical pointing at the domain.

## Files

- `proxy.js` — host routing + `/_sites` block (extends the security gate)
- `lib/domains.js` — `normalizeHost`, `isPlatformHost`, `domainCounterpart`
- `lib/render/clientSiteRenderer.js` — shared component + `loadSitePageProps` (the ONE renderer)
- `pages/c/[client]/[[...slug]].js`, `pages/_sites/[host]/[[...slug]].js` — thin wrappers
- `lib/supabase/clientHelpers.js` — `getClientSiteByDomain` + `domain` in the render whitelist

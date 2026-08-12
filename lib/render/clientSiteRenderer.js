import Head from 'next/head'
import {
  getClientPage,
  getClientPageByCategory,
  getClientPageByRoute,
  getClientPages,
  getChildPages,
  getClientComponents,
  getClientHomePage,
  getClientRedirect,
  toRenderClientProps,
  stripDraftFields,
} from '@/lib/supabase/clientHelpers'
import { redirectDestination, redirectFromRoute } from '@/lib/render/redirects'
import { themeConfigToCss } from '@/lib/render/themeCss'
import { buildCombinedCss } from '@/lib/render/cascade'
import { hasNavToken, injectNav, resolveNavItems } from '@/lib/render/siteNav'
// pagePath / isRealCategory live in their own pure module (no JSX, no imports)
// so `pnpm test:render` can pin them the way it pins themeCss / siteNav /
// cascade. Re-exported here because every caller imports them from the renderer.
import { isRealCategory, pagePath } from '@/lib/render/pagePath'

export { isRealCategory, pagePath }
// Same treatment for the serving surface: `buildNav` is pure and is now needed
// by consumers that must NOT pull this module's graph (the sitemap/robots
// routes). Re-exported so every existing importer is unchanged.
import { buildNav } from '@/lib/render/surface'

export { buildNav }
import { hasFooterToken, injectFooter, renderFooterHtml, resolveFooter } from '@/lib/render/siteFooter'
import { expandCollectionBindings, findCollectionBindings } from '@/lib/render/collectionBindings'
import { loadBoundCollections } from '@/lib/collections/ssrBindings'

// ---------------------------------------------------------------------------
// The ONE client-site renderer (W2-E). Both public routes are thin wrappers:
//   pages/c/[client]/[[...slug]].js   → basePath `/c/{slug}`   (path-based)
//   pages/_sites/[host]/[[...slug]].js → basePath ``           (custom domain)
// `nav` carries the serving surface:
//   basePath      — prefix for every in-site href (listing cards, preview back)
//   canonicalBase — origin+prefix canonical/og:url URLs are built on. For a
//                   domain-mapped site this is `https://{domain}` on EVERY
//                   surface (the /c/ path emits a cross-domain canonical so
//                   search consolidates onto the domain — no redirect, because
//                   admin iframes/screenshots/preview flows rely on /c/).
// Design + decisions: docs/DOMAIN_ROUTING_DESIGN.md
//
// TWO DERIVED PROPS carry data that used to sit inert in `client_sites`:
//   themeCss  — the `:root{}` block built from `theme_config`, the FIRST layer
//               of the CSS cascade (lib/render/themeCss.js). It comes first so
//               a site's own hand-written `:root` in global_css re-declares and
//               WINS: existing sites are unchanged apart from that leading
//               block. Mirrored server-side in aidream
//               `aidream/services/cms_introspect/cascade.py` — change both.
//   navItems  — the resolved menu (lib/render/siteNav.js). NEVER auto-injected:
//               it only replaces the literal `<!--matrx:nav-->` token in a
//               header/footer component. No token → byte-identical output.
//   footerHtml — the rendered footer (lib/render/siteFooter.js), built from
//               `footer_config` for layout plus `contact_info` / `social_links`
//               for content. Same opt-in token contract, `<!--matrx:footer-->`.
// All three are computed in loadSitePageProps (server-side) so warnings land in
// server logs and no extra site columns enter public __NEXT_DATA__.
//
// AND ONE REWRITTEN BODY: `page.html_content` (plus the header/footer
// components') has its `<template data-matrx-collection>` bindings expanded
// server-side, so collection rows are in the HTML a crawler receives instead of
// arriving only after client-side JS (lib/render/collectionBindings.js). Same
// opt-in rule as nav and footer: no binding attribute anywhere in a body → that
// body is the same string it always was, never even parsed.
// ---------------------------------------------------------------------------

export function ClientSiteRenderer({ client, page, relatedPages, components, isPreview, isList, notFound, previewGate, nav, themeCss, navItems, footerHtml }) {
  if (previewGate) {
    // A preview was requested on a token-protected site without a valid `pt`
    // or an admin session. Tell the tester exactly how to get in — this page
    // must never be a dead end (lib/previewGate.js carries the rule).
    return (
      <>
        <Head>
          <title>Preview access</title>
          <meta name="robots" content="noindex" />
        </Head>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480 }}>
            <h1>This preview is protected</h1>
            <p>
              Sign in once at <a href="/admin">mymatrx.com/admin</a>, then reload
              this page — or open the preview link from the CMS admin, which
              carries the access token.
            </p>
          </div>
        </div>
      </>
    )
  }
  if (notFound) {
    return (
      <>
        <Head>
          <title>Page Not Found</title>
          <meta name="robots" content="noindex" />
        </Head>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1>Page Not Found</h1>
            <p>The requested page could not be found.</p>
          </div>
        </div>
      </>
    )
  }

  const safeNav = nav || buildNav(client)
  const derived = { themeCss: themeCss || '', navItems: navItems || [], footerHtml: footerHtml || '' }

  if (isList) {
    return renderListingPage(client, page, relatedPages, components, isPreview, safeNav, derived)
  }
  return renderNormalPage(client, page, components, isPreview, safeNav, derived)
}

/**
 * Header/footer html with the nav and footer tokens resolved. Returns the
 * row's html UNCHANGED when it carries neither `<!--matrx:nav-->` nor
 * `<!--matrx:footer-->` — the path every existing site takes.
 */
function componentHtml(component, derived, currentHref) {
  const withNav = injectNav(component.html_content, derived.navItems, currentHref)
  return injectFooter(withNav, derived.footerHtml)
}

// Render listing page with cards
function renderListingPage(client, page, relatedPages, components, isPreview, nav, derived) {
  const metaTitle = page.meta_title || `${page.title} | ${client.name}`
  const metaDescription = page.meta_description || page.excerpt || ''
  const headerComponent = components.find(c => c.component_type === 'header')
  const footerComponent = components.find(c => c.component_type === 'footer')
  const currentHref = `${nav.basePath}${pagePath(page)}`

  const combinedCSS = buildCombinedCss({
    themeCss: derived.themeCss,
    globalCss: client.global_css,
    headerComponent,
    footerComponent,
    page,
  })

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="icon" href={client.favicon || '/favicon.ico'} />
        <link rel="apple-touch-icon" href={client.favicon || '/favicon.ico'} />
        {isPreview && <meta name="robots" content="noindex, nofollow" />}
        {combinedCSS && <style dangerouslySetInnerHTML={{ __html: combinedCSS }} />}
      </Head>

      {isPreview && page._isPreview && renderPreviewBanner(page, nav)}
      {/* Listing pages get the include too (N7): a listing's html_content can
          carry an inline MatrxData script exactly like a normal page's. The
          site-key injection deliberately skips listings, so MatrxData throws
          its own explicit "__MATRX_SITE__ is not set" — a loud, diagnosable
          failure instead of a bare ReferenceError with no clue in it. */}
      {matrxDataInclude(page, headerComponent, footerComponent)}
      {page.use_client_header && headerComponent && <div dangerouslySetInnerHTML={{ __html: componentHtml(headerComponent, derived, currentHref) }} />}

      {/* Page content */}
      <div dangerouslySetInnerHTML={{ __html: page.html_content }} />

      {/* List of related pages. Card hrefs go through pagePath (the route), not
          a hand-built `/{category}/{slug}` — that form emitted `/null/{slug}`
          for a category-less page and could not address anything deeper. */}
      {relatedPages && relatedPages.length > 0 && (
        <section style={{ padding: '3rem 2rem', background: 'var(--color-background-subtle, #f5f5f0)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2rem'
            }}>
              {relatedPages.map(relatedPage => (
                <a
                  key={relatedPage.id}
                  href={`${nav.basePath}${pagePath(relatedPage)}`}
                  style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    display: 'block'
                  }}
                >
                  {relatedPage.featured_image && (
                    <img
                      src={relatedPage.featured_image}
                      alt={relatedPage.title}
                      style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px', marginBottom: '1rem' }}
                    />
                  )}
                  <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-primary-teal, #3BA5A5)' }}>
                    {relatedPage.title}
                  </h3>
                  {relatedPage.excerpt && (
                    <p style={{ color: 'var(--color-text-secondary, #666)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                      {relatedPage.excerpt}
                    </p>
                  )}
                  {relatedPage.author && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #999)', marginTop: '0.5rem' }}>
                      By {relatedPage.author}
                    </p>
                  )}
                  {relatedPage.published_date && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #999)', marginTop: '0.25rem' }}>
                      {new Date(relatedPage.published_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {page.use_client_footer && footerComponent && <div dangerouslySetInnerHTML={{ __html: componentHtml(footerComponent, derived, currentHref) }} />}
    </>
  )
}

// Render normal page
function renderNormalPage(client, page, components, isPreview, nav, derived) {
  const metaTitle = page.meta_title || page.title || client.name
  const metaDescription = page.meta_description || page.excerpt || client.meta_defaults?.default_description || ''
  const ogImage = page.og_image || page.featured_image || client.meta_defaults?.default_og_image || ''
  const canonicalUrl = page.canonical_url || `${nav.canonicalBase}${pagePath(page)}`

  const headerComponent = components.find(c => c.component_type === 'header')
  const footerComponent = components.find(c => c.component_type === 'footer')
  const currentHref = `${nav.basePath}${pagePath(page)}`

  const combinedCSS = buildCombinedCss({
    themeCss: derived.themeCss,
    globalCss: client.global_css,
    headerComponent,
    footerComponent,
    page,
  })

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="icon" href={client.favicon || '/favicon.ico'} />
        <link rel="apple-touch-icon" href={client.favicon || '/favicon.ico'} />
        {isPreview && <meta name="robots" content="noindex, nofollow" />}

        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content={page.page_type === 'blog' ? 'article' : 'website'} />
        <meta property="og:url" content={canonicalUrl} />
        {ogImage && <meta property="og:image" content={ogImage} />}

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}

        {!isPreview && <link rel="canonical" href={canonicalUrl} />}
        {combinedCSS && <style dangerouslySetInnerHTML={{ __html: combinedCSS }} />}
      </Head>

      {isPreview && page._isPreview && renderPreviewBanner(page, nav)}
      {/* Before every body — inline scripts in html_content run in document
          order, so an include placed after them cannot help them (N7). */}
      {matrxDataInclude(page, headerComponent, footerComponent)}
      {page.use_client_header && headerComponent && <div dangerouslySetInnerHTML={{ __html: componentHtml(headerComponent, derived, currentHref) }} />}
      <div dangerouslySetInnerHTML={{ __html: page.html_content }} />
      {page.use_client_footer && footerComponent && <div dangerouslySetInnerHTML={{ __html: componentHtml(footerComponent, derived, currentHref) }} />}
      {page.js_content && <script dangerouslySetInnerHTML={{ __html: page.js_content }} />}
    </>
  )
}

// ── W2-C: auto-include the MatrxData helper when the page references it ─────
// Without this, an agent-authored page that calls MatrxData fails SILENTLY and
// TOTALLY: the helper is a separate static file, so a missing <script src>
// makes the first `MatrxData.…` line a ReferenceError that kills the whole
// script it sits in — the events list stays on "Loading…" forever and the
// form's submit handler never binds. Making the agent remember an include is a
// footgun with no failure signal, so the platform includes it for them.
//
// SCAN EVERY BODY, NOT JUST js_content (adversarial finding N7, 2026-07-25).
// Agents author these pages as HTML, so the overwhelmingly likely shape is a
// `MatrxData.submit(...)` inside an inline <script> in **html_content**, or an
// `onclick=` attribute, or a shared header/footer component — none of which
// live in js_content. Scanning only js_content reproduced the exact silent
// ReferenceError this auto-include exists to kill.
//
// PLACEMENT: emitted BEFORE any content body. Inline <script> tags inside
// html_content are real HTML in the server-rendered document and execute in
// document order during initial parse, so an include placed after them is
// useless to them. A classic (non-deferred, non-module) <script src> blocks
// until loaded, guaranteeing window.MatrxData exists for every script that
// follows it.
//
// Not gated on the site having a data_api_key: the renderer's client props are
// a deliberate allow-list (toRenderClientProps) that excludes the key, and
// widening it to plumb a "has a key" flag through public __NEXT_DATA__ buys
// nothing — matrx-data.js is a small static file, and on a keyless site the
// helper throws its own clear "no __MATRX_SITE__" error, which is the loud
// failure we want rather than a ReferenceError.
function matrxDataInclude(page, headerComponent, footerComponent) {
  const bodies = [
    page?.js_content,
    page?.html_content,
    headerComponent?.html_content,
    headerComponent?.js_content,
    footerComponent?.html_content,
    footerComponent?.js_content,
  ]
  const used = bodies.some((body) => typeof body === 'string' && body.includes('MatrxData'))
  return used ? <script src="/matrx-data.js" /> : null
}

// Preview banner component
function renderPreviewBanner(page, nav) {
  const backUrl = `${nav.basePath}${pagePath(page)}` || '/'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #ff9800, #f57c00)',
      color: 'white',
      padding: '12px 20px',
      position: 'sticky',
      top: 0,
      zIndex: 10000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <span style={{ fontWeight: 600 }}>
          PREVIEW MODE - Viewing unpublished changes
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <a
          href={backUrl}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          View Live Version
        </a>
      </div>
    </div>
  )
}

/**
 * Shared getServerSideProps body. `client` is the RAW client_sites row
 * (already resolved — by slug on /c/, by domain on /_sites). Returns a Next
 * `{ props }` / `{ redirect }` result. Props are ALWAYS whitelisted here
 * (toRenderClientProps / stripDraftFields) — never bypass this funnel: they
 * serialize into public __NEXT_DATA__.
 *
 * `req` (the Node request, from the GSSP context) is used ONLY as the carrier
 * for the W2-C site-key injection (see below) — it never enters props.
 */
/**
 * A client-site "page not found" result.
 *
 * The branded not-found body is deliberate (a client's visitor should land on
 * THEIR site, not a platform error page) — but returning it with HTTP 200 made
 * every missing URL a soft-404: search engines index unlimited junk paths on a
 * client's own domain as real pages, and a broken link looks healthy to any
 * monitor watching status codes. Client sites exist to be found, so the status
 * has to tell the truth while the body stays on-brand.
 *
 * `res` is absent only if a caller forgets to thread it; the body still renders
 * in that case, so a miss degrades to today's behavior rather than throwing.
 */
export function siteNotFound(res) {
  if (res && !res.headersSent) res.statusCode = 404
  return { props: { notFound: true } }
}

/**
 * THE 301 LAW — serve one redirect ledger hit as a REAL 301.
 *
 * Next's `{ redirect: { permanent: true } }` emits a 308, so the status is
 * hand-set the same way `siteNotFound` hand-sets 404. The branded not-found
 * body still renders under the 301 status — browsers and crawlers follow the
 * Location header and never show it. No `res` threaded (should not happen) →
 * Next's 308 is the safe fallback: still permanent, still preserves rank.
 */
export function siteMovedPermanently(res, destination) {
  if (res && !res.headersSent) {
    res.statusCode = 301
    res.setHeader('Location', destination)
    return { props: { notFound: true } }
  }
  return { redirect: { destination, permanent: true } }
}

export async function loadSitePageProps({ client, slugSegments, isPreview, previewPt, nav, req, res }) {
  const clientSlug = client.slug
  const slug = slugSegments || []

  let page = null

  if (slug.length === 0) {
    // Site root — redirect to the home page's CANONICAL ROUTE (pagePath), not
    // its bare slug. A home page is NOT root-level by definition: iopbm's is
    // `category='root', slug='home'`, so its route is `/root/home` and `/home`
    // reached it only through the legacy 1-segment slug alias. CMS 0028 dropped
    // `UNIQUE (client_id, slug)`, so that alias is claimable by any other page —
    // which made a real client's site root depend on nobody else owning the
    // slug, and an unsaved draft named "Home" 404'd it. `route` is UNIQUE per
    // site, so this target can only ever be the home page. The 302 stays
    // non-permanent and the slug alias keeps answering, so the previous target
    // remains live for visitors and search.
    const homePage = await getClientHomePage(clientSlug, isPreview)
    if (!homePage) {
      return siteNotFound(res)
    }
    // Preview-mode root browsing stays in preview; a `pt` token link keeps its
    // token through the redirect so the gate doesn't re-challenge (previewGate.js).
    const previewQs = isPreview
      ? `?preview=true${previewPt ? `&pt=${encodeURIComponent(previewPt)}` : ''}`
      : ''
    const destination = `${nav.basePath}${pagePath(homePage)}${previewQs}`
    return { redirect: { destination, permanent: false } }
  } else {
    // ── Resolution by FULL ROUTE, at any depth ──────────────────────────────
    // `client_pages.route` (CMS migration 0028) is trigger-derived from the
    // page's parent chain and UNIQUE per site, so one equality match answers a
    // path of ANY length. This replaced length-branching that hard-404'd every
    // URL deeper than two segments — 428 real planned URLs across two client
    // sites were unbuildable because of it.
    page = await getClientPageByRoute(clientSlug, `/${slug.join('/')}`, isPreview)

    // ── LEGACY ALIASES — deliberate, not dead code ─────────────────────────
    // Before routes existed a page answered at BOTH `/{slug}` (category
    // ignored) and `/{category}/{slug}`. Those URLs are live on real client
    // sites and are indexed; the route backfill deliberately moved some
    // canonicals (`/general/x` → `/x`, `/services/services` → `/services`)
    // WITHOUT moving the pages, so both forms must keep answering 200. These
    // two fallbacks are what makes that true. They only run on a route miss,
    // so a real page is never resolved through them.
    if (!page && slug.length === 1) {
      page = await getClientPage(clientSlug, slug[0], isPreview)
    }
    if (!page && slug.length === 2) {
      const [category, pageSlug] = slug
      page = await getClientPageByCategory(clientSlug, category, pageSlug, isPreview)
    }
  }

  if (!page) {
    // ── THE 301 LAW — the ledger, checked before the 404, after the page ────
    // Page-first order matters: a live page always wins over a stale ledger
    // row for the same route, so a page moving BACK onto a redirected route
    // serves 200 immediately. Rows are chain-collapsed on write (CMS 0032-
    // 0034), so this is ONE lookup — never a loop.
    const fromRoute = redirectFromRoute(slug)
    if (fromRoute) {
      const toRoute = await getClientRedirect(client.id, fromRoute)
      const destination = redirectDestination({
        toRoute,
        fromRoute,
        basePath: nav.basePath,
        isPreview,
        previewPt,
      })
      if (destination) {
        return siteMovedPermanently(res, destination)
      }
    }
    return siteNotFound(res)
  }

  const components = await getClientComponents(clientSlug, null, isPreview)

  // ── Listing pages: what sits UNDER this page ──────────────────────────────
  // Children are a `parent_id` relationship, which works at any depth. The
  // category match is the original mechanism and still the only thing that
  // populates the existing category listings (`/services`, `/education`,
  // `/team` on iopbm), whose members are NOT all parented — so the two are
  // unioned rather than swapped. Dedupe by id; a listing never lists itself or
  // another listing.
  //
  // 'general' is NEVER a category filter. It is the column DEFAULT — i.e. "the
  // author named no category" — and the same value the route rule (CMS 0028)
  // treats as no path segment. Filtering on it made a deep listing card every
  // uncategorized page on the site.
  let relatedPages = []
  let isList = false
  if (page.page_type === 'listing') {
    isList = true
    const children = await getChildPages(clientSlug, page.id)
    const filterCategory = isRealCategory(page.category) ? page.category : null
    const byCategory = filterCategory ? await getClientPages(clientSlug, false, filterCategory) : []
    const seen = new Set()
    relatedPages = [...children, ...byCategory].filter(p => {
      if (p.id === page.id || p.page_type === 'listing' || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }

  // ── theme_config → the leading `:root{}` cascade layer ───────────────────
  // Built here (server-side) so a rejected unsafe value warns into the server
  // log, and so `theme_config` never has to widen the public props allowlist.
  const themeCss = themeConfigToCss(client.theme_config, { siteSlug: client.slug })

  // ── navigation → menu items, ONLY if a component asks for them ───────────
  // Gated on the `<!--matrx:nav-->` token so a site without one pays no extra
  // DB query and renders byte-identically to before this feature existed.
  const headerComponent = components.find(c => c.component_type === 'header')
  const footerComponent = components.find(c => c.component_type === 'footer')
  const wantsNav =
    hasNavToken(headerComponent?.html_content) || hasNavToken(footerComponent?.html_content)

  // ── footer_config → a footer, ONLY if a component asks for one ──────────
  // Same opt-in token gate as nav: no `<!--matrx:footer-->` means no work and
  // byte-identical output. footer_config is LAYOUT; the contact and social
  // blocks read their content from contact_info / social_links so nothing is
  // duplicated across columns.
  const wantsFooter =
    hasFooterToken(headerComponent?.html_content) || hasFooterToken(footerComponent?.html_content)

  const footerHtml = wantsFooter
    ? renderFooterHtml(
        resolveFooter({
          footerConfig: client.footer_config,
          socialLinks: client.social_links,
          contactInfo: client.contact_info,
          siteName: client.name,
          year: new Date().getFullYear(),
          basePath: nav.basePath,
        })
      )
    : ''

  let navItems = []
  if (wantsNav) {
    const explicit = Array.isArray(client.navigation) && client.navigation.length > 0
    // Page fetch only matters for the derived fallback; skip it on an override.
    const navPages = explicit ? [] : await getClientPages(clientSlug)
    navItems = resolveNavItems({
      navigation: client.navigation,
      pages: navPages,
      basePath: nav.basePath,
      pagePath,
    })
  }

  // ── W2-C: SSR collection binding — rows in the served HTML ───────────────
  // The crawl stage of the Growth Loop can only measure content that is IN the
  // markup. Before this, `site_collection_items` reached a page only through
  // `MatrxData.list()` after hydration, so every collection — events,
  // testimonials, profiles — was invisible to search engines and to our own
  // crawler (gap G-COLLECTIONS). Bindings are expanded here, server-side, for
  // the page body and for the header/footer components (they carry
  // `html_content` too and are already scanned for MatrxData, so a shared
  // "latest posts" strip in a footer binds exactly like one in a body).
  //
  // The expanded HTML goes into PROPS deliberately, even though props
  // serialize into public __NEXT_DATA__. The rows are the `public_read`
  // projection — the same bytes the anonymous HTTP list route already serves —
  // so this widens no secret; the site data key is still the thing that must
  // never come this way. The alternative (expanded markup in the HTML but the
  // unexpanded body in props) makes the two disagree, and a React re-render
  // then blows away the server-rendered rows — silently un-fixing the exact
  // thing this feature exists to fix. Row counts are bounded (ssrBindings.js).
  const collectionBindings = [
    page.html_content,
    headerComponent?.html_content,
    footerComponent?.html_content,
  ].flatMap((body) => findCollectionBindings(body))

  let boundPage = page
  let boundComponents = components
  if (collectionBindings.length > 0) {
    const rowsByKey = await loadBoundCollections({
      clientId: client.id,
      siteSlug: client.slug,
      bindings: collectionBindings,
    })
    boundPage = { ...page, html_content: expandCollectionBindings(page.html_content, rowsByKey) }
    boundComponents = components.map((component) => ({
      ...component,
      html_content: expandCollectionBindings(component.html_content, rowsByKey),
    }))
  }

  // ── W2-C: window.__MATRX_SITE__ injection (site slug + data key) ─────────
  // The data key ships inside published page HTML BY DESIGN (it's a revocable
  // rate-limit/attribution token, not a secret — W2C-design §5.3), but it must
  // NOT enter Next props: props serialize into __NEXT_DATA__, and the props
  // allowlist (toRenderClientProps) deliberately excludes data_api_key. So the
  // key rides the REQUEST OBJECT to pages/_document.js, which emits the
  // <script> server-side only — Document markup is never hydrated and its
  // props never serialize, so the key exists in the HTML and nowhere else.
  // Conditions: PUBLISHED (never preview — preview is unauthenticated today,
  // a filed defect; injecting the key there would widen it), NORMAL pages only
  // (js_content only runs on normal pages), and only when the site has a key.
  if (!isPreview && !isList && client.data_api_key && req) {
    req.__matrxSiteInject = { slug: client.slug, dataKey: client.data_api_key }
  }

  // SECURITY: props are serialized verbatim into public __NEXT_DATA__.
  // Whitelist the client row (never ship `settings` / `owner_user_id`) and
  // strip `*_draft` content from every page/component row.
  return {
    props: {
      client: toRenderClientProps(client),
      page: stripDraftFields(boundPage),
      relatedPages: relatedPages.map(stripDraftFields),
      components: boundComponents.map(stripDraftFields),
      isPreview,
      isList,
      nav,
      themeCss,
      navItems,
      footerHtml,
    }
  }
}

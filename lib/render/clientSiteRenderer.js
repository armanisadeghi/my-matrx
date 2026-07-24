import Head from 'next/head'
import {
  getClientPage,
  getClientPageByCategory,
  getClientPages,
  getClientComponents,
  getClientHomePage,
  toRenderClientProps,
  stripDraftFields,
} from '@/lib/supabase/clientHelpers'

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
// ---------------------------------------------------------------------------

export function pagePath(page) {
  return `/${page.category ? page.category + '/' : ''}${page.slug}`
}

/** Compute the `nav` prop for a serving surface. `client` is the RAW db row. */
export function buildNav(client, { onDomain = false } = {}) {
  const basePath = onDomain ? '' : `/c/${client.slug}`
  const canonicalBase = client.domain
    ? `https://${client.domain}`
    : `https://mymatrx.com/c/${client.slug}`
  return { basePath, canonicalBase }
}

export function ClientSiteRenderer({ client, page, relatedPages, components, isPreview, isList, notFound, nav }) {
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

  if (isList) {
    return renderListingPage(client, page, relatedPages, components, isPreview, safeNav)
  }
  return renderNormalPage(client, page, components, isPreview, safeNav)
}

// Render listing page with cards
function renderListingPage(client, page, relatedPages, components, isPreview, nav) {
  const metaTitle = page.meta_title || `${page.title} | ${client.name}`
  const metaDescription = page.meta_description || page.excerpt || ''
  const headerComponent = components.find(c => c.component_type === 'header')
  const footerComponent = components.find(c => c.component_type === 'footer')

  const combinedCSS = [
    client.global_css,
    headerComponent?.css_content,
    footerComponent?.css_content,
    page.css_content
  ].filter(Boolean).join('\n\n')

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
      {page.use_client_header && headerComponent && <div dangerouslySetInnerHTML={{ __html: headerComponent.html_content }} />}

      {/* Page content */}
      <div dangerouslySetInnerHTML={{ __html: page.html_content }} />

      {/* List of related pages */}
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
                  href={`${nav.basePath}/${relatedPage.category}/${relatedPage.slug}`}
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

      {page.use_client_footer && footerComponent && <div dangerouslySetInnerHTML={{ __html: footerComponent.html_content }} />}
    </>
  )
}

// Render normal page
function renderNormalPage(client, page, components, isPreview, nav) {
  const metaTitle = page.meta_title || page.title || client.name
  const metaDescription = page.meta_description || page.excerpt || client.meta_defaults?.default_description || ''
  const ogImage = page.og_image || page.featured_image || client.meta_defaults?.default_og_image || ''
  const canonicalUrl = page.canonical_url || `${nav.canonicalBase}${pagePath(page)}`

  const headerComponent = components.find(c => c.component_type === 'header')
  const footerComponent = components.find(c => c.component_type === 'footer')

  const combinedCSS = [
    client.global_css,
    headerComponent?.css_content,
    footerComponent?.css_content,
    page.css_content
  ].filter(Boolean).join('\n\n')

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
      {page.use_client_header && headerComponent && <div dangerouslySetInnerHTML={{ __html: headerComponent.html_content }} />}
      <div dangerouslySetInnerHTML={{ __html: page.html_content }} />
      {page.use_client_footer && footerComponent && <div dangerouslySetInnerHTML={{ __html: footerComponent.html_content }} />}
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

export async function loadSitePageProps({ client, slugSegments, isPreview, nav, req, res }) {
  const clientSlug = client.slug
  const slug = slugSegments || []

  let page = null

  if (slug.length === 0) {
    // Site root — redirect to the home page's own slug URL (parity across surfaces)
    const homePage = await getClientHomePage(clientSlug, isPreview)
    if (!homePage) {
      return siteNotFound(res)
    }
    const destination = `${nav.basePath}/${homePage.slug}${isPreview ? '?preview=true' : ''}`
    return { redirect: { destination, permanent: false } }
  } else if (slug.length === 1) {
    page = await getClientPage(clientSlug, slug[0], isPreview)
  } else if (slug.length === 2) {
    const [category, pageSlug] = slug
    page = await getClientPageByCategory(clientSlug, category, pageSlug, isPreview)
  } else {
    return siteNotFound(res)
  }

  if (!page) {
    return siteNotFound(res)
  }

  const components = await getClientComponents(clientSlug, null, isPreview)

  let relatedPages = []
  let isList = false
  if (page.page_type === 'listing' && page.category) {
    isList = true
    relatedPages = await getClientPages(clientSlug, false, page.category)
    relatedPages = relatedPages.filter(p => p.id !== page.id && p.page_type !== 'listing')
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
      page: stripDraftFields(page),
      relatedPages: relatedPages.map(stripDraftFields),
      components: components.map(stripDraftFields),
      isPreview,
      isList,
      nav,
    }
  }
}

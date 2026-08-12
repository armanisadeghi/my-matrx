import { getClientPages } from '@/lib/supabase/clientHelpers'
import {
  ROBOTS_PATH,
  SITEMAP_PATH,
  originFromHeaders,
  originOf,
  renderRobotsTxt,
  renderSitemapXml,
  sitemapEntries,
} from '@/lib/render/sitemap'

// ---------------------------------------------------------------------------
// The serving half of the discovery surface (the pure half is sitemap.js).
// ONE implementation behind four thin routes, exactly like the renderer:
//   pages/c/[client]/sitemap.xml.js   /  robots.txt.js   → basePath `/c/{slug}`
//   pages/_sites/[host]/sitemap.xml.js / robots.txt.js   → basePath ``
// Both take the same `nav` object `buildNav` hands the renderer, so the URLs in
// the sitemap are byte-identical to the `<link rel=canonical>` of the pages
// they point at.
//
// These are getServerSideProps handlers that write the response themselves —
// the page component never renders. Returning `{ props: {} }` after `res.end()`
// is the Pages Router idiom for "I served this myself".
// ---------------------------------------------------------------------------

// Publishing must show up quickly, but a crawler hammering the sitemap must not
// hammer Supabase. Five minutes at the edge, stale-while-revalidate for an hour.
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'

function sendText(res, { status = 200, contentType, body }) {
  res.statusCode = status
  res.setHeader('Content-Type', contentType)
  res.setHeader('Cache-Control', status === 200 ? CACHE_CONTROL : 'no-store')
  res.end(body)
  return { props: {} }
}

/** 404 in the file's own content type — never an HTML error page. */
export function discoveryNotFound(res, contentType = 'text/plain; charset=utf-8') {
  return sendText(res, { status: 404, contentType, body: 'Not found\n' })
}

/**
 * `GET {basePath}/sitemap.xml` for one client site.
 *
 * `getClientPages(slug)` returns PUBLISHED rows only (its `includeUnpublished`
 * default) — the draft gate is the helper's, not a filter bolted on here — and
 * `sitemapEntries` applies the rest of THE ONE RULE (see sitemap.js).
 */
export async function serveSitemapXml({ client, nav, res }) {
  const pages = await getClientPages(client.slug)
  const xml = renderSitemapXml(sitemapEntries({ pages, canonicalBase: nav.canonicalBase }))
  return sendText(res, { contentType: 'application/xml; charset=utf-8', body: xml })
}

/**
 * `GET {basePath}/robots.txt` for one client site.
 *
 * The `Sitemap:` line is built from the origin THIS REQUEST arrived on, so a
 * custom domain advertises its own sitemap and never the platform host's (a
 * cross-host Sitemap line is ignored by every crawler). The site's canonical
 * origin is the fallback when the Host header is unusable.
 */
export async function serveRobotsTxt({ client, nav, req, res }) {
  const origin = originFromHeaders(req?.headers) || originOf(nav.canonicalBase)
  return sendText(res, {
    contentType: 'text/plain; charset=utf-8',
    body: renderRobotsTxt({
      sitemapUrl: `${origin}${nav.basePath}${SITEMAP_PATH}`,
      siteName: client.name,
    }),
  })
}

export { ROBOTS_PATH, SITEMAP_PATH }

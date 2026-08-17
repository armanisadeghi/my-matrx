// ---------------------------------------------------------------------------
// THE DISCOVERY SURFACE — sitemap.xml / robots.txt for a client site.
//
// Pure string math, import-free apart from `pagePath` (itself import-free), so
// `pnpm test:render` can pin it the way it pins themeCss / siteNav / cascade /
// redirects. The DB-touching half lives in lib/render/discovery.js and the four
// thin routes (`pages/c/[client]/…`, `pages/_sites/[host]/…`).
//
// THE ONE RULE: **the sitemap lists exactly the URLs the renderer answers 200
// with, in their canonical form — nothing else.** Three consequences, each of
// which is a test below:
//
//  1. PUBLISHED ONLY. `is_published` false is a draft: it 404s for every
//     anonymous visitor, so listing it would be submitting a dead URL. Preview
//     (`?preview=true`) never appears either — it is noindex by construction.
//
//  2. A REDIRECTED URL CAN NEVER APPEAR — for free, not by filtering. The
//     renderer resolves page-first / ledger-second / 404-last (THE 301 LAW,
//     lib/render/redirects.js), so a route only reaches the `client_redirects`
//     ledger when NO page resolves it. Every entry here is derived from a
//     published page's own canonical route, which by that ordering is served
//     200 — even if a stale ledger row still names it as a `from_route`.
//     Subtracting the ledger from this list would therefore be WRONG: it would
//     drop a live page that had merely reoccupied an old URL. The two other
//     forms the renderer also answers — the legacy `/{slug}` and
//     `/{category}/{slug}` aliases, and the site root `/`, which 302s to the
//     home page's canonical route — are deliberately absent for the same
//     reason: a sitemap carries canonicals, not every address that resolves.
//
//  3. A PAGE THAT DECLARES A DIFFERENT CANONICAL IS NOT LISTED. The renderer
//     emits `page.canonical_url` verbatim as `<link rel=canonical>` when it is
//     set; a sitemap entry for a URL that disowns itself is a contradiction, and
//     an off-site canonical would put another host's URL in our sitemap.
//
// `plan_excluded_at` (CMS 0027) is also skipped: the bridge's `retire` action
// marks a page as deliberately not part of the content plan. It keeps serving —
// the mark is not a delete — but we do not ask search engines to go get it.
//
// `canonicalBase` comes from `buildNav` and is the SAME value the renderer puts
// in `<link rel=canonical>`: `https://{domain}` for a domain-mapped site on
// EVERY surface, else `https://mymatrx.com/c/{slug}`. So the platform-route
// sitemap of a domain-mapped site lists that site's domain URLs — the same
// cross-domain consolidation the page canonicals already do.
// ---------------------------------------------------------------------------

import { pagePath } from './pagePath.js'

export const SITEMAP_PATH = '/sitemap.xml'
export const ROBOTS_PATH = '/robots.txt'

/** Stable public IndexNow verification key derived from the paired web.site. */
export function indexNowKeyForWebSiteId(webSiteId) {
  const key = String(webSiteId || '').toLowerCase().replace(/[^0-9a-f]/g, '')
  return key.length >= 8 && key.length <= 128 ? key : null
}

/** True only for the exact root-level `{key}.txt` verification request. */
export function isIndexNowKeyRequest(slugSegments, webSiteId) {
  const key = indexNowKeyForWebSiteId(webSiteId)
  return Boolean(
    key &&
    Array.isArray(slugSegments) &&
    slugSegments.length === 1 &&
    slugSegments[0] === `${key}.txt`
  )
}

/** XML text/attribute escaping — nothing from the DB is interpolated raw. */
export function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * `<lastmod>` value, or null when there is nothing truthful to say.
 * W3C Datetime (full ISO 8601 with an offset) is a legal sitemap lastmod.
 */
export function toLastmod(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/** The scheme+host of an absolute URL, without its path ('' when unusable). */
export function originOf(url) {
  const match = /^(https?:\/\/[^/]+)/i.exec(String(url || ''))
  return match ? match[1] : ''
}

/**
 * The origin this REQUEST arrived on — what robots.txt must advertise, so a
 * custom domain points at its own sitemap and never at the platform host.
 * Vercel sets `x-forwarded-proto`/`x-forwarded-host`; dev sets neither.
 * Returns null when the host header is missing or doesn't look like a host
 * (callers fall back to the site's canonical origin rather than trusting it).
 */
export function originFromHeaders(headers) {
  const first = (value) => (Array.isArray(value) ? value[0] : value)
  const host = String(first(headers?.['x-forwarded-host']) || first(headers?.host) || '').trim()
  // hostname[:port] only — a Host header is attacker-controlled and this value
  // is echoed into a served file.
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null
  const proto = String(first(headers?.['x-forwarded-proto']) || '').split(',')[0].trim()
  const scheme = proto === 'http' || proto === 'https'
    ? proto
    : (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${scheme}://${host}`
}

/** True when this page row belongs in a public sitemap. See THE ONE RULE. */
export function isSitemapEligible(page) {
  if (!page) return false
  if (page.is_published !== true) return false
  if (page.plan_excluded_at) return false
  return Boolean(pagePath(page))
}

/**
 * Published pages → `{ loc, lastmod }` entries, deduped and ordered by URL.
 *
 * `lastmod` prefers `last_published_at` (set on every publish since CMS 0004)
 * and falls back to `updated_at` for the rows published before that write
 * existed — a real change date beats no date at all, and both are the truth
 * about when the served row last changed.
 */
export function sitemapEntries({ pages, canonicalBase }) {
  const base = String(canonicalBase || '').replace(/\/+$/, '')
  const byLoc = new Map()

  for (const page of pages || []) {
    if (!isSitemapEligible(page)) continue
    const loc = `${base}${pagePath(page)}`

    // Rule 3: a page that names a different canonical is not listed here.
    const declared = typeof page.canonical_url === 'string' ? page.canonical_url.trim() : ''
    if (declared) {
      const resolved = declared.startsWith('/') ? `${base}${declared}` : declared
      if (resolved !== loc) continue
    }

    if (byLoc.has(loc)) continue
    byLoc.set(loc, { loc, lastmod: toLastmod(page.last_published_at || page.updated_at) })
  }

  return [...byLoc.values()].sort((a, b) => (a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0))
}

/** A sitemaps.org 0.9 urlset. An empty list is still a valid document. */
export function renderSitemapXml(entries) {
  const urls = (entries || []).map(({ loc, lastmod }) => {
    const lastmodLine = lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmodLine}\n  </url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

/**
 * robots.txt for one site. Deliberately minimal: allow everything, and point
 * at THIS host's sitemap. Nothing on a client site is hidden by robots — the
 * two things that must not be indexed (preview, not-found) say so themselves
 * with `<meta name="robots" content="noindex">` and a real 404 status, which
 * is stronger than a Disallow (a disallowed URL can still be indexed).
 *
 * `siteName` only rides in a comment; it is stripped of newlines so a site name
 * can never inject a directive.
 */
export function renderRobotsTxt({ sitemapUrl, siteName }) {
  const name = String(siteName || '').replace(/[\r\n]+/g, ' ').trim()
  return [
    `# ${name ? `${name} — ` : ''}served by the Matrx CMS (my-matrx lib/render/sitemap.js)`,
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n')
}

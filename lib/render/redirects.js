// THE 301 LAW — pure destination math for the per-site redirect ledger.
// Import-free on purpose (like pagePath.js / pageSelection.js) so
// scripts/test-render-layers.mjs can pin it. The ledger itself lives in the
// CMS project (`client_redirects`, migrations 0032-0034): rows are written
// automatically when a PUBLISHED page's route changes and are CHAIN-COLLAPSED
// on write (A→B then B→C stores A→C), so serving is ONE lookup — never walk
// a chain here. Manual deletion is the only removal.

/**
 * The ledger key for an incoming request: '/'-joined path segments.
 * Empty/blank segments are dropped; no segments → null (the site root is
 * handled by the home-page 302, never by the ledger).
 */
export function redirectFromRoute(slugSegments) {
  const segments = (slugSegments || []).filter((s) => typeof s === 'string' && s.length > 0)
  if (segments.length === 0) return null
  return `/${segments.join('/')}`
}

/**
 * Build the 301 destination for a ledger hit, or null when the row must not
 * be served (malformed target, self-target). `basePath` is '' on a custom
 * domain and `/c/{slug}` on the platform host; preview requests carry their
 * preview query through so the gate doesn't re-challenge.
 */
export function redirectDestination({ toRoute, fromRoute, basePath = '', isPreview = false, previewPt } = {}) {
  if (!toRoute || typeof toRoute !== 'string' || !toRoute.startsWith('/')) return null
  if (toRoute === fromRoute) return null
  const previewQs = isPreview
    ? `?preview=true${previewPt ? `&pt=${encodeURIComponent(previewPt)}` : ''}`
    : ''
  return `${basePath}${toRoute}${previewQs}`
}

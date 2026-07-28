// Pure routing helpers for client-site pages. No JSX, no imports — so the
// render-layer test harness (`pnpm test:render`) can pin them directly, the way
// it pins themeCss / siteNav / siteFooter / cascade.
//
// THE ONE RULE: a page's public path is `client_pages.route` (CMS migration
// 0028). A trigger derives it from the page's parent chain, it is UNIQUE per
// site, and it is exactly what `loadSitePageProps` matches — so a link built
// here always addresses the page it means, at any depth. The renderer used to
// resolve by path LENGTH and 404 anything past two segments; that ceiling made
// 428 real planned URLs unbuildable across two client sites.
//
// Server-side twin: aidream `aidream/services/cms/urls.py`
// (`client_page_route`), itself a mirror of the DB's
// `public._client_page_route_of`. Change one, change all three.

/**
 * A page's public path, base-path relative.
 *
 * The `category`/`slug` expression is the pre-route fallback for a row that
 * somehow reaches the renderer without a route (the column is NOT NULL, so this
 * should be unreachable).
 */
export function pagePath(page) {
  if (page?.route) return page.route
  return `/${page.category ? page.category + '/' : ''}${page.slug}`
}

/**
 * True when `category` names a real grouping rather than "the author named
 * none". 'general' is the DB column default, and the route trigger, aidream's
 * URL builder and the plan↔CMS bridge all treat it as the ABSENCE of a
 * category — so nothing may filter or build a path segment from it.
 */
export function isRealCategory(category) {
  const value = typeof category === 'string' ? category.trim() : ''
  return value !== '' && value.toLowerCase() !== 'general'
}

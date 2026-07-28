// Pure page-selection helpers for client-site lookups. No JSX, no imports — so
// the render-layer test harness (`pnpm test:render`) can pin them directly, the
// way it pins pagePath / themeCss / siteNav / siteFooter / cascade.
//
// These decide WHICH row a lookup answers with and WHETHER the viewer may see
// it. Every page lookup in lib/supabase/clientHelpers.js funnels through them.

/**
 * Apply the publish/preview gate to a fetched page row.
 *
 * ONE implementation, shared by every page lookup (by route, by slug, by
 * category+slug). Returns null when the page is unpublished and the caller is
 * not previewing; merges the `*_draft` twins over the live columns otherwise.
 */
export function gatePageForViewer(page, preview) {
  if (!page) return null
  if (!page.is_published && !preview) return null
  if (preview && page.has_draft) {
    return {
      ...page,
      html_content: page.html_content_draft || page.html_content,
      css_content: page.css_content_draft || page.css_content,
      js_content: page.js_content_draft || page.js_content,
      meta_title: page.meta_title_draft || page.meta_title,
      meta_description: page.meta_description_draft || page.meta_description,
      meta_keywords: page.meta_keywords_draft || page.meta_keywords,
      og_image: page.og_image_draft || page.og_image,
      canonical_url: page.canonical_url_draft || page.canonical_url,
      _isPreview: true
    }
  }
  return page
}

/**
 * Pick the ONE page a legacy alias means, out of several rows sharing a slug.
 *
 * Slug stopped being unique per site when CMS migration 0028 swapped the
 * constraint to `(client_id, route)`, so `/pricing` can now match a top-level
 * page AND `/locations/austin/pricing` AND `/locations/dallas/pricing`. The
 * alias means the SHALLOWEST one — that is the page the 1-/2-segment URL
 * addressed before routes existed, and the whole point of the fallback is that
 * no pre-existing URL changes where it lands. Ties break on route, then on
 * created_at, so the answer never depends on row order.
 *
 * A multi-match is worth saying out loud: it means a live legacy URL is now
 * ambiguous, and whoever owns that site should give the deep page a distinct
 * slug or accept that the alias points at the shallow one forever.
 */
export function pickShallowestRoute(rows, label, warn = console.warn) {
  if (!rows || rows.length === 0) return null
  if (rows.length === 1) return rows[0]
  const depth = (row) => (row.route || '').split('/').filter(Boolean).length
  const sorted = [...rows].sort(
    (a, b) =>
      depth(a) - depth(b) ||
      (a.route || '').localeCompare(b.route || '') ||
      String(a.created_at || '').localeCompare(String(b.created_at || ''))
  )
  warn(
    `[cms] legacy alias ${label} matches ${rows.length} pages ` +
      `(${rows.map((r) => r.route).join(', ')}); serving ${sorted[0].route}. ` +
      'Slug is no longer unique per site — the alias resolves to the shallowest route.'
  )
  return sorted[0]
}

/**
 * Resolve a legacy slug alias to the one page it serves.
 *
 * ── THE ORDER IS LOAD-BEARING: GATE FIRST, THEN PICK. ──────────────────────
 * A visitor-invisible page must not be allowed to win the alias and then be
 * gated away, because the alias has only one answer: whatever `pickShallowest`
 * returns is the ONLY row considered, so gating afterwards turns "an unpublished
 * page happens to share this slug" into a 404 for the live page it shadowed.
 *
 * This is not hypothetical. iopbm's home page is `slug='home', category='root'`
 * (route `/root/home`) and answers `/home` only through this alias. A DRAFT page
 * with `slug='home'` and the default `category='general'` gets route `/home` —
 * depth 1, shallower — so picking first made an unsaved draft 404 a real
 * client's homepage AND its site root. Migration 0028 dropped
 * `UNIQUE (client_id, slug)`, so any page can claim any other page's alias, and
 * our own tooling reaches it: `client_pages.category` defaults to 'general' and
 * the plan→CMS bridge writes that same value, so realizing any plan node named
 * "Home" onto a site does it.
 *
 * `preview` keeps drafts in the running deliberately — that is the whole point
 * of preview, and a previewer asking for a shadowed slug should see the draft.
 *
 * @param {Array<Object>|null} rows - Every row matching the alias
 * @param {boolean} preview - Whether the viewer is previewing drafts
 * @param {string} label - Human label for the alias, used in the warning
 * @returns {Object|null} The page to serve, or null
 */
export function selectAliasPage(rows, preview, label, warn = console.warn) {
  const visible = preview ? rows : (rows || []).filter((row) => row && row.is_published)
  return gatePageForViewer(pickShallowestRoute(visible, label, warn), preview)
}

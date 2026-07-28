import { createClient } from '@supabase/supabase-js'
// Row selection + the publish/preview gate live in their own pure module (no
// imports) so `pnpm test:render` can pin them the way it pins pagePath /
// themeCss / siteNav / cascade. `selectAliasPage` carries the load-bearing
// gate-then-pick order; read its doc before touching any alias lookup.
import { gatePageForViewer, selectAliasPage } from '@/lib/render/pageSelection'

// Create Supabase client (use service role for server-side operations)
export function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  )
}

// ---------------------------------------------------------------------------
// Public-output sanitizers
//
// `getClientSite()` fetches the FULL `client_sites` row with the service-role
// key (needed server-side: helpers use `id`, draft merging needs everything).
// But anything returned to a browser — page props (serialized into public
// `__NEXT_DATA__`) or public JSON APIs — must pass through one of these
// whitelists. NEVER ship the raw row: `settings` carries per-site operational
// config (`agent_write_policy` today, potentially keys/secrets tomorrow), and
// `id` / `owner_user_id` / timestamps are internal.
// ---------------------------------------------------------------------------

function pick(obj, fields) {
  const out = {}
  for (const field of fields) {
    // Next.js props cannot serialize `undefined`; normalize to null.
    out[field] = obj[field] === undefined ? null : obj[field]
  }
  return out
}

/**
 * Client fields the site renderer actually reads (verified against the JSX in
 * lib/render/clientSiteRenderer.js): slug (link hrefs + canonical URL), name
 * (title fallbacks), domain (canonical base for domain-mapped sites — public,
 * it IS the serving hostname), global_css (injected <style>), favicon
 * (<link rel=icon>), meta_defaults (description/og-image fallbacks).
 *
 * data_api_key is DELIBERATELY absent: it ships in page HTML via the
 * _document.js script injection (req.__matrxSiteInject — see
 * lib/render/clientSiteRenderer.js), never through props/__NEXT_DATA__.
 * Do not add it here.
 */
export function toRenderClientProps(client) {
  return pick(client, ['slug', 'name', 'domain', 'global_css', 'favicon', 'meta_defaults'])
}

/**
 * Public site-config shape for anonymous JSON APIs (GET /api/clients/[slug]).
 * Superset of the render fields plus public branding/navigation config.
 * Excludes: settings, owner_user_id, id, created_at, updated_at, version.
 */
export function toPublicClientSite(client) {
  return pick(client, [
    'slug', 'name', 'domain', 'is_active',
    'global_css', 'favicon',
    'theme_config', 'navigation', 'footer_config',
    'meta_defaults', 'contact_info', 'social_links'
  ])
}

/**
 * Sanitize a page/component row before it reaches the browser. Strips:
 * - `*_draft` content — preview mode merges drafts into the live fields
 *   server-side (see getClientPage/getClientComponents), so these keys are
 *   never read by the renderer; left in place they serialize unpublished
 *   content into public `__NEXT_DATA__`.
 * - Internal linkage/provenance: `client_id` (equals the client_sites.id we
 *   deliberately hide), `last_published_by` (a user UUID, same class as
 *   owner_user_id), and `source_*` (internal authoring provenance).
 * Keeps `has_draft` / `_isPreview` flags (used by the preview banner).
 */
const INTERNAL_ROW_FIELDS = new Set(['client_id', 'last_published_by'])

export function stripDraftFields(row) {
  if (!row) return row
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    if (key.endsWith('_draft')) continue
    if (key.startsWith('source_') || INTERNAL_ROW_FIELDS.has(key)) continue
    out[key] = value === undefined ? null : value
  }
  return out
}

/**
 * Get client site by slug
 * @param {string} slug - Client slug (e.g., 'iopbm')
 * @returns {Promise<Object|null>} Client site data or null
 */
export async function getClientSite(slug) {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('client_sites')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  
  if (error) {
    console.error('Error fetching client site:', error)
    return null
  }
  
  return data
}

/**
 * Get client site by custom domain (W2-E domain routing).
 * `host` must already be normalized (lowercase, no port — lib/domains.js);
 * the DB guarantees `domain` is stored normalized and unique (CMS migration 0013).
 * @param {string} host - Normalized hostname (e.g. 'www.clientsite.com')
 * @returns {Promise<Object|null>} Client site row or null
 */
export async function getClientSiteByDomain(host) {
  if (!host) return null
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('client_sites')
    .select('*')
    .eq('domain', host)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error fetching client site by domain:', error)
    return null
  }

  return data
}

/**
 * Get a client page by its FULL public route — the canonical lookup.
 *
 * `client_pages.route` is trigger-computed from the page's parent chain
 * (CMS migration 0028) and carries a UNIQUE (client_id, route) constraint, so
 * this resolves a path of ANY depth in one query and can never be ambiguous.
 * It replaced the old length-branching resolution (1 segment → slug,
 * 2 segments → category+slug, deeper → 404) that capped every client site at
 * two URL segments.
 *
 * @param {string} clientSlug - Client slug
 * @param {string} route - Full path with a leading slash, e.g. '/services/austin/pricing'
 * @param {boolean} preview - Whether to merge draft content
 * @returns {Promise<Object|null>} Page data or null
 */
export async function getClientPageByRoute(clientSlug, route, preview = false) {
  if (!route) return null
  const supabase = getSupabaseClient()

  const client = await getClientSite(clientSlug)
  if (!client) return null

  const { data: page, error } = await supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
    .eq('route', route)
    .maybeSingle()

  if (error) {
    console.error('Error fetching page by route:', error)
    return null
  }

  return gatePageForViewer(page, preview)
}

/**
 * Get client page by client slug and page slug.
 *
 * LEGACY ALIAS LOOKUP — kept deliberately. Before routes existed, every page
 * was reachable at the bare `/{slug}` form regardless of its category, and those
 * URLs are live on real client sites. `getClientPageByRoute` is tried first;
 * this is the compatibility fallback so no pre-existing URL ever starts 404ing.
 *
 * Slug is NO LONGER unique per site (CMS 0028 swapped the constraint to
 * (client_id, route)), so this orders deterministically and takes the first
 * match instead of `.single()`, which would 500 on a legitimate duplicate.
 *
 * @param {string} clientSlug - Client slug
 * @param {string} pageSlug - Page slug
 * @param {boolean} preview - Whether to get draft content
 * @returns {Promise<Object|null>} Page data or null
 */
export async function getClientPage(clientSlug, pageSlug, preview = false) {
  const supabase = getSupabaseClient()

  // First get the client
  const client = await getClientSite(clientSlug)
  if (!client) return null

  // No `.single()`: a duplicated slug is legal now, and `.single()` would turn
  // it into an error — i.e. a 404 on a URL that worked yesterday.
  const { data: pages, error } = await supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
    .eq('slug', pageSlug)

  if (error) {
    console.error('Error fetching page:', error)
    return null
  }

  // Gate BEFORE picking (see selectAliasPage): an unpublished page that shares
  // this slug must never win the alias and then be gated away — that 404s the
  // live page it shadowed.
  return selectAliasPage(pages, preview, `/${pageSlug}`)
}

/**
 * Get all pages for a client
 * @param {string} clientSlug - Client slug
 * @param {boolean} includeUnpublished - Include unpublished pages
 * @param {string} category - Optional: filter by category
 * @returns {Promise<Array>} Array of pages
 */
/**
 * Get the direct children of a page — the depth-aware sibling of the
 * category-based `getClientPages(..., category)`.
 *
 * A listing page used to gather its cards by matching `category`, which only
 * works while every page lives at most two segments deep. With real hierarchy,
 * "the things under this page" is a `parent_id` relationship, so a listing at
 * ANY depth lists its own children. Category-based listings still work — the
 * renderer unions both (see loadSitePageProps).
 *
 * @param {string} clientSlug - Client slug
 * @param {string} parentId - The parent page's UUID
 * @param {boolean} includeUnpublished - Include unpublished children
 * @returns {Promise<Array>} Array of child pages, sort_order ascending
 */
export async function getChildPages(clientSlug, parentId, includeUnpublished = false) {
  if (!parentId) return []
  const supabase = getSupabaseClient()

  const client = await getClientSite(clientSlug)
  if (!client) return []

  let query = supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
    .eq('parent_id', parentId)

  if (!includeUnpublished) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query.order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching child pages:', error)
    return []
  }

  return data || []
}

export async function getClientPages(clientSlug, includeUnpublished = false, category = null) {
  const supabase = getSupabaseClient()
  
  const client = await getClientSite(clientSlug)
  if (!client) return []
  
  let query = supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
  
  if (category) {
    query = query.eq('category', category)
  }
  
  if (!includeUnpublished) {
    query = query.eq('is_published', true)
  }
  
  query = query.order('sort_order', { ascending: true })
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching pages:', error)
    return []
  }
  
  return data || []
}

/**
 * Get active components for a client
 * @param {string} clientSlug - Client slug
 * @param {string} componentType - Optional: filter by type (e.g., 'header', 'footer')
 * @param {boolean} preview - Whether to get draft content
 * @returns {Promise<Array>} Array of components
 */
export async function getClientComponents(clientSlug, componentType = null, preview = false) {
  const supabase = getSupabaseClient()
  
  const client = await getClientSite(clientSlug)
  if (!client) return []
  
  let query = supabase
    .from('client_components')
    .select('*')
    .eq('client_id', client.id)
    .eq('is_active', true)
  
  if (componentType) {
    query = query.eq('component_type', componentType)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching components:', error)
    return []
  }
  
  // If in preview mode, use draft content if available
  if (preview) {
    return (data || []).map(component => ({
      ...component,
      html_content: component.html_content_draft || component.html_content,
      css_content: component.css_content_draft || component.css_content,
      _isPreview: component.has_draft
    }))
  }
  
  return data || []
}

/**
 * Get home page for a client.
 *
 * `is_home_page` NAMES A ROW, so once that row is found it is the answer — the
 * lookup must not be laundered back through the `slug` alias. It used to be
 * (`getClientPage(clientSlug, homePage.slug)`), and since CMS 0028 dropped
 * `UNIQUE (client_id, slug)` any other page could claim that slug at a
 * shallower route and win the alias. iopbm's home is `slug='home',
 * category='root'` (route `/root/home`), so a page with the DEFAULT
 * `category='general'` and `slug='home'` (route `/home`) took over the site
 * root when published, and 404'd it while still a draft.
 *
 * No `.single()`: nothing constrains `is_home_page` to one row per site, and
 * `.single()` turns a second one into an error that silently drops through to
 * the slug fallback. Order + limit makes the answer deterministic instead.
 *
 * @param {string} clientSlug - Client slug
 * @param {boolean} preview - Whether to get draft content
 * @returns {Promise<Object|null>} Home page data or null
 */
export async function getClientHomePage(clientSlug, preview = false) {
  const supabase = getSupabaseClient()

  const client = await getClientSite(clientSlug)
  if (!client) return null

  // Try to find page marked as home page
  const { data: homePage, error } = await supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
    .eq('is_home_page', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching home page:', error)
  }
  if (homePage) {
    return gatePageForViewer(homePage, preview)
  }

  // Fallback: no row claims the home flag, so fall back to the conventional
  // slugs. This DOES go through the alias (and its shallowest-route rule),
  // because with nothing marking a home page there is no better answer.
  for (const slug of ['home', 'index']) {
    const page = await getClientPage(clientSlug, slug, preview)
    if (page) return page
  }
  
  return null
}

/**
 * Update page draft content
 * @param {string} pageId - Page UUID
 * @param {Object} updates - Fields to update (e.g., { html_content_draft: '...' })
 * @returns {Promise<boolean>} Success status
 */
export async function updatePageDraft(pageId, updates) {
  const supabase = getSupabaseClient()
  
  const { error } = await supabase
    .from('client_pages')
    .update({
      ...updates,
      has_draft: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', pageId)
  
  if (error) {
    console.error('Error updating page draft:', error)
    return false
  }
  
  return true
}

/**
 * Publish page draft (promote draft to published)
 * @param {string} pageId - Page UUID
 * @param {string} userId - User ID who is publishing (optional)
 * @returns {Promise<boolean>} Success status
 */
export async function publishPageDraft(pageId, userId = null) {
  const supabase = getSupabaseClient()
  
  const { error } = await supabase.rpc('publish_page_draft', {
    page_uuid: pageId,
    publisher_id: userId
  })
  
  if (error) {
    console.error('Error publishing page draft:', error)
    return false
  }
  
  return true
}

/**
 * Discard page draft
 * @param {string} pageId - Page UUID
 * @returns {Promise<boolean>} Success status
 */
export async function discardPageDraft(pageId) {
  const supabase = getSupabaseClient()
  
  const { error } = await supabase.rpc('discard_page_draft', {
    page_uuid: pageId
  })
  
  if (error) {
    console.error('Error discarding page draft:', error)
    return false
  }
  
  return true
}

/**
 * Get client page by category and slug
 * @param {string} clientSlug - Client slug
 * @param {string} category - Page category
 * @param {string} pageSlug - Page slug
 * @param {boolean} preview - Whether to get draft content
 * @returns {Promise<Object|null>} Page data or null
 */
export async function getClientPageByCategory(clientSlug, category, pageSlug, preview = false) {
  const supabase = getSupabaseClient()
  
  // First get the client
  const client = await getClientSite(clientSlug)
  if (!client) return null
  
  // Get the pages with the category filter. No `.single()`: `category` defaults
  // to 'general' for every uncategorized page, so a slug repeated deeper in the
  // tree lands in the same category bucket and `.single()` would error — 404ing
  // a two-segment URL that worked before routes existed. This is exactly how
  // /c/dev-website/general/pricing broke during the 0028 rollout.
  const { data: pages, error } = await supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
    .eq('category', category)
    .eq('slug', pageSlug)

  if (error) {
    console.error('Error fetching page by category:', error)
    return null
  }

  // Gate BEFORE picking — same rule as the bare-slug alias (see selectAliasPage).
  return selectAliasPage(pages, preview, `/${category}/${pageSlug}`)
}

// Page version history + rollback used to live here (`client_page_versions` /
// `rollback_to_version`). Both were retired in CMS migration 0004 — versioning is
// now the canonical `history.row_versions` log, reached through the
// `version_list` / `version_get` / `version_restore` RPCs, which are locked to
// `service_role` and therefore NOT callable from this anon-key renderer. The
// version UI lives in matrx-frontend (`/cms/[siteId]/pages/[pageId]` → History).
// These helpers had no callers here.


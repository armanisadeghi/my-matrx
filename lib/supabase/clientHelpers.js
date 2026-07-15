import { createClient } from '@supabase/supabase-js'

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
 * Get client page by client slug and page slug
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
  
  // Get the page
  const { data: page, error } = await supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
    .eq('slug', pageSlug)
    .single()
  
  if (error) {
    console.error('Error fetching page:', error)
    return null
  }
  
  // If not published and not in preview mode, return null
  if (!page.is_published && !preview) {
    return null
  }
  
  // If in preview mode and draft exists, use draft content
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
 * Get all pages for a client
 * @param {string} clientSlug - Client slug
 * @param {boolean} includeUnpublished - Include unpublished pages
 * @param {string} category - Optional: filter by category
 * @returns {Promise<Array>} Array of pages
 */
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
 * Get home page for a client
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
    .single()
  
  if (!error && homePage) {
    return getClientPage(clientSlug, homePage.slug, preview)
  }
  
  // Fallback: look for 'home' or 'index' slug
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
  
  // Get the page with category filter
  const { data: page, error } = await supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', client.id)
    .eq('category', category)
    .eq('slug', pageSlug)
    .single()
  
  if (error) {
    console.error('Error fetching page by category:', error)
    return null
  }
  
  // If not published and not in preview mode, return null
  if (!page.is_published && !preview) {
    return null
  }
  
  // If in preview mode and draft exists, use draft content
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

// Page version history + rollback used to live here (`client_page_versions` /
// `rollback_to_version`). Both were retired in CMS migration 0004 — versioning is
// now the canonical `history.row_versions` log, reached through the
// `version_list` / `version_get` / `version_restore` RPCs, which are locked to
// `service_role` and therefore NOT callable from this anon-key renderer. The
// version UI lives in matrx-frontend (`/cms/[siteId]/pages/[pageId]` → History).
// These helpers had no callers here.


import { createClient } from '@supabase/supabase-js'

// Create Supabase client (use service role for server-side operations)
export function getSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  )
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

/**
 * Get page version history
 * @param {string} pageId - Page UUID
 * @returns {Promise<Array>} Array of versions
 */
export async function getPageVersions(pageId) {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('client_page_versions')
    .select('*')
    .eq('page_id', pageId)
    .order('version_number', { ascending: false })
  
  if (error) {
    console.error('Error fetching page versions:', error)
    return []
  }
  
  return data || []
}

/**
 * Rollback to a specific version
 * @param {string} pageId - Page UUID
 * @param {number} versionNumber - Version number to rollback to
 * @returns {Promise<boolean>} Success status
 */
export async function rollbackToVersion(pageId, versionNumber) {
  const supabase = getSupabaseClient()
  
  const { error } = await supabase.rpc('rollback_to_version', {
    page_uuid: pageId,
    version_num: versionNumber
  })
  
  if (error) {
    console.error('Error rolling back to version:', error)
    return false
  }
  
  return true
}


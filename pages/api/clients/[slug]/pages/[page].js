import { getClientPage, updatePageDraft, stripDraftFields } from '@/lib/supabase/clientHelpers'
import { requireIdentity, rateLimit } from '@/lib/apiAuth'

// The columns a draft update may touch. updatePageDraft() spreads whatever it
// is given straight into an RLS-bypassing UPDATE, so an unbounded req.body let
// a caller rewrite `is_published`, `client_id`, `route` — anything on the row.
// Only draft content is writable here; publishing is publish_page_draft's job.
const UPDATABLE_DRAFT_FIELDS = new Set([
  'html_content_draft',
  'css_content_draft',
  'js_content_draft',
  'meta_title_draft',
  'meta_description_draft',
])

function pickDraftUpdates(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  const picked = {}
  for (const [key, value] of Object.entries(body)) {
    if (UPDATABLE_DRAFT_FIELDS.has(key)) picked[key] = value
  }
  return picked
}

// NOTE: proxy.js also 404s PUT on this route (isBlockedClientWrite) because
// matrx-frontend's /api/cms/pages owns page updates. The GET half stays public
// (it is the anonymous page-read surface); only the write half is gated here.

/**
 * GET /api/clients/[slug]/pages/[page]
 * Get a specific page
 * 
 * PUT /api/clients/[slug]/pages/[page]
 * Update page draft content
 */
export default async function handler(req, res) {
  const { slug, page } = req.query
  
  if (!slug || !page) {
    return res.status(400).json({ error: 'Client slug and page slug are required' })
  }

  // GET: Fetch page
  if (req.method === 'GET') {
    try {
      const preview = req.query.preview === 'true'
      const pageData = await getClientPage(slug, page, preview)

      if (!pageData) {
        return res.status(404).json({ error: 'Page not found' })
      }

      // SECURITY: preview mode already merges drafts into the live fields
      // server-side; raw `*_draft` keys must not ship on an anonymous endpoint.
      return res.status(200).json({
        success: true,
        page: stripDraftFields(pageData)
      })

    } catch (error) {
      console.error('API error:', error)
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  // PUT: Update page draft
  if (req.method === 'PUT') {
    if (!rateLimit(req, res, { name: 'client-page-update', limit: 60, windowMs: 60_000 })) return
    if (!(await requireIdentity(req, res))) return

    try {
      const updates = pickDraftUpdates(req.body)
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'No updatable fields',
          allowed: [...UPDATABLE_DRAFT_FIELDS],
        })
      }

      // Get the page first to get its ID
      const pageData = await getClientPage(slug, page)
      if (!pageData) {
        return res.status(404).json({ error: 'Page not found' })
      }

      const success = await updatePageDraft(pageData.id, updates)

      if (!success) {
        return res.status(500).json({ error: 'Failed to update page draft' })
      }

      return res.status(200).json({
        success: true,
        message: 'Page draft updated successfully'
      })

    } catch (error) {
      console.error('API error:', error)
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}


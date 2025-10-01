import { getClientPage, updatePageDraft } from '@/lib/supabase/clientHelpers'

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

      return res.status(200).json({
        success: true,
        page: pageData
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
    try {
      const updates = req.body

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


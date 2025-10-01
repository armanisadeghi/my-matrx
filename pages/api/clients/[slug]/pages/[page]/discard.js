import { getClientPage, discardPageDraft } from '@/lib/supabase/clientHelpers'

/**
 * POST /api/clients/[slug]/pages/[page]/discard
 * Discard page draft changes
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { slug, page } = req.query

    if (!slug || !page) {
      return res.status(400).json({ error: 'Client slug and page slug are required' })
    }

    // Get the page to get its ID
    const pageData = await getClientPage(slug, page)
    if (!pageData) {
      return res.status(404).json({ error: 'Page not found' })
    }

    // Check if there's actually a draft to discard
    if (!pageData.has_draft) {
      return res.status(400).json({ 
        error: 'No draft changes to discard',
        message: 'This page has no unpublished changes'
      })
    }

    const success = await discardPageDraft(pageData.id)

    if (!success) {
      return res.status(500).json({ error: 'Failed to discard page draft' })
    }

    return res.status(200).json({
      success: true,
      message: 'Draft changes discarded successfully',
      pageId: pageData.id
    })

  } catch (error) {
    console.error('API error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}


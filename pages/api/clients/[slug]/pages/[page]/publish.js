import { getClientPage, publishPageDraft } from '@/lib/supabase/clientHelpers'

/**
 * POST /api/clients/[slug]/pages/[page]/publish
 * Publish page draft (promote draft to published)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { slug, page } = req.query
    const { userId } = req.body // Optional: user who is publishing

    if (!slug || !page) {
      return res.status(400).json({ error: 'Client slug and page slug are required' })
    }

    // Get the page to get its ID
    const pageData = await getClientPage(slug, page)
    if (!pageData) {
      return res.status(404).json({ error: 'Page not found' })
    }

    // Check if there's actually a draft to publish
    if (!pageData.has_draft) {
      return res.status(400).json({ 
        error: 'No draft changes to publish',
        message: 'This page has no unpublished changes'
      })
    }

    const success = await publishPageDraft(pageData.id, userId)

    if (!success) {
      return res.status(500).json({ error: 'Failed to publish page draft' })
    }

    return res.status(200).json({
      success: true,
      message: 'Page published successfully',
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


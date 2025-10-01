import { getClientPages } from '@/lib/supabase/clientHelpers'

/**
 * GET /api/clients/[slug]/pages
 * List all pages for a client
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { slug } = req.query
    const includeUnpublished = req.query.include_unpublished === 'true'

    if (!slug) {
      return res.status(400).json({ error: 'Client slug is required' })
    }

    const pages = await getClientPages(slug, includeUnpublished)

    return res.status(200).json({
      success: true,
      pages,
      count: pages.length
    })

  } catch (error) {
    console.error('API error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}


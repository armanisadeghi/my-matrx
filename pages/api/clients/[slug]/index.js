import { getClientSite, toPublicClientSite } from '@/lib/supabase/clientHelpers'

/**
 * GET /api/clients/[slug]
 * Get client site configuration
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { slug } = req.query

    if (!slug) {
      return res.status(400).json({ error: 'Client slug is required' })
    }

    const client = await getClientSite(slug)

    if (!client) {
      return res.status(404).json({ error: 'Client not found' })
    }

    // SECURITY: anonymous endpoint — never return the raw row
    // (`settings`, `owner_user_id`, internal ids stay server-side).
    return res.status(200).json({
      success: true,
      client: toPublicClientSite(client)
    })

  } catch (error) {
    console.error('API error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    })
  }
}


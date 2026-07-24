/**
 * GET /api/sites/[site]/collections/[slug]/items/[id] — public single item.
 * Wire contract: DATA_API.md. Same double-opt-in read gate + projection as the
 * list route; uniform 404 for unknown site/collection/item, non-public
 * collections, spam, soft-deleted, and archived rows alike.
 */
import { getSupabaseClient } from '@/lib/supabase/clientHelpers'
import {
  uniform404,
  resolveSite,
  resolveCollection,
  projectPublicItem,
  UUID_RE,
} from '@/lib/collections/routeHelpers'

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ success: false, error: 'method_not_allowed' })
    }

    const { site: siteSlug, slug: collectionSlug, id } = req.query
    if (typeof id !== 'string' || !UUID_RE.test(id)) return uniform404(res)

    const site = await resolveSite(siteSlug)
    if (!site) return uniform404(res)

    const collection = await resolveCollection(site.id, collectionSlug)
    if (!collection || !collection.public_read) return uniform404(res)

    const supabase = getSupabaseClient()
    const { data: row, error } = await supabase
      .from('site_collection_items')
      .select('id, created_at, data')
      .eq('id', id)
      .eq('collection_id', collection.id)
      .eq('is_spam', false)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle()
    if (error) {
      console.error('[collections] item fetch error:', error.message)
      return res.status(500).json({ success: false, error: 'internal_error' })
    }
    if (!row) return uniform404(res)

    return res.status(200).json({
      success: true,
      item: projectPublicItem(row, collection.public_read_fields),
    })
  } catch (error) {
    console.error('[collections] item route error:', error)
    return res.status(500).json({ success: false, error: 'internal_error' })
  }
}

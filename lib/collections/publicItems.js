/**
 * The ONE public read of collection items — shared by the HTTP list route
 * (`pages/api/sites/[site]/collections/[slug]/items/index.js`) and the SSR
 * template binder (`lib/render/collectionBindings.js` callers).
 *
 * Both surfaces show the same rows to the same anonymous audience, so they must
 * apply the same visibility filters and the same order. Two copies of this
 * query is how a spam row eventually appears on a page but not in the API, or
 * how SSR and client-side pagination disagree about what "first" means.
 *
 * Visibility (never widen without reading W2C-design §5.5): not spam, status
 * `active`, not soft-deleted. Projection is the caller's job via
 * `projectPublicItem` + `public_read_fields` — the allowlist is the whole
 * read-side security model.
 */
import { applyOrder } from '@/lib/collections/ordering'

/**
 * @param {Object} supabase service-role client
 * @param {Object} args
 * @param {string} args.collectionId
 * @param {{field: string, ascending: boolean}|null} args.order resolved order
 * @param {number} args.from 0-based range start
 * @param {number} args.to inclusive range end
 * @returns {Promise<{rows: Array|null, error: Object|null}>}
 */
export async function fetchPublicItems(supabase, { collectionId, order, from, to }) {
  const base = supabase
    .from('site_collection_items')
    .select('id, created_at, data')
    .eq('collection_id', collectionId)
    .eq('is_spam', false)
    .eq('status', 'active')
    .is('deleted_at', null)

  const { data, error } = await applyOrder(base, order).range(from, to)
  if (error) return { rows: null, error }
  return { rows: data || [], error: null }
}

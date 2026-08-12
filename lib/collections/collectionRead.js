/**
 * Collection lookup + the public projection — the read-side gate, in a module
 * with NO Node built-ins.
 *
 * These two functions used to live in `routeHelpers.js` beside the request
 * plumbing (`crypto` for the constant-time key compare, `net` for IP parsing).
 * The SSR binder needs them too, and it is reached from
 * `lib/render/clientSiteRenderer.js` — which is part of the PAGE bundle, not
 * just the server. Importing routeHelpers from there dragged `net` into the
 * browser build and failed `next build` outright ("Module not found: Can't
 * resolve 'net'"). Splitting them is what keeps ONE implementation of the
 * allowlist shared by both surfaces: `routeHelpers.js` re-exports these, so
 * every API route keeps importing exactly what it always did.
 *
 * KEEP THIS MODULE FREE OF NODE BUILT-INS. Anything reachable from the
 * renderer must be bundle-safe.
 */
import { getSupabaseClient } from '@/lib/supabase/clientHelpers'

/**
 * Resolve an active, non-deleted collection by (client_id, slug).
 * Callers still check public_write / public_read for their operation.
 */
export async function resolveCollection(clientId, collectionSlug) {
  if (typeof collectionSlug !== 'string' || !collectionSlug) return null
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('site_collections')
    .select(
      'id, client_id, slug, field_schema, validation_mode, public_write, public_read, public_read_fields, allow_upsert, settings'
    )
    .eq('client_id', clientId)
    .eq('slug', collectionSlug)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    console.error('[collections] collection resolve error:', error.message)
    return null
  }
  return data
}

/**
 * Public projection of an item row: ONLY {id, created_at, data} where data
 * carries the `public_read_fields` allowlist. Empty allowlist ⇒ data is {}.
 *
 * This allowlist IS the read-side security model, for the HTTP route and for
 * server-rendered template bindings alike — a field that is not in it can
 * never reach a visitor by either path.
 */
export function projectPublicItem(row, publicReadFields) {
  const fields = Array.isArray(publicReadFields) ? publicReadFields : []
  const data = {}
  if (row.data && typeof row.data === 'object' && !Array.isArray(row.data)) {
    for (const key of fields) {
      if (Object.prototype.hasOwnProperty.call(row.data, key)) {
        data[key] = row.data[key]
      }
    }
  }
  return { id: row.id, created_at: row.created_at, data }
}

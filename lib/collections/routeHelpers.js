/**
 * Shared plumbing for the public collection routes
 * (pages/api/sites/[site]/collections/[slug]/items/*). Wire contract: DATA_API.md.
 *
 * Uniform-404 posture (W2C-design §8-A6): "site doesn't exist", "wrong/missing
 * site key", "collection doesn't exist", "collection not public" all return the
 * IDENTICAL body + status through uniform404() — no enumeration oracle.
 */
import { createHash, timingSafeEqual } from 'crypto'
import { isIP } from 'net'
import { getSupabaseClient } from '@/lib/supabase/clientHelpers'

/** The one uniform 404. Never vary this body between causes. */
export function uniform404(res) {
  return res.status(404).json({ success: false, error: 'not_found' })
}

/**
 * Constant-time string compare (length-independent: compares SHA-256 digests,
 * so mismatched lengths don't short-circuit).
 */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/**
 * Client IP for rate limiting. `x-real-ip` is set by Vercel's edge (trusted
 * proxy) and cannot be attacker-supplied there. Do NOT use the leftmost
 * `x-forwarded-for` entry — it is client-supplied and voids per-IP limits
 * (W2C-design §9 finding 15; the form-submissions.js ancestor gets this wrong).
 * TRUSTED-PROXY ASSUMPTION: this is only sound behind Vercel (or any proxy
 * that overwrites x-real-ip). On a bare `next dev` there is no proxy, so we
 * fall back to the socket address (the direct peer — also unspoofable).
 * Returns null when nothing parseable is available (the DB function then
 * skips the per-IP window; the per-site window still applies).
 */
export function clientIp(req) {
  const headerIp = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'].trim() : ''
  const candidate = headerIp || req.socket?.remoteAddress || ''
  return isIP(candidate) ? candidate : null
}

/**
 * Resolve a site by slug for the public data routes. SELECTS ONLY what the
 * routes need — never `*` (the row carries settings/owner fields that must
 * not wander toward responses).
 * @returns {Promise<{id: string, slug: string, data_api_key: string|null}|null>}
 */
export async function resolveSite(siteSlug) {
  if (typeof siteSlug !== 'string' || !siteSlug) return null
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('client_sites')
    .select('id, slug, data_api_key')
    .eq('slug', siteSlug)
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    console.error('[collections] site resolve error:', error.message)
    return null
  }
  return data
}

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

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Positive-integer setting override with default + optional hard ceiling. */
export function intSetting(settings, key, fallback, ceiling = null) {
  const raw = settings ? settings[key] : undefined
  const value = Number.isInteger(raw) && raw > 0 ? raw : fallback
  return ceiling !== null ? Math.min(value, ceiling) : value
}

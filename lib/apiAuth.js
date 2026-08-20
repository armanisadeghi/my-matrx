/**
 * Handler-level auth + rate limiting for my-matrx's privileged API routes.
 *
 * WHY THIS EXISTS: every route under pages/api/** that writes runs as the
 * Supabase SERVICE ROLE, which bypasses RLS entirely. Until this module,
 * `proxy.js`'s matcher was the ONLY lock on those routes — a single edit to
 * that regex (or a route added outside it) silently exposed unauthenticated,
 * RLS-free writes to the live CMS. proxy.js stays as the outer gate; this is
 * the lock on the door itself. Both must pass.
 *
 * Two accepted identities, never anonymous:
 *   1. An admin browser session — the HMAC cookie minted by /api/auth/session
 *      after aidream's /auth/whoami confirmed `is_admin` (lib/adminSession.js).
 *   2. A server-to-server caller presenting `x-matrx-admin-secret` matching
 *      MYMATRX_ADMIN_API_SECRET (constant-time compare).
 *
 * THE USER-ID LAW (Content Engine ruling, 2026-08-20): the `user_id` written
 * to the database comes from the IDENTITY, never from the request body. A
 * body-supplied `userId`/`user_id` is ignored everywhere — attribution a
 * caller can type is not attribution.
 */
import { createHash, timingSafeEqual } from 'crypto'
import { isIP } from 'net'
import { verifySessionToken, SESSION_COOKIE_NAME } from './adminSession.js'

const ADMIN_SECRET_HEADER = 'x-matrx-admin-secret'

/** Constant-time compare via digests, so unequal lengths don't short-circuit. */
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/**
 * Client IP for rate limiting. Same trusted-proxy reasoning as
 * lib/collections/routeHelpers.js: `x-real-ip` is written by Vercel's edge and
 * is not attacker-supplied there; the leftmost `x-forwarded-for` entry IS
 * client-supplied and would void every per-IP limit. Falls back to the socket
 * peer on a bare `next dev`.
 */
export function clientIp(req) {
  const headerIp = typeof req.headers['x-real-ip'] === 'string' ? req.headers['x-real-ip'].trim() : ''
  const candidate = headerIp || req.socket?.remoteAddress || ''
  return isIP(candidate) ? candidate : 'unknown'
}

/**
 * Resolve the caller's identity, or null.
 *
 * FAIL CLOSED: if SESSION_SECRET is unset there is no way to verify a cookie,
 * so cookie auth is simply unavailable — never "allow because unconfigured".
 * Likewise an unset MYMATRX_ADMIN_API_SECRET disables the service path rather
 * than matching an empty header.
 *
 * @returns {Promise<{userId: string|null, email: string|null, kind: 'session'|'service'}|null>}
 */
export async function resolveIdentity(req) {
  const sessionSecret = process.env.SESSION_SECRET
  const token = req.cookies?.[SESSION_COOKIE_NAME]
  if (sessionSecret && token) {
    const payload = await verifySessionToken(token, sessionSecret)
    if (payload) {
      return { userId: payload.sub || null, email: payload.email || null, kind: 'session' }
    }
  }

  const serviceSecret = process.env.MYMATRX_ADMIN_API_SECRET
  const presented = req.headers?.[ADMIN_SECRET_HEADER]
  if (serviceSecret && typeof presented === 'string' && constantTimeEqual(presented, serviceSecret)) {
    // A service caller attributes to a configured platform identity — NOT to
    // anything it sent us. Unset means the row is simply unattributed.
    return {
      userId: process.env.MYMATRX_SERVICE_USER_ID || null,
      email: null,
      kind: 'service',
    }
  }

  return null
}

/**
 * Gate a handler. Writes the 401 itself and returns null when refused, so a
 * caller is exactly: `const identity = await requireIdentity(req, res); if (!identity) return`.
 */
export async function requireIdentity(req, res) {
  const identity = await resolveIdentity(req)
  if (!identity) {
    res.status(401).json({ error: 'unauthorized' })
    return null
  }
  return identity
}

// ── Rate limiting ───────────────────────────────────────────────────────────
// Deliberately in-memory, per serverless instance. These are ADMIN routes on a
// pre-launch platform: the job is to stop a credential-stuffing or runaway-loop
// burst, not to be a distributed quota system. A DB-backed counter here would
// add a round trip and a failure mode to every privileged write for no gain
// (PRIME RULE: propose the simple version first). The public visitor routes
// under /api/sites/** keep their existing DB-backed limiter, which needs to be
// exact because it is anonymous and internet-facing.
const buckets = new Map()
const MAX_BUCKETS = 10_000

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Fixed-window limiter. Returns true when the request may proceed; otherwise
 * writes 429 (with Retry-After) and returns false.
 */
export function rateLimit(req, res, { name, limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now()
  if (buckets.size > MAX_BUCKETS) prune(now)

  const key = `${name}:${clientIp(req)}`
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }
  bucket.count += 1

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    res.setHeader('Retry-After', String(retryAfter))
    res.status(429).json({ error: 'rate_limited', retryAfterSeconds: retryAfter })
    return false
  }
  return true
}

/** Test seam — the buckets are module state, so tests must be able to reset them. */
export function __resetRateLimits() {
  buckets.clear()
}

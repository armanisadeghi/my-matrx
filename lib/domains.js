// Host-header helpers for domain-based client-site routing (W2-E).
// Edge-safe: pure string ops only (imported by proxy.js, the middleware).
// Design: docs/DOMAIN_ROUTING_DESIGN.md

// Hosts that are the platform itself — NEVER treated as a client custom domain.
// Vercel preview deployments (*.vercel.app) and local dev included.
const PLATFORM_APEXES = new Set(['mymatrx.com', 'localhost', '127.0.0.1', '[::1]'])
const PLATFORM_SUFFIXES = ['.mymatrx.com', '.vercel.app', '.localhost']

// After normalization a host must look like a hostname (ASCII/punycode; IDN
// domains must be stored — and therefore arrive — in punycode form).
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/

/**
 * Normalize a raw Host header value to a comparable hostname:
 * lowercase, strip the port, strip one trailing dot.
 * Returns null when the value doesn't look like a hostname (missing header,
 * injection attempts, weird characters) — callers treat null as "platform".
 */
export function normalizeHost(rawHost) {
  if (!rawHost || typeof rawHost !== 'string') return null
  let host = rawHost.trim().toLowerCase()
  // IPv6 literals ([::1]:3000) — keep the brackets, strip the port after them.
  if (host.startsWith('[')) {
    const end = host.indexOf(']')
    if (end === -1) return null
    host = host.slice(0, end + 1)
    return host === '[::1]' ? host : null // only loopback is meaningful to us
  }
  const colon = host.indexOf(':')
  if (colon !== -1) host = host.slice(0, colon)
  if (host.endsWith('.')) host = host.slice(0, -1)
  if (!HOSTNAME_RE.test(host)) return null
  return host
}

/** True when the (normalized) host is the platform itself, not a client domain. */
export function isPlatformHost(host) {
  if (!host) return true // fail SAFE: un-parseable host gets platform behavior
  if (PLATFORM_APEXES.has(host)) return true
  return PLATFORM_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/**
 * The www/apex counterpart of a host: `www.x.com` ⇄ `x.com`.
 * Returns null when there is no meaningful counterpart (single-label hosts,
 * multi-level subdomains other than www).
 */
export function domainCounterpart(host) {
  if (!host || !host.includes('.')) return null
  if (host.startsWith('www.')) {
    const apex = host.slice(4)
    return apex.includes('.') ? apex : null
  }
  // Only offer the www form for apex-shaped hosts (exactly 2 labels) — we don't
  // guess counterparts for arbitrary subdomains like blog.x.com.
  return host.split('.').length === 2 ? `www.${host}` : null
}

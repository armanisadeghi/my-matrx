// Minimal HMAC-signed session token — no dependency, works in both the Edge
// runtime (proxy.js) and the Node runtime (pages/api/**) via Web Crypto,
// which is globally available in both.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function base64UrlEncode(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function createSessionToken(payload, secret) {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const key = await getKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return `${body}.${base64UrlEncode(new Uint8Array(sig))}`
}

export async function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string') return null
  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) return null
  const body = token.slice(0, dotIndex)
  const sig = token.slice(dotIndex + 1)
  if (!body || !sig) return null

  let key
  try {
    key = await getKey(secret)
  } catch {
    return null
  }

  let valid = false
  try {
    valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(sig), encoder.encode(body))
  } catch {
    return null
  }
  if (!valid) return null

  let payload
  try {
    payload = JSON.parse(decoder.decode(base64UrlDecode(body)))
  } catch {
    return null
  }

  if (typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null
  return payload
}

export const SESSION_COOKIE_NAME = 'mm_admin_session'
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60

import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/adminSession'

// Called by /oauth/callback right after aidream's /auth/callback hands back
// an access_token. aidream already did an admin check before minting that
// redirect, but the token arrives via a client-controlled URL, so we
// independently re-verify it against aidream's /auth/whoami (server-to-server,
// no CORS involved) before trusting it and minting our own session cookie.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { access_token } = req.body || {}
  if (!access_token || typeof access_token !== 'string') {
    return res.status(400).json({ error: 'Missing access_token' })
  }

  const aidreamUrl = process.env.AIDREAM_API_URL
  const sessionSecret = process.env.SESSION_SECRET

  if (!aidreamUrl || !sessionSecret) {
    return res.status(503).json({ error: 'Admin login is not configured' })
  }

  let whoami
  try {
    const response = await fetch(`${aidreamUrl}/auth/whoami`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to verify identity' })
    }
    whoami = await response.json()
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach identity server', details: err.message })
  }

  if (!whoami.authenticated || !whoami.is_admin) {
    return res.status(403).json({ error: 'Not an admin' })
  }

  const exp = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const token = await createSessionToken(
    { sub: whoami.user_id, email: whoami.email, exp },
    sessionSecret
  )

  const isProd = process.env.NODE_ENV === 'production'
  const cookie = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    isProd ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')

  res.setHeader('Set-Cookie', cookie)
  return res.status(200).json({ success: true, email: whoami.email })
}

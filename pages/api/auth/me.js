import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/adminSession'

export default async function handler(req, res) {
  const secret = process.env.SESSION_SECRET
  const token = req.cookies?.[SESSION_COOKIE_NAME]

  if (!secret || !token) {
    return res.status(200).json({ authenticated: false })
  }

  const payload = await verifySessionToken(token, secret)
  if (!payload) {
    return res.status(200).json({ authenticated: false })
  }

  return res.status(200).json({ authenticated: true, email: payload.email })
}

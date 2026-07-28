// Preview gate — W2 hardening item "anonymous ?preview=true", pre-launch shape.
//
// THE RULE (Arman, 2026-07-28): protecting a draft is worth LESS than a tester
// being able to see their work. So the gate fails OPEN by design:
//
//   - A site with NO `settings.preview_token` is exactly as open as before.
//     Tokens are set per-site, on real-client sites only, via SQL/admin — the
//     sandbox (`dev-website`) deliberately stays tokenless.
//   - A minted preview link (`?preview=true&pt=<token>`) always works — this is
//     what admin UIs and the agent screenshot/verify loop append.
//   - A logged-in platform admin (the `mm_admin_session` cookie from
//     mymatrx.com/admin — same OAuth every tester uses) always gets in with no
//     token at all. This is the human guarantee.
//
// A denied request never silently falls through to the published page (that
// would hide the gate from the person debugging it) — the route renders a
// loud, friendly gate page instead. See previewGateDenied / ClientSiteRenderer.
//
// The token is NOT the data_api_key (that ships inside public HTML by design
// and must never unlock drafts) and it must never enter Next props — check it
// server-side only.

import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/adminSession'

export async function previewAccessAllowed(client, query, req) {
  const token = client?.settings?.preview_token
  if (!token || typeof token !== 'string') return true
  if (query?.pt === token) return true
  const secret = process.env.SESSION_SECRET
  const raw = req?.cookies?.[SESSION_COOKIE_NAME]
  if (secret && raw && (await verifySessionToken(raw, secret))) return true
  return false
}

/** GSSP result for a denied preview: 403 + the branded gate body. */
export function previewGateDenied(res) {
  if (res && !res.headersSent) res.statusCode = 403
  return { props: { previewGate: true } }
}

// The custom-domain verification MARKER — the my-matrx half of the flow the CMS
// runs from matrx-frontend (`verify_domain` in app/api/cms/sites/route.ts):
//
//   1. The CMS fetches https://{domain}/__matrx-domain-verification
//   2. proxy.js sees a non-platform host on that exact path and rewrites it
//      here with ?host={normalized host}
//   3. This route resolves the host back to its `client_sites.domain` row and
//      returns the site's identity
//   4. The CMS compares {service, siteSlug, domain} against the site it is
//      verifying — only an exact match flips `settings.domain_traffic` to
//      {mode:"custom", verified_domain} and lets generated traffic use the
//      custom domain.
//
// Design: docs/DOMAIN_ROUTING_DESIGN.md § "Desired domain versus active
// traffic domain". Until this route existed the verifier could never succeed,
// so every custom domain stayed mode:"platform" forever.
//
// PUBLIC BY DESIGN — it discloses only (slug, domain), the same pairing the
// public /c/{slug} surface and the domain's own pages already reveal. It must
// stay reachable with zero auth: the whole point is that an outside fetch of
// the bare domain proves DNS + TLS + serving all point at us.

import { getClientSiteByDomain } from '@/lib/supabase/clientHelpers'
import { normalizeHost, isPlatformHost } from '@/lib/domains'
import { rateLimit } from '@/lib/apiAuth'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!rateLimit(req, res, { name: 'domain-verification', limit: 30, windowMs: 60_000 })) {
    return
  }
  // proxy.js passes the already-normalized host; re-normalize defensively so a
  // direct platform-host call with a hand-written ?host= behaves identically.
  const host = normalizeHost(String(req.query.host || ''))
  if (!host || isPlatformHost(host)) {
    return res.status(404).json({ error: 'No client domain to verify.' })
  }
  const site = await getClientSiteByDomain(host)
  if (!site) {
    return res.status(404).json({ error: 'No site is configured with this domain.' })
  }
  // The verifier compares these EXACT keys — change them there and here or
  // verification silently never passes again.
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({
    service: 'mymatrx',
    siteSlug: site.slug,
    domain: site.domain,
  })
}

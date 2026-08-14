import { getClientSiteByDomain } from '@/lib/supabase/clientHelpers'
import { normalizeHost } from '@/lib/domains'

export default function DomainVerificationMarker() {
  return null
}

/** Public, site-specific proof of DNS + Vercel routing + HTTPS. */
export async function getServerSideProps({ params, res }) {
  const host = normalizeHost(params?.host)
  const client = host ? await getClientSiteByDomain(host) : null
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (!client) {
    res.statusCode = 404
    res.end(JSON.stringify({ error: 'site_not_found' }))
    return { props: {} }
  }
  res.statusCode = 200
  res.end(JSON.stringify({ service: 'mymatrx', siteSlug: client.slug, domain: client.domain }))
  return { props: {} }
}

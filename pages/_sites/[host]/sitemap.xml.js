import { getClientSiteByDomain } from '@/lib/supabase/clientHelpers'
import { buildNav } from '@/lib/render/clientSiteRenderer'
import { discoveryNotFound, serveSitemapXml } from '@/lib/render/discovery'
import { normalizeHost, domainCounterpart } from '@/lib/domains'

// `https://{client domain}/sitemap.xml` — the REAL discovery surface for a
// domain-mapped site. NEVER reachable by URL: proxy.js 404s direct /_sites/*
// requests and rewrites custom-host `/sitemap.xml` here (that rewrite is why
// `/sitemap.xml` had to leave proxy.js's ROOT_STATIC_PASSTHROUGH allowlist —
// it used to fall through to public/, where no such file exists).
export default function SitemapXml() {
  return null // getServerSideProps wrote the response
}

export async function getServerSideProps({ params, req, res }) {
  const contentType = 'application/xml; charset=utf-8'
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return discoveryNotFound(res, contentType)
    }
    // Re-normalize: this page must not trust its caller (same rule as the
    // renderer wrapper — defense in depth, one funnel).
    const host = normalizeHost(params.host)
    if (!host) return discoveryNotFound(res, contentType)

    const client = await getClientSiteByDomain(host)
    if (!client) {
      // www/apex counterpart: the stored `domain` is canonical — 308 to its
      // sitemap, exactly as the page route does for pages.
      const counterpart = domainCounterpart(host)
      const counterpartClient = counterpart ? await getClientSiteByDomain(counterpart) : null
      if (counterpartClient) {
        return {
          redirect: {
            destination: `https://${counterpartClient.domain}/sitemap.xml`,
            permanent: true,
          },
        }
      }
      return discoveryNotFound(res, contentType)
    }

    return await serveSitemapXml({ client, nav: buildNav(client, { onDomain: true }), req, res })
  } catch (error) {
    console.error('Error serving domain sitemap.xml:', error)
    return discoveryNotFound(res, contentType)
  }
}

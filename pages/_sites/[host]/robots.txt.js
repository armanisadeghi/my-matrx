import { getClientSiteByDomain } from '@/lib/supabase/clientHelpers'
import { buildNav } from '@/lib/render/surface'
import { discoveryNotFound, serveRobotsTxt } from '@/lib/render/discovery'
import { normalizeHost, domainCounterpart } from '@/lib/domains'

// `https://{client domain}/robots.txt` — the file that actually governs
// crawling for a client site, and the reason `/robots.txt` had to leave
// proxy.js's ROOT_STATIC_PASSTHROUGH allowlist: served from public/ it would
// have been the PLATFORM's robots on a client's domain (and today, a 404).
// Its `Sitemap:` line names the domain it was requested on.
export default function RobotsTxt() {
  return null // getServerSideProps wrote the response
}

export async function getServerSideProps({ params, req, res }) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return discoveryNotFound(res)
    }
    const host = normalizeHost(params.host)
    if (!host) return discoveryNotFound(res)

    const client = await getClientSiteByDomain(host)
    if (!client) {
      const counterpart = domainCounterpart(host)
      const counterpartClient = counterpart ? await getClientSiteByDomain(counterpart) : null
      if (counterpartClient) {
        return {
          redirect: {
            destination: `https://${counterpartClient.domain}/robots.txt`,
            permanent: true,
          },
        }
      }
      return discoveryNotFound(res)
    }

    return await serveRobotsTxt({ client, nav: buildNav(client, { onDomain: true }), req, res })
  } catch (error) {
    console.error('Error serving domain robots.txt:', error)
    return discoveryNotFound(res)
  }
}

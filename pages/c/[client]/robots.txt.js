import { getClientSite } from '@/lib/supabase/clientHelpers'
import { buildNav } from '@/lib/render/clientSiteRenderer'
import { discoveryNotFound, serveRobotsTxt } from '@/lib/render/discovery'

// `/c/{site}/robots.txt` — the platform-host companion to `/c/{site}/sitemap.xml`.
// Crawlers only obey a robots.txt at an ORIGIN root, so this one is an
// inspection/parity surface: the file that governs a client's crawling is the
// one served at their own domain root (pages/_sites/[host]/robots.txt.js).
// Whichever host serves it, its `Sitemap:` line names that same host.
export default function RobotsTxt() {
  return null // getServerSideProps wrote the response
}

export async function getServerSideProps({ params, req, res }) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return discoveryNotFound(res)
    }
    const client = await getClientSite(params.client)
    if (!client) return discoveryNotFound(res)

    return await serveRobotsTxt({ client, nav: buildNav(client, { onDomain: false }), req, res })
  } catch (error) {
    console.error('Error serving /c robots.txt:', error)
    return discoveryNotFound(res)
  }
}

import { getClientSite } from '@/lib/supabase/clientHelpers'
import { buildNav } from '@/lib/render/clientSiteRenderer'
import { discoveryNotFound, serveSitemapXml } from '@/lib/render/discovery'

// `/c/{site}/sitemap.xml` — the platform-host discovery surface for one client
// site. A static filename beats the sibling `[[...slug]]` catch-all in Next's
// route ranking, so this never reaches the renderer. Thin wrapper over the ONE
// implementation (lib/render/discovery.js).
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
    const client = await getClientSite(params.client)
    if (!client) return discoveryNotFound(res, contentType)

    return await serveSitemapXml({ client, nav: buildNav(client, { onDomain: false }), req, res })
  } catch (error) {
    console.error('Error serving /c sitemap.xml:', error)
    return discoveryNotFound(res, contentType)
  }
}

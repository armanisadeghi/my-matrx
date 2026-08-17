import { getClientSite } from '@/lib/supabase/clientHelpers'
import { ClientSiteRenderer, buildNav, loadSitePageProps, siteNotFound } from '@/lib/render/clientSiteRenderer'
import { previewAccessAllowed, previewGateDenied } from '@/lib/previewGate'
import { serveIndexNowKeyIfRequested } from '@/lib/render/discovery'

// Path-based client-site route: /c/{site}/{slug} and /c/{site}/{category}/{slug}.
// Thin wrapper over the ONE shared renderer (lib/render/clientSiteRenderer.js).
// A domain-mapped site keeps serving 200 here, but its canonical/og:url point at
// the custom domain (cross-domain canonical — see docs/DOMAIN_ROUTING_DESIGN.md).
export default ClientSiteRenderer

export async function getServerSideProps(props) {
  try {
    const params = await props.params
    const query = await props.query
    const { client: clientSlug, slug = [] } = params
    const previewRequested = query.preview === 'true'

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return siteNotFound(props.res)
    }

    const client = await getClientSite(clientSlug)
    if (!client) {
      console.log('Client not found:', clientSlug)
      return siteNotFound(props.res)
    }

    const indexNowResponse = serveIndexNowKeyIfRequested({
      client,
      slugSegments: slug,
      res: props.res,
    })
    if (indexNowResponse) return indexNowResponse

    // Preview gate: sites with a `settings.preview_token` require the `pt`
    // link param or a platform admin session; tokenless sites stay open.
    // Denial renders a loud gate page, never a silent published fallback.
    const isPreview = previewRequested && (await previewAccessAllowed(client, query, props.req))
    if (previewRequested && !isPreview) {
      return previewGateDenied(props.res)
    }

    return await loadSitePageProps({
      client,
      slugSegments: slug,
      isPreview,
      previewPt: isPreview && typeof query.pt === 'string' ? query.pt : undefined,
      nav: buildNav(client, { onDomain: false }),
      req: props.req, // carrier for the W2-C site-key injection (never enters props)
      res: props.res, // lets a missing page answer 404 instead of a soft-404 200
    })
  } catch (error) {
    console.error('Error in getServerSideProps:', error)
    return siteNotFound(props.res)
  }
}

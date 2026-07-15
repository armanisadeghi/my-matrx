import { getClientSite } from '@/lib/supabase/clientHelpers'
import { ClientSiteRenderer, buildNav, loadSitePageProps } from '@/lib/render/clientSiteRenderer'

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
    const isPreview = query.preview === 'true'

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return { props: { notFound: true } }
    }

    const client = await getClientSite(clientSlug)
    if (!client) {
      console.log('Client not found:', clientSlug)
      return { props: { notFound: true } }
    }

    return await loadSitePageProps({
      client,
      slugSegments: slug,
      isPreview,
      nav: buildNav(client, { onDomain: false }),
    })
  } catch (error) {
    console.error('Error in getServerSideProps:', error)
    return { props: { notFound: true } }
  }
}

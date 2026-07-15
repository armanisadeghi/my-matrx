import { getClientSiteByDomain } from '@/lib/supabase/clientHelpers'
import { ClientSiteRenderer, buildNav, loadSitePageProps } from '@/lib/render/clientSiteRenderer'
import { normalizeHost, domainCounterpart } from '@/lib/domains'

// Custom-domain client-site route (W2-E). NEVER reachable by URL: proxy.js
// 404s direct /_sites/* requests and internally rewrites custom-host requests
// to /_sites/{host}{path}. Resolves the site by client_sites.domain and renders
// with root-relative hrefs (no /c/ prefix) + domain canonicals.
// Design: docs/DOMAIN_ROUTING_DESIGN.md
export default ClientSiteRenderer

export async function getServerSideProps(props) {
  try {
    const params = await props.params
    const { host: rawHost, slug = [] } = params
    // Custom domains NEVER honor ?preview=true (design decision 6): preview is an
    // internal/admin concern that stays on the platform /c/ host. Honoring a bare
    // preview param on a client's PRODUCTION domain would expose unpublished +
    // draft content to any anonymous visitor (adversarial finding W2-E #1). The
    // /c/ mymatrx preview flow (admins + the agent verify loop) is unchanged.
    const isPreview = false

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return { props: { notFound: true } }
    }

    // proxy.js already normalized + validated the host, but this page must not
    // trust its caller: re-normalize (defense in depth — same funnel).
    const host = normalizeHost(rawHost)
    if (!host) {
      return { props: { notFound: true } }
    }

    let client = await getClientSiteByDomain(host)

    if (!client) {
      // www/apex counterpart: the stored `domain` is canonical — 308 to it,
      // preserving path + query (both hosts are attached in Vercel).
      const counterpart = domainCounterpart(host)
      const counterpartClient = counterpart ? await getClientSiteByDomain(counterpart) : null
      if (counterpartClient) {
        const path = slug.length > 0 ? `/${slug.map(encodeURIComponent).join('/')}` : '/'
        const qs = isPreview ? '?preview=true' : ''
        return {
          redirect: {
            destination: `https://${counterpartClient.domain}${path}${qs}`,
            permanent: true,
          },
        }
      }
      console.log('No client site for domain:', host)
      return { props: { notFound: true } }
    }

    return await loadSitePageProps({
      client,
      slugSegments: slug,
      isPreview,
      nav: buildNav(client, { onDomain: true }),
    })
  } catch (error) {
    console.error('Error in getServerSideProps (_sites):', error)
    return { props: { notFound: true } }
  }
}

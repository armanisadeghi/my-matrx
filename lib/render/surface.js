// The SERVING SURFACE of a client site — the two values every URL this
// platform emits is built from. Pure, import-free (like pagePath.js /
// redirects.js), so `pnpm test:render` can pin it and so a non-React consumer
// can use it without pulling the renderer's module graph: the sitemap/robots
// routes need the surface and nothing else, and importing the renderer for it
// dragged React, the collection SSR layer and their node-only deps into a route
// that emits two hundred bytes of XML.
//
//   basePath      — prefix for every in-site href (nav, listing cards, preview
//                   back-link, the 301 destination). '' on a custom domain,
//                   `/c/{slug}` on the platform host.
//   canonicalBase — origin+prefix that canonical / og:url / sitemap URLs are
//                   built on. For a verified, traffic-active domain this is
//                   `https://{domain}` on EVERY surface (the /c/ path emits a
//                   cross-domain canonical so search consolidates onto the
//                   domain — no redirect, because admin iframes / screenshots /
//                   preview flows rely on /c/).
//
// Design + decisions: docs/DOMAIN_ROUTING_DESIGN.md.
// Re-exported by lib/render/clientSiteRenderer.js — its importers are unchanged.

/** Compute the `nav` prop for a serving surface. `client` is the RAW db row. */
export function buildNav(client, { onDomain = false } = {}) {
  const basePath = onDomain ? '' : `/c/${client.slug}`
  const domain = activeSiteDomain(client)
  const canonicalBase = domain
    ? `https://${domain}`
    : `https://mymatrx.com/c/${client.slug}`
  return { basePath, canonicalBase }
}

/** Desired custom host becomes the generated-traffic host only after verification. */
export function activeSiteDomain(client) {
  const domain = String(client?.domain || '').trim()
  if (!domain) return null
  const traffic = client?.settings?.domain_traffic
  // FAIL CLOSED (2026-08-24): a row with no domain_traffic state is UNVERIFIED,
  // never grandfathered. The old rollout passthrough here made live_url and
  // every canonical claim a domain nothing had checked — verified live that day:
  // zero sites had mode:"custom" and zero desired domains actually pointed at
  // us, so the passthrough preserved only lies (prpinjectionmd.com serves the
  // client's own PHP site). Verification is one click in the CMS's domain
  // settings now that the /__matrx-domain-verification marker exists.
  if (!traffic || typeof traffic !== 'object') return null
  return traffic.mode === 'custom' && traffic.verified_domain === domain ? domain : null
}

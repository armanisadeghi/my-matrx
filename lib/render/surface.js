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
//                   built on. For a domain-mapped site this is
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
  const canonicalBase = client.domain
    ? `https://${client.domain}`
    : `https://mymatrx.com/c/${client.slug}`
  return { basePath, canonicalBase }
}

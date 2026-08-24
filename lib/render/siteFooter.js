// ---------------------------------------------------------------------------
// footer_config → a real footer (opt-in, token-driven).
//
// `client_sites.footer_config` was typed, exposed by `toPublicClientSite` and
// returned by aidream's SiteRead DTO while NOTHING ever read it — every site
// hand-wrote its whole footer (columns, contact block, copyright line) inside
// its footer component's html_content, with site-absolute hrefs baked in.
//
// INJECTION CONTRACT — identical to siteNav.js, and safety-critical for the
// same reason. The footer is NEVER auto-injected. It replaces the literal token
// `<!--matrx:footer-->` wherever it appears in a header or footer component's
// html_content. No token → the output is byte-identical to what the site served
// before this feature existed. That is what keeps iopbm's hand-written footer
// working untouched. Do not widen this.
//
// OWNERSHIP — footer_config is LAYOUT ONLY (Arman's ruling, 2026-07-27).
// It owns structure and flags; the CONTENT of the contact and social blocks
// comes from the columns that already exist for it:
//   contact → `client_sites.contact_info`
//   social  → `client_sites.social_links`
// footer_config never duplicates them; it only says whether and where they
// appear. One source of truth per fact.
//
// SHAPE:
//   {
//     "columns": [ { "heading": "Services", "links": [ {label, href}, … ] }, … ],
//     "show_contact": true,          "contact_heading": "Contact",
//     "show_social": true,           "social_heading": "Follow Us",
//     "order": ["columns", "contact", "social"],   // column-block sequence
//     "copyright": "…",              // omitted → "© {year} {site name}"
//     "legal_links": [ {label, href}, … ]          // rendered after the copyright
//   }
//   `{}` (every site today) renders NOTHING, so enabling the column is inert
//   until someone populates it.
//
// HREFS: a href starting with `/` is SITE-RELATIVE and gets `basePath`
// prefixed, so one config is correct on `/c/{slug}/…` AND on a custom domain.
// Anchors, `mailto:`, `tel:` and absolute URLs pass through verbatim. (This is
// deliberately NOT the `navigation` override's verbatim rule: iopbm's footer
// hard-codes `/c/iopbm/…` today and would break the moment it gets a domain —
// authoring `/services` and letting the renderer prefix it is the fix.)
//
// Every label and href is escaped server-side; non-navigating href schemes are
// neutralized — footer_config is agent-authored and API-writable.
// ---------------------------------------------------------------------------

// Relative, not the `@/` alias: `pnpm test:render` imports these modules
// directly with plain node, which does not resolve jsconfig paths.
import { escapeHtml, resolveSiteHref, safeHref } from './siteNav.js'

export const FOOTER_TOKEN = '<!--matrx:footer-->'

/** Default sequence of the column blocks when `order` is absent or unusable. */
const DEFAULT_ORDER = ['columns', 'contact', 'social']

/** True when this html body opts in to a generated footer. */
export function hasFooterToken(html) {
  return typeof html === 'string' && html.includes(FOOTER_TOKEN)
}

/**
 * Resolve an authored href against the serving surface. Site-relative paths
 * (`/services`) get `basePath`; everything else is left alone.
 */
function resolveHref(href, basePath) {
  return resolveSiteHref(href, basePath)
}

/** Normalize an authored `[{label, href}]` list; drops entries with no label. */
function toLinks(list, basePath) {
  if (!Array.isArray(list)) return []
  return list
    .filter((entry) => entry && typeof entry === 'object' && entry.label)
    .map((entry) => ({ label: String(entry.label), href: resolveHref(entry.href, basePath) }))
}

/** 'primary_care' → 'Primary Care' — the fallback label for a social key. */
function humanize(key) {
  return String(key)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * `client_sites.social_links` → links. Accepts the two shapes that exist in
 * the wild: a `{platform: url}` map, or a list of `{label|platform, href|url}`.
 */
export function socialLinksToItems(socialLinks, basePath = '') {
  if (Array.isArray(socialLinks)) {
    return toLinks(
      socialLinks
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          label: entry.label || humanize(entry.platform || ''),
          href: entry.href || entry.url || '',
        })),
      basePath
    )
  }
  if (!socialLinks || typeof socialLinks !== 'object') return []
  return Object.entries(socialLinks)
    .filter(([, url]) => typeof url === 'string' && url.trim())
    .map(([key, url]) => ({ label: humanize(key), href: resolveHref(url, basePath) }))
}

/**
 * `client_sites.contact_info` → display lines. iopbm's live row is the shape
 * this targets: `{phone, phone_raw, address: {street, city, state, zip}}`.
 * `phone_raw` is the dial string for the `tel:` href, `phone` the display text.
 * Each line is `{text}` or `{text, href}`.
 */
export function contactInfoToLines(contactInfo) {
  if (!contactInfo || typeof contactInfo !== 'object' || Array.isArray(contactInfo)) return []
  const lines = []

  const address = contactInfo.address
  if (address && typeof address === 'object' && !Array.isArray(address)) {
    const street = String(address.street || '').trim()
    if (street) lines.push({ text: street })
    const city = String(address.city || '').trim()
    const state = String(address.state || '').trim()
    const zip = String(address.zip || '').trim()
    const locality = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    if (locality) lines.push({ text: locality })
  } else if (typeof address === 'string' && address.trim()) {
    lines.push({ text: address.trim() })
  }

  const phone = String(contactInfo.phone || contactInfo.phone_raw || '').trim()
  if (phone) {
    const dial = String(contactInfo.phone_raw || contactInfo.phone || '').replace(/[^\d+]/g, '')
    lines.push(dial ? { text: phone, href: `tel:${dial}` } : { text: phone })
  }

  const email = String(contactInfo.email || '').trim()
  // A mailto: needs a real address — an authored typo must not become a link.
  if (email) lines.push(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { text: email, href: `mailto:${email}` } : { text: email })

  return lines
}

/**
 * Build the footer's blocks for a site. Pure — `year` is a parameter so the
 * auto copyright is testable and the renderer owns "now".
 *
 * @param {object} params
 * @param {object|null} params.footerConfig - client_sites.footer_config
 * @param {object|Array|null} params.socialLinks - client_sites.social_links
 * @param {object|null} params.contactInfo - client_sites.contact_info
 * @param {string} params.siteName - client_sites.name (auto-copyright fallback)
 * @param {number} params.year - year for the auto copyright
 * @param {string} params.basePath - '' on a custom domain, '/c/{slug}' otherwise
 * @returns {{columns: Array, copyright: string, legalLinks: Array}}
 */
export function resolveFooter({
  footerConfig,
  socialLinks,
  contactInfo,
  siteName = '',
  year,
  basePath = '',
}) {
  const config =
    footerConfig && typeof footerConfig === 'object' && !Array.isArray(footerConfig) ? footerConfig : {}

  const blocks = {
    columns: Array.isArray(config.columns)
      ? config.columns
          .filter((col) => col && typeof col === 'object')
          .map((col) => ({
            heading: col.heading ? String(col.heading) : '',
            links: toLinks(col.links, basePath),
            lines: [],
          }))
          .filter((col) => col.links.length > 0 || col.heading)
      : [],
    contact: [],
    social: [],
  }

  if (config.show_contact) {
    const lines = contactInfoToLines(contactInfo)
    if (lines.length > 0) {
      blocks.contact = [{ heading: String(config.contact_heading || 'Contact'), links: [], lines }]
    }
  }

  if (config.show_social) {
    const links = socialLinksToItems(socialLinks, basePath)
    if (links.length > 0) {
      blocks.social = [{ heading: String(config.social_heading || 'Follow Us'), links, lines: [] }]
    }
  }

  // `order` sequences the column blocks. Unknown names are ignored; anything
  // the author left out still renders, appended in the default order — an
  // enabled block must never vanish because of a typo in `order`.
  const requested = Array.isArray(config.order) ? config.order.filter((k) => k in blocks) : []
  const sequence = [...requested, ...DEFAULT_ORDER.filter((k) => !requested.includes(k))]
  const columns = sequence.flatMap((key) => blocks[key])

  const copyright = config.copyright
    ? String(config.copyright)
    : siteName && year
      ? `© ${year} ${siteName}`
      : ''

  return { columns, copyright, legalLinks: toLinks(config.legal_links, basePath) }
}

function renderLinkList(links) {
  return links
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join('')
}

function renderLineList(lines) {
  return lines
    .map((line) =>
      line.href
        ? `<li><a href="${escapeHtml(safeHref(line.href))}">${escapeHtml(line.text)}</a></li>`
        : `<li>${escapeHtml(line.text)}</li>`
    )
    .join('')
}

/**
 * Render resolved blocks as markup. No inline styles — sites style
 * `.matrx-footer-*` themselves (that is why the class names are stable and
 * documented). Empty in → empty string out, so the token vanishes.
 *
 * NO OUTER WRAPPER, deliberately. The token already sits INSIDE the site's own
 * `<footer>` element, and `.matrx-footer` is spoken for: aidream's starter kit
 * (`aidream/services/cms/starter_kit.py`) emits `<footer class="matrx-footer">`
 * and ships CSS for it. Wrapping these blocks in a second `.matrx-footer`
 * would apply that element's border/padding/background twice.
 */
export function renderFooterHtml({ columns = [], copyright = '', legalLinks = [] } = {}) {
  const cols = columns
    .map((col) => {
      const heading = col.heading ? `<h3>${escapeHtml(col.heading)}</h3>` : ''
      const items = renderLinkList(col.links || []) + renderLineList(col.lines || [])
      const list = items ? `<ul>${items}</ul>` : ''
      return `<div class="matrx-footer-col">${heading}${list}</div>`
    })
    .join('')

  const legal = legalLinks.length > 0 ? `<ul class="matrx-footer-legal">${renderLinkList(legalLinks)}</ul>` : ''
  const bottom =
    copyright || legal
      ? `<div class="matrx-footer-bottom">${copyright ? `<p>${escapeHtml(copyright)}</p>` : ''}${legal}</div>`
      : ''

  return `${cols ? `<div class="matrx-footer-cols">${cols}</div>` : ''}${bottom}`
}

/**
 * Replace every `<!--matrx:footer-->` token in `html` with the rendered footer.
 * Returns `html` UNCHANGED (same reference) when the token is absent — the
 * no-op path every existing site takes.
 */
export function injectFooter(html, footerHtml) {
  if (!hasFooterToken(html)) return html
  return html.split(FOOTER_TOKEN).join(footerHtml || '')
}

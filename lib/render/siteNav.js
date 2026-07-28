// ---------------------------------------------------------------------------
// navigation → a real menu (opt-in, token-driven).
//
// `client_sites.navigation` and `client_pages.show_in_nav` / `sort_order` were
// typed, populated and surfaced in the site-structure XML while NOTHING ever
// generated a menu — every site hand-wrote its `<ul class="nav-links">` inside
// its header component's html_content.
//
// INJECTION CONTRACT — the safety-critical part. Nav is NEVER auto-injected.
// It replaces the literal token `<!--matrx:nav-->` wherever it appears in a
// header or footer component's html_content. No token → the output is
// byte-identical to what the site served before this feature existed. That is
// what keeps live hand-written menus (iopbm) working untouched.
//
// RESOLUTION ORDER:
//   1. `client_sites.navigation` non-empty array of {label, href} → verbatim
//      (an explicit override always wins; its hrefs are authored as-is, which
//      is how iopbm's in-page anchors like `#about` stay anchors).
//   2. Otherwise derive from the site's pages: is_published AND show_in_nav,
//      ordered by sort_order then title, href = basePath + pagePath(page).
//      `basePath` is what makes the same menu correct on BOTH the platform
//      path (`/c/{slug}/…`) and a custom domain (``).
//
// Every label and href is escaped server-side (the equivalent of
// MatrxData.escapeHtml in public/matrx-data.js) — component html_content is
// agent-authored and site rows are API-writable, so nothing is interpolated raw.
// ---------------------------------------------------------------------------

export const NAV_TOKEN = '<!--matrx:nav-->'

/** Server-side twin of MatrxData.escapeHtml (public/matrx-data.js). */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Reject hrefs that execute rather than navigate. Anything scheme-like that
 * isn't http/https/mailto/tel is dropped to '#' — relative paths and in-page
 * anchors (the overwhelmingly common case) pass through untouched.
 */
function safeHref(href) {
  const raw = String(href == null ? '' : href).trim()
  if (!raw) return '#'
  // Strip control chars/whitespace before scheme-sniffing (`java\nscript:`).
  const probe = raw.replace(/[\u0000-\u0020]/g, '').toLowerCase()
  const scheme = probe.match(/^([a-z][a-z0-9+.-]*):/)
  if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme[1])) return '#'
  return raw
}

/** True when this html body opts in to a generated menu. */
export function hasNavToken(html) {
  return typeof html === 'string' && html.includes(NAV_TOKEN)
}

/**
 * Build the nav item list for a site.
 * @param {object} params
 * @param {Array<{label: string, href: string}>|null} params.navigation - client_sites.navigation
 * @param {Array<object>} params.pages - published client_pages rows (fallback source)
 * @param {string} params.basePath - '' on a custom domain, '/c/{slug}' on the platform path
 * @param {(page: object) => string} params.pagePath - the renderer's pagePath helper
 * @returns {Array<{label: string, href: string}>}
 */
export function resolveNavItems({ navigation, pages, basePath = '', pagePath }) {
  // 1. Explicit override.
  if (Array.isArray(navigation) && navigation.length > 0) {
    return navigation
      .filter((entry) => entry && typeof entry === 'object' && entry.label)
      .map((entry) => ({ label: String(entry.label), href: safeHref(entry.href) }))
  }

  // 2. Derive from pages.
  const candidates = (pages || []).filter(
    (page) => page && page.is_published !== false && page.show_in_nav !== false
  )
  candidates.sort((a, b) => {
    const orderA = Number.isFinite(a.sort_order) ? a.sort_order : 0
    const orderB = Number.isFinite(b.sort_order) ? b.sort_order : 0
    if (orderA !== orderB) return orderA - orderB
    return String(a.title || '').localeCompare(String(b.title || ''))
  })

  return candidates.map((page) => ({
    label: String(page.title || page.slug || ''),
    href: safeHref(`${basePath}${pagePath(page)}`),
  }))
}

/**
 * Render nav items as markup. No inline styles — sites style `.matrx-nav`
 * themselves (that is why the class name is stable and documented).
 * @param {Array<{label: string, href: string}>} items
 * @param {string|null} currentHref - marked with aria-current="page"
 * @returns {string}
 */
export function renderNavHtml(items, currentHref = null) {
  if (!items || items.length === 0) return ''
  const listItems = items
    .map((item) => {
      const current = currentHref && item.href === currentHref ? ' aria-current="page"' : ''
      return `<li><a href="${escapeHtml(item.href)}"${current}>${escapeHtml(item.label)}</a></li>`
    })
    .join('')
  return `<nav class="matrx-nav"><ul>${listItems}</ul></nav>`
}

/**
 * Replace every `<!--matrx:nav-->` token in `html` with the rendered menu.
 * Returns `html` UNCHANGED (same reference) when the token is absent — the
 * no-op path every existing site takes.
 * @param {string|null|undefined} html
 * @param {Array<{label: string, href: string}>} items
 * @param {string|null} currentHref
 * @returns {string|null|undefined}
 */
export function injectNav(html, items, currentHref = null) {
  if (!hasNavToken(html)) return html
  return html.split(NAV_TOKEN).join(renderNavHtml(items, currentHref))
}

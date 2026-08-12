/**
 * SSR COLLECTION BINDING — collection rows in the HTML a crawler receives.
 *
 * Before this module the only path from a `site_collection_items` row to a page
 * was `MatrxData.list()` mutating the DOM after hydration: the served HTML
 * carried an empty `<ul>`, so neither Google nor our own crawler ever saw an
 * event, a testimonial or a profile. Content the platform generates could not
 * be measured, which breaks the crawl stage of the Growth Loop at its source
 * (gap `G-COLLECTIONS`; design: aidream `docs/cms_agent_authoring/W2C-render-binding.md` §A).
 *
 * THE CONTRACT — opt-in by token, exactly like nav and footer:
 *
 *   <ul>
 *     <template data-matrx-collection="events"
 *               data-order="starts_at:asc"
 *               data-limit="10">
 *       <li><strong>{{title}}</strong> — {{starts_at}}</li>
 *     </template>
 *     <li data-matrx-empty="events">No events scheduled.</li>
 *   </ul>
 *
 * No `data-matrx-collection` anywhere in a body → that body is returned as the
 * SAME STRING REFERENCE, unparsed and unserialized. Every existing page on
 * every live site takes that path, which is what makes this feature provably
 * unable to change them.
 *
 * WHY A `<template>` AND NOT A FETCH:
 *  - SEO-correct by construction — the rows are in the initial HTML.
 *  - SAFE by construction — the author never interpolates, so they cannot
 *    forget to escape. Every `{{field}}` is escaped HERE, once, by the
 *    renderer. This is strictly better than teaching `escapeHtml` discipline
 *    to every generated page.
 *  - `{{field}}` resolves ONLY against the allowlisted projection the caller
 *    passes in (`public_read_fields` + `id`/`created_at`). An unknown or
 *    non-allowlisted name renders EMPTY — `internal_notes` cannot be printed
 *    by any template, because it never reaches this function.
 *
 * WHY `<li data-matrx-empty>` AND NOT `<p>`: `<ul>` may contain only `<li>` and
 * script-supporting elements. `<template>` is script-supporting (legal there);
 * a `<p>` would be reparented out of the list by any real HTML parser. Agents
 * copy whatever this doc shows, so the example has to be valid HTML.
 *
 * PARSER NOTE (do not "upgrade" this to jsdom): a spec-compliant HTML5 parser
 * puts `<template>` children in a detached DocumentFragment, where a document
 * query finds nothing. `node-html-parser` is lenient and treats them as
 * ordinary children — which is precisely why the binding works. Swap the parser
 * and every binding silently stops matching.
 */
import { parse } from 'node-html-parser'

/** Cheap pre-check so a body with no binding is never parsed at all. */
export function hasCollectionBinding(html) {
  return typeof html === 'string' && html.includes('data-matrx-collection')
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i
const MAX_LIMIT = 200

/**
 * Every binding declared in one body, in document order.
 * @returns {Array<{collection: string, order: string|null, limit: number|null}>}
 *   Deduped per (collection, order, limit) is NOT done here — callers dedupe
 *   when fetching; the expander needs one entry per template element.
 */
export function findCollectionBindings(html) {
  if (!hasCollectionBinding(html)) return []
  const root = parse(html)
  const bindings = []
  for (const node of root.querySelectorAll('template[data-matrx-collection]')) {
    const collection = (node.getAttribute('data-matrx-collection') || '').trim()
    if (!SLUG_RE.test(collection)) {
      console.warn(`[collections] ignoring binding with unusable collection name ${JSON.stringify(collection)}`)
      continue
    }
    const rawOrder = node.getAttribute('data-order')
    const rawLimit = parseInt(node.getAttribute('data-limit'), 10)
    bindings.push({
      collection,
      order: typeof rawOrder === 'string' && rawOrder.trim() ? rawOrder.trim() : null,
      limit: Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : null,
    })
  }
  return bindings
}

/** The key a binding's rows are looked up under. Must match on both sides. */
export function bindingKey({ collection, order, limit }) {
  return `${collection}|${order || ''}|${limit || ''}`
}

/** HTML-escape one interpolated value. Item data is visitor-supplied. */
export function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Expand `{{field}}` placeholders in one template body against one item.
 * `item` is the PUBLIC projection: `{id, created_at, data}`. `{{id}}` and
 * `{{created_at}}` address the row; every other name addresses `data`. Unknown
 * names render empty — a template outliving a field rename degrades to a blank
 * instead of printing `{{starts_at}}` at a visitor.
 */
export function renderTemplate(templateHtml, item) {
  const data = item && typeof item.data === 'object' && item.data !== null ? item.data : {}
  return templateHtml.replace(/\{\{\s*([A-Za-z0-9_-]{1,64})\s*\}\}/g, (_match, key) => {
    if (key === 'id') return escapeHtml(item?.id)
    if (key === 'created_at') return escapeHtml(item?.created_at)
    return Object.prototype.hasOwnProperty.call(data, key) ? escapeHtml(data[key]) : ''
  })
}

/**
 * THE PURE EXPANDER: `html + rows -> html`. No request, no DB, unit testable.
 *
 * @param {string} html a page/component body
 * @param {Map<string, Array>|Object} rowsByKey bindingKey() → public item rows
 * @returns {string} the expanded body, or the ORIGINAL STRING REFERENCE when
 *   there is no binding to expand.
 *
 * Per binding:
 *  - rows present → the `<template>` is replaced by the concatenated rows and
 *    every `[data-matrx-empty="<collection>"]` element is removed;
 *  - zero rows (empty collection, unreadable collection, or a failed fetch) →
 *    the `<template>` is removed and the empty-state element stays. A page must
 *    never show a raw template or a half-rendered row.
 */
export function expandCollectionBindings(html, rowsByKey) {
  if (!hasCollectionBinding(html)) return html
  const get = (key) => (rowsByKey instanceof Map ? rowsByKey.get(key) : rowsByKey?.[key])

  const root = parse(html)
  const templates = root.querySelectorAll('template[data-matrx-collection]')
  if (templates.length === 0) return html

  const filled = new Set()
  for (const node of templates) {
    const collection = (node.getAttribute('data-matrx-collection') || '').trim()
    if (!SLUG_RE.test(collection)) continue
    const rawOrder = node.getAttribute('data-order')
    const rawLimit = parseInt(node.getAttribute('data-limit'), 10)
    const key = bindingKey({
      collection,
      order: typeof rawOrder === 'string' && rawOrder.trim() ? rawOrder.trim() : null,
      limit: Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : null,
    })
    const rows = get(key)
    const items = Array.isArray(rows) ? rows : []
    if (items.length === 0) {
      node.remove()
      continue
    }
    filled.add(collection)
    node.replaceWith(items.map((item) => renderTemplate(node.innerHTML, item)).join(''))
  }

  for (const node of root.querySelectorAll('[data-matrx-empty]')) {
    if (filled.has((node.getAttribute('data-matrx-empty') || '').trim())) node.remove()
  }

  return root.toString()
}

/**
 * Server side of the SSR collection binding: turn the bindings scanned out of a
 * page's HTML into rows, through EXACTLY the gate the public HTTP route
 * enforces (`resolveCollection` + `public_read` + `public_read_fields` +
 * `fetchPublicItems`). Nothing here can show a field or a row the anonymous
 * `GET .../items` endpoint would not show — the SSR path is a second consumer
 * of that gate, never a second implementation of it.
 *
 * Syntax + escaping contract: `lib/render/collectionBindings.js`.
 *
 * FAIL SOFT, WARN LOUD. A missing collection, a collection that never opted
 * into `public_read`, or a DB error yields ZERO rows for that binding — the
 * page renders its empty state instead of 500ing. A client's whole site must
 * not go dark because one collection was archived. Every such case warns into
 * the server log with the site and collection named, so it is diagnosable
 * rather than merely survivable.
 */
import { getSupabaseClient } from '@/lib/supabase/clientHelpers'
import { resolveCollection, projectPublicItem } from '@/lib/collections/routeHelpers'
import { resolveOrderSpec } from '@/lib/collections/ordering'
import { fetchPublicItems } from '@/lib/collections/publicItems'
import { bindingKey } from '@/lib/render/collectionBindings'

/**
 * Rows a binding gets when it declares no `data-limit`. Deliberately finite:
 * every row is inlined into the served HTML AND into `__NEXT_DATA__`, so an
 * unbounded binding on a 10k-row form inbox would ship a multi-megabyte page.
 * A site that genuinely needs more says so with `data-limit` (capped at 200 by
 * the scanner).
 */
export const DEFAULT_BINDING_LIMIT = 50

/**
 * @param {Object} args
 * @param {string} args.clientId `client_sites.id`
 * @param {string} args.siteSlug for log lines only
 * @param {Array<{collection, order, limit}>} args.bindings from findCollectionBindings
 * @returns {Promise<Map<string, Array>>} bindingKey() → public item rows
 */
export async function loadBoundCollections({ clientId, siteSlug, bindings }) {
  const rowsByKey = new Map()
  if (!clientId || !Array.isArray(bindings) || bindings.length === 0) return rowsByKey

  // One entry per DISTINCT (collection, order, limit): the same list bound
  // twice on a page (say in the body and in the footer) is one query.
  const wanted = new Map()
  for (const binding of bindings) {
    const key = bindingKey(binding)
    if (!wanted.has(key)) wanted.set(key, binding)
  }

  // Collection definitions are resolved once per collection name even when the
  // same name is bound with several orders.
  const definitions = new Map()
  const supabase = getSupabaseClient()

  for (const [key, binding] of wanted) {
    rowsByKey.set(key, [])

    if (!definitions.has(binding.collection)) {
      definitions.set(binding.collection, await resolveCollection(clientId, binding.collection))
    }
    const collection = definitions.get(binding.collection)
    if (!collection || !collection.public_read) {
      console.warn(
        `[collections] binding "${binding.collection}" on site ${siteSlug} resolved nothing readable ` +
        '(missing, archived, or public_read is off) — rendering its empty state'
      )
      continue
    }

    const { order, error: orderError } = resolveOrderSpec({
      requested: binding.order,
      settings: collection.settings,
      allowedFields: collection.public_read_fields,
    })
    if (orderError) {
      // A template asking for an order it may not have is an authoring bug, not
      // a visitor's problem: fall back to the collection's own order rather
      // than blanking the list, and say so.
      console.warn(
        `[collections] binding "${binding.collection}" on site ${siteSlug} declared ` +
        `data-order=${JSON.stringify(binding.order)}, which is malformed or not in public_read_fields — ` +
        'using the collection default'
      )
    }
    const effectiveOrder = orderError
      ? resolveOrderSpec({ settings: collection.settings, allowedFields: collection.public_read_fields }).order
      : order

    const limit = binding.limit || DEFAULT_BINDING_LIMIT
    const { rows, error } = await fetchPublicItems(supabase, {
      collectionId: collection.id,
      order: effectiveOrder,
      from: 0,
      to: limit - 1,
    })
    if (error) {
      console.error(`[collections] binding "${binding.collection}" on site ${siteSlug} failed:`, error.message)
      continue
    }
    rowsByKey.set(key, rows.map((row) => projectPublicItem(row, collection.public_read_fields)))
  }

  return rowsByKey
}

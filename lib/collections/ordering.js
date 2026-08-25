/**
 * Collection item ORDERING — the one place that decides what "first" means.
 *
 * Before this module every read path in every repo hardcoded `created_at DESC`
 * (W2C-render-binding §B). That is right for a form inbox and wrong for
 * everything a site actually renders: an events list ordered by row-creation
 * time shows "Herbal workshop (Sep 17)" above "Open house (Sep 3)" and no page
 * author can fix it, because the order is not theirs to express.
 *
 * Two layers, in precedence order:
 *   1. a per-request override — `?order=` on the public list route, or
 *      `data-order` on an SSR template binding;
 *   2. `site_collections.settings.default_order` — the collection's own
 *      declared order, so an events collection is right on every surface;
 *   3. `created_at:desc` — the historical default, so a collection that
 *      declares nothing renders EXACTLY as it did before this module existed.
 *
 * ALLOWLIST: on public surfaces a sort field must be `created_at`/`id` or a
 * member of `public_read_fields`. Sorting by a field the caller cannot read is
 * an oracle — repeated requests ordered by `internal_notes` leak its ordering.
 * PRIVILEGED surfaces (aidream's agent tools, matrx-frontend's admin API) pass
 * `allowAllFields: true` instead — they already read every field of every row,
 * so refusing to SORT by one would be theatre. This file is the reference
 * implementation of all three; the others are ports:
 *   - aidream/aidream/services/cms/collection_ordering.py  (canonical Python)
 *   - matrx-frontend/features/cms/collections/ordering.ts  (admin TS)
 * pinned to each other by `collection-ordering-rules.json` (`pnpm test:ordering`).
 *
 * DB-SIDE, ALWAYS. Sorting must happen in Postgres, not over a fetched page,
 * or `per_page=20` returns "the 20 newest, re-shuffled" instead of "the first
 * 20 in this order" — the exact bug this module exists to kill.
 *
 * KNOWN LIMIT — jsonb values compare as TEXT. `data->>starts_at` is a string,
 * so ordering is lexical. For ISO-8601 datetimes written in UTC (`...Z`, what
 * the platform emits and what every live row carries) lexical order IS
 * chronological, and for numbers stored as JSON numbers PostgREST still
 * compares the text form — so `10` sorts before `9`. Both are acceptable at v1
 * volumes for the string/date fields collections actually sort on, and both are
 * fixed the same way when they bite: a typed expression index + cast, which is
 * a DB change, not a change here. Do NOT "fix" it by sorting in JS — see above.
 */

/** What every collection ordered before ordering was configurable. */
export const DEFAULT_ORDER = 'created_at:desc'

/** Real columns on `site_collection_items`; everything else is a jsonb path. */
const REAL_COLUMNS = new Set(['created_at', 'id'])

const FIELD_RE = /^[A-Za-z0-9_-]{1,64}$/

/**
 * Parse a `field[:asc|desc]` spec.
 * @returns {{field: string, ascending: boolean}|null} null on anything malformed
 *   — callers fall back rather than guessing, and the public route 400s.
 */
export function parseOrderSpec(spec) {
  if (typeof spec !== 'string') return null
  const trimmed = spec.trim()
  if (!trimmed) return null
  const [field, direction = 'asc', ...rest] = trimmed.split(':')
  if (rest.length > 0) return null
  if (!FIELD_RE.test(field)) return null
  const dir = direction.trim().toLowerCase()
  if (dir !== 'asc' && dir !== 'desc') return null
  return { field, ascending: dir === 'asc' }
}

/**
 * Resolve the order for one read: requested → collection default → the
 * historical `created_at:desc`.
 *
 * @param {Object} args
 * @param {string} [args.requested] caller-supplied spec (`?order=`, `data-order`)
 * @param {Object} [args.settings] `site_collections.settings`
 * @param {string[]} [args.allowedFields] `public_read_fields` (public surfaces)
 * @param {boolean} [args.allowAllFields] privileged surfaces (agent/admin) that
 *   already read the whole row — never set this on a visitor-facing path
 * @returns {{order: {field, ascending}|null, error: string|null}}
 *   `error` is set ONLY for a caller-supplied spec that is malformed or not
 *   allowed — a bad `default_order` on the collection warns and falls back,
 *   because a typo in a setting must never 4xx a visitor's page.
 */
export function resolveOrderSpec({ requested, settings, allowedFields, allowAllFields = false } = {}) {
  const allowed = (field) =>
    allowAllFields ||
    REAL_COLUMNS.has(field) ||
    (Array.isArray(allowedFields) && allowedFields.includes(field))

  if (requested !== undefined && requested !== null && requested !== '') {
    const parsed = parseOrderSpec(requested)
    if (!parsed) return { order: null, error: 'invalid_order' }
    if (!allowed(parsed.field)) return { order: null, error: 'invalid_order' }
    return { order: parsed, error: null }
  }

  const declared = settings && typeof settings.default_order === 'string' ? settings.default_order : null
  if (declared) {
    const parsed = parseOrderSpec(declared)
    if (parsed && allowed(parsed.field)) return { order: parsed, error: null }
    console.warn(
      `[collections] ignoring unusable settings.default_order ${JSON.stringify(declared)} — ` +
      'must be `field[:asc|desc]` and readable on this surface'
    )
  }

  return { order: parseOrderSpec(DEFAULT_ORDER), error: null }
}

/** True for a real table column, false for a `data` jsonb path. */
export function isRealColumn(field) {
  return REAL_COLUMNS.has(field)
}

/** The Postgres/PostgREST column expression for a sort field. */
export function orderColumn(field) {
  return isRealColumn(field) ? field : `data->>${field}`
}

/**
 * Apply a resolved order to a supabase-js query.
 *
 * Two invariants, both load-bearing:
 *  - `id` is always the final tiebreak (same direction), so pagination is
 *    stable when the sort key ties — without it rows duplicate across pages
 *    and others vanish entirely.
 *  - `nullsFirst: false` in BOTH directions: a row missing the sort field
 *    sorts last, never leading the list. Postgres' default puts NULLs first on
 *    DESC, which would head an events list with the events that have no date.
 */
export function applyOrder(query, order) {
  const spec = order || parseOrderSpec(DEFAULT_ORDER)
  const q = query.order(orderColumn(spec.field), { ascending: spec.ascending, nullsFirst: false })
  return spec.field === 'id' ? q : q.order('id', { ascending: spec.ascending })
}

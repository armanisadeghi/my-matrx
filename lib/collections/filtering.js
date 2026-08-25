/**
 * Collection item FILTERING — the deliberately small vocabulary that lets a
 * list drop rows without becoming a query language.
 *
 * Ordering fixed "Herbal workshop (Sep 17) above Open house (Sep 3)". This
 * fixes the other half of the same flagship bug: with no filter, a past event
 * stays on the page forever and somebody has to hand-edit a site to remove it.
 * An events list that cannot say "upcoming only" is not an events list.
 *
 * THE VOCABULARY (W2C-render-binding §B — five operators and one literal, and
 * that is the whole language):
 *
 *   data-filter="starts_at:gte:now"                  upcoming events
 *   data-filter="published:eq:true"                  published testimonials
 *   data-filter="department:eq:cardiology"           profiles in one department
 *   data-filter="starts_at:gte:now,rank:lte:3"       comma-separated AND
 *
 * `field:op:value`; ops are `eq gt gte lt lte`; the literal value `now`
 * resolves server-side to the current instant as ISO-8601 UTC. Clauses are
 * ANDed. There is no OR, no negation and no nesting, on purpose — every one of
 * those turns an authoring attribute into a surface an agent can get wrong.
 *
 * ALLOWLIST — the same rule ordering uses, for the same reason: on public
 * surfaces a filter field must be `created_at`/`id` or a member of
 * `public_read_fields`. Filtering by a field the caller cannot read is an
 * oracle: `internal_notes:gte:m` narrows a list and leaks the field it cannot
 * print. Privileged surfaces pass `allowAllFields`.
 *
 * FAIL SOFT ON A SETTING, FAIL LOUD ON A REQUEST — again the same asymmetry
 * ordering already carries: a malformed `data-filter` in an author's template
 * warns and is DROPPED (the list renders unfiltered rather than the page
 * breaking); a malformed `?filter=` from a caller is a 400.
 *
 * KNOWN LIMIT — jsonb values compare as TEXT, exactly as they do for ordering.
 * For the ISO-8601 UTC datetimes the platform emits (`...Z`, what every live
 * row carries) lexical comparison IS chronological, so `starts_at:gte:now` is
 * correct. A row written with a numeric offset (`...-04:00`) would compare
 * wrong even though it is the same instant, and `10` compares below `9`. Both
 * are the same limit `ordering.js` documents and both are fixed the same way
 * when they bite: a typed expression index + cast, a DB change. Do NOT "fix"
 * it by filtering in JS — a filter applied after the page is fetched returns
 * "the first 50 rows, some hidden" instead of "the first 50 matching rows",
 * which is the identical class of bug that made DB-side ordering mandatory.
 */

/** Real columns on `site_collection_items`; everything else is a jsonb path. */
const REAL_COLUMNS = new Set(['created_at', 'id'])

/** The whole language. Values are the PostgREST operator names. */
export const FILTER_OPS = Object.freeze({
  eq: 'eq',
  gt: 'gt',
  gte: 'gte',
  lt: 'lt',
  lte: 'lte',
})

const FIELD_RE = /^[A-Za-z0-9_-]{1,64}$/

/** No single value may be longer than this — a filter is not a payload. */
const MAX_VALUE_LENGTH = 256

/** More clauses than this is not authoring, it is a query language. */
const MAX_CLAUSES = 8

/**
 * Parse one `field:op:value` clause.
 *
 * The value may itself contain `:` (an ISO-8601 datetime does), so only the
 * FIRST TWO separators are structural — everything after them is the value.
 *
 * @returns {{field: string, op: string, value: string}|null} null on anything
 *   malformed; callers decide whether that is a warning or a 400.
 */
export function parseFilterClause(clause) {
  if (typeof clause !== 'string') return null
  const trimmed = clause.trim()
  if (!trimmed) return null
  const first = trimmed.indexOf(':')
  if (first < 0) return null
  const second = trimmed.indexOf(':', first + 1)
  if (second < 0) return null
  const field = trimmed.slice(0, first)
  const op = trimmed.slice(first + 1, second).trim().toLowerCase()
  const value = trimmed.slice(second + 1)
  if (!FIELD_RE.test(field)) return null
  if (!Object.prototype.hasOwnProperty.call(FILTER_OPS, op)) return null
  if (value === '' || value.length > MAX_VALUE_LENGTH) return null
  return { field, op, value }
}

/**
 * Resolve a whole `data-filter` / `?filter=` spec.
 *
 * @param {Object} args
 * @param {string} [args.requested] comma-separated clauses
 * @param {string[]} [args.allowedFields] `public_read_fields` (public surfaces)
 * @param {boolean} [args.allowAllFields] privileged surfaces only
 * @param {Date} [args.now] injected for tests; defaults to the current instant
 * @returns {{filters: Array<{field, op, value}>, error: string|null}}
 *   `filters` is empty when nothing was requested. `error` is set for a
 *   malformed or disallowed spec — and `filters` is empty alongside it, so a
 *   caller that chooses to warn-and-continue renders UNFILTERED rather than
 *   half-filtered.
 */
export function resolveFilters({ requested, allowedFields, allowAllFields = false, now } = {}) {
  if (requested === undefined || requested === null || requested === '') {
    return { filters: [], error: null }
  }
  if (typeof requested !== 'string') return { filters: [], error: 'invalid_filter' }

  const clauses = requested.split(',').map((c) => c.trim()).filter(Boolean)
  if (clauses.length === 0) return { filters: [], error: 'invalid_filter' }
  if (clauses.length > MAX_CLAUSES) return { filters: [], error: 'invalid_filter' }

  const allowed = (field) =>
    allowAllFields ||
    REAL_COLUMNS.has(field) ||
    (Array.isArray(allowedFields) && allowedFields.includes(field))

  const nowIso = (now instanceof Date ? now : new Date()).toISOString()
  const filters = []
  for (const clause of clauses) {
    const parsed = parseFilterClause(clause)
    if (!parsed) return { filters: [], error: 'invalid_filter' }
    if (!allowed(parsed.field)) return { filters: [], error: 'invalid_filter' }
    filters.push({
      ...parsed,
      // `now` is the ONE literal. Resolved once per read so every clause in a
      // multi-clause filter compares against the same instant.
      value: parsed.value === 'now' ? nowIso : parsed.value,
    })
  }
  return { filters, error: null }
}

/** The Postgres/PostgREST column expression for a filter field. */
export function filterColumn(field) {
  return REAL_COLUMNS.has(field) ? field : `data->>${field}`
}

/**
 * Apply resolved filters to a supabase-js query. DB-SIDE, ALWAYS — see the
 * KNOWN LIMIT note above for why filtering a fetched page is not an option.
 */
export function applyFilters(query, filters) {
  let q = query
  for (const { field, op, value } of filters || []) {
    q = q.filter(filterColumn(field), FILTER_OPS[op], value)
  }
  return q
}

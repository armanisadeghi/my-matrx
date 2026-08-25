/**
 * Public collection endpoints (W2C-2 visitor runtime). Wire contract: DATA_API.md.
 *
 *   POST /api/sites/[site]/collections/[slug]/items  — visitor submit
 *     Gate order: method → site (slug) → X-Matrx-Site-Key (constant-time) →
 *     collection (public_write) → size caps → honeypot → validation →
 *     spam heuristics → idempotency key → atomic RPC submit_collection_item().
 *   GET  /api/sites/[site]/collections/[slug]/items  — public list
 *     No site key. public_read collections only; {id, created_at, data}
 *     projected through public_read_fields; paginated.
 *
 * All writes go through the Postgres function `submit_collection_item` via
 * supabase.rpc() — NEVER a hand-rolled count-then-insert (it races under
 * concurrency; the rate-limit/quota/upsert atomicity lives in the function —
 * aidream/db/migrations/cms/0015_site_collections.sql, W2C-design §5.2).
 *
 * Error-shape conventions follow the form-submissions.js ancestor
 * ({success, ...} JSON, console.error on 500) — but NOT its missing gating
 * and NOT its spoofable x-forwarded-for IP parsing (see routeHelpers.clientIp).
 */
import { getSupabaseClient } from '@/lib/supabase/clientHelpers'
import { validateItem } from '@/lib/collections/validateItem'
import { resolveOrderSpec } from '@/lib/collections/ordering'
import { fetchPublicItems } from '@/lib/collections/publicItems'
import { resolveFilters } from '@/lib/collections/filtering'
import {
  uniform404,
  constantTimeEqual,
  clientIp,
  resolveSite,
  resolveCollection,
  projectPublicItem,
  UUID_RE,
  intSetting,
} from '@/lib/collections/routeHelpers'

// ── CAPS defaults (per-collection overrides live in site_collections.settings;
//    W2C-design §5 — CAPS constants in the route module, no silent env flags) ──
const MAX_ITEM_BYTES = 65536 // settings.max_item_bytes override, hard ceiling below
const MAX_ITEM_BYTES_CEILING = 524288 // 512 KB — matches the bodyParser sizeLimit
const RATE_IP_PER_HOUR = 30 // settings.rate_limit_per_ip_per_hour
const RATE_SITE_PER_HOUR = 500 // settings.rate_limit_per_site_per_hour
const MAX_ITEMS = 100000 // settings.max_items (quota → quarantine, never reject)
const MAX_FIELDS = 200 // keys after flatten — not overridable
const MAX_SOURCE_URL_LENGTH = 2048
const MAX_USER_AGENT_LENGTH = 512
const SPAM_URL_THRESHOLD = 4 // ≥ this many http(s) URLs across string values ⇒ is_spam
const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

// Own the request-body cap explicitly (don't inherit Vercel's 1 MB default).
// The per-collection byte cap below is the real authority; this is the outer wall.
export const config = {
  api: {
    bodyParser: { sizeLimit: '512kb' },
  },
}

/** Count keys recursively ("after flatten") across nested objects/arrays. */
function countKeys(value) {
  if (Array.isArray(value)) {
    let n = 0
    for (const entry of value) n += countKeys(entry)
    return n
  }
  if (typeof value === 'object' && value !== null) {
    let n = 0
    for (const key of Object.keys(value)) {
      n += 1 + countKeys(value[key])
    }
    return n
  }
  return 0
}

/** Count http(s) URLs across every string value, recursively. */
function countUrls(value) {
  if (typeof value === 'string') {
    return (value.match(/https?:\/\//gi) || []).length
  }
  if (Array.isArray(value)) {
    let n = 0
    for (const entry of value) n += countUrls(entry)
    return n
  }
  if (typeof value === 'object' && value !== null) {
    let n = 0
    for (const key of Object.keys(value)) n += countUrls(value[key])
    return n
  }
  return 0
}

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') return await handleSubmit(req, res)
    if (req.method === 'GET') return await handleList(req, res)
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ success: false, error: 'method_not_allowed' })
  } catch (error) {
    console.error('[collections] route error:', error)
    return res.status(500).json({ success: false, error: 'internal_error' })
  }
}

// ── POST — visitor submit ────────────────────────────────────────────────────
async function handleSubmit(req, res) {
  const { site: siteSlug, slug: collectionSlug } = req.query

  // 1. Site. Uniform 404 for unknown site / bad key / unknown or non-public
  //    collection — identical body, no enumeration oracle.
  const site = await resolveSite(siteSlug)
  if (!site) return uniform404(res)

  // 2. Site data key (required on ALL public writes; W2C-design §5.3). A site
  //    with no key configured accepts no public writes at all.
  const presentedKey = req.headers['x-matrx-site-key']
  if (
    !site.data_api_key ||
    typeof presentedKey !== 'string' ||
    !constantTimeEqual(presentedKey, site.data_api_key)
  ) {
    return uniform404(res)
  }

  // 3. Collection — must exist, be active, and have opted into public writes.
  const collection = await resolveCollection(site.id, collectionSlug)
  if (!collection || !collection.public_write) return uniform404(res)

  const settings = collection.settings || {}
  const effective = {
    maxItemBytes: intSetting(settings, 'max_item_bytes', MAX_ITEM_BYTES, MAX_ITEM_BYTES_CEILING),
    ipLimit: intSetting(settings, 'rate_limit_per_ip_per_hour', RATE_IP_PER_HOUR),
    siteLimit: intSetting(settings, 'rate_limit_per_site_per_hour', RATE_SITE_PER_HOUR),
    maxItems: intSetting(settings, 'max_items', MAX_ITEMS),
    honeypotField: typeof settings.honeypot_field === 'string' ? settings.honeypot_field : null,
  }

  // 4. Body shape: {data, source_url?, idempotency_key?}; data = plain object.
  const body = req.body
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: 'invalid_request' })
  }
  const { data, source_url, idempotency_key } = body
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return res.status(400).json({ success: false, error: 'invalid_data' })
  }
  if (source_url !== undefined && source_url !== null && typeof source_url !== 'string') {
    return res.status(400).json({ success: false, error: 'invalid_source_url' })
  }

  // 5. Size caps — the ROUTE is the size authority (UTF-8 bytes of the data
  //    payload), not the validator.
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > effective.maxItemBytes) {
    return res.status(413).json({ success: false, error: 'payload_too_large' })
  }
  if (countKeys(data) > MAX_FIELDS) {
    return res.status(413).json({ success: false, error: 'too_many_fields' })
  }

  // 6. Honeypot — silent trap. A non-empty value in the named field flags the
  //    row and PROCEEDS: the response must be byte-shape-identical to a real
  //    success (spam rows are unreadable everywhere public, so the real row id
  //    leaks nothing).
  let isSpam = false
  let payload = data
  if (effective.honeypotField && Object.prototype.hasOwnProperty.call(data, effective.honeypotField)) {
    const trapValue = data[effective.honeypotField]
    if (trapValue !== undefined && trapValue !== null && trapValue !== '') {
      isSpam = true
    }
    // The honeypot is never a real field, so it must not reach the validator or
    // the stored row. On a STRICT collection, leaving it in made the validator
    // reject it as an unknown key — a 400 that NAMED the trap field, teaching
    // the bot exactly what to omit next time and inverting the silent-trap
    // contract (found live 2026-07-24). Stripping it keeps the trap silent in
    // both modes and keeps `data` clean of decoy values.
    payload = { ...data }
    delete payload[effective.honeypotField]
  }

  // 7. Field validation (JS twin of the canonical validator).
  //    Advisory: warnings ride the success response. Strict: reject 400.
  //    required-missing rejects in BOTH modes (inside validateItem).
  const validation = validateItem(collection.field_schema, payload, collection.validation_mode)
  if (!validation.ok) {
    return res.status(400).json({ success: false, errors: validation.errors })
  }

  // 8. Cheap spam heuristics — flag, never reject (W2C-design §5.6).
  if (!isSpam && countUrls(payload) >= SPAM_URL_THRESHOLD) {
    isSpam = true
  }

  // 9. Idempotency key: honored only on allow_upsert collections; must be a
  //    syntactically valid UUID there (400 otherwise — silently dropping a key
  //    the caller relies on would mint duplicate rows). On non-upsert
  //    collections the key is ignored entirely.
  let idempotencyKey = null
  if (idempotency_key !== undefined && idempotency_key !== null && collection.allow_upsert) {
    if (typeof idempotency_key !== 'string' || !UUID_RE.test(idempotency_key)) {
      return res.status(400).json({ success: false, error: 'invalid_idempotency_key' })
    }
    idempotencyKey = idempotency_key
  }

  // 10. The atomic write. Rate windows, quota-quarantine, upsert, and
  //     client_id derivation all live INSIDE the DB function.
  const supabase = getSupabaseClient()
  const { data: outcome, error } = await supabase.rpc('submit_collection_item', {
    p_collection_id: collection.id,
    p_data: payload,
    p_is_spam: isSpam,
    p_source_url: source_url ? String(source_url).slice(0, MAX_SOURCE_URL_LENGTH) : null,
    p_ip: clientIp(req),
    p_user_agent: (req.headers['user-agent'] || '').slice(0, MAX_USER_AGENT_LENGTH) || null,
    p_idempotency_key: idempotencyKey,
    p_allow_upsert: collection.allow_upsert,
    p_ip_limit: effective.ipLimit,
    p_site_limit: effective.siteLimit,
    p_max_items: effective.maxItems,
  })
  if (error) {
    console.error('[collections] submit RPC error:', error.message)
    return res.status(500).json({ success: false, error: 'internal_error' })
  }

  switch (outcome?.outcome) {
    case 'created':
    case 'updated':
    case 'quarantined':
      // Quarantined (over-quota triage) is DELIBERATELY indistinguishable from
      // created — a real customer's submission never sees a quota error.
      return res.status(201).json({ success: true, id: outcome.id, warnings: validation.warnings })
    case 'rate_limited':
      res.setHeader('Retry-After', '3600')
      return res.status(429).json({ success: false, error: 'rate_limited' })
    case 'not_found':
      return uniform404(res)
    default:
      console.error('[collections] unexpected RPC outcome:', outcome)
      return res.status(500).json({ success: false, error: 'internal_error' })
  }
}

// ── GET — public list ────────────────────────────────────────────────────────
async function handleList(req, res) {
  const { site: siteSlug, slug: collectionSlug } = req.query

  // Reads need NO site key — public_read is the sole (double-opt-in) gate.
  const site = await resolveSite(siteSlug)
  if (!site) return uniform404(res)

  const collection = await resolveCollection(site.id, collectionSlug)
  if (!collection || !collection.public_read) return uniform404(res)

  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const perPageRaw = parseInt(req.query.per_page, 10) || DEFAULT_PER_PAGE
  const perPage = Math.min(Math.max(1, perPageRaw), MAX_PER_PAGE)
  const from = (page - 1) * perPage

  // Order: `?order=field[:asc|desc]` → the collection's own
  // `settings.default_order` → `created_at:desc` (what every collection did
  // before ordering was configurable). Sort fields are restricted to
  // `public_read_fields` + created_at/id — ordering by a field the caller
  // cannot read is an oracle. The stable id tiebreak lives in applyOrder().
  const { order, error: orderError } = resolveOrderSpec({
    requested: typeof req.query.order === 'string' ? req.query.order : undefined,
    settings: collection.settings,
    allowedFields: collection.public_read_fields,
  })
  if (orderError) {
    return res.status(400).json({ success: false, error: orderError })
  }

  // Filter: `?filter=field:op:value[,…]`, ops `eq gt gte lt lte`, plus the one
  // literal `now`. Same allowlist as the order, for the same reason — narrowing
  // a list by a field the caller cannot read leaks that field's values. A bad
  // CALLER spec is a 400 here; the SSR binder warns and drops it instead,
  // because an author's typo must not break a visitor's page.
  const { filters, error: filterError } = resolveFilters({
    requested: typeof req.query.filter === 'string' ? req.query.filter : undefined,
    allowedFields: collection.public_read_fields,
  })
  if (filterError) {
    return res.status(400).json({ success: false, error: filterError })
  }

  const supabase = getSupabaseClient()
  const { rows, error } = await fetchPublicItems(supabase, {
    collectionId: collection.id,
    order,
    filters,
    from,
    to: from + perPage - 1,
  })
  if (error) {
    console.error('[collections] list error:', error.message)
    return res.status(500).json({ success: false, error: 'internal_error' })
  }

  return res.status(200).json({
    success: true,
    page,
    per_page: perPage,
    items: (rows || []).map((row) => projectPublicItem(row, collection.public_read_fields)),
  })
}

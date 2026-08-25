#!/usr/bin/env node
/**
 * Fixture runner for the collection ORDERING twin.
 *
 * Runs every case in lib/collections/collection-ordering-rules.json (copied
 * verbatim from aidream/aidream/services/cms/collection-ordering-rules.json —
 * never edit the copy) against lib/collections/ordering.js.
 *
 *   pnpm test:ordering
 *
 * Three implementations agree on what "first" means only because this fixture
 * pins them: this file (visitor HTTP + SSR), aidream's collection_ordering.py
 * (agent surface, canonical), and matrx-frontend's ordering.ts (admin API).
 * Before they were pinned, an events collection declaring `starts_at:asc`
 * rendered chronologically to a visitor and newest-first everywhere else.
 *
 * Exit 1 on any failure OR if the fixture is missing — an unpinned twin is the
 * dangerous state, not a pass. Same shape as test-validate-item.mjs on purpose.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = join(root, 'lib/collections/collection-ordering-rules.json')

const CANONICAL_FIXTURE =
  '/Users/armanisadeghi/code/aidream/aidream/services/cms/collection-ordering-rules.json'

function sha1(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex')
}

if (!existsSync(fixturePath)) {
  console.error(`FAIL: fixture missing at ${fixturePath} — the ordering twin is UNPINNED.`)
  console.error(`      cp ${CANONICAL_FIXTURE} ${fixturePath}`)
  process.exit(1)
}

if (existsSync(CANONICAL_FIXTURE)) {
  if (sha1(CANONICAL_FIXTURE) !== sha1(fixturePath)) {
    console.error('FAIL: our copy has DRIFTED from aidream\'s canonical ordering fixture.')
    console.error(`      cp ${CANONICAL_FIXTURE} ${fixturePath}`)
    console.error('      then re-run — ordering.js may need updating too.')
    process.exit(1)
  }
} else {
  console.warn(`NOTE: no aidream checkout at ${CANONICAL_FIXTURE} — freshness NOT verified.`)
}

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const { DEFAULT_ORDER, isRealColumn, parseOrderSpec, resolveOrderSpec } = await import(
  join(root, 'lib/collections/ordering.js')
)

let total = 0
let failures = 0
const fail = (group, name, detail) => {
  failures++
  console.error(`  ✗ [${group}] ${name}`)
  console.error(`      ${detail}`)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── constants ───────────────────────────────────────────────────────────────
total++
if (fixture.default_order !== DEFAULT_ORDER)
  fail('constants', 'default_order', `fixture ${fixture.default_order} vs twin ${DEFAULT_ORDER}`)
for (const field of fixture.real_columns ?? []) {
  total++
  if (!isRealColumn(field)) fail('constants', `real_column:${field}`, 'not a real column in the twin')
}

// ── parse_cases ─────────────────────────────────────────────────────────────
for (const c of fixture.parse_cases ?? []) {
  total++
  const got = parseOrderSpec(c.spec)
  if (!same(got, c.expect))
    fail('parse', c.name, `expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`)
}

// ── resolve_cases ───────────────────────────────────────────────────────────
// The twin warns on an unusable setting by design — silenced so a passing run
// stays readable.
const realWarn = console.warn
console.warn = () => {}
try {
  for (const c of fixture.resolve_cases ?? []) {
    total++
    const got = resolveOrderSpec({
      requested: c.requested,
      settings: c.settings,
      allowedFields: c.allowed_fields,
      allowAllFields: c.allow_all_fields,
    })
    if (!same(got, c.expect))
      fail('resolve', c.name, `expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`)
  }
} finally {
  console.warn = realWarn
}

// ── field_classification_cases ──────────────────────────────────────────────
for (const c of fixture.field_classification_cases ?? []) {
  total++
  const got = isRealColumn(c.field)
  if (got !== c.is_real_column)
    fail('classification', c.field, `expected is_real_column=${c.is_real_column}, got ${got}`)
}

if (total === 0) {
  console.error('FAIL: fixture parsed but contained zero cases — inspect its shape.')
  process.exit(1)
}

console.log(`collection-ordering twin: ${total - failures}/${total} fixture cases passed`)
if (failures > 0) {
  console.error(`FAIL: ${failures} case(s) diverge — fix lib/collections/ordering.js, never the fixture.`)
  process.exit(1)
}

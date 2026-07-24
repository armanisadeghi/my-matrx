#!/usr/bin/env node
/**
 * Fixture runner for the collection-item validator twin (CW3 drift guard).
 *
 * Runs EVERY case in lib/collections/collection-validation-rules.json (copied
 * verbatim from aidream/aidream/services/cms/collection-validation-rules.json —
 * the Python validate_item owns the canonical semantics; never edit the copy)
 * against lib/collections/validateItem.js, plus the byte-cap counter cases the
 * ROUTE enforces (pages/api/sites/.../items/index.js uses the same counters).
 *
 *   pnpm test:collections
 *
 * Fixture contract (from the fixture's $comment):
 *  - validate_cases: {name, field_schema, data, validation_mode,
 *    expect: {ok, rejected_fields, warning_fields}} — rejected/warning are
 *    SORTED, DEDUPED lists of field KEYS.
 *  - utf8_byte_length_cases: {name, text, expect_bytes} — UTF-8 byte counter.
 *  - item_byte_size_cases: {name, data, expect_bytes} — compact JSON bytes,
 *    no ascii escaping (i.e. Buffer.byteLength(JSON.stringify(data))).
 *
 * Exit 1 on any failure OR if the fixture file is missing — a missing fixture
 * means the twin is UNPINNED, which is the dangerous state, not a pass.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = join(root, 'lib/collections/collection-validation-rules.json')
const validatorPath = join(root, 'lib/collections/validateItem.js')

// validateItem.js is ESM syntax in a CJS-typed package (Next transpiles it);
// it is pure + import-free, so load it via a data: URI for Node.
const validatorSource = readFileSync(validatorPath, 'utf8')
const { validateItem } = await import(
  'data:text/javascript;base64,' + Buffer.from(validatorSource).toString('base64')
)

let fixture
try {
  fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
} catch {
  console.error(`FAIL: fixture not readable at ${fixturePath}`)
  console.error(
    'The validator twin is UNPINNED without it. Copy it verbatim from ' +
      'aidream/aidream/services/cms/collection-validation-rules.json (see DATA_API.md).'
  )
  process.exit(1)
}

function sortedDedupedKeys(list) {
  return [...new Set((list || []).map((entry) => entry.key))].sort()
}

let total = 0
let failures = 0
function check(group, name, problems) {
  total++
  if (problems.length > 0) {
    failures++
    console.error(`✗ [${group}] ${name}`)
    for (const p of problems) console.error(`    ${p}`)
  }
}

// ── 1. validate_cases ────────────────────────────────────────────────────────
for (const c of fixture.validate_cases || []) {
  const result = validateItem(c.field_schema, c.data, c.validation_mode)
  const problems = []
  if (c.expect.ok !== undefined && result.ok !== c.expect.ok) {
    problems.push(`ok: expected ${c.expect.ok}, got ${result.ok}`)
  }
  if (c.expect.rejected_fields !== undefined) {
    const got = sortedDedupedKeys(result.errors)
    const want = [...c.expect.rejected_fields].sort()
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(`rejected_fields: expected [${want}], got [${got}]`)
    }
  }
  if (c.expect.warning_fields !== undefined) {
    const got = sortedDedupedKeys(result.warnings)
    const want = [...c.expect.warning_fields].sort()
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push(`warning_fields: expected [${want}], got [${got}]`)
    }
  }
  check('validate', c.name, problems)
}

// ── 2. utf8_byte_length_cases (the route's string byte counter) ─────────────
for (const c of fixture.utf8_byte_length_cases || []) {
  const got = Buffer.byteLength(c.text, 'utf8')
  check('utf8_bytes', c.name, got === c.expect_bytes ? [] : [`expected ${c.expect_bytes} bytes, got ${got}`])
}

// ── 3. item_byte_size_cases (the route's item size authority) ───────────────
for (const c of fixture.item_byte_size_cases || []) {
  const got = Buffer.byteLength(JSON.stringify(c.data), 'utf8')
  check('item_bytes', c.name, got === c.expect_bytes ? [] : [`expected ${c.expect_bytes} bytes, got ${got}`])
}

if (total === 0) {
  console.error('FAIL: fixture parsed but contained zero cases — inspect its shape.')
  process.exit(1)
}
console.log(`${total - failures}/${total} fixture cases passed`)
if (failures > 0) {
  console.error(`FAIL: ${failures} case(s) diverge from the canonical validator — fix validateItem.js (never the fixture).`)
  process.exit(1)
}

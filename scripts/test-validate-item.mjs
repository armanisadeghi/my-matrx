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
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = join(root, 'lib/collections/collection-validation-rules.json')
const validatorPath = join(root, 'lib/collections/validateItem.js')

// ── Freshness guard: is our COPY still the canonical fixture? ────────────────
// The suite below proves the JS twin matches the fixture — it says nothing
// about whether the fixture is current. If aidream adds cases (it has, twice)
// and this copy is not re-synced, every test still passes while the two
// validators quietly disagree on the new cases. That is the exact failure this
// whole fixture exists to prevent, so drift is a FAILURE, not a warning.
//
// Checked only when the sibling checkout is present (a developer machine); a
// standalone clone skips it rather than failing on something it cannot see.
const CANONICAL_FIXTURE =
  '/Users/armanisadeghi/code/aidream/aidream/services/cms/collection-validation-rules.json'

function sha1(path) {
  return createHash('sha1').update(readFileSync(path)).digest('hex')
}

function checkFixtureFreshness() {
  if (!existsSync(CANONICAL_FIXTURE)) {
    console.log('· canonical fixture not on this machine — freshness check skipped')
    return true
  }
  const ours = sha1(fixturePath)
  const canonical = sha1(CANONICAL_FIXTURE)
  if (ours === canonical) {
    console.log(`✓ fixture matches canonical (${ours.slice(0, 12)})`)
    return true
  }
  console.error('✗ FIXTURE DRIFT — this copy is not the canonical fixture.')
  console.error(`    ours:      ${ours}`)
  console.error(`    canonical: ${canonical}`)
  console.error(`    fix: cp ${CANONICAL_FIXTURE} ${fixturePath}`)
  console.error('    then re-run; new cases may reveal real validator divergences.')
  return false
}

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

// The complete issue-code vocabulary (ruling (i)) — identical in all three
// implementations, documented in DATA_API.md as a public wire contract. A code
// outside this set is a divergence even if every field list still matches.
const ISSUE_CODES = new Set([
  'required_missing', 'unknown_key', 'type_mismatch',
  'max_length', 'out_of_range', 'invalid_option',
])

/**
 * Sorted [key, code] pairs — NOT deduped, so issue MULTIPLICITY is pinned too
 * (ruling (j)). Element-wise comparison, matching Python's list ordering; the
 * default Array#sort would compare the joined "key,code" string instead.
 */
function sortedIssuePairs(list) {
  return (list || [])
    .map((entry) => [entry.key, entry.code])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
}

/** Compare against the fixture's expectation; a MISSING expectation fails —
 *  silently skipping it is how the fixture stayed blind to codes for so long. */
function checkIssues(problems, label, got, want) {
  if (want === undefined) {
    problems.push(`${label}: fixture case has no ${label} — re-copy the canonical fixture`)
    return
  }
  const wantSorted = want
    .map((p) => [p[0], p[1]])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
  if (JSON.stringify(got) !== JSON.stringify(wantSorted)) {
    problems.push(`${label}: expected ${JSON.stringify(wantSorted)}, got ${JSON.stringify(got)}`)
  }
  for (const [, code] of got) {
    if (!ISSUE_CODES.has(code)) problems.push(`${label}: undeclared issue code "${code}"`)
  }
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
  // (key, code) pairs — the assertion that can actually SEE a code-vocabulary
  // or multiplicity divergence. Field lists cannot, which is how Python's
  // coarse `constraint_violation` and its short-circuit survived for months.
  checkIssues(problems, 'rejected_issues', sortedIssuePairs(result.errors), c.expect.rejected_issues)
  checkIssues(problems, 'warning_issues', sortedIssuePairs(result.warnings), c.expect.warning_issues)
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
if (!checkFixtureFreshness()) process.exit(1)

#!/usr/bin/env node
/**
 * Fixture runner for the collection-item validator twin (CW3 drift guard).
 *
 * Runs EVERY case in lib/collections/collection-validation-rules.json (copied
 * verbatim from aidream/aidream/services/cms/ — the Python side owns the
 * canonical semantics) against lib/collections/validateItem.js.
 *
 *   pnpm test:collections
 *
 * Case shape (the house url-rules.json pattern): top-level "*cases" arrays of
 * {name, input, expect}. input: {field_schema|schema, data, mode|validation_mode}.
 * expect: any of {ok|valid, errors, warnings} — errors/warnings compared as
 * order-insensitive (key, code) sets when entries are objects, or as code/key
 * string sets when entries are strings.
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
} catch (err) {
  console.error(`FAIL: fixture not readable at ${fixturePath}`)
  console.error(
    'The validator twin is UNPINNED without it. Copy it verbatim from ' +
      'aidream/aidream/services/cms/collection-validation-rules.json (see DATA_API.md).'
  )
  process.exit(1)
}

// Collect every case from any top-level array whose key mentions "cases",
// falling back to any top-level array of {input, expect} objects.
const cases = []
for (const [key, value] of Object.entries(fixture)) {
  if (!Array.isArray(value)) continue
  if (!/cases?$/i.test(key) && !value.every((c) => c && c.input && c.expect)) continue
  for (const c of value) {
    if (c && typeof c === 'object' && c.input && c.expect) cases.push({ group: key, ...c })
  }
}
if (cases.length === 0) {
  console.error('FAIL: fixture parsed but contained zero recognizable cases — inspect its shape.')
  process.exit(1)
}

function problemSet(list) {
  // Normalize an errors/warnings list to a sorted multiset of "key:code" tags.
  return (list || [])
    .map((entry) => {
      if (typeof entry === 'string') return entry
      const key = entry.key ?? entry.field ?? ''
      const code = entry.code ?? entry.error ?? entry.type ?? ''
      return `${key}:${code}`
    })
    .sort()
}

let failures = 0
for (const testCase of cases) {
  const input = testCase.input
  const schema = input.field_schema ?? input.schema ?? []
  const mode = input.mode ?? input.validation_mode ?? 'advisory'
  const result = validateItem(schema, input.data ?? {}, mode)

  const problems = []
  const expect = testCase.expect

  const expectedOk = expect.ok ?? expect.valid
  if (expectedOk !== undefined && result.ok !== expectedOk) {
    problems.push(`ok: expected ${expectedOk}, got ${result.ok}`)
  }
  if (expect.errors !== undefined) {
    const want = problemSet(expect.errors)
    const got = problemSet(result.errors)
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      problems.push(`errors: expected [${want}], got [${got}]`)
    }
  }
  if (expect.warnings !== undefined) {
    const want = problemSet(expect.warnings)
    const got = problemSet(result.warnings)
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      problems.push(`warnings: expected [${want}], got [${got}]`)
    }
  }

  if (problems.length > 0) {
    failures++
    console.error(`✗ [${testCase.group}] ${testCase.name || '(unnamed)'}`)
    for (const p of problems) console.error(`    ${p}`)
  }
}

console.log(`${cases.length - failures}/${cases.length} fixture cases passed`)
if (failures > 0) {
  console.error(`FAIL: ${failures} case(s) diverge from the canonical validator — fix validateItem.js (never the fixture).`)
  process.exit(1)
}

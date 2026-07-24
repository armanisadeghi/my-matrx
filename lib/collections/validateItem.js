/**
 * validateItem — the JS twin of aidream's canonical collection-item validator
 * (aidream/services/cms/ — CW3). Pure function, no I/O, no env.
 *
 * The aidream (Python) side owns the canonical semantics; this twin is pinned
 * to it by the shared language-neutral fixture `collection-validation-rules.json`
 * (copied verbatim from aidream/aidream/services/cms/ — see DATA_API.md
 * "fixture-twin contract"). Run the fixture suite with `pnpm test:collections`.
 *
 * Normative definitions (W2C-design §2.3, adversarial finding 9):
 *   - `max_length` counts Unicode CODE POINTS ([...str].length), never UTF-16
 *     units (.length) — "𝒳".length is 2, but it is ONE code point.
 *   - Byte caps are NOT this function's job: the ROUTE is the size authority
 *     (UTF-8 bytes of JSON.stringify(data)).
 *   - `datetime` accepts ONLY strict ISO-8601 (regex + calendar sanity check);
 *     bare `new Date(str)` permissive parsing is forbidden.
 *   - `number` must be a JSON number: `"5"` is a mismatch for a number field;
 *     NaN/Infinity are rejected (JSON cannot carry them, but guard anyway).
 *   - `richtext` never appears on public_write collections (the definition
 *     layer in aidream forbids the combination — content-guard sanitization is
 *     Python-side and the visitor path is aidream-free by design), so at THIS
 *     layer richtext is validated exactly like text (string + length only).
 *
 * Modes (W2C-design §2.3):
 *   - advisory (default): unknown keys pass silently; type/constraint
 *     mismatches are recorded as WARNINGS; only required-missing rejects.
 *   - strict: unknown keys and type/constraint mismatches reject too.
 *
 * @param {Array<Object>} fieldSchema - [{key,label,type,required?,max_length?,min?,max?,options?}]
 * @param {Object} data - the submitted item data (plain object)
 * @param {('advisory'|'strict')} mode
 * @returns {{ok: boolean, errors: Array<{key:string,code:string,message:string}>, warnings: Array<{key:string,code:string,message:string}>}}
 */

const FIELD_TYPES = new Set([
  'text', 'richtext', 'number', 'boolean', 'email', 'url', 'datetime', 'select', 'json',
])

// Strict ISO-8601: date, or date + T time (seconds/fraction optional) with an
// optional Z / ±hh:mm offset. Anything else — RFC 2822 dates, `Date.parse`
// liberalism, bare times — is a mismatch.
const ISO_8601_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:Z|[+-]\d{2}:\d{2})?)?$/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function codePointLength(str) {
  // Counts Unicode code points, NOT UTF-16 code units.
  return [...str].length
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isValidIso8601(value) {
  const m = ISO_8601_RE.exec(value)
  if (!m) return false
  const [, y, mo, d, h, mi, s] = m
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  // Calendar sanity: round-trip through Date in UTC and compare Y-M-D
  // (catches 2024-02-31 etc. that the regex alone would pass).
  const dt = new Date(Date.UTC(Number(y), month - 1, day))
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return false
  }
  if (h !== undefined) {
    if (Number(h) > 23 || Number(mi) > 59) return false
    if (s !== undefined && Number(s) > 59) return false
  }
  return true
}

/**
 * Type check a single value against a field def.
 * @returns {null | {code: string, message: string}} null = OK
 */
function checkType(field, value) {
  const { type } = field
  switch (type) {
    case 'text':
    case 'richtext': {
      if (typeof value !== 'string') {
        return { code: 'type_mismatch', message: `${field.key} must be a string` }
      }
      return null
    }
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { code: 'type_mismatch', message: `${field.key} must be a finite JSON number` }
      }
      return null
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        return { code: 'type_mismatch', message: `${field.key} must be a boolean` }
      }
      return null
    }
    case 'email': {
      if (typeof value !== 'string' || !EMAIL_RE.test(value)) {
        return { code: 'type_mismatch', message: `${field.key} must be a valid email address` }
      }
      return null
    }
    case 'url': {
      if (typeof value !== 'string') {
        return { code: 'type_mismatch', message: `${field.key} must be a URL string` }
      }
      let parsed
      try {
        parsed = new URL(value)
      } catch {
        return { code: 'type_mismatch', message: `${field.key} must be a valid URL` }
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { code: 'type_mismatch', message: `${field.key} must be an http(s) URL` }
      }
      return null
    }
    case 'datetime': {
      if (typeof value !== 'string' || !isValidIso8601(value)) {
        return { code: 'type_mismatch', message: `${field.key} must be a strict ISO-8601 datetime` }
      }
      return null
    }
    case 'select': {
      const options = Array.isArray(field.options) ? field.options : []
      if (!options.includes(value)) {
        return { code: 'invalid_option', message: `${field.key} must be one of the configured options` }
      }
      return null
    }
    case 'json': {
      // Any JSON value is acceptable.
      return null
    }
    default: {
      // Unknown field type in the DEFINITION — a definition-layer bug, not the
      // submitter's fault. Treat as unvalidatable: pass the value.
      return null
    }
  }
}

/** Constraint checks that apply after the type check passed. */
function checkConstraints(field, value) {
  const problems = []
  if (typeof value === 'string' && Number.isInteger(field.max_length) && field.max_length >= 0) {
    if (codePointLength(value) > field.max_length) {
      problems.push({
        code: 'max_length',
        message: `${field.key} exceeds max_length ${field.max_length} (code points)`,
      })
    }
  }
  if (field.type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    if (typeof field.min === 'number' && value < field.min) {
      problems.push({ code: 'out_of_range', message: `${field.key} is below min ${field.min}` })
    }
    if (typeof field.max === 'number' && value > field.max) {
      problems.push({ code: 'out_of_range', message: `${field.key} is above max ${field.max}` })
    }
  }
  return problems
}

function isMissing(value) {
  // Absent, null, or empty string count as "not provided" for `required`.
  return value === undefined || value === null || value === ''
}

export function validateItem(fieldSchema, data, mode = 'advisory') {
  const errors = []
  const warnings = []
  const strict = mode === 'strict'

  const schema = Array.isArray(fieldSchema) ? fieldSchema : []
  const byKey = new Map()
  for (const field of schema) {
    if (field && typeof field.key === 'string' && FIELD_TYPES.has(field.type)) {
      byKey.set(field.key, field)
    } else if (field && typeof field.key === 'string') {
      // Keep the key known (so it isn't flagged unknown) even if type is bad.
      byKey.set(field.key, { ...field, type: '_unvalidatable' })
    }
  }

  // 1. required-missing — rejects in BOTH modes.
  for (const field of byKey.values()) {
    if (field.required && isMissing(data[field.key])) {
      errors.push({
        key: field.key,
        code: 'required_missing',
        message: `${field.key} is required`,
      })
    }
  }

  // 2. unknown keys — strict rejects; advisory passes silently.
  for (const key of Object.keys(data)) {
    if (!byKey.has(key)) {
      if (strict) {
        errors.push({ key, code: 'unknown_key', message: `${key} is not a defined field` })
      }
    }
  }

  // 3. type + constraint checks on provided values.
  for (const [key, field] of byKey.entries()) {
    const value = data[key]
    if (isMissing(value)) continue // required-missing already handled

    const typeProblem = checkType(field, value)
    if (typeProblem) {
      const entry = { key, ...typeProblem }
      if (strict) errors.push(entry)
      else warnings.push(entry)
      continue // constraints are meaningless on a mistyped value
    }
    for (const problem of checkConstraints(field, value)) {
      const entry = { key, ...problem }
      if (strict) errors.push(entry)
      else warnings.push(entry)
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

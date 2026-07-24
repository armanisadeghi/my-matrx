/**
 * validateItem — the JS twin of aidream's canonical collection-item validator
 * (aidream/services/cms/collection_validation.py — CW3). Pure function, no I/O,
 * no env.
 *
 * The aidream (Python) side owns the canonical semantics; this twin is pinned
 * to it by the shared language-neutral fixture `collection-validation-rules.json`
 * (copied verbatim from aidream/aidream/services/cms/ — see DATA_API.md
 * "fixture-twin contract"). Run the fixture suite with `pnpm test:collections`.
 * Every rule below is stated in the same words in the Python docstring; change
 * one ⇒ change both ⇒ change the fixture ⇒ run BOTH suites.
 *
 * Normative definitions (W2C-design §2.3, adversarial finding 9, plus the
 * 2026-07-23 twin-divergence rulings (a)–(g)):
 *   - `max_length` counts Unicode CODE POINTS ([...str].length), never UTF-16
 *     units (.length) — "𝒳".length is 2, but it is ONE code point — and it
 *     applies to EVERY string value whatever type the field declares (ruling
 *     (b)): max_length on an email/url/select/datetime/json field is enforced
 *     exactly like on text. A declared constraint is never silently ignored.
 *   - Byte caps are NOT this function's job: the ROUTE is the size authority
 *     (UTF-8 bytes of JSON.stringify(data)).
 *   - `datetime` accepts ONLY strict ISO-8601 (regex + an explicit civil
 *     calendar check); bare `new Date(str)` permissive parsing is forbidden —
 *     and so is `Date.UTC` for the calendar check, because it maps years 0–99
 *     onto 1900–1999 and would reject the valid year "0050".
 *   - `number` must be a finite JSON number: `"5"` is a mismatch; NaN/Infinity
 *     reject; and a literal JSON.parse would turn into Infinity rejects on BOTH
 *     twins (ruling (g)) — Python refuses the value it could still represent
 *     exactly. Corollary: every numeric comparison (value, `min`, `max`,
 *     `max_length`) happens on the IEEE-754 DOUBLE, which is free here and is
 *     what Python's `_as_double` exists to reproduce. The boundary is
 *     JSON.parse's round-half-to-even threshold (2**1024 - 2**970), NOT
 *     1.797…e308: the integer just past Number.MAX_VALUE rounds DOWN to a
 *     finite double and passes on both sides.
 *   - `richtext` never appears on public_write collections (the definition
 *     layer in aidream forbids the combination — content-guard sanitization is
 *     Python-side and the visitor path is aidream-free by design), so at THIS
 *     layer richtext is validated exactly like text (string + length only).
 *
 * Empty string (ruling (a) — the highest-traffic real-world shape, since
 * browsers submit "" for untouched inputs): "" counts as "not provided" ONLY
 * for the string-ish types (text/richtext/email/url/datetime/select). On a
 * `number` or `boolean` field "" is a present value of the WRONG TYPE — a type
 * mismatch, never an absence, so a required numeric field can never be
 * satisfied by a blank. On a `json` field "" is a valid JSON value and passes.
 * (This twin used to apply "empty == missing" to every type; that was the bug.)
 *
 * Malformed field_schema (ruling (f)): aidream rejects bad shapes at
 * create/update time, but a version restore or a direct DB write can bring them
 * back, so both twins are defensive identically — a malformed constraint is
 * IGNORED (treated as absent), never silently reinterpreted. See
 * declaredMaxLength / declaredBound / declaredOptions below. A field whose
 * `key` is not a NON-EMPTY STRING is skipped entirely (its data key then reads
 * as an unknown key in strict mode).
 *
 * Regex dialect (rulings (c)/(d)/(e)): `url` uses the SAME regex as Python —
 * `new URL()` is forbidden here, it accepts `HTTP://`, `Https://`, leading
 * whitespace, `http:/x` and embedded tabs that the canonical regex rejects.
 * No `\s` in a shared pattern (JS counts U+FEFF as whitespace and Python does
 * not; Python counts U+001C–U+001F/U+0085 and JS does not) — WS_CLASS below is
 * the contract. JS `$` is the normative end anchor (Python must use `\Z`, since
 * its `$` also matches before a trailing newline: "a@b.co\n" is NOT an email).
 * Fractional seconds accept up to 9 digits.
 *
 * `required` (ruling (h)): constrains ONLY when it is the literal boolean
 * `true`. `1`, `"true"`, `[]`, `{}`, `0`, `null` are MALFORMED and IGNORED,
 * exactly like a malformed max_length. Never `if (field.required)` — JS truthy
 * and Python truthy disagree about `[]`/`{}` (368 divergences per 5,000 random
 * cases, the largest ever measured on this seam).
 *
 * Issue shape — a PUBLIC WIRE CONTRACT (ruling (i)): the route returns these
 * objects verbatim to the browser and DATA_API.md documents them. Every twin
 * emits `{key, code, message}` (the property is `key`, never `field`) with
 * `code` drawn from exactly six values:
 *   required_missing | unknown_key | type_mismatch
 *   max_length | out_of_range | invalid_option
 * EVERY constraint failure on a field is reported, not just the first (ruling
 * (j)) — a form UI wants to show them all at once. A TYPE mismatch still
 * short-circuits its own field's constraint checks.
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

// String-typed field types: for these — and ONLY these — "" counts as missing.
const STRING_TYPES = new Set(['text', 'richtext', 'email', 'url', 'datetime', 'select'])

// The normative whitespace class. NEVER use `\s` in a shared format regex.
const WS_CLASS =
  '\\t\\n\\x0b\\x0c\\r \\x1c-\\x1f\\x85\\xa0' +
  '\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff'

// Strict ISO-8601: date, or date + T time (seconds/fraction optional) with an
// optional Z / ±hh:mm offset. Anything else — RFC 2822 dates, `Date.parse`
// liberalism, bare times — is a mismatch.
const ISO_8601_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:Z|([+-]\d{2}):(\d{2}))?)?$/

const EMAIL_RE = new RegExp(`^[^@${WS_CLASS}]+@[^@${WS_CLASS}]+\\.[^@${WS_CLASS}]+$`)
const URL_RE = new RegExp(`^https?://[^${WS_CLASS}]+$`)

// Largest finite IEEE-754 double — the shared "this number survived JSON.parse"
// bound (ruling (g)). Number.MAX_VALUE, spelled out so both twins read alike.
const FLOAT_MAX = 1.7976931348623157e308

function codePointLength(str) {
  // Counts Unicode code points, NOT UTF-16 code units.
  return [...str].length
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function daysInMonth(year, month) {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

function isValidIso8601(value) {
  const m = ISO_8601_RE.exec(value)
  if (!m) return false
  // Groups: 1 y, 2 mo, 3 d, 4 h, 5 mi, 6 s, 7 fraction (skipped), 8 offH, 9 offM
  const [, y, mo, d, h, mi, s, , offH, offM] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  // Proleptic Gregorian, years 1–9999 (Python's date() bounds). Computed by
  // hand — Date.UTC(50, ...) means 1950, which would reject the valid "0050".
  if (year < 1) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > daysInMonth(year, month)) return false
  if (h !== undefined) {
    if (Number(h) > 23 || Number(mi) > 59) return false
    if (s !== undefined && Number(s) > 59) return false
  }
  if (offH !== undefined) {
    if (Math.abs(Number(offH)) > 23 || Number(offM) > 59) return false
  }
  return true
}

/**
 * Normative `max_length` reader (ruling (f)) — constrains ONLY when the
 * declared value is a non-negative INTEGRAL JSON number. `-1`, `true`, `"5"`,
 * `null`, `2.5`, NaN/Infinity are malformed → IGNORED (never reinterpreted).
 * `2.0` is honoured as `2`: JSON cannot distinguish it from `2`, so it is the
 * only choice both twins can make identically.
 * @returns {number|null}
 */
function declaredMaxLength(field) {
  const raw = field.max_length
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return null
  return raw
}

/**
 * Normative `min`/`max` reader (ruling (f)) — a real, non-bool, non-NaN JSON
 * number or nothing at all. `min: true` constrains NOTHING (Python's bool is an
 * int, so it used to be read as `1` there).
 * @returns {number|null}
 */
function declaredBound(field, name) {
  const raw = field[name]
  if (typeof raw !== 'number' || Number.isNaN(raw)) return null
  return raw
}

/**
 * Normative `options` reader (ruling (f)) — constrains ONLY when it is a
 * non-empty array of strings. A bare string used to be SUBSTRING-tested on the
 * Python side (`value not in "abc"`), which is a bug in any reading; a mixed
 * array is equally un-actionable. Both leave the select unconstrained.
 * @returns {string[]|null}
 */
function declaredOptions(field) {
  const raw = field.options
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!raw.every((option) => typeof option === 'string')) return null
  return raw
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
      if (value < -FLOAT_MAX || value > FLOAT_MAX) {
        // Unreachable after JSON.parse (it yields Infinity, caught above) —
        // kept so a hand-built object is judged the same as a parsed one.
        return { code: 'type_mismatch', message: `${field.key} is outside the IEEE-754 double range` }
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
      // The canonical regex, NOT `new URL()` — see the header (ruling (c)).
      if (typeof value !== 'string' || !URL_RE.test(value)) {
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
      if (typeof value !== 'string') {
        return { code: 'type_mismatch', message: `${field.key} must be a string` }
      }
      return null
    }
    case 'json': {
      // Any JSON value is acceptable — including "" (ruling (a)).
      return null
    }
    default: {
      // Unknown field type in the DEFINITION: canonical semantics treat any
      // provided value as a mismatch (nothing can legitimately satisfy a type
      // the validator doesn't know) — strict rejects, advisory warns.
      return { code: 'type_mismatch', message: `${field.key} has an unrecognized field type` }
    }
  }
}

/** Constraint checks that only run when the TYPE already matched. */
function checkConstraints(field, value) {
  const problems = []
  // max_length applies to EVERY string value, whatever the declared type.
  if (typeof value === 'string') {
    const maxLength = declaredMaxLength(field)
    if (maxLength !== null && codePointLength(value) > maxLength) {
      problems.push({
        code: 'max_length',
        message: `${field.key} exceeds max_length ${maxLength} (code points)`,
      })
    }
  }
  if (field.type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    const min = declaredBound(field, 'min')
    const max = declaredBound(field, 'max')
    if (min !== null && value < min) {
      problems.push({ code: 'out_of_range', message: `${field.key} is below min ${min}` })
    }
    if (max !== null && value > max) {
      problems.push({ code: 'out_of_range', message: `${field.key} is above max ${max}` })
    }
  }
  if (field.type === 'select' && typeof value === 'string') {
    const options = declaredOptions(field)
    if (options !== null && !options.includes(value)) {
      problems.push({
        code: 'invalid_option',
        message: `${field.key} must be one of the configured options`,
      })
    }
  }
  return problems
}

/**
 * Normative `required` reader (ruling (h)) — the literal boolean `true` and
 * NOTHING else. Language-native truthiness is BANNED here: `[]` and `{}` are
 * truthy in JS and falsy in Python, so "is this field required?" used to depend
 * on which twin you asked — 368 divergences per 5,000 random cases, the largest
 * ever measured on this seam. A malformed `required` is IGNORED, exactly like a
 * malformed max_length/min/max/options; the definition-write paths (aidream
 * `_validate_field_schema`, matrx-frontend `parseFieldSchema`) refuse to STORE
 * a non-boolean `required` in the first place.
 * @returns {boolean}
 */
function declaredRequired(field) {
  return field.required === true
}

/**
 * Is this value an ABSENCE for `required` purposes? Absent and null always;
 * "" only on a string-ish type (ruling (a)).
 */
function isMissing(field, value) {
  if (value === undefined || value === null) return true
  return value === '' && STRING_TYPES.has(field.type)
}

export function validateItem(fieldSchema, data, mode = 'advisory') {
  const errors = []
  const warnings = []
  const strict = mode === 'strict'

  const schema = Array.isArray(fieldSchema) ? fieldSchema : []
  // A field is declared IFF `key` is a non-empty string (ruling (f)).
  const byKey = new Map()
  for (const field of schema) {
    if (!isPlainObject(field) || typeof field.key !== 'string' || field.key === '') continue
    if (FIELD_TYPES.has(field.type)) {
      byKey.set(field.key, field)
    } else {
      // Keep the key known (so it isn't flagged unknown) even if type is bad;
      // any provided value is then a mismatch, exactly as in Python.
      byKey.set(field.key, { ...field, type: '_unvalidatable' })
    }
  }

  // 1. declared fields — required-missing, then type, then constraints.
  //    (Same single pass as Python, so the two can't drift on ordering.)
  for (const [key, field] of byKey.entries()) {
    const present = Object.prototype.hasOwnProperty.call(data, key)
    const value = present ? data[key] : undefined
    if (!present || isMissing(field, value)) {
      if (declaredRequired(field)) {
        errors.push({ key, code: 'required_missing', message: `${key} is required` })
      }
      continue // optional + absent/null/empty → nothing to check
    }
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

  // 2. unknown keys — strict rejects; advisory passes silently.
  for (const key of Object.keys(data)) {
    if (!byKey.has(key)) {
      if (strict) {
        errors.push({ key, code: 'unknown_key', message: `${key} is not a defined field` })
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

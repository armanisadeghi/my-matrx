// ---------------------------------------------------------------------------
// theme_config → CSS custom properties (the FIRST layer of the CSS cascade).
//
// `client_sites.theme_config` was typed, documented and populated for years
// while the renderer never read it — every live site duplicated the same
// values BY HAND at the top of its `global_css`. This module makes the data
// authoritative: the `:root{}` block it emits is prepended to the cascade, so
// a site that also hand-writes `:root{ --color-primary-teal: … }` in its
// global_css simply re-declares the same custom properties LATER and wins.
// Existing sites therefore render byte-identically apart from the new leading
// block — that is the whole safety argument for shipping this to live sites.
//
// NAMING CONTRACT (matches the live hand-written CSS exactly — do not change):
//   theme_config.{group}.{key} → --{group minus a trailing "s"}-{key with _→-}
//     colors.primary_teal → --color-primary-teal
//     fonts.primary       → --font-primary
//     spacing.section     → --spacing-section   (no trailing "s" to drop)
//   A top-level scalar (theme_config.foo = "…") becomes --foo. Nothing else is
//   emitted: nested objects two levels deep, arrays, nulls and empty strings
//   are skipped.
//
// SAFETY: theme_config is agent- and API-writable, and its output lands inside
// a <style> block on a live client site. Every value must clear a conservative
// allowlist (see isSafeCssValue) — anything that could close the declaration,
// close the block, open a tag, or pull a remote stylesheet is dropped and
// console.warn'ed (server-side; the visitor just sees the property missing).
// ---------------------------------------------------------------------------

/** Characters a theme value may contain. Deliberately narrow. */
const VALUE_CHARSET = /^[A-Za-z0-9 #.,%()'"/_+-]+$/

/** Anything in here means "not a plain value" — reject outright. */
const VALUE_BANNED = /[{}<>;\\]|@import|expression\s*\(|url\s*\(|javascript:|\/\*|\*\//i

/** The only CSS functions a theme value may call. */
const ALLOWED_FUNCTIONS = new Set([
  'rgb', 'rgba', 'hsl', 'hsla', 'var', 'calc', 'min', 'max', 'clamp',
])

const MAX_VALUE_LENGTH = 240

/** A CSS custom-property name segment: lowercase words joined by hyphens. */
const IDENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * True when `value` is safe to emit verbatim as a CSS declaration value.
 * Conservative by design: hex colors, numbers with units, keyword and
 * font-family lists, and the color/sizing functions above. Gradients, `url()`
 * and anything exotic are rejected — put those in global_css.
 */
export function isSafeCssValue(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false

  const raw = value.trim()
  if (!raw || raw.length > MAX_VALUE_LENGTH) return false
  if (VALUE_BANNED.test(raw)) return false
  if (!VALUE_CHARSET.test(raw)) return false

  // Balanced parens, and every call is to an allow-listed function.
  let depth = 0
  for (const char of raw) {
    if (char === '(') depth += 1
    else if (char === ')') {
      depth -= 1
      if (depth < 0) return false
    }
  }
  if (depth !== 0) return false

  for (const match of raw.matchAll(/([A-Za-z-]*)\(/g)) {
    if (!ALLOWED_FUNCTIONS.has(match[1].toLowerCase())) return false
  }

  return true
}

/** `colors` → `color`, `fonts` → `font`, `spacing` → `spacing`. */
function singularize(group) {
  return group.endsWith('s') ? group.slice(0, -1) : group
}

/** `primary_teal` → `primary-teal`; returns null if it isn't a clean ident. */
function toIdent(part) {
  const ident = String(part).trim().toLowerCase().replace(/[\s_]+/g, '-')
  return IDENT.test(ident) ? ident : null
}

function isScalar(value) {
  return typeof value === 'string' || typeof value === 'number'
}

/** An empty/whitespace value is "not set", not "unsafe" — skip it silently. */
function isBlank(value) {
  return typeof value === 'string' && value.trim() === ''
}

/**
 * Flatten `theme_config` into `[{ name, value }]` custom properties.
 * Sorted for a stable, diffable output (JSONB does not preserve key order).
 * @param {object|null|undefined} themeConfig
 * @param {{ onReject?: (name: string, value: unknown) => void }} [options]
 */
export function themeConfigToCustomProperties(themeConfig, { onReject } = {}) {
  if (!themeConfig || typeof themeConfig !== 'object' || Array.isArray(themeConfig)) return []

  const props = []
  const reject = onReject || (() => {})

  for (const groupKey of Object.keys(themeConfig).sort()) {
    const groupValue = themeConfig[groupKey]

    // Top-level scalar → `--{key}`.
    if (isScalar(groupValue)) {
      const name = toIdent(groupKey)
      if (!name || isBlank(groupValue)) continue
      if (!isSafeCssValue(groupValue)) {
        reject(`--${name}`, groupValue)
        continue
      }
      props.push({ name: `--${name}`, value: String(groupValue).trim() })
      continue
    }

    if (!groupValue || typeof groupValue !== 'object' || Array.isArray(groupValue)) continue

    const prefix = toIdent(singularize(groupKey))
    if (!prefix) continue

    for (const key of Object.keys(groupValue).sort()) {
      const value = groupValue[key]
      if (!isScalar(value) || isBlank(value)) continue // nested objects / arrays / nulls / empties
      const suffix = toIdent(key)
      if (!suffix) continue
      const name = `--${prefix}-${suffix}`
      if (!isSafeCssValue(value)) {
        reject(name, value)
        continue
      }
      props.push({ name, value: String(value).trim() })
    }
  }

  return props
}

/**
 * Render `theme_config` as the leading `:root{}` cascade layer.
 * Returns `''` when there is nothing safe to emit, so the layer drops out of
 * the cascade entirely (`.filter(Boolean)`), leaving output untouched.
 * @param {object|null|undefined} themeConfig
 * @param {{ siteSlug?: string }} [options]
 * @returns {string}
 */
export function themeConfigToCss(themeConfig, { siteSlug } = {}) {
  const props = themeConfigToCustomProperties(themeConfig, {
    onReject: (name, value) => {
      // LOUD RECOVERY: a rejected value means someone wrote something the
      // theme layer refuses to put inside a live <style> block. The visitor
      // never sees a broken stylesheet; the operator sees this.
      console.warn(
        `[theme_config] rejected unsafe value for ${name}` +
        (siteSlug ? ` on site "${siteSlug}"` : '') +
        `: ${JSON.stringify(value)}`
      )
    },
  })

  if (props.length === 0) return ''
  return `:root {\n${props.map((p) => `  ${p.name}: ${p.value};`).join('\n')}\n}`
}

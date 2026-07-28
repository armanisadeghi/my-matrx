#!/usr/bin/env node
/**
 * Tests for the two data-driven render layers:
 *   lib/render/themeCss.js  — theme_config → the leading `:root{}` cascade layer
 *   lib/render/siteNav.js   — navigation / show_in_nav → the `<!--matrx:nav-->` menu
 *   lib/render/cascade.js   — layer order + the use_client_header/footer CSS gating
 *
 *   pnpm test:render
 *
 * These layers emit raw markup and raw CSS into LIVE CLIENT SITES, so the
 * cases below are weighted toward the two things that must never regress:
 *  1. NO-TOKEN IS A NO-OP — a header without `<!--matrx:nav-->` comes back
 *     byte-identical (same string reference). iopbm's hand-written menu depends
 *     on this and is the acceptance test for the whole feature.
 *  2. NOTHING HOSTILE ESCAPES — theme values that could close the declaration,
 *     close the <style> block, open a tag, or @import are dropped; every nav
 *     label/href is escaped and non-navigating schemes are neutralized.
 *
 * Exit 1 on any failure.
 */
import { themeConfigToCss, isSafeCssValue } from '../lib/render/themeCss.js'
import { NAV_TOKEN, resolveNavItems, renderNavHtml, injectNav, hasNavToken } from '../lib/render/siteNav.js'
import { buildCombinedCss } from '../lib/render/cascade.js'

let total = 0
let failures = 0

function check(name, condition, detail = '') {
  total += 1
  if (!condition) {
    failures += 1
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function eq(name, got, want) {
  check(name, got === want, `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
}

// Silence the deliberate rejection warnings this suite provokes.
const realWarn = console.warn
console.warn = () => {}

// ── themeCss: the naming contract ───────────────────────────────────────────
eq(
  'naming: colors.primary_teal → --color-primary-teal (matches iopbm byte for byte)',
  themeConfigToCss({ colors: { primary_teal: '#3BA5A5' } }),
  ':root {\n  --color-primary-teal: #3BA5A5;\n}'
)
eq(
  'naming: fonts.primary → --font-primary',
  themeConfigToCss({ fonts: { primary: 'Inter, system-ui, sans-serif' } }),
  ':root {\n  --font-primary: Inter, system-ui, sans-serif;\n}'
)
eq(
  'naming: groups without a trailing "s" keep their name',
  themeConfigToCss({ spacing: { section: '4rem' }, radii: { card: '8px' } }),
  ':root {\n  --radii-card: 8px;\n  --spacing-section: 4rem;\n}'
)
eq('naming: top-level scalar → --{key}', themeConfigToCss({ tracking: 1.25 }), ':root {\n  --tracking: 1.25;\n}')

// ── themeCss: nothing to emit means no layer at all ─────────────────────────
for (const [name, input] of [
  ['null', null],
  ['empty object', {}],
  ['array', ['nope']],
  ['only nested objects', { colors: { nested: { deep: '1px' } } }],
  ['only nulls/empties', { colors: { a: null, b: '', c: '   ' } }],
]) {
  eq(`empty: ${name} emits nothing`, themeConfigToCss(input), '')
}

// ── themeCss: the injection allowlist ───────────────────────────────────────
for (const safe of ['#3BA5A5', '#fff', '#3BA5A5FF', 'red', '4rem', '-2px', '1.25', '0',
  'rgba(0, 0, 0, 0.1)', 'hsl(180 50% 40%)', 'var(--color-primary-teal)', 'calc(100% - 2rem)',
  '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif', "'Segoe UI', sans-serif"]) {
  check(`allow: ${safe}`, isSafeCssValue(safe) === true)
}
for (const hostile of [
  '#fff} body{display:none} .x{color:red',       // closes the block
  'red; background: url(http://evil.test/x)',    // ends the declaration
  '</style><script>alert(1)</script>',           // opens a tag
  '@import url(http://evil.test/x.css)',         // pulls a remote stylesheet
  'expression(alert(1))',                        // legacy IE execution
  'url(http://evil.test/x.png)',                 // remote fetch / tracking
  'red /* comment */ blue',                      // comment smuggling
  'linear-gradient(red, blue)',                  // function outside the allowlist
  'rgb(0,0,0',                                   // unbalanced parens
  'x'.repeat(300),                               // absurd length
  {}, [], null, undefined, true,                 // non-scalars
]) {
  check(`reject: ${JSON.stringify(hostile)?.slice(0, 48)}`, isSafeCssValue(hostile) === false)
}
check(
  'hostile values are dropped from the emitted block, safe siblings survive',
  themeConfigToCss({ colors: { ok: '#fff', evil: '#fff} body{display:none} .x{color:red' } }) ===
    ':root {\n  --color-ok: #fff;\n}'
)

// ── siteNav: NO TOKEN IS A NO-OP (the live-site acceptance test) ────────────
const iopbmHeader = '<div class="nav-wrapper"><nav><ul class="nav-links"><li><a href="/c/iopbm/about">About</a></li></ul></nav></div>'
const items = [{ label: 'About', href: '/c/iopbm/about' }]
check('no-token: header returns the SAME string reference', injectNav(iopbmHeader, items) === iopbmHeader)
check('no-token: hasNavToken is false', hasNavToken(iopbmHeader) === false)
check('no-token: null/undefined html is passed through', injectNav(null, items) === null)

// ── siteNav: resolution order ──────────────────────────────────────────────
const pagePath = (p) => `/${p.category ? p.category + '/' : ''}${p.slug}`
const pages = [
  { slug: 'pricing', title: 'Pricing', category: 'general', is_published: true, show_in_nav: true, sort_order: 2 },
  { slug: 'about', title: 'About', category: 'general', is_published: true, show_in_nav: true, sort_order: 1 },
  { slug: 'hidden', title: 'Hidden', category: 'general', is_published: true, show_in_nav: false, sort_order: 0 },
  { slug: 'draft', title: 'Draft', category: 'general', is_published: false, show_in_nav: true, sort_order: 0 },
  { slug: 'zeta', title: 'Zeta', category: 'general', is_published: true, show_in_nav: true, sort_order: 1 },
]
eq(
  'derive: published + show_in_nav only, ordered by sort_order then title, basePath-prefixed',
  JSON.stringify(resolveNavItems({ navigation: [], pages, basePath: '/c/dev', pagePath })),
  JSON.stringify([
    { label: 'About', href: '/c/dev/general/about' },
    { label: 'Zeta', href: '/c/dev/general/zeta' },
    { label: 'Pricing', href: '/c/dev/general/pricing' },
  ])
)
eq(
  'derive: custom domain drops the /c/ prefix (basePath is "")',
  resolveNavItems({ navigation: null, pages: [pages[1]], basePath: '', pagePath })[0].href,
  '/general/about'
)
eq(
  'override: a non-empty navigation array wins and is used verbatim (anchors stay anchors)',
  JSON.stringify(resolveNavItems({ navigation: [{ label: 'About', href: '#about' }], pages, basePath: '/c/dev', pagePath })),
  JSON.stringify([{ label: 'About', href: '#about' }])
)

// ── siteNav: markup, escaping, current page ────────────────────────────────
eq(
  'markup: simple nav/ul/li/a with aria-current on the current page',
  renderNavHtml([{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }], '/b'),
  '<nav class="matrx-nav"><ul><li><a href="/a">A</a></li><li><a href="/b" aria-current="page">B</a></li></ul></nav>'
)
eq('markup: no items → empty string (token vanishes)', renderNavHtml([], '/a'), '')
eq('markup: token with no items resolves to nothing', injectNav(`<h>${NAV_TOKEN}</h>`, []), '<h></h>')
check(
  'escaping: labels are escaped, never interpolated raw',
  renderNavHtml([{ label: 'A & <script>alert(1)</script>', href: '/a' }]).includes('A &amp; &lt;script&gt;')
)
check(
  'escaping: a quote in an href cannot break out of the attribute',
  renderNavHtml([{ label: 'x', href: '/a" onmouseover="alert(1)' }]).includes('&quot; onmouseover=&quot;')
)
for (const scheme of ['javascript:alert(1)', 'JaVaScript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x']) {
  eq(`href: ${scheme.slice(0, 20)} is neutralized to #`, resolveNavItems({
    navigation: [{ label: 'x', href: scheme }], pages: [], basePath: '', pagePath,
  })[0].href, '#')
}
for (const ok of ['/general/about', '#about', 'https://example.com/x', 'mailto:a@b.com', 'tel:+15551234']) {
  eq(`href: ${ok} passes through`, resolveNavItems({
    navigation: [{ label: 'x', href: ok }], pages: [], basePath: '', pagePath,
  })[0].href, ok)
}
eq(
  'token: every occurrence is replaced (header AND footer can both carry one)',
  injectNav(`${NAV_TOKEN}|${NAV_TOKEN}`, [{ label: 'A', href: '/a' }]).split('<nav').length - 1,
  2
)

// ── cascade: layer order and the use_client_header/footer gating ────────────
// C5 REGRESSION: the flags gate a component's CSS exactly as they gate its
// markup. The renderer used to emit header/footer CSS unconditionally while
// aidream's `resolve_cascade` gated it, so `cms_inspect css_cascade` reported a
// cascade the live site did not serve. TWIN: aidream cascade.py — change both.
const HDR = { css_content: '.h{color:red}' }
const FTR = { css_content: '.f{color:blue}' }
const cascadeArgs = (page) => ({
  themeCss: ':root {\n  --a: 1;\n}',
  globalCss: '.g{color:green}',
  headerComponent: HDR,
  footerComponent: FTR,
  page,
})
const bothOn = { css_content: '.p{color:pink}', use_client_header: true, use_client_footer: true }

eq(
  'cascade: order is theme → global → header → footer → page',
  buildCombinedCss(cascadeArgs(bothOn)),
  ':root {\n  --a: 1;\n}\n\n.g{color:green}\n\n.h{color:red}\n\n.f{color:blue}\n\n.p{color:pink}'
)
eq(
  'cascade: use_client_header=false drops the header CSS (and ONLY it)',
  buildCombinedCss(cascadeArgs({ ...bothOn, use_client_header: false })),
  ':root {\n  --a: 1;\n}\n\n.g{color:green}\n\n.f{color:blue}\n\n.p{color:pink}'
)
eq(
  'cascade: use_client_footer=false drops the footer CSS (and ONLY it)',
  buildCombinedCss(cascadeArgs({ ...bothOn, use_client_footer: false })),
  ':root {\n  --a: 1;\n}\n\n.g{color:green}\n\n.h{color:red}\n\n.p{color:pink}'
)
eq(
  'cascade: both flags false → neither component CSS ships (the dev-website verify-* fixtures)',
  buildCombinedCss(cascadeArgs({ ...bothOn, use_client_header: false, use_client_footer: false })),
  ':root {\n  --a: 1;\n}\n\n.g{color:green}\n\n.p{color:pink}'
)
eq(
  'cascade: blank layers drop out entirely, no stray blank lines',
  buildCombinedCss({ themeCss: '', globalCss: null, headerComponent: { css_content: null },
    footerComponent: undefined, page: { css_content: '.p{}', use_client_header: true, use_client_footer: true } }),
  '.p{}'
)
eq(
  'cascade: every layer blank → empty string (no <style> tag is emitted)',
  buildCombinedCss({ page: { css_content: null, use_client_header: true, use_client_footer: true } }),
  ''
)
eq(
  'cascade: a site with no header/footer rows is unaffected by the flags',
  buildCombinedCss({ themeCss: ':root {\n  --a: 1;\n}', globalCss: '.g{}',
    page: { css_content: '.p{}', use_client_header: false, use_client_footer: false } }),
  ':root {\n  --a: 1;\n}\n\n.g{}\n\n.p{}'
)

console.warn = realWarn
console.log(`${total - failures}/${total} render-layer cases passed`)
if (failures > 0) process.exit(1)

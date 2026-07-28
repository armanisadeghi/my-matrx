#!/usr/bin/env node
/**
 * Tests for the two data-driven render layers:
 *   lib/render/themeCss.js  — theme_config → the leading `:root{}` cascade layer
 *   lib/render/siteNav.js   — navigation / show_in_nav → the `<!--matrx:nav-->` menu
 *   lib/render/siteFooter.js — footer_config (+ contact_info / social_links) →
 *                              the `<!--matrx:footer-->` footer
 *   lib/render/cascade.js   — layer order + the use_client_header/footer CSS gating
 *   lib/render/pageSelection.js — which row a lookup answers with, and whether
 *                              the viewer may see it (publish/preview gate)
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
import {
  FOOTER_TOKEN,
  contactInfoToLines,
  hasFooterToken,
  injectFooter,
  renderFooterHtml,
  resolveFooter,
  socialLinksToItems,
} from '../lib/render/siteFooter.js'
import { buildCombinedCss } from '../lib/render/cascade.js'
import { pagePath, isRealCategory } from '../lib/render/pagePath.js'
import { gatePageForViewer, selectAliasPage } from '../lib/render/pageSelection.js'

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
// The REAL pagePath, not a stub: nav hrefs and the resolver must agree, and a
// stub here would hide exactly the drift these cases exist to catch.
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

// ── siteFooter: NO TOKEN IS A NO-OP (the live-site acceptance test) ────────
// iopbm's hand-written <footer> is the acceptance case: every one of its
// columns, its tel: link and its copyright line must survive untouched.
const iopbmFooter = '<footer><div class="footer-container"><div class="footer-section"><h3>Contact</h3><ul><li>901 Dover Drive, Suite 205</li></ul></div></div></footer>'
check('footer no-token: html returns the SAME string reference', injectFooter(iopbmFooter, '<div class="matrx-footer-bottom"></div>') === iopbmFooter)
check('footer no-token: hasFooterToken is false', hasFooterToken(iopbmFooter) === false)
check('footer no-token: null/undefined html is passed through', injectFooter(null, 'x') === null)
check('footer no-token: a nav token alone does not summon a footer', hasFooterToken(`<h>${NAV_TOKEN}</h>`) === false)

// ── siteFooter: empty config renders NOTHING (the state of all live sites) ──
const emptyArgs = { socialLinks: {}, contactInfo: {}, siteName: '', year: 2026, basePath: '/c/dev' }
for (const [name, footerConfig] of [
  ['{}', {}],
  ['null', null],
  ['an array', ['nope']],
  ['a string', 'nope'],
  ['columns: []', { columns: [] }],
  ['flags on but the source columns are empty', { show_contact: true, show_social: true }],
]) {
  eq(`footer empty: ${name} renders nothing`, renderFooterHtml(resolveFooter({ ...emptyArgs, footerConfig })), '')
}
eq('footer empty: an empty render makes the token vanish', injectFooter(`<f>${FOOTER_TOKEN}</f>`, ''), '<f></f>')

// ── siteFooter: columns, headings, markup ──────────────────────────────────
eq(
  'footer markup: columns → .matrx-footer-cols / .matrx-footer-col / h3 / ul / li / a',
  renderFooterHtml(resolveFooter({
    ...emptyArgs,
    footerConfig: { columns: [{ heading: 'Services', links: [{ label: 'GI', href: '/services/gi' }] }] },
  })),
  '<div class="matrx-footer-cols"><div class="matrx-footer-col"><h3>Services</h3><ul><li><a href="/c/dev/services/gi">GI</a></li></ul></div></div>'
)
eq(
  'footer hrefs: site-relative paths get basePath, anchors/absolute/mailto/tel do not',
  JSON.stringify(resolveFooter({
    ...emptyArgs,
    footerConfig: { columns: [{ links: [
      { label: 'a', href: '/services' },
      { label: 'b', href: '#contact' },
      { label: 'c', href: 'https://example.com/x' },
      { label: 'd', href: 'mailto:a@b.com' },
      { label: 'e', href: 'tel:+15551234' },
    ] }] },
  }).columns[0].links.map((l) => l.href)),
  JSON.stringify(['/c/dev/services', '#contact', 'https://example.com/x', 'mailto:a@b.com', 'tel:+15551234'])
)
eq(
  'footer hrefs: on a custom domain basePath is "" so the SAME config is correct',
  resolveFooter({ ...emptyArgs, basePath: '', footerConfig: { columns: [{ links: [{ label: 'a', href: '/services' }] }] } })
    .columns[0].links[0].href,
  '/services'
)
for (const scheme of ['javascript:alert(1)', 'JaVaScript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x']) {
  eq(`footer href: ${scheme.slice(0, 20)} is neutralized to #`, resolveFooter({
    ...emptyArgs, footerConfig: { columns: [{ links: [{ label: 'x', href: scheme }] }] },
  }).columns[0].links[0].href, '#')
}
check(
  'footer escaping: headings and labels are escaped, never interpolated raw',
  renderFooterHtml(resolveFooter({
    ...emptyArgs,
    footerConfig: { columns: [{ heading: '<script>alert(1)</script>', links: [{ label: 'A & B', href: '/x" onmouseover="y' }] }] },
  })) === '<div class="matrx-footer-cols"><div class="matrx-footer-col"><h3>&lt;script&gt;alert(1)&lt;/script&gt;</h3><ul><li><a href="/c/dev/x&quot; onmouseover=&quot;y">A &amp; B</a></li></ul></div></div>'
)

// COLLISION GUARD: `.matrx-footer` belongs to the site's own <footer> element
// (aidream's starter kit emits `<footer class="matrx-footer">` and ships CSS
// for it). The generated blocks sit INSIDE that element, so they must never
// introduce a second `.matrx-footer` — that would double its border/padding.
check(
  'footer markup: no outer .matrx-footer wrapper (the starter kit owns that class)',
  !/class="matrx-footer"/.test(renderFooterHtml(resolveFooter({
    ...emptyArgs, siteName: 'X',
    footerConfig: { columns: [{ heading: 'S', links: [{ label: 'a', href: '/a' }] }], legal_links: [{ label: 'P', href: '/p' }] },
  })))
)

// ── siteFooter: contact block reads contact_info, never footer_config ──────
// iopbm's LIVE contact_info row is the fixture — this is the shape that exists.
const iopbmContact = {
  phone: '(949) 404-4444',
  phone_raw: '+19494044444',
  address: { street: '901 Dover Drive, Suite 205', city: 'Newport Beach', state: 'CA', zip: '' },
}
eq(
  'contact: iopbm’s live row → street, "City, ST", and a tel: link off phone_raw',
  JSON.stringify(contactInfoToLines(iopbmContact)),
  JSON.stringify([
    { text: '901 Dover Drive, Suite 205' },
    { text: 'Newport Beach, CA' },
    { text: '(949) 404-4444', href: 'tel:+19494044444' },
  ])
)
eq(
  'contact: a zip joins the state',
  contactInfoToLines({ address: { city: 'Newport Beach', state: 'CA', zip: '92663' } })[0].text,
  'Newport Beach, CA 92663'
)
eq('contact: a plain string address is one line', contactInfoToLines({ address: '1 Main St' })[0].text, '1 Main St')
eq('contact: an email becomes a mailto:', JSON.stringify(contactInfoToLines({ email: 'a@b.com' })), JSON.stringify([{ text: 'a@b.com', href: 'mailto:a@b.com' }]))
eq('contact: a malformed email stays plain text, never a broken mailto:', JSON.stringify(contactInfoToLines({ email: 'not an email' })), JSON.stringify([{ text: 'not an email' }]))
for (const [name, input] of [['{}', {}], ['null', null], ['an array', [1]], ['blank values', { phone: '', email: '   ' }]]) {
  eq(`contact: ${name} yields no lines`, contactInfoToLines(input).length, 0)
}
eq(
  'contact: show_contact renders a column from contact_info, headed by contact_heading',
  renderFooterHtml(resolveFooter({
    ...emptyArgs, contactInfo: { phone: '(949) 404-4444', phone_raw: '+19494044444' },
    footerConfig: { show_contact: true, contact_heading: 'Reach Us' },
  })),
  '<div class="matrx-footer-cols"><div class="matrx-footer-col"><h3>Reach Us</h3><ul><li><a href="tel:+19494044444">(949) 404-4444</a></li></ul></div></div>'
)
check(
  'contact: show_contact absent → no contact column even when contact_info is full',
  renderFooterHtml(resolveFooter({ ...emptyArgs, contactInfo: iopbmContact, footerConfig: {} })) === ''
)

// ── siteFooter: social block reads social_links, both shapes ───────────────
eq(
  'social: a {platform: url} map → humanized labels',
  JSON.stringify(socialLinksToItems({ twitter: 'https://x.test/a', linked_in: 'https://li.test/a' })),
  JSON.stringify([{ label: 'Twitter', href: 'https://x.test/a' }, { label: 'Linked In', href: 'https://li.test/a' }])
)
eq(
  'social: a [{platform,url}] list works too',
  JSON.stringify(socialLinksToItems([{ platform: 'twitter', url: 'https://x.test/a' }, { label: 'IG', href: 'https://ig.test/a' }])),
  JSON.stringify([{ label: 'Twitter', href: 'https://x.test/a' }, { label: 'IG', href: 'https://ig.test/a' }])
)
eq('social: blank urls are dropped', socialLinksToItems({ twitter: '  ', facebook: null }).length, 0)
eq('social: a javascript: url is neutralized', socialLinksToItems({ x: 'javascript:alert(1)' })[0].href, '#')
check(
  'social: show_social absent → no social column even when social_links is full',
  renderFooterHtml(resolveFooter({ ...emptyArgs, socialLinks: { twitter: 'https://x.test/a' }, footerConfig: {} })) === ''
)

// ── siteFooter: block order ────────────────────────────────────────────────
const orderArgs = {
  socialLinks: { twitter: 'https://x.test/a' },
  contactInfo: { phone: '555' },
  siteName: '', year: 2026, basePath: '',
}
const headings = (footerConfig) =>
  resolveFooter({ ...orderArgs, footerConfig }).columns.map((c) => c.heading).join(',')
eq(
  'order: default is columns → contact → social',
  headings({ columns: [{ heading: 'Links', links: [{ label: 'a', href: '/a' }] }], show_contact: true, show_social: true }),
  'Links,Contact,Follow Us'
)
eq(
  'order: an explicit order re-sequences the blocks',
  headings({ columns: [{ heading: 'Links', links: [{ label: 'a', href: '/a' }] }], show_contact: true, show_social: true, order: ['social', 'contact', 'columns'] }),
  'Follow Us,Contact,Links'
)
eq(
  'order: a block left out of `order` still renders (a typo must never hide it)',
  headings({ columns: [{ heading: 'Links', links: [{ label: 'a', href: '/a' }] }], show_contact: true, show_social: true, order: ['social', 'bogus'] }),
  'Follow Us,Links,Contact'
)

// ── siteFooter: copyright + legal links ────────────────────────────────────
eq(
  'copyright: omitted → auto "© {year} {site name}"',
  renderFooterHtml(resolveFooter({ ...emptyArgs, siteName: 'Institute of Plant-Based Medicine', year: 2026, footerConfig: { show_contact: false } })),
  '<div class="matrx-footer-bottom"><p>© 2026 Institute of Plant-Based Medicine</p></div>'
)
eq(
  'copyright: an explicit string wins and is escaped',
  resolveFooter({ ...emptyArgs, siteName: 'X', footerConfig: { copyright: '© 2025 X <b>Inc</b>' } }).copyright,
  '© 2025 X <b>Inc</b>'
)
check(
  'copyright: the explicit string is escaped in the markup',
  renderFooterHtml(resolveFooter({ ...emptyArgs, footerConfig: { copyright: '© 2025 X <b>Inc</b>' } }))
    .includes('<p>© 2025 X &lt;b&gt;Inc&lt;/b&gt;</p>')
)
eq(
  'copyright: with no site name and no explicit value there is no bottom bar',
  renderFooterHtml(resolveFooter({ ...emptyArgs, siteName: '', footerConfig: {} })),
  ''
)
eq(
  'legal_links: rendered after the copyright, basePath-prefixed',
  renderFooterHtml(resolveFooter({ ...emptyArgs, siteName: 'X', footerConfig: { legal_links: [{ label: 'Privacy', href: '/privacy' }] } })),
  '<div class="matrx-footer-bottom"><p>© 2026 X</p><ul class="matrx-footer-legal"><li><a href="/c/dev/privacy">Privacy</a></li></ul></div>'
)

// ── siteFooter: token replacement ──────────────────────────────────────────
eq(
  'footer token: every occurrence is replaced',
  injectFooter(`${FOOTER_TOKEN}|${FOOTER_TOKEN}`, '<div class="matrx-footer-bottom"></div>').split('matrx-footer-bottom').length - 1,
  2
)
eq(
  'footer token: nav and footer tokens coexist in one component body',
  injectFooter(injectNav(`${NAV_TOKEN}${FOOTER_TOKEN}`, [{ label: 'A', href: '/a' }]), '<div class="matrx-footer-bottom"></div>'),
  '<nav class="matrx-nav"><ul><li><a href="/a">A</a></li></ul></nav><div class="matrx-footer-bottom"></div>'
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

// ── routing: pagePath + the 'general' convention ───────────────────────────
// `client_pages.route` (CMS migration 0028) is a page's public path at any
// depth. These pin the two rules the whole depth fix rests on: a link is built
// from the ROUTE, and 'general' is never a path segment or a listing filter.
eq('pagePath: the stored route wins',
  pagePath({ route: '/locations/austin/pricing', category: 'general', slug: 'pricing' }),
  '/locations/austin/pricing')
eq('pagePath: a four-segment route is passed through whole',
  pagePath({ route: '/a/b/c/d', slug: 'd' }), '/a/b/c/d')
eq('pagePath: falls back to category+slug only when there is no route',
  pagePath({ category: 'education', slug: 'gut-health' }), '/education/gut-health')
eq('pagePath: no category, no route → one segment',
  pagePath({ category: null, slug: 'about' }), '/about')

check('isRealCategory: a real grouping is real', isRealCategory('education') === true)
check("isRealCategory: 'general' is NOT a category (it is the column default)",
  isRealCategory('general') === false)
check('isRealCategory: case and whitespace do not smuggle it back in',
  isRealCategory('  GENERAL ') === false)
check('isRealCategory: empty / null / undefined are not categories',
  isRealCategory('') === false && isRealCategory(null) === false && isRealCategory(undefined) === false)

// ── selection: the alias shadowing case (gate BEFORE pick) ─────────────────
// CMS 0028 dropped `UNIQUE (client_id, slug)`, so a legacy 1-/2-segment alias
// can match several pages. Picking the shallowest FIRST and gating afterwards
// let an unpublished page win the alias and then vanish — a 404 for the live
// page it shadowed. iopbm's home page (`category='root', slug='home'`, route
// `/root/home`) answers `/home` only through that alias, and `category`
// DEFAULTS to 'general' (route `/home`, depth 1 — shallower), so a draft named
// "Home" from our own plan→CMS bridge took down a real client's homepage and
// site root. These pin gate-then-pick so it cannot come back.
const REAL_HOME = { id: 'real', slug: 'home', category: 'root', route: '/root/home', is_published: true, is_home_page: true }
const DECOY_PUBLISHED = { id: 'decoy', slug: 'home', category: 'general', route: '/home', is_published: true }
const DECOY_DRAFT = { ...DECOY_PUBLISHED, is_published: false }

eq('selection: an UNPUBLISHED shallower page never wins the alias (the 404 bug)',
  selectAliasPage([DECOY_DRAFT, REAL_HOME], false, '/home')?.id, 'real')
eq('selection: row order does not change that',
  selectAliasPage([REAL_HOME, DECOY_DRAFT], false, '/home')?.id, 'real')
eq('selection: a PUBLISHED shallower page still wins the alias (unchanged rule)',
  selectAliasPage([DECOY_PUBLISHED, REAL_HOME], false, '/home')?.id, 'decoy')
eq('selection: preview keeps drafts in the running — that is what preview is for',
  selectAliasPage([DECOY_DRAFT, REAL_HOME], true, '/home')?.id, 'decoy')
eq('selection: every match unpublished → nothing to serve',
  selectAliasPage([DECOY_DRAFT, { ...REAL_HOME, is_published: false }], false, '/home'), null)
eq('selection: a lone published match is served',
  selectAliasPage([REAL_HOME], false, '/home')?.id, 'real')
eq('selection: no rows → null', selectAliasPage([], false, '/home'), null)
eq('selection: null rows → null', selectAliasPage(null, false, '/home'), null)

// The site root redirects to the home page's ROUTE, never its slug — the slug
// alias is exactly the thing another page can steal.
eq('selection: the site-root redirect target is the route, not the slug',
  pagePath(REAL_HOME), '/root/home')

// gate: the publish check itself, and the draft merge preview depends on.
eq('selection: an unpublished page is invisible to a visitor',
  gatePageForViewer({ is_published: false }, false), null)
eq('selection: a preview of a draft merges the *_draft twins',
  gatePageForViewer({ is_published: false, has_draft: true, html_content: 'live', html_content_draft: 'draft' }, true).html_content,
  'draft')
eq('selection: a published page with no draft passes through untouched',
  gatePageForViewer(REAL_HOME, false), REAL_HOME)

console.warn = realWarn
console.log(`${total - failures}/${total} render-layer cases passed`)
if (failures > 0) process.exit(1)

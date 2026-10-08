#!/usr/bin/env node
/**
 * /p/[id] serves the stored document as-is (lib/render/servedHtmlDocument.js):
 * its <html>/<body> attributes and whole <head> survive, and only our SEO tags,
 * the safety CSS and the frame script are injected — first in the head.
 *
 * The second half runs the frame script's FIT in a real Chromium, inside an
 * iframe exactly as chat embeds it: a page that fits is untouched; a modest
 * overflow on a wide frame is SCALED (layout kept); a heavy overflow on a
 * narrow frame REFLOWS; resizing back restores the author's page exactly; the
 * reported height is the scaled height; print ignores every fit adjustment.
 * Needs a Playwright Chromium (`pnpm exec playwright-core install chromium`).
 *
 *   pnpm test:stored-html
 */
import { buildServedDocument, documentTitle, SAFETY_CSS, HEIGHT_MESSAGE_TYPE, FIT_MIN_SCALE } from '../lib/render/servedHtmlDocument.js'
import { chromium, webkit } from 'playwright-core'
import http from 'node:http'

const PAGE = `<!DOCTYPE html><html lang="fa" dir="rtl" class="dark"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#111">
<title>Binary Basics</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/x.css">
<style>body{margin:0}</style>
</head><body class="page" data-theme="x"><div id="graph"></div><script>new vis.Network(document.getElementById('graph'), {}, {})</script></body></html>`

let failed = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}

const plain = buildServedDocument({ id: 'p1', html_content: PAGE })
check('<html> attributes survive', plain.includes('<html lang="fa" dir="rtl" class="dark">'))
check('<body> attributes survive', plain.includes('<body class="page" data-theme="x">'))
check('every head meta survives', plain.includes('name="theme-color"'))
check('head script and stylesheet stay in the head', plain.indexOf('vis-network.min.js') < plain.indexOf('</head>') && plain.includes('x.css'))
check('the page keeps its own title', documentTitle(plain) === 'Binary Basics')
check('no second viewport or charset', (plain.match(/name="viewport"/g) || []).length === 1 && (plain.match(/charset/gi) || []).length === 1)
check('safety CSS is injected before the author CSS', plain.indexOf(SAFETY_CSS) > -1 && plain.indexOf(SAFETY_CSS) < plain.indexOf('body{margin:0}'))
check('safety CSS never outranks the author (zero specificity)', !/(^|})\s*(img|table|pre|body|html)\b/.test(SAFETY_CSS))
check('frame script posts the height message', plain.includes(HEIGHT_MESSAGE_TYPE) && plain.includes('data-matrx-frame'))
check('noindex by default', plain.includes('content="noindex, nofollow"'))

const seo = buildServedDocument({ id: 'p2', html_content: PAGE, meta_title: 'DB <Title>', meta_description: 'Generated "from" chat', is_indexable: true })
check('database title replaces the document title', documentTitle(seo) === 'DB &lt;Title&gt;' && !seo.includes('Binary Basics'))
check('description is escaped', seo.includes('content="Generated &quot;from&quot; chat"'))
check('og:url names the page', seo.includes('https://www.mymatrx.com/p/p2'))
check('indexable pages say so', seo.includes('content="index, follow"'))

const fragment = buildServedDocument({ id: 'p3', html_content: '<p>hi</p>' })
check('a fragment becomes a full document', /^<!DOCTYPE html>/.test(fragment) && fragment.includes('<body><p>hi</p></body>'))
check('a fragment gets a viewport', fragment.includes('name="viewport"'))

// ── FIT, in a real browser ───────────────────────────────────────────────
const ROW = (n, w) => `<div class="row" style="display:flex;gap:8px">${Array.from({ length: n }, (_, i) =>
  `<div class="card" style="flex:none;width:${w}px;height:90px;background:#334155">${2 ** (n - 1 - i)}</div>`).join('')}</div>`
const doc = (body, css = '') => buildServedDocument({ id: 'fit', html_content:
  `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:16px system-ui}${css}</style></head><body>${body}</body></html>` })
// 8 cards × 100px + 7 gaps × 8px = 856px wide.
const CARDS = doc(`<h1>Bits</h1>${ROW(8, 100)}<p>After the row.</p>`)
const FITS = doc(`<h1>Fits</h1>${ROW(4, 100)}`)
const TABLE = doc(`<table style="border-collapse:collapse"><tr>${'<td style="min-width:120px;border:1px solid">cell</td>'.repeat(8)}</tr></table><p>below</p>`)
const DRAWER = doc(`<h1>Drawer</h1><aside style="position:absolute;left:100%;top:0;width:600px;height:50px">off-canvas</aside>`, 'body{overflow-x:hidden;position:relative}')
const GROWING = doc(`<h1>Grows</h1>${ROW(8, 100)}<div id="grow" style="height:10px;background:#0af"></div>`)

// The page is served over HTTP so the frame URL's query (?fit=card, ?print=1) is real.
let served = ''
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(served) })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const origin = `http://127.0.0.1:${server.address().port}`

for (const engine of ['chromium', 'webkit']) {
  const T = (name) => `[${engine}] ${name}`
  const browser = await (engine === 'webkit' ? webkit : chromium).launch()
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  await page.goto(`${origin}/host`)
  await page.setContent(`<body style="margin:0"><iframe id="f" style="border:0;display:block;width:750px;height:300px"></iframe><script>
window.reported=null; addEventListener('message',function(e){ if(e.data&&e.data.type===${JSON.stringify(HEIGHT_MESSAGE_TYPE)}){ window.reported=e.data.height; document.getElementById('f').style.height=e.data.height+'px' } })
</script></body>`)
  const load = async (html, width, query = '?fit=card') => {
    served = html
    await page.evaluate(() => { window.reported = null })
    await page.$eval('#f', (f, [src, w]) => { f.style.width = w + 'px'; f.src = src }, [`${origin}/p/fit${query}&n=${Math.random()}`, width])
    await page.waitForFunction(() => window.reported !== null)
    await page.waitForTimeout(200)
  }
  const resize = async (width) => { await page.$eval('#f', (f, w) => { f.style.width = w + 'px' }, width); await page.waitForTimeout(300) }
  const frame = () => page.frames().find((f) => f.url().includes('/p/fit'))
  const state = async () => frame().evaluate((reported) => {
    const de = document.documentElement
    const cards = [...document.querySelectorAll('.card')]
    return {
      zoom: parseFloat(de.style.getPropertyValue('--matrx-zoom')) || null,
      zoomAttr: de.hasAttribute('data-matrx-zoom'),
      fit: [...document.querySelectorAll('[data-matrx-fit]')].map((e) => `${e.tagName.toLowerCase()}=${e.getAttribute('data-matrx-fit')}`),
      rows: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().top))).size,
      sideways: de.scrollWidth - de.clientWidth,
      innerScroll: (window.scrollTo(0, 1e7), window.scrollY),
      styled: document.querySelectorAll('body [style*="flex-wrap"],body [style*="grid-template"],[data-matrx-scroll-x]').length,
      vw: Math.round(innerWidth),
      reported,
    }
  }, await page.evaluate(() => window.reported))

  await load(FITS, 750)
  let s = await state()
  check(T('fit: a page that fits is untouched (no zoom, no attribute)'), !s.zoomAttr && s.fit.length === 0 && s.rows === 1)

  await load(CARDS, 750)
  s = await state()
  check(T(`card: modest overflow on a wide frame scales (zoom ${s.zoom})`), s.zoom >= FIT_MIN_SCALE && s.zoom < 1 && s.fit.length === 0)
  check(T('card: scaled page keeps the author layout — 8 cards on ONE row'), s.rows === 1)
  check(T(`card: scaled page has no sideways scroll (${s.sideways})`), s.sideways <= 1)
  check(T(`card: reported height is the scaled height (inner scroll ${s.innerScroll}, ${s.reported}px)`), s.innerScroll === 0)
  check(T('card: no inline style is written into the author page'), s.styled === 0)

  await resize(375)
  s = await state()
  check(T(`card: heavy overflow on a phone reflows (${s.fit.join(',')})`), s.fit.includes('div=wrap') && s.rows > 1)
  check(T('card: reflowed page has no sideways scroll'), s.sideways <= 1)
  check(T('card: reflowed page height reported without inner scroll'), s.innerScroll === 0)

  await resize(750)
  s = await state()
  check(T('card: resizing back restores the scaled one-row layout (no reflow left behind)'), s.fit.length === 0 && s.rows === 1 && s.zoom >= FIT_MIN_SCALE)
  await resize(1000)
  s = await state()
  check(T('card: resizing wide restores the page exactly (no zoom, no attribute)'), !s.zoomAttr && s.zoom === null && s.fit.length === 0 && s.rows === 1)

  await load(TABLE, 375)
  s = await state()
  check(T(`card: a wide table on a phone scrolls inside itself (${s.fit.join(',')})`), s.fit.includes('table=scroll') && s.sideways <= 1)
  await resize(1200)
  s = await state()
  check(T('card: the table is restored when the frame is wide again'), s.fit.length === 0 && !s.zoomAttr)

  await load(DRAWER, 750)
  s = await state()
  check(T('fit: a page that clips sideways (off-canvas drawer) is never fitted'), !s.zoomAttr && s.fit.length === 0)

  await load(GROWING, 750)
  const refits = await frame().evaluate(async () => {
    let n = 0
    new MutationObserver((m) => { n += m.filter((r) => r.attributeName === 'data-matrx-zoom').length }).observe(document.documentElement, { attributes: true })
    const g = document.getElementById('grow')
    for (let h = 20; h <= 200; h += 20) { g.style.height = h + 'px'; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))) }
    return n
  })
  s = await state()
  check(T(`card: a height-only change never re-runs the fit (${refits} zoom resets)`), refits === 0 && s.zoomAttr)
  check(T('card: the height is still re-reported as the page grows'), s.innerScroll === 0)

  await load(CARDS, 750, '?x=1')
  s = await state()
  check(T('page/canvas: modest overflow is never scaled or reflowed'), !s.zoomAttr && s.fit.length === 0)
  await resize(375)
  s = await state()
  check(T(`page/canvas: heavy overflow on a phone reflows, never scales (${s.fit.join(',')})`), !s.zoomAttr && s.fit.includes('div=wrap'))

  await load(CARDS, 375, '?print=1')
  s = await state()
  check(T('print=1: natural layout — never scaled or reflowed'), !s.zoomAttr && s.fit.length === 0)

  await load(CARDS, 750)
  await page.emulateMedia({ media: 'print' })
  const printZoom = await frame().evaluate(() => getComputedStyle(document.documentElement).zoom)
  check(T(`print: the fit scale is not applied when printing (zoom ${printZoom})`), printZoom === '1' || printZoom === 'normal')
  if (engine === 'chromium') {
    const adjust = await frame().evaluate(() => getComputedStyle(document.body).printColorAdjust)
    check(T('print: author backgrounds are kept (print-color-adjust: exact)'), adjust === 'exact')
    await page.emulateMedia({ media: 'screen' })
    const screenAdjust = await frame().evaluate(() => getComputedStyle(document.body).printColorAdjust)
    check(T('print rules never touch the screen'), screenAdjust === 'economy')
  }
  await browser.close()
}
server.close()

process.exit(failed ? 1 : 0)

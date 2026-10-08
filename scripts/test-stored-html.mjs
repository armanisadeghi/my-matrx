#!/usr/bin/env node
/**
 * /p/[id] serves the stored document as-is (lib/render/servedHtmlDocument.js):
 * its <html>/<body> attributes and whole <head> survive, and only our SEO tags,
 * the safety CSS and the frame script are injected — first in the head.
 *
 *   pnpm test:stored-html
 */
import { buildServedDocument, documentTitle, SAFETY_CSS, HEIGHT_MESSAGE_TYPE } from '../lib/render/servedHtmlDocument.js'

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

process.exit(failed ? 1 : 0)

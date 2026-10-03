#!/usr/bin/env node
/**
 * /p/[id] keeps a stored page's head scripts and stylesheets (lib/render/storedHtmlParts.js).
 * A chat-generated page that loads vis-network in its <head> rendered blank with
 * "vis is not defined" because the SEO path kept only <style> from the head.
 *
 *   pnpm test:stored-html
 */
import { splitStoredHtml } from '../lib/render/storedHtmlParts.js'

const PAGE = `<!DOCTYPE html><html><head>
<title>Naming Chemical Compounds Knowledge Graph</title>
<meta name="description" content="x">
<link rel="preconnect" href="https://unpkg.com">
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/x.css">
<style>body{margin:0}</style>
</head><body><div id="graph"></div><script>new vis.Network(document.getElementById('graph'), {}, {})</script></body></html>`

let failed = 0
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failed++
}

const parts = splitStoredHtml(PAGE)
check('the head <script src> survives', parts.headAssets.includes('vis-network.min.js'))
check('the head stylesheet survives', parts.headAssets.includes('x.css'))
check('preconnect survives', parts.headAssets.includes('rel="preconnect"'))
check('title and meta are left to <Head>', !/<title|<meta/i.test(parts.headAssets))
check('styles are kept', parts.inlineStyles.includes('margin:0'))
check('the body keeps its inline script', parts.body.includes('new vis.Network'))
check('head assets come in document order', parts.headAssets.indexOf('preconnect') < parts.headAssets.indexOf('vis-network') && parts.headAssets.indexOf('vis-network') < parts.headAssets.indexOf('x.css'))
check('a fragment with no head is all body', splitStoredHtml('<p>hi</p>').body === '<p>hi</p>' && splitStoredHtml('<p>hi</p>').headAssets === '')

process.exit(failed ? 1 : 0)

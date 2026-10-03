/**
 * Splits a stored full HTML document (`html_pages.html_content`) into what the
 * /p/[id] SEO path renders: the page's head ASSETS, its inline styles and its body.
 *
 * THE DEFECT (2026-10-03): when a page carries database SEO fields, /p/[id]
 * replaced the document's <head> with Next's <Head> and kept ONLY its <style>
 * blocks. Every <script src> and <link rel="stylesheet"> in the head was
 * dropped, while the body's inline scripts still ran — so a generated
 * "knowledge graph" page that loads vis-network from a CDN in its head rendered
 * blank with `ReferenceError: vis is not defined`. Every chat-generated page is
 * published WITH SEO fields (a title and "Generated from chat"), so every one
 * that loads a library in its head was broken.
 *
 * `headAssets` keeps every <script> (src and inline) and every
 * <link rel="stylesheet"|"preconnect"|"preload"|"modulepreload"> in document
 * order. The caller renders them BEFORE the body content, so a classic
 * <script src> still loads (and blocks) before the body's inline scripts run,
 * exactly as it did in the author's <head>. Title and meta stay with <Head>.
 */
const HEAD_ASSET =
  /<script\b[^>]*>[\s\S]*?<\/script\s*>|<link\b[^>]*\brel\s*=\s*["']?(?:stylesheet|preconnect|preload|modulepreload)\b[^>]*>/gi

export function splitStoredHtml(html) {
  const source = typeof html === 'string' ? html : ''
  const headMatch = source.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const head = headMatch ? headMatch[1] : ''
  const headAssets = (head.match(HEAD_ASSET) || []).join('\n')
  const styleMatches = head.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []
  const inlineStyles = styleMatches.join('\n')
  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : source
  return { headAssets, inlineStyles, body }
}

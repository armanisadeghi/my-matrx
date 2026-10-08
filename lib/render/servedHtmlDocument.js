/**
 * Builds the exact document /p/[id] serves for a stored html_pages row.
 *
 * The stored document is served AS-IS — its <html>/<body> attributes, its whole
 * <head> (metas, scripts, stylesheets, fonts) and its body. Until 2026-10-07 the
 * route poured it into Next's page structure, which dropped every <html>/<body>
 * attribute and every head meta but title/description (lib/render/storedHtmlParts.js,
 * now deleted).
 *
 * Into the head we inject only:
 *  1. SAFETY CSS, first, at zero specificity (`:where`) so any rule the author
 *     wrote wins: media never exceed their container, <pre> scrolls inside itself.
 *  2. Our SEO tags, each only when the document does not already carry it
 *     (database title/description replace the document's own when set).
 *  3. FRAME SCRIPT: reports the page's content height to the parent frame
 *     (`matrx-html-page:height`, chat sizes the inline preview to it), and —
 *     ONLY while the page scrolls sideways, so a layout that fits is never
 *     touched — fits what overflows: a table or <pre> scrolls inside its own
 *     wrapper, a no-wrap flex row wraps, a one-column grid whose track is wider
 *     than the screen (minmax(260px,1fr) at 320px) shrinks to the screen, and
 *     any other overflowing grid scrolls inside its own wrapper.
 */

export const HEIGHT_MESSAGE_TYPE = 'matrx-html-page:height'

export const SAFETY_CSS =
  ':where(img,video,canvas,svg,iframe,embed,object){max-width:100%}' +
  ':where(img,video){height:auto}' +
  ':where(pre){max-width:100%;overflow-x:auto}' +
  ':where([data-matrx-scroll-x]){max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}'

// Plain ES5 so it runs in any page; no globals leak (IIFE).
export const FRAME_SCRIPT = `(function(){
function wrap(el){
  var w=document.createElement('div'); w.setAttribute('data-matrx-scroll-x','');
  el.parentNode.insertBefore(w,el); w.appendChild(el);
}
function fit(){
  var de=document.documentElement, b=document.body; if(!b) return;
  if(de.scrollWidth<=de.clientWidth+1) return;
  var all=b.querySelectorAll('*');
  for(var i=0;i<all.length;i++){
    var el=all[i];
    if(!el.parentNode||el.closest('[data-matrx-scroll-x]')) continue;
    var over=el.scrollWidth>el.clientWidth+1;
    if(!over&&el.getBoundingClientRect().right<=de.clientWidth+1) continue;
    var tag=el.tagName, cs=getComputedStyle(el);
    if(tag==='TABLE'||(tag==='PRE'&&!el.closest('table'))){ wrap(el); continue; }
    if(!over) continue;
    if(cs.display.indexOf('flex')>-1&&cs.flexDirection.indexOf('row')===0&&cs.flexWrap==='nowrap'){ el.style.flexWrap='wrap'; continue; }
    if(cs.display.indexOf('grid')>-1){
      if(cs.gridTemplateColumns.split(' ').length===1) el.style.gridTemplateColumns='minmax(0,1fr)'; else wrap(el);
    }
  }
}
var last=-1;
function height(){
  var b=document.body; if(!b) return 0;
  var cs=getComputedStyle(b);
  var h=b.getBoundingClientRect().height+(parseFloat(cs.marginTop)||0)+(parseFloat(cs.marginBottom)||0);
  var kids=b.children, top=document.documentElement.getBoundingClientRect().top;
  for(var i=0;i<kids.length;i++){
    var k=kids[i], ks=getComputedStyle(k);
    if(ks.position==='fixed'||ks.display==='none') continue;
    var bottom=k.getBoundingClientRect().bottom-top+(parseFloat(ks.marginBottom)||0);
    if(bottom>h) h=bottom;
  }
  return Math.ceil(h);
}
function report(){
  if(window.parent===window) return;
  var h=height();
  if(h===last) return; last=h;
  try{window.parent.postMessage({type:'${HEIGHT_MESSAGE_TYPE}',height:h},'*');}catch(e){}
}
var queued=false;
function tick(){ if(queued) return; queued=true; requestAnimationFrame(function(){ queued=false; fit(); report(); }); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',tick); else tick();
window.addEventListener('load',tick);
window.addEventListener('resize',tick);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(tick);
if(window.ResizeObserver){ var ro=new ResizeObserver(tick); var start=function(){ if(document.body) ro.observe(document.body); ro.observe(document.documentElement); }; if(document.body) start(); else document.addEventListener('DOMContentLoaded',start); }
})();`

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const escapeText = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const TITLE_RE = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i
const DESCRIPTION_RE = /<meta\b[^>]*\bname\s*=\s*["']?description["']?[^>]*>/i

const has = (doc, re) => re.test(doc)

/** The page's own <title> text, or '' when it has none. */
export function documentTitle(html) {
  const match = typeof html === 'string' ? html.match(TITLE_RE) : null
  return match ? match[1].trim() : ''
}

function documentDescription(html) {
  const tag = html.match(DESCRIPTION_RE)
  if (!tag) return ''
  const content = tag[0].match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i)
  return content ? (content[1] ?? content[2] ?? '') : ''
}

/** A full document keeps its own structure; a fragment gets a minimal one. */
function asDocument(html) {
  if (/<html\b/i.test(html) && /<head\b/i.test(html)) return html
  if (/<html\b/i.test(html)) return html.replace(/<html\b([^>]*)>/i, '<html$1><head></head>')
  return `<!DOCTYPE html>\n<html lang="en"><head></head><body>${html}</body></html>`
}

/**
 * @param {{ id: string, html_content: string, meta_title?: string|null,
 *   meta_description?: string|null, meta_keywords?: string|null, og_image?: string|null,
 *   canonical_url?: string|null, is_indexable?: boolean|null }} page
 * @param {{ origin?: string }} [options]
 * @returns {string} the complete document to send
 */
export function buildServedDocument(page, { origin = 'https://www.mymatrx.com' } = {}) {
  let doc = asDocument(typeof page.html_content === 'string' ? page.html_content : '')

  const title = page.meta_title || documentTitle(doc) || 'Untitled Page'
  const description = page.meta_description || documentDescription(doc)

  // Database values win: drop the document's own title/description only when we replace them.
  if (page.meta_title && has(doc, TITLE_RE)) doc = doc.replace(TITLE_RE, '')
  if (page.meta_description && has(doc, DESCRIPTION_RE)) doc = doc.replace(DESCRIPTION_RE, '')

  const tags = [`<style data-matrx-safety>${SAFETY_CSS}</style>`]
  if (!/<meta\b[^>]*charset/i.test(doc)) tags.push('<meta charset="utf-8">')
  if (!/<meta\b[^>]*name\s*=\s*["']?viewport/i.test(doc)) {
    tags.push('<meta name="viewport" content="width=device-width, initial-scale=1">')
  }
  if (!has(doc, TITLE_RE)) tags.push(`<title>${escapeText(title)}</title>`)
  if (description && !has(doc, DESCRIPTION_RE)) {
    tags.push(`<meta name="description" content="${escapeAttr(description)}">`)
  }
  if (!/rel\s*=\s*["']?(?:shortcut )?icon/i.test(doc)) tags.push('<link rel="icon" href="/favicon.ico">')
  if (!/name\s*=\s*["']?robots/i.test(doc)) {
    tags.push(`<meta name="robots" content="${page.is_indexable ? 'index, follow' : 'noindex, nofollow'}">`)
  }
  if (page.meta_keywords && !/name\s*=\s*["']?keywords/i.test(doc)) {
    tags.push(`<meta name="keywords" content="${escapeAttr(page.meta_keywords)}">`)
  }
  if (page.canonical_url && !/rel\s*=\s*["']?canonical/i.test(doc)) {
    tags.push(`<link rel="canonical" href="${escapeAttr(page.canonical_url)}">`)
  }
  if (!/property\s*=\s*["']?og:/i.test(doc)) {
    tags.push(
      `<meta property="og:title" content="${escapeAttr(title)}">`,
      `<meta property="og:description" content="${escapeAttr(description)}">`,
      '<meta property="og:type" content="article">',
      `<meta property="og:url" content="${escapeAttr(`${origin}/p/${page.id}`)}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escapeAttr(title)}">`,
      `<meta name="twitter:description" content="${escapeAttr(description)}">`,
    )
    if (page.og_image) {
      tags.push(
        `<meta property="og:image" content="${escapeAttr(page.og_image)}">`,
        `<meta name="twitter:image" content="${escapeAttr(page.og_image)}">`,
      )
    }
  }
  tags.push(`<script data-matrx-frame>${FRAME_SCRIPT}</script>`)

  // Safety CSS and SEO go FIRST in the head (author CSS after it wins); the frame
  // script is harmless anywhere and needs no DOM at parse time.
  return doc.replace(/<head\b([^>]*)>/i, (open) => `${open}\n${tags.join('\n')}\n`)
}

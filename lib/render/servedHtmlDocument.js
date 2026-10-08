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
 *     Its `@media print` part keeps the author's backgrounds and keeps small
 *     cards (marked by the frame script on `beforeprint`), figures, rows and
 *     list items from splitting across pages.
 *  2. Our SEO tags, each only when the document does not already carry it
 *     (database title/description replace the document's own when set).
 *  3. FRAME SCRIPT: reports the page's content height to the parent frame
 *     (`matrx-html-page:height`, chat sizes the inline preview to it), and
 *     FITS a page that scrolls sideways — see FIT below.
 *
 * FIT — fit, don't reflow. A page that fits is never touched. A page wider than
 * its frame is first SCALED to the frame width (CSS `zoom` on <html>), which
 * keeps the author's layout: a row of eight cards stays one row in a 750px chat
 * card. Only when scaling would go below FIT_MIN_SCALE (0.75 — 16px body text
 * becomes 12px, the smallest size still comfortable to read; in practice: a
 * desktop page on a phone) does it REFLOW instead: a table, <pre> or
 * multi-track grid scrolls inside itself, a no-wrap flex row wraps, a one-track
 * grid wider than the screen shrinks — then any small remainder is scaled.
 *
 * MODES (the frame URL's query): `?fit=card` — the chat inline card — scales
 * as above. No parameter — the page opened on its own or in the canvas app
 * frame — never scales (zoom would break games and drag code that mix
 * offsetX with clientX) and reflows only a HEAVY overflow (below the same
 * 0.75 line); a modest one is left as the author wrote it. `?print=1` — a page
 * opened to be printed — is never touched: natural layout, and when opened top-level
 * (the app's Print, from a click) it prints itself once loaded (fonts included).
 *
 * Only VISIBLE overflow counts: a page whose <html> or <body> clips sideways
 * (`overflow-x: hidden|clip` — off-canvas drawers, slide-in animations) is
 * never fitted for things nobody can see.
 *
 * A pass reruns only when the frame WIDTH changes (or on load / fonts ready);
 * a height-only change — an animating page — only re-reports the height,
 * unless a page left untouched has since started to overflow.
 *
 * Every adjustment is an attribute (`data-matrx-fit` on elements,
 * `data-matrx-zoom` + `--matrx-zoom` on <html>) whose rules live in
 * `@media screen`, so: (a) each pass first removes them all and decides again
 * from the author's own layout — a resize back to a wide frame restores the
 * page exactly (nothing is sticky, no node is ever moved); (b) print ignores
 * them and prints the author's natural layout.
 *
 * Why `zoom`, not `transform: scale`: zoom changes LAYOUT, so the document's
 * height, `position: fixed/sticky`, hit-testing and text rasterization (crisp,
 * not a scaled bitmap) all stay right with no compensation, and the height the
 * parent reads is already the scaled height. A transform would need an explicit
 * body width, a manual height correction, and makes every fixed element scroll
 * with the page. `zoom` is standard (Chrome 128+, Firefox 126+, Safari always);
 * where it is missing the pass sees the overflow remain and reflows instead.
 */

export const HEIGHT_MESSAGE_TYPE = 'matrx-html-page:height'

/** Below this scale, text is too small to read: reflow instead of scaling. */
export const FIT_MIN_SCALE = 0.75

/**
 * Printing: a boxed element (background, border or shadow — a card, a tile,
 * a callout) shorter than this many CSS px is kept whole on one page. Taller
 * boxes (a whole section) may split, or they would leave half-empty pages.
 * Marked on `beforeprint`, cleared on `afterprint`; screen never sees it.
 */
export const PRINT_KEEP_MAX_HEIGHT = 480

export const SAFETY_CSS =
  ':where(img,video,canvas,svg,iframe,embed,object){max-width:100%}' +
  ':where(img,video){height:auto}' +
  ':where(pre){max-width:100%;overflow-x:auto}' +
  // FIT attributes — set and cleared only by the frame script, screen only.
  '@media screen{' +
  'html[data-matrx-zoom]{zoom:var(--matrx-zoom)!important}' +
  '[data-matrx-fit=scroll]{display:block!important;max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch}' +
  '[data-matrx-fit=scroll-grid],[data-matrx-fit=scroll-pre]{max-width:100%!important;overflow-x:auto!important;-webkit-overflow-scrolling:touch}' +
  '[data-matrx-fit=wrap]{flex-wrap:wrap!important}' +
  '[data-matrx-fit=shrink]{grid-template-columns:minmax(0,1fr)!important}' +
  '}' +
  '@media print{' +
  ':where(*){-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  ':where(figure,img,svg,canvas,video,pre,blockquote,tr,li,h1,h2,h3,h4,[data-matrx-keep]){break-inside:avoid}' +
  ':where(h1,h2,h3,h4){break-after:avoid}' +
  '}'

// Plain ES5 so it runs in any page; no globals leak (IIFE).
export const FRAME_SCRIPT = `(function(){
var MIN=${FIT_MIN_SCALE}, KEEP=${PRINT_KEEP_MAX_HEIGHT}, de=document.documentElement;
var q=location.search, MODE=/[?&]print=1(&|$)/.test(q)?'print':/[?&]fit=card(&|$)/.test(q)?'card':'page';
function clips(el){ var x=el?getComputedStyle(el).overflowX:''; return x==='hidden'||x==='clip'; }
function over(){ return !clips(de)&&!clips(document.body)&&de.scrollWidth>de.clientWidth+1; }
function reset(){
  de.removeAttribute('data-matrx-zoom'); de.style.removeProperty('--matrx-zoom');
  var marked=document.querySelectorAll('[data-matrx-fit]');
  for(var i=0;i<marked.length;i++) marked[i].removeAttribute('data-matrx-fit');
}
function zoom(s){ de.style.setProperty('--matrx-zoom',String(s)); de.setAttribute('data-matrx-zoom',''); }
function scale(){
  for(var n=0;n<3&&over();n++){
    var cur=parseFloat(de.style.getPropertyValue('--matrx-zoom'))||1;
    var s=Math.floor(cur*de.clientWidth/de.scrollWidth*1000)/1000;
    if(s<MIN) return false;
    zoom(s);
  }
  return !over();
}
function reflow(){
  var all=document.body.querySelectorAll('*');
  for(var i=0;i<all.length;i++){
    var el=all[i];
    if(el.closest('[data-matrx-fit^=scroll]')) continue;
    var wide=el.scrollWidth>el.clientWidth+1;
    if(!wide&&el.getBoundingClientRect().right<=de.clientWidth+1) continue;
    var tag=el.tagName, cs=getComputedStyle(el);
    if(tag==='TABLE'){ el.setAttribute('data-matrx-fit','scroll'); continue; }
    if(tag==='PRE'&&!el.closest('table')){ el.setAttribute('data-matrx-fit','scroll-pre'); continue; }
    if(!wide) continue;
    if(cs.display.indexOf('flex')>-1&&cs.flexDirection.indexOf('row')===0&&cs.flexWrap==='nowrap'){ el.setAttribute('data-matrx-fit','wrap'); continue; }
    if(cs.display.indexOf('grid')>-1) el.setAttribute('data-matrx-fit',cs.gridTemplateColumns.split(' ').length===1?'shrink':'scroll-grid');
  }
}
function fit(){
  if(!document.body||MODE==='print') return;
  reset();
  if(!over()) return;
  if(MODE==='card'){
    if(scale()) return;
    reset(); reflow();
    if(over()) scale();
    return;
  }
  if(de.clientWidth/de.scrollWidth<MIN) reflow();
}
var last=-1;
function height(){
  var b=document.body; if(!b) return 0;
  var cs=getComputedStyle(b);
  var h=b.getBoundingClientRect().height+(parseFloat(cs.marginTop)||0)+(parseFloat(cs.marginBottom)||0);
  var kids=b.children, top=de.getBoundingClientRect().top;
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
var queued=false, forced=false, lastW=-1;
function run(){
  queued=false;
  var w=window.innerWidth, touched=de.hasAttribute('data-matrx-zoom')||!!document.querySelector('[data-matrx-fit]');
  // Refit only when the frame WIDTH changes (or on load/fonts); a height-only
  // change (an animating page) never re-runs the pass — unless a page left
  // untouched has since started to overflow (late content).
  if(forced||w!==lastW||(!touched&&over())) fit();
  forced=false; lastW=w; report();
}
function tick(){ if(queued) return; queued=true; requestAnimationFrame(run); }
function refit(){ forced=true; tick(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',refit); else refit();
window.addEventListener('load',refit);
window.addEventListener('resize',tick);
function keep(){
  var all=document.body?document.body.querySelectorAll('*'):[];
  for(var i=0;i<all.length;i++){
    var el=all[i], cs=getComputedStyle(el);
    if(cs.display==='inline'||cs.display==='none') continue;
    var boxed=cs.backgroundColor!=='rgba(0, 0, 0, 0)'||cs.backgroundImage!=='none'||cs.boxShadow!=='none'||parseFloat(cs.borderTopWidth)>0;
    if(boxed&&el.getBoundingClientRect().height<KEEP) el.setAttribute('data-matrx-keep','');
  }
}
function unkeep(){ var k=document.querySelectorAll('[data-matrx-keep]'); for(var i=0;i<k.length;i++) k[i].removeAttribute('data-matrx-keep'); }
window.addEventListener('beforeprint',keep);
window.addEventListener('afterprint',unkeep);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(refit);
if(window.ResizeObserver){ var ro=new ResizeObserver(tick); var start=function(){ if(document.body) ro.observe(document.body); ro.observe(de); }; if(document.body) start(); else document.addEventListener('DOMContentLoaded',start); }
// ?print=1 opened top-level (the app's Print, from a click): print once the page and its fonts
// have loaded, at natural layout. Never inside a frame.
if(MODE==='print'&&window.top===window){
  var printed=false;
  var printNow=function(){ if(printed) return; printed=true; setTimeout(function(){ window.focus(); window.print(); },150); };
  var whenLoaded=function(){ if(document.fonts&&document.fonts.ready) document.fonts.ready.then(printNow,printNow); else printNow(); };
  if(document.readyState==='complete') whenLoaded(); else window.addEventListener('load',whenLoaded);
}
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

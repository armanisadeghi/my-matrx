/**
 * The resolved CSS cascade for a client-site page — the ONE place the layer
 * order and the layer gating live.
 *
 * Order: `theme -> global_css -> header css -> footer css -> page css`. Blank
 * layers drop out; non-blank layers are joined with a blank line. No scoping is
 * ever applied to any layer.
 *
 * A PAGE THAT OPTED OUT OF A COMPONENT DOES NOT CARRY ITS CSS. `use_client_header`
 * / `use_client_footer` gate the component's stylesheet exactly as they gate its
 * markup — a headerless page shipping header CSS is at best dead bytes and at
 * worst live rules (resets, `body` declarations) styling a header that isn't
 * there. This used to be renderer-only drift: the flags gated the HTML while the
 * CSS went out unconditionally, so `cms_inspect css_cascade` (which gated both)
 * reported a cascade the live site did not serve. Contract C5 requires the tool
 * to mirror the renderer exactly.
 *
 * TWIN: `aidream/services/cms_introspect/cascade.py` (`resolve_cascade`).
 * **Change both or they drift.** The Python side additionally resolves `_draft`
 * twins per column; this renderer only ever sees one resolved value per column
 * (drafts are folded in upstream by `toRenderClientProps`/`stripDraftFields`),
 * so the gating and the ordering are the whole shared contract here.
 */

/**
 * @param {object}  args
 * @param {string}  [args.themeCss]         pre-rendered `:root{}` block (lib/render/themeCss.js)
 * @param {string}  [args.globalCss]        `client_sites.global_css`
 * @param {object}  [args.headerComponent]  header row, or undefined when the site has none
 * @param {object}  [args.footerComponent]  footer row, or undefined when the site has none
 * @param {object}  args.page               page row — supplies `css_content` and the two flags
 * @returns {string} the combined stylesheet ('' when every layer is blank)
 */
export function buildCombinedCss({ themeCss, globalCss, headerComponent, footerComponent, page }) {
  return [
    themeCss,
    globalCss,
    page?.use_client_header ? headerComponent?.css_content : null,
    page?.use_client_footer ? footerComponent?.css_content : null,
    page?.css_content,
  ].filter(Boolean).join('\n\n')
}

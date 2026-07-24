import Document, { Html, Head, Main, NextScript } from 'next/document'

/**
 * Custom Document — exists for exactly ONE reason: the W2-C site-key
 * injection on published client-site renders.
 *
 * Why here and not in the page component: page props serialize verbatim into
 * public __NEXT_DATA__, and the site data key must ride the HTML only (it is
 * injected as a plain <script>, never as data). The renderer's
 * getServerSideProps stashes {slug, dataKey} on the Node request object
 * (req.__matrxSiteInject — set in lib/render/clientSiteRenderer.js
 * loadSitePageProps, published normal pages only, never preview, never
 * listing pages, never when the site has no data_api_key). Document renders
 * server-side only and its props are NOT serialized to the client, so the key
 * appears once, in markup, and nowhere in the Next data blob.
 *
 * Placement: document <head>, so the inline script executes before the page's
 * js_content <script> (which lives in the body via <Main />) — page JS can
 * rely on window.__MATRX_SITE__ being set.
 */
export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    const siteInject = ctx.req?.__matrxSiteInject || null
    return { ...initialProps, siteInject }
  }

  render() {
    const { siteInject } = this.props
    // JSON.stringify + escape '<' so a hostile value can never close the
    // script tag or open a comment (</script>, <!-- injection).
    const siteInjectJs = siteInject
      ? `window.__MATRX_SITE__=${JSON.stringify(siteInject).replace(/</g, '\\u003c')};`
      : null

    return (
      <Html>
        <Head>{siteInjectJs && <script dangerouslySetInnerHTML={{ __html: siteInjectJs }} />}</Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

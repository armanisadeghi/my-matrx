import Head from 'next/head'
import { getClientSite, getClientPage, getClientPageByCategory, getClientPages, getClientComponents, getClientHomePage } from '@/lib/supabase/clientHelpers'

export default function ClientPage({ client, page, relatedPages, components, isPreview, isList, notFound }) {
  if (notFound) {
    return (
      <>
        <Head>
          <title>Page Not Found</title>
          <meta name="robots" content="noindex" />
        </Head>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontFamily: 'Arial, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1>Page Not Found</h1>
            <p>The requested page could not be found.</p>
          </div>
        </div>
      </>
    )
  }

  // If this is a listing page, render with related items
  if (isList) {
    return renderListingPage(client, page, relatedPages, components, isPreview)
  }

  // Otherwise render normal page
  return renderNormalPage(client, page, components, isPreview)
}

// Render listing page with cards
function renderListingPage(client, page, relatedPages, components, isPreview) {
  const metaTitle = page.meta_title || `${page.title} | ${client.name}`
  const metaDescription = page.meta_description || page.excerpt || ''
  const headerComponent = components.find(c => c.component_type === 'header')
  const footerComponent = components.find(c => c.component_type === 'footer')
  
  const combinedCSS = [
    client.global_css,
    headerComponent?.css_content,
    footerComponent?.css_content,
    page.css_content
  ].filter(Boolean).join('\n\n')

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="icon" href={client.favicon || '/favicon.ico'} />
        <link rel="apple-touch-icon" href={client.favicon || '/favicon.ico'} />
        {isPreview && <meta name="robots" content="noindex, nofollow" />}
        {combinedCSS && <style dangerouslySetInnerHTML={{ __html: combinedCSS }} />}
      </Head>

      {isPreview && page._isPreview && renderPreviewBanner(client, page)}
      {page.use_client_header && headerComponent && <div dangerouslySetInnerHTML={{ __html: headerComponent.html_content }} />}
      
      {/* Page content */}
      <div dangerouslySetInnerHTML={{ __html: page.html_content }} />
      
      {/* List of related pages */}
      {relatedPages && relatedPages.length > 0 && (
        <section style={{ padding: '3rem 2rem', background: 'var(--color-background-subtle, #f5f5f0)' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '2rem' 
            }}>
              {relatedPages.map(relatedPage => (
                <a 
                  key={relatedPage.id}
                  href={`/c/${client.slug}/${relatedPage.category}/${relatedPage.slug}`}
                  style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    color: 'inherit',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    transition: 'transform 0.3s, box-shadow 0.3s',
                    display: 'block'
                  }}
                >
                  {relatedPage.featured_image && (
                    <img 
                      src={relatedPage.featured_image} 
                      alt={relatedPage.title}
                      style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px', marginBottom: '1rem' }}
                    />
                  )}
                  <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-primary-teal, #3BA5A5)' }}>
                    {relatedPage.title}
                  </h3>
                  {relatedPage.excerpt && (
                    <p style={{ color: 'var(--color-text-secondary, #666)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                      {relatedPage.excerpt}
                    </p>
                  )}
                  {relatedPage.author && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #999)', marginTop: '0.5rem' }}>
                      By {relatedPage.author}
                    </p>
                  )}
                  {relatedPage.published_date && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary, #999)', marginTop: '0.25rem' }}>
                      {new Date(relatedPage.published_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {page.use_client_footer && footerComponent && <div dangerouslySetInnerHTML={{ __html: footerComponent.html_content }} />}
    </>
  )
}

// Render normal page
function renderNormalPage(client, page, components, isPreview) {
  const metaTitle = page.meta_title || page.title || client.name
  const metaDescription = page.meta_description || page.excerpt || client.meta_defaults?.default_description || ''
  const ogImage = page.og_image || page.featured_image || client.meta_defaults?.default_og_image || ''
  const canonicalUrl = page.canonical_url || `https://mymatrx.com/c/${client.slug}/${page.category ? page.category + '/' : ''}${page.slug}`

  const headerComponent = components.find(c => c.component_type === 'header')
  const footerComponent = components.find(c => c.component_type === 'footer')

  const combinedCSS = [
    client.global_css,
    headerComponent?.css_content,
    footerComponent?.css_content,
    page.css_content
  ].filter(Boolean).join('\n\n')

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <link rel="icon" href={client.favicon || '/favicon.ico'} />
        <link rel="apple-touch-icon" href={client.favicon || '/favicon.ico'} />
        {isPreview && <meta name="robots" content="noindex, nofollow" />}
        
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content={page.page_type === 'blog' ? 'article' : 'website'} />
        <meta property="og:url" content={canonicalUrl} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
        
        {!isPreview && <link rel="canonical" href={canonicalUrl} />}
        {combinedCSS && <style dangerouslySetInnerHTML={{ __html: combinedCSS }} />}
      </Head>

      {isPreview && page._isPreview && renderPreviewBanner(client, page)}
      {page.use_client_header && headerComponent && <div dangerouslySetInnerHTML={{ __html: headerComponent.html_content }} />}
      <div dangerouslySetInnerHTML={{ __html: page.html_content }} />
      {page.use_client_footer && footerComponent && <div dangerouslySetInnerHTML={{ __html: footerComponent.html_content }} />}
      {page.js_content && <script dangerouslySetInnerHTML={{ __html: page.js_content }} />}
    </>
  )
}

// Preview banner component
function renderPreviewBanner(client, page) {
  const backUrl = page.category ? `/c/${client.slug}/${page.category}/${page.slug}` : `/c/${client.slug}/${page.slug}`
  
  return (
    <div style={{
      background: 'linear-gradient(135deg, #ff9800, #f57c00)',
      color: 'white',
      padding: '12px 20px',
      position: 'sticky',
      top: 0,
      zIndex: 10000,
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <span style={{ fontWeight: 600 }}>
          PREVIEW MODE - Viewing unpublished changes
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <a 
          href={backUrl}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: '1px solid white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          View Live Version
        </a>
      </div>
    </div>
  )
}

export async function getServerSideProps({ params, query }) {
  try {
    const { client: clientSlug, slug = [] } = params
    const isPreview = query.preview === 'true'

    console.log('=== Client Page SSR (Catch-All) ===')
    console.log('Client:', clientSlug)
    console.log('Slug segments:', slug)
    console.log('Preview:', isPreview)

    // Validate environment
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing Supabase environment variables')
      return { props: { notFound: true } }
    }

    // Get client site
    const client = await getClientSite(clientSlug)
    if (!client) {
      console.log('Client not found:', clientSlug)
      return { props: { notFound: true } }
    }

    let page = null

    // Determine routing based on slug segments
    if (slug.length === 0) {
      // No slug - redirect to home page
      console.log('No slug provided - redirecting to home')
      const homePage = await getClientHomePage(clientSlug, isPreview)
      
      if (!homePage) {
        return { props: { notFound: true } }
      }
      
      const destination = isPreview 
        ? `/c/${clientSlug}/${homePage.slug}?preview=true`
        : `/c/${clientSlug}/${homePage.slug}`
      
      return {
        redirect: {
          destination,
          permanent: false
        }
      }
    } else if (slug.length === 1) {
      // Single segment: /c/iopbm/education
      const pageSlug = slug[0]
      console.log('Single segment route - fetching page:', pageSlug)
      page = await getClientPage(clientSlug, pageSlug, isPreview)
    } else if (slug.length === 2) {
      // Two segments: /c/iopbm/education/gut-health-basics
      const [category, pageSlug] = slug
      console.log('Two segment route - category:', category, 'slug:', pageSlug)
      page = await getClientPageByCategory(clientSlug, category, pageSlug, isPreview)
    } else {
      // More than 2 segments - not supported
      console.log('Too many slug segments:', slug.length)
      return { props: { notFound: true } }
    }

    if (!page) {
      console.log('Page not found for slug:', slug)
      return { props: { notFound: true } }
    }

    // Get components (header, footer)
    const components = await getClientComponents(clientSlug, null, isPreview)

    // Check if this is a listing page
    let relatedPages = []
    let isList = false
    if (page.page_type === 'listing' && page.category) {
      isList = true
      // Get all pages in this category
      relatedPages = await getClientPages(clientSlug, false, page.category)
      // Filter out the listing page itself
      relatedPages = relatedPages.filter(p => p.id !== page.id && p.page_type !== 'listing')
      console.log('Listing page detected:', page.category, 'Found', relatedPages.length, 'related pages')
    }

    console.log('Page loaded successfully:', page.title)
    console.log('Page type:', page.page_type, 'Category:', page.category)
    console.log('Has draft:', page._isPreview || false)

    return {
      props: {
        client,
        page,
        relatedPages,
        components,
        isPreview,
        isList
      }
    }
  } catch (error) {
    console.error('Error in getServerSideProps:', error)
    return { props: { notFound: true } }
  }
}


import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'
import { isLive } from '@/lib/render/pageSelection'
import { splitStoredHtml } from '@/lib/render/storedHtmlParts'

export default function DynamicPage({ pageData, notFound }) {
  if (notFound) {
    return (
      <>
        <Head>
          <title>Page Not Found - MyMatrx</title>
          <meta name="description" content="The requested page could not be found." />
          <link rel="icon" href="/favicon.ico" />
          <link rel="shortcut icon" href="/favicon.ico" />
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

  // Extract title from HTML content if no meta_title exists in database
  const extractTitleFromHTML = (htmlContent) => {
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i)
    return titleMatch ? titleMatch[1] : 'Untitled Page'
  }

  // Extract description from HTML content if no meta_description exists in database
  const extractDescriptionFromHTML = (htmlContent) => {
    const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    return descMatch ? descMatch[1] : ''
  }

  // Database values ALWAYS win if they exist, otherwise extract from HTML
  const metaTitle = pageData.meta_title || extractTitleFromHTML(pageData.html_content)
  const metaDescription = pageData.meta_description || extractDescriptionFromHTML(pageData.html_content)
  
  // Determine robots meta tag based on is_indexable field (defaults to noindex)
  const robotsMeta = pageData.is_indexable ? 'index, follow' : 'noindex, nofollow'

  // Check if HTML already has complete head section
  const hasCompleteHead = pageData.html_content.includes('<html') && pageData.html_content.includes('<head>')
  
  // If we have database SEO fields, always use Next.js Head for better SEO control
  const hasDatabaseSEO = pageData.meta_title || pageData.meta_description || pageData.meta_keywords || pageData.og_image

  if (hasCompleteHead && !hasDatabaseSEO) {
    // Only use raw HTML if no database SEO fields are present
    let enhancedHTML = pageData.html_content
    
    // Add favicon if not present
    if (!enhancedHTML.includes('favicon')) {
      enhancedHTML = enhancedHTML.replace(
        /<head([^>]*)>/i, 
        `<head$1>\n    <link rel="icon" href="/favicon.ico" />\n    <link rel="shortcut icon" href="/favicon.ico" />`
      )
    }
    
    // Add canonical URL if not present and we have one
    if (pageData.canonical_url && !enhancedHTML.includes('rel="canonical"')) {
      enhancedHTML = enhancedHTML.replace(
        /<head([^>]*)>/i, 
        `<head$1>\n    <link rel="canonical" href="${pageData.canonical_url}" />`
      )
    }

    return <div dangerouslySetInnerHTML={{ __html: enhancedHTML }} />
  }

  // Extract body content and styles if HTML has complete head, otherwise use full content
  let bodyContent = pageData.html_content
  let inlineStyles = ''
  
  if (hasCompleteHead) {
    // The head's <style>s go to <Head>; its scripts and stylesheets go FIRST in
    // the body so they load before the body's inline scripts, as they did in
    // the author's <head> (lib/render/storedHtmlParts.js — they used to be
    // dropped, and a page loading a library from a CDN rendered blank).
    const parts = splitStoredHtml(pageData.html_content)
    inlineStyles = parts.inlineStyles
    bodyContent = parts.headAssets ? `${parts.headAssets}\n${parts.body}` : parts.body
  }

  // Use Next.js Head component for SEO control
  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        
        {/* Extracted styles from original HTML */}
        {inlineStyles && (
          <style dangerouslySetInnerHTML={{ __html: inlineStyles.replace(/<\/?style[^>]*>/gi, '') }} />
        )}
        
        {/* SEO Meta Tags */}
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://mymatrx.com/p/${pageData.id}`} />
        
        {pageData.og_image && (
          <meta property="og:image" content={pageData.og_image} />
        )}
        
        {pageData.meta_keywords && (
          <meta name="keywords" content={pageData.meta_keywords} />
        )}
        
        {pageData.canonical_url && (
          <link rel="canonical" href={pageData.canonical_url} />
        )}
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        
        {pageData.og_image && (
          <meta name="twitter:image" content={pageData.og_image} />
        )}
        
        {/* Additional SEO */}
        <meta name="robots" content={robotsMeta} />
        <meta name="author" content="MyMatrx" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  )
}

export async function getServerSideProps(props) {
  try {
    const params = await props.params
    console.log('=== SERVER SIDE PROPS DEBUG ===')
    console.log('Params:', params)
    console.log('Environment check:')
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? 'SET' : 'NOT SET')

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('Missing environment variables!')
      return {
        props: {
          notFound: true
        }
      }
    }

    // Use service role key for server-side operations (more reliable)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    )

    console.log('Fetching page server-side:', params.id)

    const { data, error } = await supabase
      .from('html_pages')
      .select('*')
      .eq('id', params.id)
      .single()

    // An archived html_page (CMS 0041 deleted_at) is gone until restored. The
    // service role skips row security, so the gate lives here (see isLive).
    if (error || !data || !isLive(data)) {
      console.log('Page not found:', params.id, error?.message)
      return {
        notFound: true
      }
    }

    console.log('Page found server-side:', data.meta_title || 'Untitled')

    // SECURITY: props are serialized into public __NEXT_DATA__ — whitelist
    // exactly the fields the component reads (never ship user_id or any
    // other internal html_pages column).
    const pageData = {}
    for (const field of ['id', 'html_content', 'meta_title', 'meta_description', 'meta_keywords', 'og_image', 'canonical_url', 'is_indexable']) {
      pageData[field] = data[field] === undefined ? null : data[field]
    }

    return {
      props: {
        pageData
      }
    }
  } catch (error) {
    console.error('Error fetching page server-side:', error)
    return {
      props: {
        notFound: true
      }
    }
  }
}

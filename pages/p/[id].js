import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'
import { isLive } from '@/lib/render/pageSelection'
import { buildServedDocument } from '@/lib/render/servedHtmlDocument'

/**
 * /p/[id] — a published html_pages document. getServerSideProps writes the
 * document itself to the response, so this component renders only when the
 * page could not be read at all.
 */
export default function DynamicPage() {
  return (
    <>
      <Head>
        <title>Page Not Found - MyMatrx</title>
        <meta name="description" content="The requested page could not be found." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Page Not Found</h1>
          <p>The requested page could not be found.</p>
        </div>
      </div>
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

    // The stored document goes out byte-for-byte, with only our SEO tags, the
    // safety CSS and the frame script injected into its head
    // (lib/render/servedHtmlDocument.js) — never poured into Next's page shell.
    const html = buildServedDocument(pageData)
    props.res.setHeader('Content-Type', 'text/html; charset=utf-8')
    props.res.end(html)
    return { props: {} }
  } catch (error) {
    console.error('Error fetching page server-side:', error)
    return {
      props: {
        notFound: true
      }
    }
  }
}

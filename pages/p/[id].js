import { createClient } from '@supabase/supabase-js'

export default function DynamicPage({ pageData, notFound }) {
  if (notFound) {
    return (
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
    )
  }

  // Render the HTML content directly
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: pageData.html_content }} 
    />
  )
}

export async function getServerSideProps({ params }) {
  try {
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

    if (error || !data) {
      console.log('Page not found:', params.id, error?.message)
      return {
        notFound: true
      }
    }

    console.log('Page found server-side:', data.title)

    return {
      props: {
        pageData: data
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

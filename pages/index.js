import Head from 'next/head'

export default function HomePage({ recentPages }) {
  return (
    <>
      <Head>
        <title>MyMatrx - Dynamic HTML Pages</title>
        <meta name="description" content="Create and serve dynamic HTML pages with AI-powered content generation" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <div style={{ 
        fontFamily: 'Arial, sans-serif', 
        padding: '40px', 
        maxWidth: '800px', 
        margin: '0 auto' 
      }}>
      <h1>🚀 My Matrx - Dynamic HTML Pages</h1>
      <p>This is a Next.js app that serves HTML pages dynamically from Supabase.</p>
      
      <div>
        <h2>📄 Recent Pages</h2>
        {recentPages && recentPages.length > 0 ? (
          <ul>
            {recentPages.map(page => (
              <li key={page.id} style={{ marginBottom: '10px' }}>
                <a href={`/p/${page.id}`} style={{ color: '#007bff' }}>
                  {page.title}
                </a>
                <span style={{ color: '#666', marginLeft: '10px' }}>
                  {new Date(page.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No pages found. Create a test page to get started!</p>
        )}
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#e9ecef', borderRadius: '8px' }}>
        <h3>🛠️ Administration</h3>
        <p>
          <a href="/admin" style={{ color: '#007bff', textDecoration: 'none', fontSize: '18px' }}>
            → Go to Admin Dashboard
          </a>
        </p>
        <p style={{ color: '#666', fontSize: '14px', margin: '10px 0 0 0' }}>
          Manage pages, test database connections, and system diagnostics
        </p>
      </div>
    </div>
    </>
  )
}

export async function getServerSideProps() {
  // Skip server-side page loading for now - we'll load via API
  return {
    props: {
      recentPages: []
    }
  }
}

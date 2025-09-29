import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [testResult, setTestResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pages, setPages] = useState([])
  const [serverData, setServerData] = useState(null)

  // Load pages on mount
  useEffect(() => {
    if (activeTab === 'pages') {
      loadPages()
    }
  }, [activeTab])

  const loadPages = async () => {
    try {
      const response = await fetch('/api/list-pages')
      const result = await response.json()
      if (result.success) {
        setPages(result.pages)
      }
    } catch (error) {
      console.error('Failed to load pages:', error)
    }
  }

  const testDatabaseConnection = async () => {
    setIsLoading(true)
    setTestResult('Testing database connection...')
    
    try {
      const response = await fetch('/api/test-db')
      const result = await response.json()

      if (result.success) {
        setTestResult(`✅ Database Connected! Method: ${result.method}\n${result.message}`)
        setServerData(result)
      } else {
        setTestResult(`❌ Database Error: ${JSON.stringify(result, null, 2)}`)
      }
    } catch (err) {
      setTestResult(`❌ Connection Failed: ${err.message}`)
    }
    
    setIsLoading(false)
  }

  const createTestPage = async () => {
    setIsLoading(true)
    setTestResult('Creating test page...')
    
    try {
      const testHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Admin Test Page</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { max-width: 600px; margin: 0 auto; text-align: center; }
            .timestamp { font-size: 14px; opacity: 0.8; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Admin Test Page</h1>
            <p>This page was created from the admin interface.</p>
            <div class="timestamp">Created: ${new Date().toLocaleString()}</div>
          </div>
        </body>
        </html>
      `

      const response = await fetch('/api/create-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `Admin Test Page - ${new Date().toLocaleString()}`,
          description: 'Test page created from admin interface',
          html_content: testHTML,
          user_id: '00000000-0000-0000-0000-000000000000' // Admin test user
        })
      })

      const result = await response.json()

      if (result.success) {
        setTestResult(`✅ Page Created Successfully!\nPage ID: ${result.pageId}\nURL: /p/${result.pageId}`)
        if (activeTab === 'pages') {
          loadPages() // Refresh page list
        }
      } else {
        setTestResult(`❌ Create Failed: ${JSON.stringify(result, null, 2)}`)
      }
    } catch (err) {
      setTestResult(`❌ Create Failed: ${err.message}`)
    }
    
    setIsLoading(false)
  }

  const deletePage = async (pageId) => {
    if (!confirm('Are you sure you want to delete this page?')) return
    
    try {
      // Note: We'd need to create a delete API endpoint for this
      alert('Delete functionality not implemented yet')
    } catch (error) {
      console.error('Failed to delete page:', error)
    }
  }

  const tabStyle = (tabName) => ({
    padding: '10px 20px',
    margin: '0 5px',
    backgroundColor: activeTab === tabName ? '#007bff' : '#f8f9fa',
    color: activeTab === tabName ? 'white' : '#333',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    cursor: 'pointer',
    display: 'inline-block'
  })

  return (
    <>
      <Head>
        <title>Admin Dashboard - MyMatrx</title>
        <meta name="description" content="Administrative dashboard for managing HTML pages and system diagnostics" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      
      <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ borderBottom: '2px solid #dee2e6', paddingBottom: '20px', marginBottom: '30px' }}>
        <h1 style={{ color: '#333', marginBottom: '10px' }}>🛠️ Admin Dashboard</h1>
        <p style={{ color: '#666', margin: '0' }}>Manage pages, test connections, and debug the system</p>
      </div>

      {/* Tab Navigation */}
      <div style={{ marginBottom: '30px' }}>
        <div onClick={() => setActiveTab('overview')} style={tabStyle('overview')}>
          📊 Overview
        </div>
        <div onClick={() => setActiveTab('database')} style={tabStyle('database')}>
          🗄️ Database
        </div>
        <div onClick={() => setActiveTab('pages')} style={tabStyle('pages')}>
          📄 Pages
        </div>
        <div onClick={() => setActiveTab('system')} style={tabStyle('system')}>
          ⚙️ System
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h3 style={{ color: '#28a745', margin: '0 0 10px 0' }}>✅ System Status</h3>
              <p>Next.js app is running</p>
              <p>Vercel deployment: Active</p>
              <p>Database: {serverData ? 'Connected' : 'Unknown'}</p>
            </div>
            
            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h3 style={{ color: '#007bff', margin: '0 0 10px 0' }}>📈 Quick Stats</h3>
              <p>Total Pages: {pages.length}</p>
              <p>API Endpoints: 4</p>
              <p>Routes: /p/[id], /admin</p>
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', border: '1px solid #ffeaa7' }}>
            <h3 style={{ color: '#856404', margin: '0 0 15px 0' }}>🔗 Important Links</h3>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li><a href="/" style={{ color: '#007bff' }}>Homepage</a> - Main landing page</li>
              <li><a href="/p/3484a7eb-1fbe-421c-bcde-6f146436f9f1" style={{ color: '#007bff' }}>Sample Dynamic Page</a> - Test the dynamic routing</li>
              <li><a href="/api/test-db" style={{ color: '#007bff' }}>Database Test API</a> - Raw API response</li>
              <li><a href="/public/sample.html" style={{ color: '#007bff' }}>Static HTML Sample</a> - Static file serving</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'database' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            <button 
              onClick={testDatabaseConnection} 
              disabled={isLoading}
              style={{
                padding: '15px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              {isLoading ? '⏳ Testing...' : '🔍 Test Database Connection'}
            </button>

            <button 
              onClick={createTestPage} 
              disabled={isLoading}
              style={{
                padding: '15px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                opacity: isLoading ? 0.7 : 1
              }}
            >
              {isLoading ? '⏳ Creating...' : '➕ Create Test Page'}
            </button>
          </div>

          {testResult && (
            <div style={{
              padding: '20px',
              backgroundColor: testResult.includes('✅') ? '#d4edda' : '#f8d7da',
              color: testResult.includes('✅') ? '#155724' : '#721c24',
              borderRadius: '8px',
              border: `1px solid ${testResult.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap'
            }}>
              {testResult}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pages' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: '0' }}>📄 All Pages ({pages.length})</h3>
            <button 
              onClick={loadPages}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Refresh
            </button>
          </div>

          {pages.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Title</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Created</th>
                    <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>User ID</th>
                    <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map(page => (
                    <tr key={page.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px' }}>
                        <a href={`/p/${page.id}`} style={{ color: '#007bff', textDecoration: 'none' }} target="_blank">
                          {page.title}
                        </a>
                      </td>
                      <td style={{ padding: '12px', color: '#666' }}>
                        {new Date(page.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#666' }}>
                        {page.user_id ? page.user_id.substring(0, 8) + '...' : 'None'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button 
                          onClick={() => window.open(`/p/${page.id}`, '_blank')}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '5px',
                            fontSize: '12px'
                          }}
                        >
                          👁️ View
                        </button>
                        <button 
                          onClick={() => deletePage(page.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <p style={{ color: '#666', margin: '0' }}>No pages found. Create a test page to get started!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'system' && (
        <div>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h3 style={{ color: '#333', margin: '0 0 15px 0' }}>🔧 Environment Status</h3>
              <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
                <p>Node.js: {typeof window !== 'undefined' ? 'Client-side' : 'Server-side'}</p>
                <p>Next.js: 15.5.4</p>
                <p>Environment: {process.env.NODE_ENV || 'development'}</p>
              </div>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <h3 style={{ color: '#333', margin: '0 0 15px 0' }}>📡 API Endpoints</h3>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                <li><code>/api/test-db</code> - Database connection test</li>
                <li><code>/api/create-page</code> - Create new pages</li>
                <li><code>/api/list-pages</code> - List all pages</li>
                <li><code>/api/get-page</code> - Get single page (legacy)</li>
              </ul>
            </div>

            <div style={{ padding: '20px', backgroundColor: '#d1ecf1', borderRadius: '8px', border: '1px solid #bee5eb' }}>
              <h3 style={{ color: '#0c5460', margin: '0 0 15px 0' }}>✨ SEO Features Available</h3>
              <ul style={{ margin: '0', paddingLeft: '20px' }}>
                <li>Automatic favicon on all pages</li>
                <li>Meta titles and descriptions</li>
                <li>Open Graph social sharing tags</li>
                <li>Twitter Card optimization</li>
                <li>Server-side rendering for fast SEO</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

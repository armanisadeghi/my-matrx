import { useState } from 'react'

export default function HomePage({ recentPages }) {
  const [testResult, setTestResult] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const testDatabaseConnection = async () => {
    setIsLoading(true)
    setTestResult('Testing database connection...')
    
    try {
      const response = await fetch('/api/test-db')
      const result = await response.json()

      if (result.success) {
        setTestResult(`✅ Database Connected! Method: ${result.method}\n${result.message}`)
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
          <title>Test Page</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { max-width: 600px; margin: 0 auto; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Test Page Created Successfully!</h1>
            <p>This page was created at ${new Date().toLocaleString()}</p>
            <p>Database integration is working perfectly!</p>
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
          title: `Test Page - ${new Date().toLocaleString()}`,
          description: 'Auto-generated test page',
          htmlContent: testHTML,
          userId: '00000000-0000-0000-0000-000000000000' // Test UUID
        })
      })

      const result = await response.json()

      if (result.success) {
        setTestResult(`✅ Test Page Created! 
Page ID: ${result.pageId}
View at: ${result.url}
Click here: http://localhost:3000${result.url}`)
      } else {
        setTestResult(`❌ Create Failed: ${result.error}
Details: ${result.details || 'No additional details'}`)
      }
    } catch (err) {
      setTestResult(`❌ Create Failed: ${err.message}`)
    }
    
    setIsLoading(false)
  }

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      padding: '40px', 
      maxWidth: '800px', 
      margin: '0 auto' 
    }}>
      <h1>🚀 My Matrx - Dynamic HTML Pages</h1>
      <p>This is a Next.js app that serves HTML pages dynamically from Supabase.</p>
      
      <div style={{ 
        background: '#f5f5f5', 
        padding: '20px', 
        borderRadius: '8px', 
        margin: '20px 0' 
      }}>
        <h2>🧪 Database Testing</h2>
        <div style={{ marginBottom: '15px' }}>
          <button 
            onClick={testDatabaseConnection}
            disabled={isLoading}
            style={{ 
              padding: '10px 20px', 
              marginRight: '10px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Testing...' : 'Test Database Connection'}
          </button>
          
          <button 
            onClick={createTestPage}
            disabled={isLoading}
            style={{ 
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Creating...' : 'Create Test Page'}
          </button>
        </div>
        
        {testResult && (
          <div style={{ 
            padding: '10px', 
            background: testResult.includes('✅') ? '#d4edda' : '#f8d7da',
            border: `1px solid ${testResult.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>
            {testResult}
          </div>
        )}
      </div>

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
        <h3>🔗 API Endpoints</h3>
        <ul>
          <li><code>/p/[uuid]</code> - View any page by ID</li>
          <li><code>/api/test</code> - API health check</li>
          <li><code>/pages/[filename]</code> - Static HTML files</li>
        </ul>
      </div>
    </div>
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

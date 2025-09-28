import { useState, useEffect } from 'react'

export default function DebugPage({ serverData, serverError }) {
  const [clientData, setClientData] = useState(null)
  const [clientError, setClientError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const testClientSide = async () => {
    setIsLoading(true)
    setClientError(null)
    
    try {
      const response = await fetch('/api/test-db')
      const result = await response.json()
      setClientData(result)
    } catch (error) {
      setClientError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const testAPIEndpoint = async () => {
    setIsLoading(true)
    setClientError(null)
    
    try {
      const response = await fetch('/api/create-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Debug Test Page',
          description: 'Testing production connection',
          htmlContent: '<html><body><h1>Debug Test</h1><p>Created at ' + new Date().toISOString() + '</p></body></html>',
          userId: '00000000-0000-0000-0000-000000000000'
        })
      })
      const result = await response.json()
      setClientData(result)
    } catch (error) {
      setClientError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🔍 Production Database Debug Page</h1>
      
      {/* Server-Side Test Results */}
      <div style={{ marginBottom: '40px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>🖥️ Server-Side Test (getServerSideProps)</h2>
        
        {serverError ? (
          <div style={{ padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
            <h3 style={{ color: '#c00', margin: '0 0 10px 0' }}>❌ Server Error:</h3>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(serverError, null, 2)}</pre>
          </div>
        ) : serverData ? (
          <div style={{ padding: '15px', background: '#efe', border: '1px solid #cfc', borderRadius: '4px' }}>
            <h3 style={{ color: '#060', margin: '0 0 10px 0' }}>✅ Server Success:</h3>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(serverData, null, 2)}</pre>
          </div>
        ) : (
          <p>No server data available</p>
        )}
      </div>

      {/* Client-Side Tests */}
      <div style={{ marginBottom: '40px', padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>🌐 Client-Side Tests</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={testClientSide}
            disabled={isLoading}
            style={{ 
              padding: '10px 20px', 
              marginRight: '10px',
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Testing...' : 'Test Database Connection'}
          </button>
          
          <button 
            onClick={testAPIEndpoint}
            disabled={isLoading}
            style={{ 
              padding: '10px 20px',
              background: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Creating...' : 'Test Create Page API'}
          </button>
        </div>

        {clientError && (
          <div style={{ padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', marginTop: '15px' }}>
            <h3 style={{ color: '#c00', margin: '0 0 10px 0' }}>❌ Client Error:</h3>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{clientError}</pre>
          </div>
        )}

        {clientData && (
          <div style={{ padding: '15px', background: '#efe', border: '1px solid #cfc', borderRadius: '4px', marginTop: '15px' }}>
            <h3 style={{ color: '#060', margin: '0 0 10px 0' }}>✅ Client Success:</h3>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(clientData, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Environment Info */}
      <div style={{ padding: '20px', background: '#f9f9f9', borderRadius: '8px' }}>
        <h2>🔧 Environment Info</h2>
        <ul>
          <li><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'Server-side'}</li>
          <li><strong>User Agent:</strong> {typeof window !== 'undefined' ? navigator.userAgent : 'Server-side'}</li>
          <li><strong>Timestamp:</strong> {new Date().toISOString()}</li>
        </ul>
      </div>
    </div>
  )
}

export async function getServerSideProps() {
  try {
    console.log('=== DEBUG PAGE SERVER SIDE ===')
    console.log('Environment check:')
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET')
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? 'SET' : 'NOT SET')

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      return {
        props: {
          serverData: null,
          serverError: {
            message: 'Missing environment variables',
            details: {
              SUPABASE_URL: !!process.env.SUPABASE_URL,
              SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE
            }
          }
        }
      }
    }

    // Import here to avoid issues
    const { createClient } = await import('@supabase/supabase-js')
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    )

    console.log('Testing Supabase connection...')

    // Test 1: Simple count query
    const { count, error: countError } = await supabase
      .from('html_pages')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Count query failed:', countError)
      return {
        props: {
          serverData: null,
          serverError: {
            message: 'Count query failed',
            details: countError
          }
        }
      }
    }

    // Test 2: Get first few records
    const { data, error } = await supabase
      .from('html_pages')
      .select('id, title, description, created_at, user_id')
      .limit(5)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Select query failed:', error)
      return {
        props: {
          serverData: null,
          serverError: {
            message: 'Select query failed',
            details: error
          }
        }
      }
    }

    console.log(`Found ${count} total records, returning first ${data.length}`)

    return {
      props: {
        serverData: {
          totalCount: count,
          records: data,
          environment: {
            SUPABASE_URL: process.env.SUPABASE_URL,
            hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE,
            timestamp: new Date().toISOString()
          }
        },
        serverError: null
      }
    }

  } catch (error) {
    console.error('Debug page server error:', error)
    return {
      props: {
        serverData: null,
        serverError: {
          message: 'Server-side error',
          details: error.message,
          stack: error.stack
        }
      }
    }
  }
}

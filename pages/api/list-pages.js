import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('=== LIST PAGES API DEBUG ===')
    console.log('Environment check:')
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? 'SET' : 'NOT SET')

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      return res.status(500).json({
        success: false,
        error: 'Missing environment variables',
        details: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE
        }
      })
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    )

    console.log('Querying html_pages table...')

    const { data, error, count } = await supabase
      .from('html_pages')
      .select('id, title, description, created_at, user_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Database query failed:', error)
      return res.status(500).json({
        success: false,
        error: 'Database query failed',
        details: error
      })
    }

    console.log(`Found ${count} total pages, returning ${data.length}`)

    // Generate URLs for each page
    const pagesWithUrls = data.map(page => ({
      ...page,
      url: `${req.headers.host ? `https://${req.headers.host}` : 'http://localhost:3000'}/p/${page.id}`,
      localUrl: `http://localhost:3000/p/${page.id}`
    }))

    return res.status(200).json({
      success: true,
      totalCount: count,
      pages: pagesWithUrls,
      environment: {
        host: req.headers.host,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('List pages API error:', error)
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}

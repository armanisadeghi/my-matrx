import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Page ID is required' })
  }

  try {
    console.log('Fetching page with ID:', id)

    const { data, error } = await supabase
      .from('html_pages')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase fetch error:', error)
      return res.status(404).json({ 
        success: false, 
        error: 'Page not found',
        details: error.message
      })
    }

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'Page not found' 
      })
    }

    console.log('Page found:', data.title)

    return res.status(200).json({
      success: true,
      data: data
    })

  } catch (error) {
    console.error('Get page error:', error)
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message
    })
  }
}

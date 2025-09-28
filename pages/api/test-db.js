import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    // Log environment variables (without exposing keys)
    console.log('Environment check:')
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET')
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET')
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? 'SET' : 'NOT SET')

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Missing environment variables',
        details: {
          url: !!process.env.SUPABASE_URL,
          key: !!process.env.SUPABASE_ANON_KEY
        }
      })
    }

    // Try with anon key first
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    )

    console.log('Testing connection with anon key...')
    const { data: anonData, error: anonError } = await supabase
      .from('html_pages')
      .select('count')
      .limit(1)

    if (anonError) {
      console.log('Anon key error:', anonError)
      
      // Try with service role key
      console.log('Trying with service role key...')
      const supabaseService = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE
      )

      const { data: serviceData, error: serviceError } = await supabaseService
        .from('html_pages')
        .select('count')
        .limit(1)

      if (serviceError) {
        console.log('Service role error:', serviceError)
        return res.status(500).json({ 
          error: 'Both connection methods failed',
          anonError,
          serviceError
        })
      }

      return res.status(200).json({ 
        success: true,
        method: 'service_role',
        data: serviceData,
        message: 'Connected with service role key'
      })
    }

    return res.status(200).json({ 
      success: true,
      method: 'anon_key',
      data: anonData,
      message: 'Connected with anon key'
    })

  } catch (error) {
    console.error('Connection test error:', error)
    return res.status(500).json({ 
      error: 'Connection test failed',
      details: error.message
    })
  }
}

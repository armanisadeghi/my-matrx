import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE // Use service role for writes
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { title, description, htmlContent, userId } = req.body

    console.log('Creating page with data:', { title, description, userId: userId || 'none' })

    if (!title || !htmlContent) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['title', 'htmlContent'],
        received: { title: !!title, htmlContent: !!htmlContent }
      })
    }

    const { data, error } = await supabase
      .from('html_pages')
      .insert({
        title,
        description: description || null,
        html_content: htmlContent,
        user_id: userId || null
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase insert error:', error)
      return res.status(500).json({ 
        error: 'Database insert failed', 
        details: error.message,
        code: error.code
      })
    }

    console.log('Page created successfully:', data.id)

    return res.status(200).json({
      success: true,
      pageId: data.id,
      url: `/p/${data.id}`,
      title: data.title,
      createdAt: data.created_at
    })

  } catch (error) {
    console.error('Create page error:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    })
  }
}

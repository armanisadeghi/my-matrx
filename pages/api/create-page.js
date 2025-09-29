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
    const { 
      title, 
      description, 
      htmlContent, 
      html_content, // Support both formats
      userId, 
      user_id, // Support both formats
      meta_title,
      meta_description,
      meta_keywords,
      og_image,
      canonical_url
    } = req.body

    // Use the provided value or fallback
    const finalHtmlContent = htmlContent || html_content
    const finalUserId = userId || user_id

    console.log('Creating page with data:', { 
      title, 
      description, 
      userId: finalUserId || 'none',
      hasSEO: !!(meta_title || meta_description)
    })

    if (!title || !finalHtmlContent) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['title', 'htmlContent or html_content'],
        received: { title: !!title, htmlContent: !!finalHtmlContent }
      })
    }

    const insertData = {
      title,
      description: description || null,
      html_content: finalHtmlContent,
      user_id: finalUserId || null
    }

    // Add SEO fields if provided
    if (meta_title) insertData.meta_title = meta_title
    if (meta_description) insertData.meta_description = meta_description
    if (meta_keywords) insertData.meta_keywords = meta_keywords
    if (og_image) insertData.og_image = og_image
    if (canonical_url) insertData.canonical_url = canonical_url

    const { data, error } = await supabase
      .from('html_pages')
      .insert(insertData)
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

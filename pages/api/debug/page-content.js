import { getClientSite, getClientPage, getClientComponents } from '@/lib/supabase/clientHelpers'

/**
 * GET /api/debug/page-content?client=iopbm&page=home
 * Debug endpoint to see what content is being loaded
 */
export default async function handler(req, res) {
  try {
    const { client, page } = req.query

    if (!client || !page) {
      return res.status(400).json({ 
        error: 'Missing required params',
        usage: '/api/debug/page-content?client=iopbm&page=home'
      })
    }

    const clientData = await getClientSite(client)
    const pageData = await getClientPage(client, page)
    const components = await getClientComponents(client)

    const headerComponent = components.find(c => c.component_type === 'header')
    const footerComponent = components.find(c => c.component_type === 'footer')

    return res.status(200).json({
      client: {
        name: clientData?.name,
        has_global_css: !!clientData?.global_css,
        global_css_length: clientData?.global_css?.length || 0,
        global_css_preview: clientData?.global_css?.substring(0, 200),
      },
      page: {
        title: pageData?.title,
        has_css: !!pageData?.css_content,
        css_length: pageData?.css_content?.length || 0,
        css_preview: pageData?.css_content?.substring(0, 200),
        has_html: !!pageData?.html_content,
        html_length: pageData?.html_content?.length || 0,
        html_preview: pageData?.html_content?.substring(0, 200),
      },
      header: {
        exists: !!headerComponent,
        has_css: !!headerComponent?.css_content,
        css_length: headerComponent?.css_content?.length || 0,
        has_html: !!headerComponent?.html_content,
        html_length: headerComponent?.html_content?.length || 0,
      },
      footer: {
        exists: !!footerComponent,
        has_css: !!footerComponent?.css_content,
        css_length: footerComponent?.css_content?.length || 0,
        has_html: !!footerComponent?.html_content,
        html_length: footerComponent?.html_content?.length || 0,
      }
    })
  } catch (error) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    })
  }
}


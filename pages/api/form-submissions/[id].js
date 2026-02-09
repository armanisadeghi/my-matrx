import { createClient } from '@supabase/supabase-js';

/**
 * API Route: GET /api/form-submissions/[id]
 * Retrieve a specific form submission by ID
 * 
 * Also supports:
 * - GET /api/form-submissions/latest?form_type=xxx - Get latest submission of a type
 * - GET /api/form-submissions/list?form_type=xxx&limit=10 - List submissions
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Special routes
    if (id === 'latest') {
      const { form_type } = req.query;
      if (!form_type) {
        return res.status(400).json({ error: 'form_type query parameter required' });
      }

      const { data, error } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_type', form_type)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'No submissions found' });
        }
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(data);
    }

    if (id === 'list') {
      const { form_type, limit = 50 } = req.query;
      
      let query = supabase
        .from('form_submissions')
        .select('id, form_type, submitted_at, source_url, created_at')
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (form_type) {
        query = query.eq('form_type', form_type);
      }

      const { data, error } = await query;

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        submissions: data,
        count: data.length
      });
    }

    // Get specific submission by ID
    const { data, error } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Submission not found' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Form submission retrieval error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

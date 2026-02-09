import { createClient } from '@supabase/supabase-js';

/**
 * API Route: POST /api/form-submissions
 * Universal endpoint for submitting form data to the form_submissions table
 * 
 * Accepts any JSON payload with required fields:
 * - form_type: string identifier for the form (e.g., 'realsingles_algorithm_worksheet')
 * - data: object containing the form data
 * 
 * Optional fields:
 * - source_url: URL where the form was submitted from
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { form_type, data, source_url } = req.body;

    // Validation
    if (!form_type || typeof form_type !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid form_type' });
    }

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid data object' });
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY // Using service role to bypass RLS for insert
    );

    // Get IP address and user agent for tracking
    const ip_address = req.headers['x-forwarded-for']?.split(',')[0] || 
                       req.headers['x-real-ip'] || 
                       req.socket.remoteAddress;
    const user_agent = req.headers['user-agent'];

    // Insert submission
    const { data: submission, error } = await supabase
      .from('form_submissions')
      .insert({
        form_type,
        data,
        source_url: source_url || null,
        ip_address,
        user_agent,
        submitted_by: null, // Can be enhanced later to support authenticated users
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ 
        error: 'Failed to save submission',
        details: error.message 
      });
    }

    return res.status(201).json({
      success: true,
      id: submission.id,
      message: 'Submission saved successfully'
    });

  } catch (error) {
    console.error('Form submission error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

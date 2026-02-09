/**
 * Diagnostic endpoint to test form submissions setup
 * GET /api/form-submissions/test
 */
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const diagnostics = {
    envVarsPresent: {
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE: !!supabaseKey,
    },
    envVarsPartial: {
      SUPABASE_URL: supabaseUrl?.substring(0, 40) + '...',
      SUPABASE_SERVICE_ROLE: supabaseKey ? '***' + supabaseKey.slice(-4) : 'NOT SET',
    },
    nodeEnv: process.env.NODE_ENV,
    checkedVars: [
      'SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL', 
      'SUPABASE_SERVICE_ROLE',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]
  };

  // Test if we can import Supabase
  try {
    const { createClient } = require('@supabase/supabase-js');
    diagnostics.supabasePackage = 'installed';
    
    // Try to create a client
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      diagnostics.supabaseClient = 'created';
      
      // Test connection
      try {
        const { data, error } = await supabase
          .from('form_submissions')
          .select('id')
          .limit(1);
        
        if (error) {
          diagnostics.databaseTest = `error: ${error.message}`;
        } else {
          diagnostics.databaseTest = 'success';
        }
      } catch (err) {
        diagnostics.databaseTest = `exception: ${err.message}`;
      }
    } else {
      diagnostics.supabaseClient = 'cannot create - missing env vars';
    }
  } catch (err) {
    diagnostics.supabasePackage = `error: ${err.message}`;
  }

  return res.status(200).json({
    status: diagnostics.envVarsPresent.SUPABASE_URL && 
            diagnostics.envVarsPresent.SUPABASE_SERVICE_ROLE 
            ? 'ready' 
            : 'missing env vars',
    diagnostics
  });
}

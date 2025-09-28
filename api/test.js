// Simple test endpoint to verify API is working
export default function handler(req, res) {
  // Super permissive CORS - allow everything
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    method: req.method,
    origin: req.headers.origin || 'No origin header',
    cors: 'fully permissive'
  });
}

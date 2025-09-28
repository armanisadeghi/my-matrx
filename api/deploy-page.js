// Vercel Serverless Function to receive and deploy HTML pages
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*'); // In production, set this to your React app's domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { htmlContent, title, description, apiKey } = req.body;

    // Simple API key validation (in production, use proper authentication)
    if (apiKey !== process.env.DEPLOY_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate required fields
    if (!htmlContent || !title) {
      return res.status(400).json({ error: 'Missing required fields: htmlContent and title' });
    }

    // Generate UUID for the page
    const { randomUUID } = require('crypto');
    const pageId = randomUUID();
    const filename = `${pageId}.html`;

    // Import required modules
    const fs = require('fs').promises;
    const path = require('path');

    // Write the HTML file to pages directory
    const pagesDir = path.join(process.cwd(), 'pages');
    
    // Ensure pages directory exists
    try {
      await fs.access(pagesDir);
    } catch {
      await fs.mkdir(pagesDir, { recursive: true });
    }
    
    const filePath = path.join(pagesDir, filename);
    await fs.writeFile(filePath, htmlContent, 'utf8');

    // Update the index.html file
    await updateIndexFile(pageId, title, description || 'Generated HTML page');

    // Return success response with page details
    return res.status(200).json({
      success: true,
      pageId,
      filename,
      url: `${process.env.VERCEL_URL || 'http://localhost:3000'}/pages/${pageId}`,
      message: 'Page deployed successfully'
    });

  } catch (error) {
    console.error('Deployment error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

async function updateIndexFile(pageId, title, description) {
  const fs = require('fs').promises;
  const path = require('path');
  const { parse } = require('node-html-parser');

  try {
    // Read current index.html
    const indexPath = path.join(process.cwd(), 'index.html');
    const indexContent = await fs.readFile(indexPath, 'utf8');
    
    // Parse HTML
    const root = parse(indexContent);
    
    // Find the pages-list div
    const pagesList = root.querySelector('.pages-list');
    
    if (pagesList) {
      // Create new page card HTML
      const newPageCard = `
            <a href="pages/${pageId}.html" class="page-card">
                <div class="page-title">${title}</div>
                <div class="page-description">
                    ${description}
                </div>
                <div class="page-id">ID: ${pageId}</div>
            </a>`;
      
      // Add the new page card to the beginning
      pagesList.innerHTML = newPageCard + pagesList.innerHTML;
      
      // Write updated content back
      await fs.writeFile(indexPath, root.toString(), 'utf8');
    }
  } catch (error) {
    console.error('Error updating index file:', error);
    // Don't throw - page creation should succeed even if index update fails
  }
}

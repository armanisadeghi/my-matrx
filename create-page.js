#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

/**
 * Creates a new HTML page with UUID filename and basic template
 */
function createPage() {
    const currentDir = process.cwd();
    const pagesDir = path.join(currentDir, 'pages');
    
    // Ensure pages directory exists
    if (!fs.existsSync(pagesDir)) {
        console.log('📁 Creating pages directory...');
        fs.mkdirSync(pagesDir, { recursive: true });
    }
    
    // Generate UUID
    const pageId = randomUUID();
    const filename = `${pageId}.html`;
    const filePath = path.join(pagesDir, filename);
    
    // Get current date for template
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Create HTML template
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Page - ${pageId}</title>
    <meta name="description" content="Generated HTML page created on ${currentDate}">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            min-height: 100vh;
            color: #333;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
            text-align: center;
        }
        
        .content {
            line-height: 1.6;
            color: #2c3e50;
        }
        
        .meta {
            margin-top: 30px;
            padding: 20px;
            background: rgba(102, 126, 234, 0.1);
            border-radius: 12px;
            border-left: 4px solid #667eea;
        }
        
        .meta p {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 5px;
        }
        
        .meta code {
            background: rgba(0, 0, 0, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>New Page Template</h1>
        <div class="content">
            <p>This is a new HTML page template. Replace this content with your own HTML.</p>
            <p>You can modify the title, add your own CSS styles, and create your content here.</p>
        </div>
        
        <div class="meta">
            <p><strong>Page ID:</strong> <code>${pageId}</code></p>
            <p><strong>Created:</strong> ${currentDate}</p>
            <p><strong>File:</strong> <code>pages/${filename}</code></p>
        </div>
    </div>
</body>
</html>`;
    
    // Write the file
    try {
        fs.writeFileSync(filePath, htmlTemplate, 'utf8');
        
        console.log('✅ New page created successfully!');
        console.log('');
        console.log('📄 File Details:');
        console.log(`   📁 Location: pages/${filename}`);
        console.log(`   🆔 Page ID: ${pageId}`);
        console.log(`   📅 Created: ${currentDate}`);
        console.log('');
        console.log('🔗 Next Steps:');
        console.log('   1. Edit the HTML file with your content');
        console.log('   2. Run: npm run update-index');
        console.log('   3. Test locally: npm run dev');
        console.log('   4. Deploy: git add . && git commit -m "Add new page" && git push');
        console.log('');
        console.log(`🌐 Local URL: http://localhost:3000/pages/${pageId}`);
        
    } catch (error) {
        console.error('❌ Error creating page:', error.message);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    createPage();
}

module.exports = { createPage };

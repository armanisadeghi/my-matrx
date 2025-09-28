# React Integration Guide - Updated for Pages Directory

## 🔧 Updated React/Next.js Integration Code

### **1. API Service (utils/staticSiteAPI.js)**
```javascript
// utils/staticSiteAPI.js
const STATIC_SITE_URL = 'https://your-static-site.vercel.app'; // Replace with your deployed URL
const API_KEY = process.env.NEXT_PUBLIC_DEPLOY_API_KEY; // Your custom API key

export class StaticSiteAPI {
  static async deployPage(htmlContent, title, description = '') {
    try {
      const response = await fetch(`${STATIC_SITE_URL}/api/deploy-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent,
          title,
          description,
          apiKey: API_KEY
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error deploying page:', error);
      throw error;
    }
  }

  static async testConnection() {
    try {
      const response = await fetch(`${STATIC_SITE_URL}/api/test`);
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
  }

  static getPageUrl(pageId) {
    return `${STATIC_SITE_URL}/pages/${pageId}`;
  }
}
```

### **2. Environment Variables**

**In your React app's `.env.local`:**
```bash
# Your custom API key (the one we generated)
NEXT_PUBLIC_DEPLOY_API_KEY=fd010a122c7ea2e704b08ef353c741bba5fe9ffab17ee20a7a8082e696634b13

# Your deployed static site URL
NEXT_PUBLIC_STATIC_SITE_URL=https://your-static-site.vercel.app
```

### **3. Updated Component Example**
```javascript
// components/HTMLPageGenerator.jsx
import { useState } from 'react';
import { useStaticSite } from '../hooks/useStaticSite';

export function HTMLPageGenerator() {
  const [title, setTitle] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [description, setDescription] = useState('');
  const [deployedPage, setDeployedPage] = useState(null);
  
  const { deployPage, testConnection, isDeploying, error } = useStaticSite();

  const handleDeploy = async () => {
    if (!title || !htmlContent) {
      alert('Please provide both title and HTML content');
      return;
    }

    try {
      const page = await deployPage(htmlContent, title, description);
      setDeployedPage(page);
      
      // Clear form
      setTitle('');
      setHtmlContent('');
      setDescription('');
      
      alert('Page deployed successfully!');
    } catch (error) {
      alert(`Deployment failed: ${error.message}`);
    }
  };

  const handleTestConnection = async () => {
    try {
      const result = await testConnection();
      alert(`Connection successful! ${result.message}`);
    } catch (error) {
      alert(`Connection failed: ${error.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Deploy HTML Page</h2>
        <button
          onClick={handleTestConnection}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Test Connection
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Page Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Enter page title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 border rounded"
            placeholder="Brief description of the page"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">HTML Content</label>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="w-full p-2 border rounded h-64 font-mono text-sm"
            placeholder="Paste your HTML content here"
          />
        </div>

        <button
          onClick={handleDeploy}
          disabled={isDeploying || !title || !htmlContent}
          className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isDeploying ? 'Deploying...' : 'Deploy Page'}
        </button>

        {error && (
          <div className="text-red-500 p-3 bg-red-50 rounded border border-red-200">
            <strong>Error:</strong> {error}
          </div>
        )}

        {deployedPage && (
          <div className="bg-green-50 p-4 rounded border border-green-200">
            <h3 className="font-semibold text-green-800 mb-2">Page Deployed Successfully!</h3>
            <div className="space-y-2">
              <p className="text-sm text-green-600">
                <strong>Title:</strong> {deployedPage.title}
              </p>
              <p className="text-sm text-green-600">
                <strong>Page ID:</strong> {deployedPage.id}
              </p>
              <p className="text-sm text-green-600">
                <a 
                  href={deployedPage.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="underline hover:text-green-800"
                >
                  🔗 View Live Page
                </a>
              </p>
            </div>
            
            {/* Preview in iframe */}
            <div className="mt-4">
              <h4 className="font-medium text-green-800 mb-2">Preview:</h4>
              <iframe
                src={deployedPage.url}
                className="w-full h-96 border rounded"
                title={deployedPage.title}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## 🚀 Deployment Steps

1. **Deploy your static site:**
   ```bash
   git add .
   git commit -m "Add pages directory and API endpoints"
   git push
   vercel --prod
   ```

2. **Set environment variable in Vercel:**
   - Go to your Vercel project → Settings → Environment Variables
   - Add: `DEPLOY_API_KEY` = `fd010a122c7ea2e704b08ef353c741bba5fe9ffab17ee20a7a8082e696634b13`

3. **Test the API:**
   - Visit: `https://your-site.vercel.app/api/test`
   - Should return: `{"message": "API is working!"}`

4. **Use in your React app:**
   - Add the environment variables
   - Use the provided components
   - Test the integration

## 📁 File Structure
```
my-matrx/
├── api/
│   ├── deploy-page.js    # Main deployment endpoint
│   └── test.js          # Test endpoint
├── pages/               # All HTML pages go here
│   ├── 3bb6da52...html
│   └── 7b1ac916...html
├── index.html          # Landing page
├── vercel.json         # Vercel config
└── package.json        # Dependencies
```

## 🔐 Security Notes

- The API key is YOUR custom key, not a Vercel service key
- Keep it secret and don't commit it to your React app's git repo
- Use environment variables in both projects
- In production, consider adding rate limiting and better authentication

Your setup is now organized and ready for production! 🎉

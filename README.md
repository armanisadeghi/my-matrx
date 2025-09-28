# My Matrx - Static HTML Pages

A production-ready static site repository for serving HTML pages with automated deployment API and easy Vercel integration. Features instant HTML page deployment from external React applications via API endpoints.

## 🚀 Quick Start

### Local Development
```bash
# Start local server (automatically opens browser)
npm run serve
# or start without opening browser
npm run dev
# or preview on different port
npm run preview
```

Visit `http://localhost:3000` to view your site locally.

### Deployment to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to production**:
   ```bash
   vercel --prod
   ```

That's it! Your site will be live on Vercel with a custom URL.

## 📝 Adding New Pages

### 🚀 Super Easy Method (Recommended)
```bash
# Create a new page with template and auto-update index
npm run new-page
```
This command will:
1. Generate a UUID and create a new HTML file in `/pages` directory
2. Add a beautiful template with proper structure and styling
3. Automatically update the index page with the new page

### ⚡ Just Create File Method
```bash
# Create a new HTML file with template (no index update)
npm run create-page
```
This creates a new HTML file with:
- UUID-based filename in `/pages` directory
- Professional HTML template with styling
- Placeholder content ready for your edits
- Meta information and proper structure

### 📋 Manual Method
```bash
# Step 1: Generate a UUID
npm run generate-uuid

# Step 2: Create your HTML file in the pages directory
# pages/{your-uuid}.html

# Step 3: Update index page automatically
npm run update-index

# Step 4: Deploy
vercel --prod
```

### 🔄 Auto-Update Index Anytime
```bash
npm run update-index
```
This will automatically:
- Scan all HTML files in the `pages/` directory
- Extract titles from `<title>` tags
- Extract descriptions from meta descriptions or content
- Update the index.html with all pages
- Sort pages alphabetically by title

## 🔌 API Endpoints

### **POST /api/deploy-page**
Deploy a new HTML page instantly from external applications.

**Request:**
```json
{
  "htmlContent": "<html>...</html>",
  "title": "Page Title",
  "description": "Optional description",
  "apiKey": "your-api-key"
}
```

**Response:**
```json
{
  "success": true,
  "pageId": "uuid-generated",
  "filename": "uuid.html",
  "url": "https://mymatrx.com/pages/uuid",
  "message": "Page deployed successfully"
}
```

### **GET /api/test**
Test API connectivity and server status.

**Response:**
```json
{
  "message": "API is working!",
  "timestamp": "2025-09-28T07:30:00.000Z",
  "method": "GET"
}
```

### **Environment Variables Required:**
```bash
DEPLOY_API_KEY=your-secure-api-key-here
```

## 📁 File Structure
```
my-matrx/
├── api/
│   ├── deploy-page.js                  # API endpoint for external page deployment
│   └── test.js                         # API connection testing endpoint
├── pages/                              # All HTML pages organized here
│   ├── {uuid}.html                     # Individual HTML pages
│   └── {uuid}.html                     # More HTML pages
├── index.html                          # Landing page listing all pages
├── create-page.js                      # Script to create new HTML files with template
├── update-index.js                     # Auto-update script for index page
├── vercel.json                         # Vercel deployment configuration with API
├── package.json                        # Project metadata and scripts
├── node_modules/                       # Dependencies (auto-generated)
├── REACT_INTEGRATION_GUIDE.md          # Integration guide for React apps
└── README.md                          # This file
```

## 🛠️ Features

- ✅ **Zero Build Process**: Pure HTML/CSS/JS - no compilation needed
- ✅ **UUID-Based Naming**: Unique, collision-free page identifiers
- ✅ **API Deployment**: Deploy HTML pages instantly via REST API
- ✅ **Auto-Index Updates**: Automatically scans and updates homepage with new pages
- ✅ **Smart Content Extraction**: Pulls titles and descriptions from HTML files
- ✅ **Organized Structure**: Pages stored in dedicated `/pages` directory
- ✅ **React Integration**: Ready-to-use integration for React/Next.js apps
- ✅ **Vercel Optimized**: Configured for optimal Vercel deployment with serverless functions
- ✅ **Clean URLs**: Automatic `.html` extension removal
- ✅ **Security Headers**: Basic security headers and API key protection
- ✅ **Local Development**: Node.js http-server for reliable testing

## 🎨 Styling Guidelines

Each page is self-contained with its own CSS. For consistency:

- Use modern CSS features (Grid, Flexbox, CSS Variables)
- Include responsive design with media queries
- Add smooth animations and transitions
- Use semantic HTML structure
- Include proper meta tags for SEO

## 📋 Current Pages

- **Kybella Infographic** (`pages/3bb6da52-ade0-4b8c-96b3-ce0a18979bcc.html`)
  - Medical infographic about Kybella treatment for jowls
  - Responsive design with animated elements

- **PDO Threads Infographic** (`pages/7b1ac916-aed7-4863-8a8e-f233e317ded8.html`)
  - Non-surgical lifting and collagen stimulation guide
  - Professional medical content with modern design

## 🚀 Vercel Configuration

The `vercel.json` file includes:
- **Serverless Functions**: API endpoints for page deployment
- **Clean URLs**: Removes .html extensions automatically
- **Security Headers**: CORS, XSS protection, content type validation
- **Environment Variables**: Secure API key management
- **Static File Serving**: Optimized for HTML pages in `/pages` directory

## 💡 Tips

1. **Testing Locally**: Always test your pages locally before deploying
2. **Pages Directory**: All HTML files must be placed in the `/pages` directory
3. **API Integration**: Use `REACT_INTEGRATION_GUIDE.md` for React app setup
4. **Responsive Design**: Ensure your pages work on all device sizes  
5. **Performance**: Keep images optimized and CSS/JS minimal
6. **SEO**: Include proper meta tags and semantic HTML for better indexing
7. **Accessibility**: Use proper heading hierarchy and alt texts
8. **Security**: Keep your API key secure and never commit it to public repos

## 🔗 Related Resources

- **`REACT_INTEGRATION_GUIDE.md`** - Complete guide for React/Next.js integration
- **Live Site**: [https://mymatrx.com](https://mymatrx.com)
- **API Endpoints**: 
  - Test: `https://mymatrx.com/api/test`
  - Deploy: `https://mymatrx.com/api/deploy-page` (POST)

## 📞 Support

For issues or questions about this setup, refer to:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [HTML/CSS/JS References](https://developer.mozilla.org/)

---

**Production-ready static site with API integration! 🚀**
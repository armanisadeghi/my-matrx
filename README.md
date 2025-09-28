# My Matrx - Static HTML Pages

A simple static site repository for serving HTML pages with easy deployment to Vercel.

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

### 🚀 Automated Method (Recommended)
```bash
# Generate UUID and auto-update index page
npm run new-page
```
This command will:
1. Generate a new UUID
2. Automatically scan all HTML files and update the index page
3. Extract titles and descriptions from your HTML files

### 📋 Manual Method
```bash
# Step 1: Generate a UUID
npm run generate-uuid

# Step 2: Create your HTML file using the UUID as filename
# {your-uuid}.html

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
- Scan all HTML files in the directory
- Extract titles from `<title>` tags
- Extract descriptions from meta descriptions or content
- Update the index.html with all pages
- Sort pages alphabetically by title

## 📁 File Structure
```
my-matrx/
├── index.html                          # Landing page listing all pages
├── {uuid}.html                         # Individual HTML pages
├── update-index.js                     # Auto-update script for index page
├── vercel.json                         # Vercel deployment configuration
├── package.json                        # Project metadata and scripts
├── node_modules/                       # Dependencies (auto-generated)
└── README.md                          # This file
```

## 🛠️ Features

- ✅ **Zero Build Process**: Pure HTML/CSS/JS - no compilation needed
- ✅ **UUID-Based Naming**: Unique, collision-free page identifiers
- ✅ **Auto-Index Updates**: Automatically scans and updates homepage with new pages
- ✅ **Smart Content Extraction**: Pulls titles and descriptions from HTML files
- ✅ **Vercel Optimized**: Configured for optimal Vercel deployment
- ✅ **Clean URLs**: Automatic `.html` extension removal
- ✅ **Security Headers**: Basic security headers included
- ✅ **Local Development**: Node.js http-server for reliable testing

## 🎨 Styling Guidelines

Each page is self-contained with its own CSS. For consistency:

- Use modern CSS features (Grid, Flexbox, CSS Variables)
- Include responsive design with media queries
- Add smooth animations and transitions
- Use semantic HTML structure
- Include proper meta tags for SEO

## 📋 Current Pages

- **Kybella Infographic** (`3bb6da52-ade0-4b8c-96b3-ce0a18979bcc.html`)
  - Medical infographic about Kybella treatment for jowls
  - Responsive design with animated elements

## 🚀 Vercel Configuration

The `vercel.json` file includes:
- Clean URLs (removes .html extensions)
- Security headers
- Proper routing configuration
- Static file serving optimization

## 💡 Tips

1. **Testing Locally**: Always test your pages locally before deploying
2. **Responsive Design**: Ensure your pages work on all device sizes  
3. **Performance**: Keep images optimized and CSS/JS minimal
4. **SEO**: Include proper meta tags and semantic HTML
5. **Accessibility**: Use proper heading hierarchy and alt texts

## 📞 Support

For issues or questions about this setup, refer to:
- [Vercel Documentation](https://vercel.com/docs)
- [HTML/CSS/JS References](https://developer.mozilla.org/)

---

**Happy coding! 🎉**
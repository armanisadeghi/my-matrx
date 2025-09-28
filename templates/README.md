# Templates

This folder contains templates for quick page creation.

## Usage

1. **Copy the basic template**:
   ```bash
   cp templates/basic-page.html pages/your-new-page.html
   ```

2. **Copy CSS template** (optional):
   ```bash
   cp templates/template.css assets/css/your-new-page.css
   ```

3. **Copy JS template** (optional):
   ```bash
   cp templates/template.js assets/js/your-new-page.js
   ```

4. **Update your HTML file**:
   - Change the title
   - Link your CSS and JS files
   - Add your content
   - Update navigation if needed

## Available Templates

- `basic-page.html` - Basic HTML structure with navigation
- `template.css` - Base CSS styles for new pages
- `template.js` - Template JavaScript with common functionality

## Quick Start Script

Create a quick start script to automate new page creation:

```bash
#!/bin/bash
# Create a new page quickly
PAGE_NAME=$1
cp templates/basic-page.html pages/$PAGE_NAME.html
cp templates/template.css assets/css/$PAGE_NAME.css
cp templates/template.js assets/js/$PAGE_NAME.js
echo "Created new page: $PAGE_NAME"
```
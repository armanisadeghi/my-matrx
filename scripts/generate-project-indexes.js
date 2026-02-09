#!/usr/bin/env node

/**
 * Generate Index Pages for Project Directories
 * 
 * Scans subdirectories in public/ and creates index.html pages
 * that link to all HTML files within each directory.
 * 
 * Usage: node scripts/generate-project-indexes.js
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const IGNORED_DIRS = []; // Add any dirs to ignore here
const IGNORED_FILES = ['index.html']; // Don't list the index page itself

/**
 * Extract metadata from an HTML file
 */
function extractMetadata(filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf-8');
    const root = parse(html);

    // Extract title
    const titleElement = root.querySelector('title');
    const title = titleElement ? titleElement.text.trim() : path.basename(filePath, '.html');

    // Extract description
    const descElement = root.querySelector('meta[name="description"]');
    const description = descElement ? descElement.getAttribute('content') : '';

    // Get file stats for last modified date
    const stats = fs.statSync(filePath);
    const lastModified = stats.mtime;

    return {
      filename: path.basename(filePath),
      title,
      description,
      lastModified
    };
  } catch (error) {
    console.error(`Error extracting metadata from ${filePath}:`, error.message);
    return {
      filename: path.basename(filePath),
      title: path.basename(filePath, '.html'),
      description: '',
      lastModified: new Date()
    };
  }
}

/**
 * Generate a beautiful index.html page
 */
function generateIndexPage(projectName, pages) {
  const title = projectName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const pageCards = pages
    .map(page => {
      const dateStr = page.lastModified.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      return `
      <a href="/${projectName}/${page.filename}" class="page-card">
        <div class="card-header">
          <h3 class="page-title">${page.title}</h3>
          <svg class="arrow-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        ${page.description ? `<p class="page-description">${page.description}</p>` : ''}
        <div class="page-meta">
          <span class="filename">${page.filename}</span>
          <span class="modified">Updated ${dateStr}</span>
        </div>
      </a>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Project Index</title>
  <meta name="description" content="Index of all pages for the ${title} project">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #fafaf9;
      --bg-card: #ffffff;
      --text-primary: #1c1917;
      --text-secondary: #57534e;
      --text-tertiary: #a8a29e;
      --border: #e7e5e4;
      --accent: #0ea5e9;
      --accent-hover: #0284c7;
      --accent-light: #e0f2fe;
      --shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
      --shadow-hover: 0 10px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
      --radius: 12px;
      --font-display: 'DM Serif Display', Georgia, serif;
      --font-body: 'Inter', -apple-system, system-ui, sans-serif;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: var(--font-body);
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    @media (min-width: 768px) {
      .container {
        padding: 4rem 2rem;
      }
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    .project-name {
      font-family: var(--font-display);
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 400;
      margin-bottom: 0.75rem;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }

    .subtitle {
      font-size: 1.125rem;
      color: var(--text-secondary);
      font-weight: 400;
    }

    .page-count {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: var(--accent-light);
      color: var(--accent-hover);
      border-radius: 99px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    /* Page Grid */
    .pages-grid {
      display: grid;
      gap: 1.25rem;
      margin-bottom: 3rem;
    }

    .page-card {
      display: block;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s ease;
      box-shadow: var(--shadow);
    }

    .page-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-hover);
      border-color: var(--accent);
    }

    .card-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 0.75rem;
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.3;
      flex: 1;
    }

    .arrow-icon {
      flex-shrink: 0;
      color: var(--text-tertiary);
      transition: transform 0.2s ease;
    }

    .page-card:hover .arrow-icon {
      transform: translateX(4px);
      color: var(--accent);
    }

    .page-description {
      font-size: 0.9375rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
      line-height: 1.6;
    }

    .page-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      font-size: 0.8125rem;
      color: var(--text-tertiary);
    }

    .filename {
      font-family: 'Monaco', 'Courier New', monospace;
      background: var(--bg-primary);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }

    .modified {
      white-space: nowrap;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
    }

    .footer-text {
      color: var(--text-tertiary);
      font-size: 0.875rem;
    }

    .footer-text code {
      font-family: 'Monaco', 'Courier New', monospace;
      background: var(--bg-primary);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.8125rem;
      color: var(--text-secondary);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--text-secondary);
    }

    .empty-state svg {
      margin: 0 auto 1.5rem;
      opacity: 0.5;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .page-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1 class="project-name">${title}</h1>
      <p class="subtitle">Project Pages & Resources</p>
      <span class="page-count">${pages.length} ${pages.length === 1 ? 'Page' : 'Pages'}</span>
    </header>

    ${pages.length > 0 ? `
    <div class="pages-grid">
      ${pageCards}
    </div>
    ` : `
    <div class="empty-state">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="13 2 13 9 20 9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <p>No pages found in this directory</p>
    </div>
    `}

    <footer class="footer">
      <p class="footer-text">
        Auto-generated index • Run <code>node scripts/generate-project-indexes.js</code> to update
      </p>
    </footer>
  </div>
</body>
</html>
`;
}

/**
 * Process a directory and generate its index page
 */
function processDirectory(dirPath, dirName) {
  console.log(`\n📁 Processing: ${dirName}`);

  // Get all HTML files in the directory
  const files = fs.readdirSync(dirPath);
  const htmlFiles = files.filter(file => 
    file.endsWith('.html') && !IGNORED_FILES.includes(file)
  );

  if (htmlFiles.length === 0) {
    console.log(`  ℹ️  No HTML files found, skipping`);
    return;
  }

  // Extract metadata from each file
  const pages = htmlFiles.map(file => {
    const filePath = path.join(dirPath, file);
    return extractMetadata(filePath);
  });

  // Sort by last modified date (newest first)
  pages.sort((a, b) => b.lastModified - a.lastModified);

  // Generate index page
  const indexHtml = generateIndexPage(dirName, pages);
  const indexPath = path.join(dirPath, 'index.html');
  
  fs.writeFileSync(indexPath, indexHtml, 'utf-8');
  console.log(`  ✅ Generated index.html with ${pages.length} pages`);
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Generating project index pages...\n');
  console.log(`📂 Scanning: ${PUBLIC_DIR}`);

  // Get all subdirectories in public/
  const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
  const directories = entries
    .filter(entry => entry.isDirectory() && !IGNORED_DIRS.includes(entry.name))
    .map(entry => entry.name);

  if (directories.length === 0) {
    console.log('\n⚠️  No subdirectories found in public/');
    return;
  }

  console.log(`\nFound ${directories.length} directories to process`);

  // Process each directory
  directories.forEach(dirName => {
    const dirPath = path.join(PUBLIC_DIR, dirName);
    processDirectory(dirPath, dirName);
  });

  console.log('\n✨ All done!\n');
}

// Run the script
main();

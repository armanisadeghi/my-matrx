# Project Index Generator

Automatically generates beautiful index pages for project directories in `public/`.

## Overview

This system scans subdirectories in `public/` and creates an `index.html` file in each directory that:

- Lists all HTML files in that directory
- Extracts and displays the page title and meta description
- Shows when each page was last updated
- Provides direct links to each page
- Features a clean, modern, responsive design

## Usage

### Generate All Index Pages

```bash
npm run generate-indexes
```

This will:
1. Scan all subdirectories in `public/`
2. Find all `.html` files in each directory
3. Extract metadata (title, description) from each file
4. Generate/update `index.html` in each directory

### Manual Run

```bash
node scripts/generate-project-indexes.js
```

## What Gets Generated

For each project directory (e.g., `public/all-green/`), an `index.html` file is created with:

- **Header**: Project name (derived from directory name)
- **Page count badge**: Shows total number of pages
- **Page cards**: Each HTML file gets a card showing:
  - Page title (from `<title>` tag)
  - Description (from `<meta name="description">`)
  - Filename (in monospace)
  - Last modified date
- **Footer**: Instructions for regenerating the index

## Accessing Index Pages

Once generated, you can view the index pages at:

- `/all-green/` → `public/all-green/index.html`
- `/real-singles/` → `public/real-singles/index.html`
- `/games/` → `public/games/index.html`
- `/iopbm/` → `public/iopbm/index.html`
- `/samples/` → `public/samples/index.html`

## Customization

### Ignore Specific Directories

Edit `scripts/generate-project-indexes.js`:

```javascript
const IGNORED_DIRS = ['node_modules', 'temp']; // Add dirs to ignore
```

### Ignore Specific Files

```javascript
const IGNORED_FILES = ['index.html', 'draft.html']; // Add files to ignore
```

### Customize Design

The generated HTML includes all styles inline. To customize:

1. Edit the `generateIndexPage()` function in `scripts/generate-project-indexes.js`
2. Modify the CSS within the `<style>` tag
3. Regenerate indexes: `npm run generate-indexes`

## Features

### Automatic Metadata Extraction

- **Title**: Extracted from `<title>` tag
- **Description**: Extracted from `<meta name="description">` tag
- **Fallback**: Uses filename if metadata is missing

### Smart Sorting

Pages are sorted by last modified date (newest first), making it easy to see recent updates.

### Responsive Design

- Mobile-first design
- Smooth hover animations
- Professional typography
- Accessible color contrast

### Performance

- Zero JavaScript required
- Lightweight HTML/CSS only
- Fast page loads
- Works without any build process

## When to Regenerate

Run the script whenever:

- You add a new HTML file to a project directory
- You update a page title or description
- You delete or rename a file
- You create a new project directory

You can also add this to your workflow:

```bash
# Add to package.json scripts for automatic regeneration
"prebuild": "npm run generate-indexes"
```

## Technical Details

### Dependencies

- **node-html-parser**: Lightweight HTML parser for extracting metadata
  - Already installed in this project
  - No additional dependencies needed

### File Structure

```
public/
├── all-green/
│   ├── index.html              ← Auto-generated
│   ├── orange-county-ca-itad.html
│   └── orange-county-ca-itad-v2.html
├── real-singles/
│   ├── index.html              ← Auto-generated
│   └── realsingles-algorithm-worksheet.html
└── games/
    ├── index.html              ← Auto-generated
    ├── minesweeper.html
    └── minesweeper-2.html
```

### Metadata Extraction Logic

```javascript
// Looks for standard HTML meta tags
<title>Page Title Here</title>
<meta name="description" content="Page description here">

// Falls back to filename if not found
filename: "my-page.html" → title: "my-page"
```

## Troubleshooting

### Index page not updating

1. Delete the old `index.html` in the directory
2. Run `npm run generate-indexes` again

### Missing page description

Add a meta description tag to your HTML file:

```html
<meta name="description" content="Your page description here">
```

### Wrong title showing

Update the `<title>` tag in your HTML file and regenerate.

### Script fails to run

1. Verify `node-html-parser` is installed: `npm list node-html-parser`
2. If missing, install it: `npm install node-html-parser`

## Future Enhancements

Potential improvements:

- Add search/filter functionality
- Generate a master index for all projects
- Support for thumbnails/preview images
- Category/tag system for pages
- CLI options for targeting specific directories
- Watch mode for automatic regeneration on file changes

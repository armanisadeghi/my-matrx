# Utility Scripts

This folder contains reusable scripts for project automation and optimization.

## 📄 Available Scripts

### 1. `generate-project-indexes.js` - Project Index Generator

Automatically generates beautiful index pages for project directories in `public/`.

**What it does:**
- Scans all subdirectories in `public/`
- Finds all HTML files in each directory
- Extracts page titles and descriptions from HTML metadata
- Creates a professional index.html page with links to all pages
- Includes last modified dates and file information

**Usage:**

```bash
# Generate all project index pages
npm run generate-indexes

# Or run directly
node scripts/generate-project-indexes.js
```

**Output:**
- Creates `index.html` in each project directory
- Modern, responsive design with hover animations
- Shows page count, titles, descriptions, and last updated dates
- No JavaScript required - pure HTML/CSS

**Example:** After running the script:
- `/all-green/` shows index of All Green pages
- `/real-singles/` shows index of Real Singles pages
- `/games/` shows index of game demos
- `/iopbm/` shows index of IOPBM pages
- `/samples/` shows index of sample pages

**See:** [PROJECT_INDEXES.md](./PROJECT_INDEXES.md) for detailed documentation.

---

### 2. `convert-to-webp.js` - WebP Converter

Converts PNG/JPG images to WebP format with high compression and quality.

**Prerequisites:**
- Node.js
- The script will automatically install the `sharp` library if not present

**Usage:**

```bash
# Convert a single image (auto-generates output filename)
node scripts/convert-to-webp.js path/to/image.png

# Specify output filename
node scripts/convert-to-webp.js path/to/image.png path/to/output.webp

# Specify quality (0-100, default: 85)
node scripts/convert-to-webp.js path/to/image.png output.webp 90
```

**Examples:**

```bash
# Convert logo to WebP
node scripts/convert-to-webp.js "public/iopbm/assets/logo.png"

# High quality conversion (90)
node scripts/convert-to-webp.js "public/images/hero.jpg" "public/images/hero.webp" 90

# Lower quality for smaller file size (75)
node scripts/convert-to-webp.js "public/images/thumbnail.png" "" 75
```

**Output:**
- Creates a `.webp` file in the same directory as the input
- Displays input/output sizes and percentage savings
- Maintains image dimensions and quality

---

### 3. `convert-to-webp.ps1` - PowerShell WebP Converter (Alternative)

Windows PowerShell script that uses Google's `cwebp` encoder.

**Prerequisites:**
- Windows PowerShell
- `cwebp` utility (instructions provided by script if not installed)

**Installation of cwebp:**

```powershell
# Option 1: Using Chocolatey
choco install webp

# Option 2: Using npm
npm install -g cwebp-bin
```

**Usage:**

```powershell
# Convert single image
.\scripts\convert-to-webp.ps1 -InputPath "path/to/image.png"

# Specify quality
.\scripts\convert-to-webp.ps1 -InputPath "path/to/image.png" -Quality 90

# Batch convert all images in folder
.\scripts\convert-to-webp.ps1 -InputPath "path/to/folder" -Batch
```

---

## 🎯 Best Practices

### Quality Settings

- **85-90**: High quality for hero images and important visuals
- **80-85**: Good balance for most images (default)
- **70-80**: Smaller file size, acceptable quality for thumbnails

### When to Use WebP

✅ **Use WebP for:**
- Large images (> 50KB)
- Photos and complex graphics
- Images that need to load fast (above the fold)
- Any image where file size matters

⚠️ **Consider PNG/JPG for:**
- Very small images (< 5KB) - savings may be minimal
- Images that need universal compatibility (very rare now)
- Images with transparency that must work on old browsers

### Implementation in HTML

Use the `<picture>` element with fallback:

```html
<picture>
    <source srcset="/path/to/image.webp" type="image/webp">
    <img src="/path/to/image.png" alt="Description" width="100" height="100">
</picture>
```

This provides:
- WebP for modern browsers (smaller file size)
- Automatic fallback to PNG/JPG for older browsers
- Proper dimensions to prevent layout shift

---

## 📊 Expected Savings

Typical file size reductions when converting to WebP:

| Original Format | WebP Quality | Typical Savings |
|----------------|--------------|-----------------|
| PNG (logo)     | 85           | 50-80%         |
| PNG (photo)    | 85           | 60-80%         |
| JPEG (photo)   | 85           | 25-35%         |
| JPEG (high quality) | 90      | 15-25%         |

---

## 🔄 Future Scripts

Consider adding:
- `resize-images.js` - Batch resize images to multiple sizes
- `optimize-svg.js` - Minify and optimize SVG files
- `generate-responsive.js` - Create multiple sizes for responsive images

---

## 📝 Notes

- Scripts preserve original files (non-destructive)
- Output files are placed in the same directory as input
- All scripts provide detailed progress and savings information
- WebP is supported by [all modern browsers](https://caniuse.com/webp) (96%+ global support)


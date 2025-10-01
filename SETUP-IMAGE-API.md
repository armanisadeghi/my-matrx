# Setting Up the Image Conversion API

## 📦 Installation

The WebP conversion API requires two additional packages:

```bash
pnpm add sharp formidable
```

### What These Do:
- **`sharp`**: High-performance image processing library (same one used in our script)
- **`formidable`**: Handles multipart/form-data file uploads in API routes

## 🚀 API Endpoint Created

**Location:** `pages/api/convert-to-webp.js`

**Endpoint:** `POST /api/convert-to-webp`

This serverless function runs on Vercel and converts uploaded images to WebP format on-demand.

## 📝 Quick Start

### 1. Install Dependencies

```bash
pnpm add sharp formidable
```

### 2. Test Locally

```bash
pnpm dev
```

### 3. Access the Web Interface

**We've already created a beautiful web interface for you!**

Visit: **`http://localhost:3000/utilities/image-converter`**

Or browse all utilities at: **`http://localhost:3000/utilities`**

### 4. Alternative: Create Your Own Test Page (Optional)

Create `pages/image-converter.js`:

```jsx
import { useState } from 'react';

export default function ImageConverter() {
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleConvert = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setConverting(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('quality', 85);

      const response = await fetch('/api/convert-to-webp', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Conversion failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const originalSize = parseInt(response.headers.get('X-Original-Size'));
      const webpSize = parseInt(response.headers.get('X-WebP-Size'));
      const savings = response.headers.get('X-Savings-Percent');
      
      setResult({
        url,
        originalSize: (originalSize / 1024).toFixed(2),
        webpSize: (webpSize / 1024).toFixed(2),
        savings
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Image to WebP Converter</h1>
      
      <div style={{ marginTop: '2rem' }}>
        <input 
          type="file" 
          accept="image/*"
          onChange={handleConvert}
          disabled={converting}
          style={{ display: 'block' }}
        />
      </div>
      
      {converting && (
        <p style={{ marginTop: '1rem' }}>Converting...</p>
      )}
      
      {error && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          background: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {result && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '1rem', 
          background: '#efe',
          border: '1px solid #cfc',
          borderRadius: '4px'
        }}>
          <h3>Conversion Successful!</h3>
          <p><strong>Original Size:</strong> {result.originalSize} KB</p>
          <p><strong>WebP Size:</strong> {result.webpSize} KB</p>
          <p><strong>Savings:</strong> {result.savings}%</p>
          
          <a 
            href={result.url} 
            download="converted.webp"
            style={{
              display: 'inline-block',
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#2A7A7A',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px'
            }}
          >
            Download WebP
          </a>
        </div>
      )}
    </div>
  );
}
```

Then visit: `http://localhost:3000/image-converter`

## 🌐 Using the API

### From JavaScript/React

```javascript
const convertImage = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('quality', 85);

  const response = await fetch('/api/convert-to-webp', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Conversion failed');
  }

  return await response.blob();
};
```

### From Command Line (cURL)

```bash
curl -X POST \
  http://localhost:3000/api/convert-to-webp \
  -F "image=@path/to/image.png" \
  -F "quality=85" \
  --output converted.webp
```

## 🚀 Deployment on Vercel

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Add WebP conversion API"
   git push
   ```

2. **Deploy to Vercel**:
   - Vercel will automatically detect and deploy the API route
   - No additional configuration needed
   - The API will be available at: `https://your-domain.com/api/convert-to-webp`

3. **API Limits on Vercel**:
   - **Hobby Plan**: 10s timeout, 4.5MB upload limit
   - **Pro Plan**: 60s timeout, 50MB upload limit

## 📊 Performance

Typical conversion times on Vercel:
- Small images (<1MB): ~0.5-1 second
- Medium images (1-5MB): ~1-2 seconds
- Large images (5-10MB): ~2-5 seconds

## 🔒 Security Considerations

For production use, consider adding:

1. **Authentication**:
   ```javascript
   // Add to API route
   const apiKey = req.headers['x-api-key'];
   if (apiKey !== process.env.IMAGE_API_KEY) {
     return res.status(401).json({ error: 'Unauthorized' });
   }
   ```

2. **Rate Limiting**:
   Use Vercel's built-in rate limiting or a service like Upstash

3. **File Size Validation**:
   ```javascript
   const MAX_SIZE = 10 * 1024 * 1024; // 10MB
   if (imageFile.size > MAX_SIZE) {
     return res.status(400).json({ 
       error: 'File too large',
       message: 'Maximum file size is 10MB'
     });
   }
   ```

## 🎯 Use Cases

1. **On-demand image optimization** for user uploads
2. **Automated image processing** in your CMS
3. **Batch conversion** via API calls
4. **Dynamic image delivery** with optimized formats

## 📚 Documentation

See `pages/api/README.md` for complete API documentation and more examples.

## ⚡ Benefits of API vs Script

| Feature | Script | API |
|---------|--------|-----|
| Location | Run locally | Run on Vercel |
| Automation | Manual/CLI | Programmatic |
| Integration | Terminal | Any app/service |
| User Access | Developers only | Can expose to users |
| Processing | Local CPU | Vercel serverless |
| Scalability | Limited | Auto-scales |

## 🔄 When to Use Each

**Use the Script** (`scripts/convert-to-webp.js`) when:
- Batch processing local files
- One-time optimizations
- Development/testing

**Use the API** (`/api/convert-to-webp`) when:
- User-uploaded images
- Automated workflows
- Integration with other services
- Dynamic image optimization

Both are available and can be used together! 🎉


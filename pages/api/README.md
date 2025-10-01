# API Routes

## Image Optimization API

### `POST /api/convert-to-webp`

Converts uploaded images to WebP format on-demand.

#### Request

**Method:** `POST`  
**Content-Type:** `multipart/form-data`

**Parameters:**
- `image` (required): Image file to convert (PNG, JPG, JPEG, GIF, etc.)
- `quality` (optional): WebP quality (0-100, default: 85)

#### Response

**Success (200):**
- Returns the converted WebP image as binary data
- Headers include conversion statistics:
  - `X-Original-Size`: Original file size in bytes
  - `X-WebP-Size`: WebP file size in bytes
  - `X-Savings-Percent`: Percentage of file size reduction

**Error (400/500):**
```json
{
  "error": "Error type",
  "message": "Error description"
}
```

#### Usage Examples

##### JavaScript Fetch API
```javascript
const convertToWebP = async (file, quality = 85) => {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('quality', quality);

  const response = await fetch('/api/convert-to-webp', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  // Get conversion stats from headers
  const originalSize = response.headers.get('X-Original-Size');
  const webpSize = response.headers.get('X-WebP-Size');
  const savings = response.headers.get('X-Savings-Percent');

  console.log(`Saved ${savings}% (${originalSize} → ${webpSize} bytes)`);

  // Get the WebP image as blob
  const blob = await response.blob();
  return blob;
};

// Usage
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const webpBlob = await convertToWebP(file);
  
  // Create download link
  const url = URL.createObjectURL(webpBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'converted.webp';
  a.click();
});
```

##### React Component
```jsx
import { useState } from 'react';

export default function ImageConverter() {
  const [converting, setConverting] = useState(false);
  const [result, setResult] = useState(null);

  const handleConvert = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setConverting(true);
    setResult(null);

    try {
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

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setResult({
        url,
        originalSize: response.headers.get('X-Original-Size'),
        webpSize: response.headers.get('X-WebP-Size'),
        savings: response.headers.get('X-Savings-Percent')
      });
    } catch (error) {
      console.error(error);
      alert('Failed to convert image');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={handleConvert}
        disabled={converting}
      />
      
      {converting && <p>Converting...</p>}
      
      {result && (
        <div>
          <p>Saved {result.savings}%</p>
          <p>Original: {(result.originalSize / 1024).toFixed(2)} KB</p>
          <p>WebP: {(result.webpSize / 1024).toFixed(2)} KB</p>
          <a href={result.url} download="converted.webp">
            Download WebP
          </a>
        </div>
      )}
    </div>
  );
}
```

##### cURL
```bash
curl -X POST \
  http://localhost:3000/api/convert-to-webp \
  -F "image=@path/to/image.png" \
  -F "quality=85" \
  --output converted.webp
```

#### Dependencies

This API route requires the following packages:

```bash
pnpm add sharp formidable
```

#### Deployment on Vercel

This API route works out-of-the-box on Vercel with no additional configuration needed. Vercel automatically:
- Handles serverless function deployment
- Provides 50MB memory limit (configurable)
- 10-second execution timeout on Hobby plan
- Supports up to 4.5MB request body size

#### Performance Considerations

- **Memory**: Image conversion is memory-intensive. For large images (>10MB), consider implementing streaming or chunking
- **Timeout**: Conversions typically complete in <2 seconds for images under 5MB
- **File Size Limits**: Vercel has a 4.5MB body size limit on Hobby plan (50MB on Pro)

#### Security Considerations

- The API validates file types through sharp (rejects invalid images)
- Temporary files are automatically cleaned up
- Consider adding authentication for production use
- Consider rate limiting to prevent abuse

#### Future Enhancements

Possible improvements:
- Add support for batch conversion
- Support different output formats (AVIF, WebP, etc.)
- Add resize/crop functionality
- Store converted images in cloud storage
- Add authentication/API keys


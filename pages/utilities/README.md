# Utilities Section

A collection of developer tools and utilities accessible via the web interface.

## 📍 Pages

### `/utilities`
**Main utilities dashboard** - Browse all available tools

### `/utilities/image-converter`
**Image to WebP Converter** - Convert images to optimized WebP format with a drag-and-drop interface

## 🎨 Features

- **Beautiful UI**: Modern, gradient-based design with smooth animations
- **Drag & Drop**: Easy file selection
- **Real-time Preview**: See your image before converting
- **Quality Control**: Adjustable quality slider (0-100%)
- **Instant Stats**: View original size, WebP size, and savings percentage
- **One-Click Download**: Download converted images immediately

## 🔧 Adding New Utilities

To add a new utility tool:

### 1. Create the page

```jsx
// pages/utilities/your-tool.js
import Link from 'next/link';
import Head from 'next/head';

export default function YourTool() {
  return (
    <>
      <Head>
        <title>Your Tool | Utilities</title>
      </Head>
      
      <div>
        {/* Your tool UI */}
      </div>
    </>
  );
}
```

### 2. Add to the utilities index

Edit `pages/utilities/index.js` and add your tool to the `utilities` array:

```javascript
const utilities = [
  // ... existing utilities
  {
    name: 'Your Tool Name',
    description: 'Description of what your tool does',
    icon: '🔧', // Pick an emoji icon
    href: '/utilities/your-tool',
    tags: ['Category', 'Tags']
  },
];
```

### 3. Create API endpoint (if needed)

If your tool needs backend processing, create an API route:

```javascript
// pages/api/your-tool.js
export default async function handler(req, res) {
  // Your API logic
}
```

## 🎯 Design Guidelines

To maintain consistency across utilities:

1. **Colors**: Use the gradient background (`#667eea` to `#764ba2`)
2. **Layout**: Center content with max-width of 800-1200px
3. **Cards**: White background, rounded corners (16px), generous padding
4. **Typography**: 
   - Headings: White with text shadow
   - Body: #333 for primary, #666 for secondary
5. **Buttons**: 
   - Primary: #667eea (purple gradient)
   - Success: #22c55e (green)
   - Secondary: White with border
6. **Transitions**: 0.3s ease for all interactions

## 🚀 Future Utility Ideas

- **Image Resizer**: Batch resize images to multiple dimensions
- **SVG Optimizer**: Minify and optimize SVG files
- **Color Palette Generator**: Extract colors from images
- **Base64 Encoder/Decoder**: Convert images to/from base64
- **JSON Formatter**: Pretty-print and validate JSON
- **Hash Generator**: Generate MD5, SHA-256, etc.
- **QR Code Generator**: Create QR codes from text/URLs
- **UUID Generator**: Generate unique identifiers

## 📱 Responsive Design

All utilities are fully responsive and work on:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🔐 Access Control

Currently, utilities are publicly accessible. To add authentication:

1. Use Next.js middleware or API route guards
2. Check for authentication tokens
3. Redirect unauthorized users

Example:
```javascript
import { useSession } from 'next-auth/react';

export default function YourTool() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return <div>Access Denied</div>;
  
  // Your tool UI
}
```

## 🎨 UI Framework

These utilities use **inline styles** for simplicity and zero dependencies. Feel free to:
- Keep inline styles for quick prototyping
- Migrate to CSS modules for better organization
- Use Tailwind CSS if preferred
- Add component libraries like shadcn/ui

## 📊 Usage Tracking

To track utility usage, add analytics:

```javascript
// In your utility component
useEffect(() => {
  // Track page view
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: 'Image Converter',
      page_location: window.location.href,
      page_path: '/utilities/image-converter'
    });
  }
}, []);
```

## 🔄 Integration with Main App

The utilities section is standalone but can be integrated:

1. **Add to main navigation**: Link from your main app nav
2. **Embed in admin panel**: Include utilities in your dashboard
3. **White-label**: Customize colors and branding
4. **API integration**: Use the same APIs in your main app

---

**Built with ❤️ for developer productivity**



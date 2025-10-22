# HTML Pages - Quick Reference

## 📊 Database Fields

| Field | Type | Required | Default | Purpose |
|-------|------|----------|---------|---------|
| `id` | UUID | Auto | - | Unique identifier |
| `user_id` | UUID | No | NULL | Page owner |
| `html_content` | TEXT | **YES** | - | Page HTML content |
| `meta_title` | TEXT | **YES** | - | SEO title (shows in browser/search) |
| `meta_description` | TEXT | No | NULL | SEO description |
| `meta_keywords` | TEXT | No | NULL | SEO keywords |
| `og_image` | TEXT | No | NULL | Social media preview image |
| `canonical_url` | TEXT | No | NULL | Canonical URL for SEO |
| `is_indexable` | BOOLEAN | No | **FALSE** | Search engine indexing control |
| `created_at` | TIMESTAMP | Auto | NOW() | Creation timestamp |
| `updated_at` | TIMESTAMP | Auto | NOW() | Last update timestamp |

---

## 🎯 SEO Priority Hierarchy

### Title (What shows in browser tab & search results)
```
1. meta_title from database (ALWAYS WINS if exists)
2. <title> extracted from html_content
3. "Untitled Page" (fallback)
```

### Description (What shows in search results)
```
1. meta_description from database (ALWAYS WINS if exists)
2. <meta name="description"> extracted from html_content
3. "" (empty string fallback)
```

### Indexing (Should search engines index this page?)
```
is_indexable = true  → <meta name="robots" content="index, follow">
is_indexable = false → <meta name="robots" content="noindex, nofollow"> (DEFAULT)
```

---

## 💻 Code Examples

### Create a Page (Not Indexed)
```javascript
const response = await fetch('/api/create-page', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meta_title: 'My Awesome Page',
    meta_description: 'This is a great page about...',
    htmlContent: '<html><body>Hello World</body></html>',
    // is_indexable defaults to false (noindex)
  })
});
```

### Create an Indexed Page
```javascript
const response = await fetch('/api/create-page', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    meta_title: 'Public Article',
    meta_description: 'Everyone should see this',
    htmlContent: '<html><body>...</body></html>',
    is_indexable: true // ← Make it indexable!
  })
});
```

### Update Existing Page to be Indexable
```sql
UPDATE html_pages 
SET is_indexable = true 
WHERE id = 'your-page-id';
```

### Make All Pages Indexable
```sql
UPDATE html_pages 
SET is_indexable = true;
```

### Check Indexing Status
```sql
SELECT 
  id,
  meta_title,
  is_indexable,
  CASE 
    WHEN is_indexable THEN 'Will be indexed by Google'
    ELSE 'Hidden from search engines'
  END as status
FROM html_pages
ORDER BY created_at DESC;
```

---

## 🔍 Common Queries

### Get All Indexed Pages
```sql
SELECT id, meta_title, meta_description
FROM html_pages
WHERE is_indexable = true;
```

### Get All Hidden Pages
```sql
SELECT id, meta_title
FROM html_pages
WHERE is_indexable = false OR is_indexable IS NULL;
```

### Update Multiple Pages
```sql
-- Make specific pages indexable
UPDATE html_pages 
SET is_indexable = true 
WHERE id IN (
  'uuid-1',
  'uuid-2',
  'uuid-3'
);
```

---

## 🚦 Page States

| State | `meta_title` | `is_indexable` | Result |
|-------|--------------|----------------|--------|
| **Draft** | "My Draft" | `false` | Accessible but not indexed |
| **Public** | "My Article" | `true` | Accessible AND indexed |
| **Private** | "Secret Page" | `false` | Accessible but not indexed |

---

## ⚡ Quick Tips

1. **Always provide `meta_title`** - It's required and shows in search results
2. **Be explicit about indexing** - Set `is_indexable: true` for public pages
3. **Database wins** - Database SEO fields override HTML tags
4. **Default is safe** - New pages are `noindex` by default
5. **Keep it simple** - One title, one description per page

---

## 🎨 Full Example

```javascript
// Create a complete, indexable page
const page = await fetch('/api/create-page', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    // Required fields
    meta_title: 'Complete Guide to Next.js',
    htmlContent: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>body { font-family: Arial; }</style>
        </head>
        <body>
          <h1>Welcome to My Guide</h1>
          <p>This is an amazing article...</p>
        </body>
      </html>
    `,
    
    // SEO fields
    meta_description: 'Learn Next.js with this comprehensive guide. Perfect for beginners.',
    meta_keywords: 'nextjs, react, tutorial, guide',
    og_image: 'https://mysite.com/images/nextjs-guide.jpg',
    canonical_url: 'https://mysite.com/guides/nextjs',
    
    // Indexing control
    is_indexable: true, // Make it public!
    
    // Optional
    user_id: 'your-user-id'
  })
});

// Response
{
  "success": true,
  "pageId": "abc-123-def-456",
  "url": "/p/abc-123-def-456",
  "meta_title": "Complete Guide to Next.js",
  "is_indexable": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

## 📖 More Info

- **Full Migration Guide**: `database/HTML_PAGES_MIGRATION_GUIDE.md`
- **Database Schema**: `database/schema.sql` (for client_pages)
- **Migration Script**: `database/migrate-html-pages-simplify.sql`


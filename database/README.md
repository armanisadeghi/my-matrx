# Client Sites Database Documentation

## 📋 Overview

This database schema supports a multi-tenant client website management system with built-in versioning, draft/publish workflows, and preview capabilities.

## 🏗️ Architecture

### Core Concepts

1. **Client Sites**: Each client (like IOPBM) is a separate tenant with their own configuration
2. **Pages**: Individual pages within a client site, with draft and published versions
3. **Components**: Reusable sections (header, footer) shared across pages
4. **Versions**: Historical snapshots of published content for rollback
5. **Assets**: Media files and documents organized per client

## 📊 Tables

### 1. `client_sites`
Master table for each client website.

**Key Fields:**
- `slug`: URL identifier (e.g., 'iopbm' → `/c/iopbm`)
- `theme_config`: JSON with colors, fonts, spacing
- `navigation`: JSON array of menu items
- `footer_config`: Footer structure and content

### 2. `client_pages`
Individual pages with draft/published content separation.

**Key Fields:**
- `html_content`: Published/live content
- `html_content_draft`: Draft content being edited
- `has_draft`: Quick flag to check if draft exists
- `is_published`: Whether page is live
- `is_home_page`: Flag for default page

**Versioning Fields:**
Each content field has a `_draft` counterpart:
- `html_content` / `html_content_draft`
- `css_content` / `css_content_draft`
- `meta_title` / `meta_title_draft`
- etc.

### 3. `client_components`
Reusable components like headers and footers.

**Types:**
- `header`: Site navigation
- `footer`: Site footer
- `hero`: Hero sections
- `cta`: Call-to-action sections
- Custom types as needed

### 4. `client_page_versions`
Automatic history of all published versions.

**Features:**
- Auto-increments version number
- Stores complete snapshot at publish time
- Enables rollback to any previous version

### 5. `client_assets`
File and image management.

**Tracking:**
- Storage location (URL or path)
- File metadata (size, dimensions, type)
- Usage tracking (which pages use this asset)
- Organization (folders, tags)

### 6. `client_activity_log`
Audit trail for all changes.

## 🔄 Preview Mode System

### How It Works

The system supports two modes on the same URL:

#### Production Mode (Default)
```
URL: /c/iopbm/home
Shows: html_content (published version)
```

#### Preview Mode
```
URL: /c/iopbm/home?preview=true
Shows: html_content_draft (if exists) OR html_content (fallback)
```

### Implementation in Routes

```javascript
// pages/c/[client]/[page].js
export async function getServerSideProps({ params, query }) {
  const { client, page } = params;
  const isPreview = query.preview === 'true';
  
  // Fetch page data
  const pageData = await getClientPage(client, page);
  
  // Determine which content to show
  const content = isPreview && pageData.has_draft 
    ? pageData.html_content_draft 
    : pageData.html_content;
    
  return { props: { content, isPreview } };
}
```

### Preview Banner

When in preview mode, show a banner:
```html
{isPreview && (
  <div style="background: #ff9800; padding: 10px; text-align: center;">
    ⚠️ PREVIEW MODE - You are viewing draft content
    <button>Publish Changes</button>
    <button>Discard Draft</button>
  </div>
)}
```

## 📝 Content Workflow

### Creating/Editing a Page

1. **Edit Draft**
   ```sql
   UPDATE client_pages 
   SET 
     html_content_draft = 'new content',
     has_draft = true
   WHERE client_id = 'xxx' AND slug = 'home';
   ```

2. **Preview Changes**
   - Visit: `/c/iopbm/home?preview=true`
   - See draft content in action

3. **Publish Draft**
   ```sql
   SELECT publish_page_draft('page-uuid', 'user-uuid');
   ```
   This function:
   - Copies all `_draft` fields to main fields
   - Clears all `_draft` fields
   - Sets `has_draft = false`
   - Creates version history entry
   - Updates `last_published_at`

4. **Discard Draft** (if changes aren't good)
   ```sql
   SELECT discard_page_draft('page-uuid');
   ```

### Rollback to Previous Version

```sql
-- View all versions
SELECT version_number, published_at, change_summary 
FROM client_page_versions 
WHERE page_id = 'xxx' 
ORDER BY version_number DESC;

-- Rollback to version 5
SELECT rollback_to_version('page-uuid', 5);
```

## 🔐 Row Level Security (RLS)

RLS is enabled with public read access for published content.

### Default Policies

1. **Public Read**: Anyone can view published pages/components
2. **Authenticated Write**: Only authenticated users can modify (configure as needed)
3. **Service Role**: API routes use service role key for full access

### Customizing Policies

```sql
-- Example: Only page owners can edit
CREATE POLICY "Users can edit their own pages" ON client_pages
  FOR UPDATE 
  USING (auth.uid() = last_published_by);
```

## 🚀 Initial Setup Steps

### 1. Execute Schema
```bash
# In Supabase SQL Editor
Run: database/schema.sql
```

### 2. Insert Initial Data
```bash
Run: database/insert-iopbm-home.sql
```

### 3. Verify Installation
```sql
-- Check client exists
SELECT * FROM client_sites WHERE slug = 'iopbm';

-- Check pages created
SELECT id, slug, title, has_draft, is_published 
FROM client_pages 
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm');

-- Check components
SELECT component_type, name 
FROM client_components 
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm');
```

## 📡 API Endpoints Needed

You'll need to create these API routes:

### Read Operations
- `GET /api/clients/[slug]` - Get client config
- `GET /api/clients/[slug]/pages` - List all pages
- `GET /api/clients/[slug]/pages/[page_slug]` - Get specific page
- `GET /api/clients/[slug]/components` - Get all components

### Write Operations
- `POST /api/clients/[slug]/pages` - Create new page
- `PUT /api/clients/[slug]/pages/[page_slug]` - Update page draft
- `POST /api/clients/[slug]/pages/[page_slug]/publish` - Publish draft
- `DELETE /api/clients/[slug]/pages/[page_slug]/draft` - Discard draft
- `POST /api/clients/[slug]/pages/[page_slug]/rollback` - Rollback to version

## 🎨 Theme Configuration Example

```json
{
  "colors": {
    "primary": "#3BA5A5",
    "secondary": "#8DB85C",
    "text": "#333333"
  },
  "fonts": {
    "heading": "Georgia, serif",
    "body": "Arial, sans-serif"
  },
  "spacing": {
    "section": "5rem",
    "container": "1200px"
  }
}
```

## 📱 Navigation Configuration Example

```json
[
  {"label": "Home", "href": "/c/iopbm", "show": false},
  {"label": "About", "href": "/c/iopbm/about", "show": true},
  {"label": "Services", "href": "/c/iopbm/services", "show": true},
  {"label": "Contact", "href": "/c/iopbm/contact", "show": true}
]
```

## 🔍 Useful Queries

### Get all pages for a client with draft status
```sql
SELECT 
  slug,
  title,
  is_published,
  has_draft,
  CASE 
    WHEN has_draft THEN 'Has unpublished changes'
    WHEN is_published THEN 'Published'
    ELSE 'Draft only'
  END as status
FROM client_pages
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm')
ORDER BY sort_order;
```

### Get version history for a page
```sql
SELECT 
  v.version_number,
  v.published_at,
  v.change_summary,
  v.version_label
FROM client_page_versions v
JOIN client_pages p ON v.page_id = p.id
WHERE p.client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm')
  AND p.slug = 'home'
ORDER BY v.version_number DESC;
```

### Get all active components for a client
```sql
SELECT 
  component_type,
  name,
  has_draft,
  LENGTH(html_content) as content_size
FROM client_components
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm')
  AND is_active = true;
```

## 🐛 Troubleshooting

### Draft not showing in preview
1. Check `has_draft` flag is true
2. Verify `html_content_draft` is not NULL
3. Confirm preview query param: `?preview=true`

### Version not being created
1. Check trigger is enabled: `\d+ client_pages`
2. Verify `is_published` changed from false to true
3. Check `client_page_versions` table for errors

### RLS blocking queries
1. Use service role key in API routes
2. Check policy with: `SELECT * FROM pg_policies WHERE tablename = 'client_pages';`
3. Temporarily disable RLS for testing: `ALTER TABLE client_pages DISABLE ROW LEVEL SECURITY;`

## 📚 Next Steps

1. ✅ Execute SQL schema
2. ✅ Verify tables created
3. ⏭️ Create API routes
4. ⏭️ Build dynamic page renderer
5. ⏭️ Create content migration tool
6. ⏭️ Build admin interface

---

**Questions?** Check the main README or create an issue.


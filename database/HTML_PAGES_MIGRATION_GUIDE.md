# HTML Pages Migration Guide

## 🎯 Overview

This migration simplifies the `html_pages` table by:
1. **Removing duplicate fields** - No more confusion between `title`/`meta_title` and `description`/`meta_description`
2. **Adding indexing control** - New `is_indexable` boolean field (defaults to `false` for noindex)
3. **Ensuring database values always win** - Clear hierarchy for SEO data

---

## 📋 What Changed

### Database Schema Changes

#### ❌ Removed Fields (Duplicates):
- `title` (text) - **Replaced by** `meta_title`
- `description` (text) - **Replaced by** `meta_description`

#### ✅ Added Fields:
- `is_indexable` (boolean) - Default: `FALSE` (noindex, nofollow)

#### ✅ Kept Fields:
- `meta_title` (text) - **Now the primary title field**
- `meta_description` (text) - **Now the primary description field**
- `meta_keywords` (text)
- `og_image` (text)
- `canonical_url` (text)
- `html_content` (text)
- All other existing fields

### New Table Structure

```sql
html_pages (
  id                 UUID PRIMARY KEY
  user_id            UUID
  html_content       TEXT NOT NULL
  meta_title         TEXT             -- Primary title (required)
  meta_description   TEXT             -- Primary description
  meta_keywords      TEXT
  og_image           TEXT
  canonical_url      TEXT
  is_indexable       BOOLEAN DEFAULT FALSE  -- NEW: Controls indexing
  created_at         TIMESTAMP
  updated_at         TIMESTAMP
)
```

---

## 🔄 Migration Steps

### Step 1: Run the Database Migration

Execute the migration SQL in your Supabase SQL Editor:

```bash
# File: database/migrate-html-pages-simplify.sql
```

**What it does:**
1. Adds `is_indexable` column (default: FALSE)
2. Migrates data from `title` → `meta_title` and `description` → `meta_description`
3. Drops the old duplicate columns
4. Verifies the changes

**⚠️ Important:** The migration preserves all existing data. No data loss!

### Step 2: Update Existing Pages (Optional)

If you want to make existing pages indexable, run:

```sql
-- Make specific pages indexable
UPDATE html_pages 
SET is_indexable = true 
WHERE id IN ('page-id-1', 'page-id-2');

-- Or make ALL existing pages indexable
UPDATE html_pages 
SET is_indexable = true;
```

---

## 🎨 New Behavior

### SEO Data Hierarchy

**For Title:**
1. ✅ `meta_title` from database (if exists) - **ALWAYS WINS**
2. Extract `<title>` from `html_content` (if database field is null)
3. Default: "Untitled Page"

**For Description:**
1. ✅ `meta_description` from database (if exists) - **ALWAYS WINS**
2. Extract `<meta name="description">` from `html_content` (if database field is null)
3. Default: Empty string

**For Indexing:**
- `is_indexable = true` → `<meta name="robots" content="index, follow" />`
- `is_indexable = false` → `<meta name="robots" content="noindex, nofollow" />` **(DEFAULT)**

### Code Example - Rendering Logic

```javascript
// Database values ALWAYS win if they exist
const metaTitle = pageData.meta_title || extractTitleFromHTML(pageData.html_content)
const metaDescription = pageData.meta_description || extractDescriptionFromHTML(pageData.html_content)
const robotsMeta = pageData.is_indexable ? 'index, follow' : 'noindex, nofollow'
```

---

## 📝 API Changes

### Creating a New Page

**Before:**
```javascript
POST /api/create-page
{
  "title": "My Page",                    // ❌ Removed
  "description": "Page description",     // ❌ Removed
  "meta_title": "SEO Title",
  "meta_description": "SEO Description",
  "htmlContent": "<html>...</html>"
}
```

**After:**
```javascript
POST /api/create-page
{
  "meta_title": "My Page Title",         // ✅ Now required
  "meta_description": "Page description", // ✅ Optional
  "meta_keywords": "keyword1, keyword2",  // Optional
  "og_image": "https://...",              // Optional
  "canonical_url": "https://...",         // Optional
  "is_indexable": false,                  // ✅ NEW (default: false)
  "htmlContent": "<html>...</html>"       // Required
}
```

**Response:**
```javascript
{
  "success": true,
  "pageId": "uuid",
  "url": "/p/uuid",
  "meta_title": "My Page Title",         // Updated from "title"
  "is_indexable": false,                  // NEW
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### Listing Pages

**Before:**
```javascript
GET /api/list-pages

Response: [
  {
    "id": "uuid",
    "title": "...",          // ❌ Removed
    "description": "...",    // ❌ Removed
    ...
  }
]
```

**After:**
```javascript
GET /api/list-pages

Response: [
  {
    "id": "uuid",
    "meta_title": "...",        // ✅ Updated
    "meta_description": "...",  // ✅ Updated
    "is_indexable": false,      // ✅ NEW
    ...
  }
]
```

---

## 🚨 Breaking Changes

### If You Were Using the Old API

**1. Creating Pages**
- Change `title` → `meta_title`
- Change `description` → `meta_description`
- Add `is_indexable: true` if you want the page indexed

**2. Querying Pages**
- Update SELECT queries to use `meta_title` instead of `title`
- Update SELECT queries to use `meta_description` instead of `description`

**3. Frontend Display**
- Update any code displaying `page.title` → `page.meta_title`
- Update any code displaying `page.description` → `page.meta_description`

---

## ✅ Benefits

1. **No More Confusion** - Single source of truth for title and description
2. **Database Always Wins** - Clear hierarchy: database > HTML extraction
3. **Better SEO Control** - Explicit indexing control per page
4. **Secure by Default** - New pages are `noindex` until explicitly made indexable
5. **Cleaner Code** - Simpler, more maintainable logic

---

## 🧪 Testing

### Verify Migration

```sql
-- Check table structure
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'html_pages'
ORDER BY ordinal_position;

-- Should NOT see: title, description
-- Should see: meta_title, meta_description, is_indexable
```

### Test Indexing

```javascript
// Create a noindex page (default)
const noindexPage = await createPage({
  meta_title: "Private Page",
  htmlContent: "<html>...</html>"
  // is_indexable defaults to false
});

// Create an indexable page
const indexablePage = await createPage({
  meta_title: "Public Page",
  htmlContent: "<html>...</html>",
  is_indexable: true
});

// Visit pages and check <meta name="robots"> tag
```

---

## 📚 Files Modified

1. **database/migrate-html-pages-simplify.sql** - Database migration script
2. **pages/p/[id].js** - Page rendering logic
3. **pages/api/create-page.js** - Page creation API
4. **pages/api/list-pages.js** - Page listing API

---

## ❓ FAQ

**Q: Will I lose any data?**
A: No! The migration copies all data from `title` to `meta_title` and `description` to `meta_description` before dropping the old columns.

**Q: What happens to my existing pages?**
A: They will all be `noindex` by default. You need to explicitly set `is_indexable = true` for pages you want indexed.

**Q: Can I still have meta tags in my HTML?**
A: Yes! But database fields will always take priority. HTML meta tags are only used as fallback if database fields are empty.

**Q: What if I don't provide meta_title?**
A: The system will extract the `<title>` from your HTML content. If that doesn't exist, it shows "Untitled Page".

**Q: Why default to noindex?**
A: Safety first! This prevents accidental indexing of draft/test pages. You explicitly opt-in to indexing.

---

## 🎉 Summary

You now have:
- ✅ Single title field (`meta_title`)
- ✅ Single description field (`meta_description`)
- ✅ Explicit indexing control (`is_indexable`)
- ✅ Database values always win over HTML
- ✅ Secure by default (noindex)
- ✅ Cleaner, simpler code

**Ready to migrate? Run the SQL script and you're done!** 🚀


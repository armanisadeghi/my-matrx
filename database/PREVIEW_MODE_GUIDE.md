# 🎨 Preview Mode Implementation Guide

## Overview

The preview mode system allows clients to make changes to their content and see them live **without publishing** to production. This is accomplished using the same URL with a query parameter.

---

## 🔄 How It Works

### Database Structure

Every editable field has TWO columns:
- **Production Column**: `html_content` - What visitors see
- **Draft Column**: `html_content_draft` - What editors see in preview

### URL Behavior

| URL | Shows | Use Case |
|-----|-------|----------|
| `/c/iopbm/home` | `html_content` | Public visitors |
| `/c/iopbm/home?preview=true` | `html_content_draft` (if exists) | Client previewing changes |

---

## 🎯 Implementation in Routes

### In `pages/c/[client]/[page].js`:

```javascript
export async function getServerSideProps({ params, query }) {
  const { client, page } = params;
  const isPreview = query.preview === 'true';
  
  // Fetch page from database
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );
  
  const { data: pageData } = await supabase
    .from('client_pages')
    .select('*')
    .eq('client_id', await getClientId(client))
    .eq('slug', page)
    .single();
  
  // Determine which content to show
  const content = {
    html: isPreview && pageData.html_content_draft 
      ? pageData.html_content_draft 
      : pageData.html_content,
      
    css: isPreview && pageData.css_content_draft
      ? pageData.css_content_draft
      : pageData.css_content,
      
    metaTitle: isPreview && pageData.meta_title_draft
      ? pageData.meta_title_draft
      : pageData.meta_title,
    // ... etc for all fields
  };
  
  return {
    props: {
      content,
      isPreview,
      hasDraft: pageData.has_draft,
      pageId: pageData.id
    }
  };
}
```

---

## 🎨 Preview Banner Component

Show a banner when in preview mode:

```javascript
// components/PreviewBanner.js
export default function PreviewBanner({ pageId, onPublish, onDiscard }) {
  return (
    <div className="preview-banner">
      <div className="container">
        <span className="preview-icon">⚠️</span>
        <span className="preview-text">
          PREVIEW MODE - You are viewing unpublished changes
        </span>
        <div className="preview-actions">
          <button 
            onClick={onPublish}
            className="btn-publish"
          >
            ✓ Publish Changes
          </button>
          <button 
            onClick={onDiscard}
            className="btn-discard"
          >
            ✕ Discard Draft
          </button>
          <a 
            href={window.location.pathname} 
            className="btn-exit"
          >
            View Live Site
          </a>
        </div>
      </div>
      
      <style jsx>{`
        .preview-banner {
          background: linear-gradient(135deg, #ff9800, #f57c00);
          color: white;
          padding: 12px 20px;
          position: sticky;
          top: 0;
          z-index: 10000;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .preview-icon {
          font-size: 1.2rem;
        }
        .preview-text {
          font-weight: 600;
          flex: 1;
        }
        .preview-actions {
          display: flex;
          gap: 0.5rem;
        }
        button, .btn-exit {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
        .btn-publish {
          background: #4CAF50;
          color: white;
        }
        .btn-discard {
          background: #f44336;
          color: white;
        }
        .btn-exit {
          background: rgba(255,255,255,0.2);
          color: white;
          border: 1px solid white;
        }
        button:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
```

---

## 📝 Content Editing Workflow

### 1. **Client Makes Changes**

Via API call:
```javascript
// Update draft content
await fetch('/api/clients/iopbm/pages/home', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    html_content_draft: '<h1>New content</h1>',
    meta_title_draft: 'New Title'
  })
});
```

This updates the database:
```sql
UPDATE client_pages
SET 
  html_content_draft = '<h1>New content</h1>',
  meta_title_draft = 'New Title',
  has_draft = true
WHERE slug = 'home';
```

### 2. **Client Previews Changes**

- Click "Preview" button
- Opens: `/c/iopbm/home?preview=true`
- Shows the draft content
- Preview banner appears at top

### 3. **Client Publishes**

Click "Publish" button, which calls:
```javascript
await fetch('/api/clients/iopbm/pages/home/publish', {
  method: 'POST'
});
```

This executes:
```sql
SELECT publish_page_draft('page-uuid', 'user-uuid');
```

Which:
1. Copies `html_content_draft` → `html_content`
2. Copies all other `_draft` fields to main fields
3. Clears all `_draft` fields
4. Sets `has_draft = false`
5. Creates version history entry
6. Updates `last_published_at` timestamp

### 4. **Changes Are Live**

- Production URL shows new content
- Version saved in history
- Can rollback if needed

---

## 🔒 Security Considerations

### Preview Access Control

You have several options:

#### Option 1: Cookie-Based Authentication
```javascript
// Middleware to check authentication
export async function getServerSideProps({ params, query, req }) {
  const isPreview = query.preview === 'true';
  
  if (isPreview) {
    // Check if user is authenticated
    const session = await getSession(req);
    if (!session) {
      return { redirect: { destination: '/login', permanent: false } };
    }
    
    // Check if user has access to this client
    const hasAccess = await checkClientAccess(session.user.id, params.client);
    if (!hasAccess) {
      return { notFound: true };
    }
  }
  
  // ... rest of logic
}
```

#### Option 2: Secret Token
```javascript
// Generate secret token for preview
const PREVIEW_TOKEN = process.env.PREVIEW_SECRET_TOKEN;

if (isPreview && query.token !== PREVIEW_TOKEN) {
  return { notFound: true };
}

// URL becomes: /c/iopbm/home?preview=true&token=secret123
```

#### Option 3: Time-Limited Preview Links
```javascript
// Store in database
CREATE TABLE preview_links (
  token TEXT PRIMARY KEY,
  page_id UUID,
  expires_at TIMESTAMP,
  created_by UUID
);

// Generate link
const token = generateRandomToken();
await createPreviewLink(pageId, token, expiresIn24Hours);

// Share link: /c/iopbm/home?preview=true&token=abc123xyz
```

---

## 🎛️ Advanced Features

### Multi-Version Preview

Allow previewing specific versions:

```javascript
// URL: /c/iopbm/home?version=5
const versionNumber = query.version;

if (versionNumber) {
  const { data: version } = await supabase
    .from('client_page_versions')
    .select('*')
    .eq('page_id', pageId)
    .eq('version_number', versionNumber)
    .single();
    
  content = version.html_content;
}
```

### Side-by-Side Comparison

Show draft and live side-by-side:

```javascript
// URL: /c/iopbm/home?compare=true

if (query.compare === 'true') {
  return {
    props: {
      liveContent: pageData.html_content,
      draftContent: pageData.html_content_draft,
      compareMode: true
    }
  };
}

// Render as split screen
<div className="compare-view">
  <div className="live-panel">
    <h2>Live Version</h2>
    <div dangerouslySetInnerHTML={{ __html: liveContent }} />
  </div>
  <div className="draft-panel">
    <h2>Draft Version</h2>
    <div dangerouslySetInnerHTML={{ __html: draftContent }} />
  </div>
</div>
```

### Change Highlighting

Show what changed between versions:

```javascript
import { diffWords } from 'diff';

const changes = diffWords(liveContent, draftContent);

// Render with highlighting
{changes.map((part, i) => (
  <span
    key={i}
    style={{
      background: part.added ? '#c8e6c9' : part.removed ? '#ffcdd2' : 'transparent',
      textDecoration: part.removed ? 'line-through' : 'none'
    }}
  >
    {part.value}
  </span>
))}
```

---

## 🧪 Testing Preview Mode

### Test Checklist

- [ ] Draft content shows in preview mode
- [ ] Production content unchanged when viewing with `?preview=true`
- [ ] Preview banner appears correctly
- [ ] Publish button works and updates production
- [ ] Discard button clears draft
- [ ] Can switch between preview and live view
- [ ] Unauthorized users cannot access preview
- [ ] Version history created on publish
- [ ] All SEO fields respect preview mode

### Test Script

```javascript
// 1. Create draft
await updatePageDraft('home', '<h1>Draft Content</h1>');

// 2. Verify draft exists
const page = await getPage('home');
console.assert(page.has_draft === true);

// 3. Preview shows draft
const previewContent = await fetchPage('/c/iopbm/home?preview=true');
console.assert(previewContent.includes('Draft Content'));

// 4. Production shows original
const liveContent = await fetchPage('/c/iopbm/home');
console.assert(!liveContent.includes('Draft Content'));

// 5. Publish
await publishDraft('home');

// 6. Production now shows draft
const newLiveContent = await fetchPage('/c/iopbm/home');
console.assert(newLiveContent.includes('Draft Content'));

// 7. Draft cleared
const updatedPage = await getPage('home');
console.assert(updatedPage.has_draft === false);
```

---

## 📱 Mobile Considerations

Make preview banner responsive:

```css
@media (max-width: 768px) {
  .preview-banner .container {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .preview-actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .preview-actions button {
    flex: 1;
    font-size: 0.9rem;
  }
}
```

---

## 🎯 Best Practices

1. **Always show preview banner** - Make it obvious this isn't production
2. **Prevent indexing** - Add `<meta name="robots" content="noindex">` in preview mode
3. **Disable analytics** - Don't track preview visits
4. **Add watermark** - Optional visual indicator
5. **Auto-save drafts** - Save changes periodically
6. **Confirmation dialogs** - Confirm before publishing/discarding
7. **Loading states** - Show progress when publishing
8. **Error handling** - Graceful fallback if draft is corrupted

---

## 🔗 Integration with AI Assistant

Since your main app has AI-assisted coding, you can integrate preview mode:

```javascript
// User: "Make the hero section bigger"
// AI edits the draft
await updateDraft(pageId, {
  html_content_draft: modifiedHTML
});

// AI: "I've made the hero section bigger. Preview the changes?"
// Show preview link: /c/iopbm/home?preview=true

// User approves: "Looks good, publish it"
// AI publishes the draft
await publishDraft(pageId);
```

This creates a seamless editing workflow! 🎉

---

Ready to implement? Let me know if you need clarification on any part!


## 🗺️ Client Sites Routing Architecture

## Overview

The routing system supports three levels of pages:
1. **Root-level pages** - Standalone pages (home, contact)
2. **Category listing pages** - Index pages showing collections
3. **Category item pages** - Individual items within a category

---

## 📊 URL Structure

### Examples:

```
/c/iopbm                              → Redirects to home
/c/iopbm/home                         → Home page (root level)
/c/iopbm/contact                      → Contact page (root level)

/c/iopbm/services                     → Services listing (shows all services)
/c/iopbm/services/gastroenterology    → Individual service page
/c/iopbm/services/concierge-medicine  → Individual service page

/c/iopbm/education                    → Education/blog listing (shows all posts)
/c/iopbm/education/gut-health-basics  → Individual blog post
/c/iopbm/education/plant-based-nutrition → Individual blog post
```

---

## 🗂️ Page Categories

Categories organize pages into collections:

| Category | Purpose | Examples |
|----------|---------|----------|
| `root` or `general` | Standalone pages | Home, Contact, About |
| `services` | Service offerings | Individual service pages |
| `education` | Blog posts, articles | Educational content |
| `team` | Team member profiles | Staff bios |
| `locations` | Multiple locations | Office locations |
| `custom` | Any custom category | Your choice! |

---

## 📄 Page Types

Page types determine how pages are rendered:

| Page Type | Purpose | Use Case |
|-----------|---------|----------|
| `standard` | Regular page | Most pages |
| `home` | Homepage | Landing page |
| `listing` | Collection index | Shows grid of child pages |
| `service` | Service detail | Service description |
| `blog` | Blog post | Article with metadata |

---

## 🔧 Database Fields

### New Fields Added:

```sql
client_pages:
  category       TEXT      -- 'services', 'education', 'general', etc.
  page_type      TEXT      -- 'standard', 'listing', 'service', 'blog'
  parent_id      UUID      -- Optional: parent page reference
  excerpt        TEXT      -- Short description for listings
  featured_image TEXT      -- Image URL for cards
  published_date TIMESTAMP -- For blog posts
  author         TEXT      -- Author name
  tags           TEXT[]    -- Array of tags
```

---

## 🚀 Creating Pages

### Example 1: Create a New Service

```sql
INSERT INTO client_pages (
  client_id,
  slug,
  category,
  page_type,
  title,
  excerpt,
  featured_image,
  html_content,
  is_published,
  sort_order
) VALUES (
  '71ebb42c-e69e-4db5-a0f9-928e1079f32d', -- IOPBM client ID
  'hormone-therapy',
  'services',
  'service',
  'Bioidentical Hormone Therapy',
  'Personalized hormone optimization for men and women',
  '/iopbm/assets/hormone-therapy.jpg',
  '<section><h1>Hormone Therapy</h1><p>Content here...</p></section>',
  true,
  4
);
```

**Result:** Page accessible at `/c/iopbm/services/hormone-therapy`

---

### Example 2: Create a New Blog Post

```sql
INSERT INTO client_pages (
  client_id,
  slug,
  category,
  page_type,
  title,
  excerpt,
  author,
  published_date,
  tags,
  featured_image,
  html_content,
  is_published
) VALUES (
  '71ebb42c-e69e-4db5-a0f9-928e1079f32d',
  'inflammatory-bowel-disease',
  'education',
  'blog',
  'Understanding Inflammatory Bowel Disease',
  'Learn about IBD symptoms, causes, and treatment options',
  'Dr. Angie Sadeghi, MD',
  NOW(),
  ARRAY['ibd', 'crohns', 'colitis', 'digestive-health'],
  '/iopbm/assets/ibd-guide.jpg',
  '<article><h1>Understanding IBD</h1><p>Content here...</p></article>',
  true
);
```

**Result:** Page accessible at `/c/iopbm/education/inflammatory-bowel-disease`

---

### Example 3: Create a Listing Page

```sql
-- First, create the category listing page
INSERT INTO client_pages (
  client_id,
  slug,
  category,
  page_type,
  title,
  excerpt,
  html_content,
  is_published
) VALUES (
  '71ebb42c-e69e-4db5-a0f9-928e1079f32d',
  'team',
  'team',
  'listing',
  'Our Team',
  'Meet the healthcare professionals at IOPBM',
  '<section style="padding: 4rem 2rem; text-align: center;">
    <h1>Meet Our Team</h1>
    <p>Dedicated healthcare professionals committed to your wellness</p>
  </section>',
  true
);

-- Then create team member pages
INSERT INTO client_pages (
  client_id,
  slug,
  category,
  page_type,
  title,
  excerpt,
  featured_image,
  html_content,
  is_published,
  sort_order
) VALUES (
  '71ebb42c-e69e-4db5-a0f9-928e1079f32d',
  'dr-sadeghi',
  'team',
  'standard',
  'Dr. Angie Sadeghi, MD',
  'Board-certified gastroenterologist and founder of IOPBM',
  '/iopbm/assets/dr-sadeghi.jpg',
  '<section><h1>Dr. Angie Sadeghi, MD</h1><p>Bio here...</p></section>',
  true,
  1
);
```

**Result:**
- Listing: `/c/iopbm/team` (shows all team members)
- Individual: `/c/iopbm/team/dr-sadeghi`

---

## 🎯 How Listing Pages Work

When a page has `page_type = 'listing'`, the system automatically:

1. Fetches all published pages in the same category
2. Filters out the listing page itself
3. Displays them as cards with:
   - Featured image (if set)
   - Title
   - Excerpt
   - Published date (for blogs)
   - Link to full page

---

## 🔀 Routing Priority

Routes are matched in this order:

1. `/c/[client]/[category]/[slug]` - Category-based routes (new)
2. `/c/[client]/[page]` - Root-level pages (existing)
3. `/c/[client]` - Redirects to home

**Example routing:**
- `/c/iopbm/home` → Matches route #2 (root-level)
- `/c/iopbm/services` → Matches route #1 (services listing)
- `/c/iopbm/services/gastro` → Matches route #1 (service item)

---

## 📝 Best Practices

### 1. Use Consistent Categories

Stick to a set of standard categories:
- `general` or `root` - Standalone pages
- `services` - Service pages
- `education` - Blog/articles
- `team` - Team profiles
- `locations` - Locations (if multi-location)

### 2. Create Listing Pages First

Before adding items to a category:
1. Create the listing page
2. Set `page_type = 'listing'`
3. Then add individual items

### 3. Use Excerpts for Cards

Always provide:
- `excerpt` - Shows in listing cards
- `featured_image` - Makes cards visual
- `title` - Clear, descriptive

### 4. Organize with Sort Order

Use `sort_order` to control order in listings:
```sql
UPDATE client_pages 
SET sort_order = 1 
WHERE slug = 'most-important-service';
```

---

## 🎨 Customizing Listing Pages

### Basic Listing (Auto-generated)

If you don't provide custom HTML for a listing page, the system auto-generates a card grid showing all items in that category.

### Custom Listing Layout

Provide your own HTML in `html_content`:

```html
<section style="padding: 4rem 2rem;">
  <div style="max-width: 1200px; margin: 0 auto; text-align: center;">
    <h1>Our Services</h1>
    <p>Comprehensive care tailored to your needs</p>
    
    <!-- Optional: Add custom intro content -->
    <div style="margin: 2rem 0;">
      <p>At IOPBM, we offer a full spectrum of services...</p>
    </div>
  </div>
</section>

<!-- The system will automatically insert the card grid here -->
```

---

## 🔍 Querying Pages by Category

### Get All Services:
```javascript
const services = await getClientPages('iopbm', false, 'services')
```

### Get All Blog Posts:
```javascript
const blogs = await getClientPages('iopbm', false, 'education')
```

### Get Specific Page in Category:
```javascript
const page = await getClientPageByCategory('iopbm', 'services', 'gastroenterology')
```

---

## 🧪 Testing Your Routes

### Test Checklist:

- [ ] Root pages work: `/c/iopbm/home`, `/c/iopbm/contact`
- [ ] Category listing works: `/c/iopbm/services`
- [ ] Category items work: `/c/iopbm/services/gastroenterology`
- [ ] Listing page shows cards of all items
- [ ] Cards link to individual pages
- [ ] Preview mode works: Add `?preview=true`
- [ ] Header/footer appear on all pages
- [ ] Global CSS applies everywhere

---

## 🎯 Migration Guide

### Converting Home Page Sections to Separate Pages

If you want to split sections from your home page:

**Step 1:** Identify sections to extract
```
Home page currently has:
- Hero
- About section  ← Extract this
- Services section ← Extract this
- Testimonials
- Contact
```

**Step 2:** Create new pages
```sql
-- About page
INSERT INTO client_pages (
  client_id, slug, category, page_type, title, html_content, is_published
) VALUES (
  'client-id', 'about', 'general', 'standard', 'About Us',
  '<!-- Copy about section HTML from home.html -->',
  true
);

-- Services listing
INSERT INTO client_pages (
  client_id, slug, category, page_type, title, html_content, is_published
) VALUES (
  'client-id', 'services', 'services', 'listing', 'Our Services',
  '<!-- Copy services section HTML -->',
  true
);
```

**Step 3:** Update navigation links
```sql
UPDATE client_sites
SET navigation = '[
  {"label": "Home", "href": "/c/iopbm"},
  {"label": "About", "href": "/c/iopbm/about"},
  {"label": "Services", "href": "/c/iopbm/services"},
  {"label": "Education", "href": "/c/iopbm/education"},
  {"label": "Contact", "href": "/c/iopbm/contact"}
]'
WHERE slug = 'iopbm';
```

**Step 4:** Keep home page simpler
Remove extracted sections from home page, keep only:
- Hero
- Brief intro
- CTA sections

---

## 🚀 Creating a New Category

Want to add a new category (e.g., "FAQs")?

**Step 1:** Create listing page
```sql
INSERT INTO client_pages (
  client_id, slug, category, page_type, title, excerpt, html_content, is_published
) VALUES (
  'client-id', 'faq', 'faq', 'listing',
  'Frequently Asked Questions',
  'Find answers to common questions',
  '<section><h1>FAQ</h1><p>Common questions answered</p></section>',
  true
);
```

**Step 2:** Add FAQ items
```sql
INSERT INTO client_pages (
  client_id, slug, category, page_type, title, excerpt, html_content, is_published, sort_order
) VALUES (
  'client-id', 'insurance', 'faq', 'standard',
  'Insurance & Payment',
  'Learn about insurance coverage and payment options',
  '<section><h1>Insurance & Payment</h1><p>We accept...</p></section>',
  true, 1
),
(
  'client-id', 'appointments', 'faq', 'standard',
  'Scheduling Appointments',
  'How to schedule and what to expect',
  '<section><h1>Appointments</h1><p>Schedule by...</p></section>',
  true, 2
);
```

**Result:**
- Listing: `/c/iopbm/faq`
- Items: `/c/iopbm/faq/insurance`, `/c/iopbm/faq/appointments`

---

## 📚 Summary

| Route Pattern | Purpose | Example |
|---------------|---------|---------|
| `/c/[client]` | Client home | `/c/iopbm` |
| `/c/[client]/[page]` | Root page | `/c/iopbm/contact` |
| `/c/[client]/[category]` | Category listing | `/c/iopbm/services` |
| `/c/[client]/[category]/[slug]` | Category item | `/c/iopbm/services/gastro` |

**Key Points:**
- ✅ Use categories to organize related pages
- ✅ Create listing pages for each category
- ✅ Use excerpts and featured images for better listings
- ✅ Global CSS applies to all pages
- ✅ Easy to add new pages without code changes

---

Need help setting up a specific category structure? Ask! 🚀


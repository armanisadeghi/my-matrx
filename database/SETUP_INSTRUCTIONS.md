# 🚀 Database Setup Instructions

## Step-by-Step Guide to Setting Up the Client Sites Database

### Prerequisites
- ✅ Active Supabase project
- ✅ Access to Supabase SQL Editor
- ✅ Service role key configured in your `.env.local`

---

## 📝 Step 1: Execute Main Schema

1. **Open Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "+ New Query"

3. **Copy and Paste Schema**
   - Open `database/schema.sql`
   - Copy the ENTIRE contents
   - Paste into the SQL Editor

4. **Execute**
   - Click "Run" (or press Ctrl/Cmd + Enter)
   - Wait for completion (may take 10-30 seconds)

5. **Verify Success**
   - You should see: "Schema created successfully!"
   - Check the "Table Editor" - you should see 6 new tables:
     - `client_sites`
     - `client_pages`
     - `client_components`
     - `client_page_versions`
     - `client_assets`
     - `client_activity_log`

---

## 📝 Step 2: Insert IOPBM Initial Data

1. **Create New Query**
   - In SQL Editor, click "+ New Query"

2. **Copy and Paste Data Script**
   - Open `database/insert-iopbm-home.sql`
   - Copy the ENTIRE contents
   - Paste into the SQL Editor

3. **Execute**
   - Click "Run"
   - Wait for completion

4. **Verify Success**
   - You should see messages like:
     - "IOPBM home page created successfully"
     - "Placeholder pages created successfully"
     - "Header and footer components created"

---

## ✅ Step 3: Verification

Run these queries to confirm everything is set up correctly:

### Verify Client Site Exists
```sql
SELECT * FROM client_sites WHERE slug = 'iopbm';
```
**Expected**: 1 row with IOPBM details

### Verify Pages Created
```sql
SELECT 
  slug,
  title,
  is_home_page,
  has_draft,
  is_published,
  show_in_nav
FROM client_pages
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm')
ORDER BY sort_order;
```
**Expected**: 5 rows (home, services, education, about, contact)

### Verify Components Created
```sql
SELECT 
  component_type,
  name,
  is_active
FROM client_components
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm');
```
**Expected**: 2 rows (header, footer)

### Get IOPBM Client ID (save this!)
```sql
SELECT id FROM client_sites WHERE slug = 'iopbm';
```
**Action**: Copy the UUID - you'll need it for API calls

---

## 🔐 Step 4: Configure Environment Variables

Update your `.env.local` file:

```env
# Existing Supabase variables
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE=your_service_role_key

# New: IOPBM Client ID (optional, for convenience)
IOPBM_CLIENT_ID=paste_the_uuid_from_step3
```

---

## 🧪 Step 5: Test RLS Policies

### Test Public Read Access
```sql
-- This should work (reading published content)
SET ROLE anon;
SELECT * FROM client_sites WHERE is_active = true;
SELECT * FROM client_pages WHERE is_published = true;
RESET ROLE;
```

### Test Service Role Access
```sql
-- This should work (service role has full access)
SELECT * FROM client_pages; -- Should see all pages
```

---

## 🎯 Step 6: Test Helper Functions

### Test Publish Function
```sql
-- Get a page ID
SELECT id FROM client_pages WHERE slug = 'services' LIMIT 1;

-- Add some draft content
UPDATE client_pages 
SET 
  html_content_draft = '<h1>Test Draft</h1>',
  has_draft = true
WHERE slug = 'services';

-- Publish the draft
SELECT publish_page_draft(
  (SELECT id FROM client_pages WHERE slug = 'services'),
  NULL -- or a user UUID
);

-- Verify it worked
SELECT 
  html_content,
  has_draft,
  is_published 
FROM client_pages 
WHERE slug = 'services';
```
**Expected**: 
- `html_content` now contains the draft
- `has_draft` is `false`
- `is_published` is `true`

### Test Version History
```sql
-- Check if version was created
SELECT 
  version_number,
  published_at
FROM client_page_versions
WHERE page_id = (SELECT id FROM client_pages WHERE slug = 'services')
ORDER BY version_number DESC;
```
**Expected**: At least 1 version entry

---

## 🐛 Troubleshooting

### Issue: "permission denied for table client_sites"
**Solution**: Make sure you're using the service role key in your API routes, not the anon key.

### Issue: "relation client_sites does not exist"
**Solution**: 
1. Check if schema.sql executed successfully
2. Verify you're connected to the correct project
3. Try running schema.sql again

### Issue: "duplicate key value violates unique constraint"
**Solution**: Data already exists. Either:
- Skip insert-iopbm-home.sql if already run
- Or delete existing data first:
```sql
DELETE FROM client_pages WHERE client_id IN (SELECT id FROM client_sites WHERE slug = 'iopbm');
DELETE FROM client_components WHERE client_id IN (SELECT id FROM client_sites WHERE slug = 'iopbm');
DELETE FROM client_sites WHERE slug = 'iopbm';
```

### Issue: Version history not being created
**Solution**: Check if trigger exists:
```sql
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'client_pages';
```
Should see `page_version_on_publish` trigger.

---

## 📊 Useful Management Queries

### View All Clients
```sql
SELECT 
  slug,
  name,
  is_active,
  created_at
FROM client_sites
ORDER BY created_at DESC;
```

### View All Pages for IOPBM
```sql
SELECT 
  p.slug,
  p.title,
  p.is_published,
  p.has_draft,
  COUNT(v.id) as version_count
FROM client_pages p
LEFT JOIN client_page_versions v ON v.page_id = p.id
WHERE p.client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm')
GROUP BY p.id, p.slug, p.title, p.is_published, p.has_draft
ORDER BY p.sort_order;
```

### View Recent Activity
```sql
SELECT 
  activity_type,
  entity_type,
  description,
  created_at
FROM client_activity_log
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm')
ORDER BY created_at DESC
LIMIT 20;
```

---

## ✨ Next Steps After Database Setup

1. ✅ Database schema created
2. ✅ IOPBM client and pages inserted
3. ⏭️ Create API routes (`/api/clients/*`)
4. ⏭️ Build dynamic page renderer (`/pages/c/[client]/[page].js`)
5. ⏭️ Migrate home.html content to database
6. ⏭️ Test preview mode
7. ⏭️ Build admin interface

---

## 🆘 Need Help?

If you encounter issues:
1. Check the error message in Supabase SQL Editor
2. Review the troubleshooting section above
3. Check database/README.md for detailed documentation
4. Verify your Supabase project is active and accessible

---

**Ready?** Let's execute the schema! 🚀


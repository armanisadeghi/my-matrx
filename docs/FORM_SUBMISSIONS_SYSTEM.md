# Form Submissions System

## Overview

A universal, reusable system for storing arbitrary form data, surveys, and structured information using PostgreSQL's JSONB capabilities. No schema changes required when adding new forms.

## Architecture

```
┌─────────────────┐
│   HTML Form     │
│  (any form)     │
└────────┬────────┘
         │ POST /api/form-submissions
         ▼
┌─────────────────┐
│  Next.js API    │
│   Route Handler │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Supabase      │
│ form_submissions│
│   (JSONB data)  │
└─────────────────┘
```

## Database Schema

```sql
CREATE TABLE form_submissions (
  id UUID PRIMARY KEY,
  form_type TEXT NOT NULL,                    -- Identifier for the form
  submitted_by UUID REFERENCES auth.users,    -- NULL for anonymous
  submitted_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,                        -- The actual form data
  source_url TEXT,                            -- Where it was submitted from
  ip_address INET,                            -- Client IP
  user_agent TEXT,                            -- Browser info
  search_vector tsvector,                     -- Full-text search
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

### Key Features

- **JSONB storage**: Store any structure without schema changes
- **GIN indexes**: Fast JSONB queries and full-text search
- **RLS enabled**: Row-level security for multi-tenant access
- **Auto-timestamps**: Automatic `updated_at` trigger
- **Anonymous submissions**: `submitted_by` can be NULL

## API Endpoints

### POST /api/form-submissions

Submit form data.

**Request:**
```json
{
  "form_type": "realsingles_algorithm_worksheet",
  "data": {
    "gender_confirm": "yes",
    "distance_type": "soft",
    "age_importance": "very",
    "...": "..."
  },
  "source_url": "https://example.com/form"
}
```

**Response (201):**
```json
{
  "success": true,
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Submission saved successfully"
}
```

### GET /api/form-submissions/[id]

Retrieve a specific submission.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "form_type": "realsingles_algorithm_worksheet",
  "submitted_at": "2026-02-08T12:00:00Z",
  "data": { /* form data */ },
  "source_url": "https://example.com/form",
  "created_at": "2026-02-08T12:00:00Z"
}
```

### GET /api/form-submissions/latest?form_type=xxx

Get the most recent submission for a form type.

**Example:**
```
GET /api/form-submissions/latest?form_type=realsingles_algorithm_worksheet
```

### GET /api/form-submissions/list?form_type=xxx&limit=50

List submissions (metadata only, without full data).

**Example:**
```
GET /api/form-submissions/list?form_type=realsingles_algorithm_worksheet&limit=10
```

**Response:**
```json
{
  "submissions": [
    {
      "id": "...",
      "form_type": "...",
      "submitted_at": "...",
      "source_url": "...",
      "created_at": "..."
    }
  ],
  "count": 10
}
```

## HTML Integration Example

### Basic Submission

```html
<script>
async function submitForm() {
  const formData = {
    field1: document.getElementById('field1').value,
    field2: document.getElementById('field2').value
  };

  const response = await fetch('/api/form-submissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      form_type: 'my_custom_form',
      data: formData,
      source_url: window.location.href
    })
  });

  const result = await response.json();
  
  if (response.ok) {
    console.log('Saved with ID:', result.id);
  } else {
    console.error('Failed:', result.error);
  }
}
</script>
```

### With Auto-Save

```html
<script>
let autoSaveTimer = null;
let state = {};

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSave, 2000); // Save 2s after last change
}

async function autoSave() {
  await fetch('/api/form-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form_type: 'my_form_autosave',
      data: { ...state, is_draft: true },
      source_url: window.location.href
    })
  });
}

// Trigger on any input change
document.querySelectorAll('input, textarea, select').forEach(el => {
  el.addEventListener('change', () => {
    state[el.name] = el.value;
    scheduleAutoSave();
  });
});
</script>
```

## Querying JSONB Data

### Direct SQL Queries

```sql
-- Find submissions where philosophy is "quality"
SELECT * FROM form_submissions 
WHERE data->>'philosophy' = 'quality';

-- Find submissions with age_importance = "very"
SELECT * FROM form_submissions 
WHERE data->>'age_importance' = 'very';

-- Full-text search across all data
SELECT * FROM form_submissions 
WHERE search_vector @@ to_tsquery('english', 'distance & flexible');

-- Count by form type
SELECT form_type, COUNT(*) 
FROM form_submissions 
GROUP BY form_type;

-- Get recent submissions with specific nested data
SELECT id, form_type, data->>'completed_by' as completed_by, submitted_at
FROM form_submissions 
WHERE form_type = 'realsingles_algorithm_worksheet'
ORDER BY submitted_at DESC
LIMIT 10;
```

### Via Supabase Client

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

// Get all RealSingles worksheets
const { data } = await supabase
  .from('form_submissions')
  .select('*')
  .eq('form_type', 'realsingles_algorithm_worksheet')
  .order('created_at', { ascending: false });

// Query JSONB field
const { data } = await supabase
  .from('form_submissions')
  .select('*')
  .eq('data->>philosophy', 'quality'); // JSONB text extraction

// Full-text search
const { data } = await supabase
  .from('form_submissions')
  .select('*')
  .textSearch('search_vector', 'distance & flexible');
```

## Use Cases

### 1. **Surveys & Questionnaires**
```javascript
form_type: 'user_satisfaction_survey'
data: { rating: 5, comments: "...", nps_score: 9 }
```

### 2. **Configuration Wizards**
```javascript
form_type: 'app_setup_wizard'
data: { theme: "dark", notifications: true, ... }
```

### 3. **Algorithm Parameters** (like RealSingles)
```javascript
form_type: 'realsingles_algorithm_worksheet'
data: { distance_type: "soft", age_importance: "very", ... }
```

### 4. **Bug Reports / Feedback**
```javascript
form_type: 'bug_report'
data: { browser: "Chrome", steps: "...", severity: "high" }
```

### 5. **Lead Capture Forms**
```javascript
form_type: 'contact_inquiry'
data: { name: "...", email: "...", message: "..." }
```

## Benefits

✅ **No schema changes** - Add new forms instantly  
✅ **Queryable** - JSONB operators for deep queries  
✅ **Indexable** - GIN indexes for performance  
✅ **Searchable** - Full-text search across all data  
✅ **Trackable** - Know who submitted what and when  
✅ **Flexible** - Any structure, any data type  
✅ **Production-ready** - RLS, indexes, triggers included  

## Security

- **RLS Policies**: 
  - Anyone can insert (for anonymous forms)
  - Users can only view/update their own submissions
  - Service role bypasses RLS (use carefully in API routes)

- **IP Tracking**: Automatically captures `ip_address` for abuse prevention

- **Input Validation**: API validates `form_type` and `data` structure

## Monitoring

### View submission counts
```sql
SELECT 
  form_type,
  COUNT(*) as total_submissions,
  COUNT(DISTINCT submitted_by) as unique_users,
  MAX(submitted_at) as last_submission
FROM form_submissions
GROUP BY form_type
ORDER BY total_submissions DESC;
```

### Recent activity
```sql
SELECT 
  form_type,
  submitted_at,
  ip_address,
  source_url
FROM form_submissions
ORDER BY submitted_at DESC
LIMIT 20;
```

## Future Enhancements

- [ ] Add support for file attachments via Supabase Storage
- [ ] Add webhook notifications on submission
- [ ] Add email notifications for specific form types
- [ ] Add admin dashboard to view/export submissions
- [ ] Add data export (CSV/JSON) endpoint
- [ ] Add submission editing capability
- [ ] Add form versioning (track schema changes)

## Example: RealSingles Algorithm Worksheet

The RealSingles worksheet demonstrates all features:

1. **Auto-save**: Saves draft every 2 seconds
2. **Manual export**: Downloads text file + saves to DB
3. **Progress tracking**: Shows completion percentage
4. **Flexible schema**: 24+ questions across 8 sections
5. **Anonymous submission**: No auth required

**File**: `/public/real-singles/realsingles-algorithm-worksheet.html`

**Form Type**: `realsingles_algorithm_worksheet`

**Data Structure**:
```json
{
  "gender_confirm": "yes",
  "distance_type": "soft",
  "distance_max": "250",
  "age_type": "soft",
  "age_importance": "very",
  "height_type": "soft",
  "..": "... (24+ fields)"
}
```

## Support

For questions or issues, contact the development team or check the Supabase logs:

```bash
# View recent errors
supabase logs postgres --level error --limit 50

# View API logs
supabase logs api --limit 50
```

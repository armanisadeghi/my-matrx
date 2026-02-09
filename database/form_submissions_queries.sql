-- ══════════════════════════════════════════════════════════════════
-- FORM SUBMISSIONS - USEFUL QUERIES
-- Copy/paste these into Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- BASIC QUERIES
-- ────────────────────────────────────────────────────────────────

-- View all submissions (summary)
SELECT 
  id,
  form_type,
  submitted_at,
  source_url,
  created_at
FROM form_submissions
ORDER BY submitted_at DESC
LIMIT 20;

-- Count submissions by form type
SELECT 
  form_type,
  COUNT(*) as total,
  MIN(submitted_at) as first_submission,
  MAX(submitted_at) as last_submission
FROM form_submissions
GROUP BY form_type
ORDER BY total DESC;

-- ────────────────────────────────────────────────────────────────
-- REALSINGLES ALGORITHM WORKSHEET - SPECIFIC QUERIES
-- ────────────────────────────────────────────────────────────────

-- Get the latest RealSingles worksheet (final, not autosave)
SELECT 
  id,
  submitted_at,
  data
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
ORDER BY submitted_at DESC
LIMIT 1;

-- Get all RealSingles decisions (excluding autosaves)
SELECT 
  id,
  submitted_at,
  data->>'completed_by' as completed_by,
  data->>'philosophy' as overall_philosophy,
  data
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
ORDER BY submitted_at DESC;

-- Analyze philosophy choices
SELECT 
  data->>'philosophy' as philosophy,
  COUNT(*) as count
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
GROUP BY data->>'philosophy';

-- Analyze distance preferences
SELECT 
  data->>'distance_type' as distance_flexibility,
  data->>'distance_max' as max_distance,
  COUNT(*) as count
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
GROUP BY data->>'distance_type', data->>'distance_max';

-- Analyze age importance
SELECT 
  data->>'age_type' as age_flexibility,
  data->>'age_importance' as age_importance,
  COUNT(*) as count
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
GROUP BY data->>'age_type', data->>'age_importance';

-- Find worksheets where age is marked as "critical"
SELECT 
  id,
  submitted_at,
  data->>'age_importance' as age_importance,
  data->>'age_type' as age_flexibility,
  data->>'age_notes' as notes
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
  AND data->>'age_importance' = 'critical';

-- Summary of all dealbreaker/critical factors
SELECT 
  id,
  submitted_at,
  jsonb_object_keys(data) as field_name,
  data->>jsonb_object_keys(data) as value
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
  AND data->>jsonb_object_keys(data) = 'critical';

-- Get specific decision fields in table format
SELECT 
  id,
  submitted_at,
  data->>'distance_type' as distance,
  data->>'age_importance' as age,
  data->>'height_importance' as height,
  data->>'marital_importance' as marital,
  data->>'intentions_importance' as intentions,
  data->>'wants_children_importance' as children,
  data->>'philosophy' as philosophy
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
ORDER BY submitted_at DESC;

-- ────────────────────────────────────────────────────────────────
-- ADVANCED JSONB QUERIES
-- ────────────────────────────────────────────────────────────────

-- Find all "hard filter" preferences
SELECT 
  id,
  submitted_at,
  jsonb_object_keys(data) as field,
  data->>jsonb_object_keys(data) as value
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
  AND data->>jsonb_object_keys(data) = 'hard';

-- Extract all notes/comments
SELECT 
  id,
  submitted_at,
  jsonb_object_keys(data) as field,
  data->>jsonb_object_keys(data) as note
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
  AND jsonb_object_keys(data) LIKE '%_notes'
  AND data->>jsonb_object_keys(data) IS NOT NULL
  AND data->>jsonb_object_keys(data) != '';

-- Full-text search in all data
SELECT 
  id,
  form_type,
  submitted_at,
  data
FROM form_submissions
WHERE search_vector @@ to_tsquery('english', 'dealbreaker | critical');

-- ────────────────────────────────────────────────────────────────
-- EXPORT QUERIES
-- ────────────────────────────────────────────────────────────────

-- Export complete worksheet as CSV-friendly format
SELECT 
  id,
  submitted_at,
  data->>'philosophy' as philosophy,
  data->>'distance_type' as distance_type,
  data->>'distance_max' as distance_max,
  data->>'age_type' as age_type,
  data->>'age_importance' as age_importance,
  data->>'height_type' as height_type,
  data->>'height_importance' as height_importance,
  data->>'bodytype_type' as bodytype_type,
  data->>'bodytype_importance' as bodytype_importance,
  data->>'marital_type' as marital_type,
  data->>'marital_importance' as marital_importance,
  data->>'intentions_type' as intentions_type,
  data->>'intentions_importance' as intentions_importance,
  data->>'has_children_type' as has_children_type,
  data->>'has_children_importance' as has_children_importance,
  data->>'wants_children_type' as wants_children_type,
  data->>'wants_children_importance' as wants_children_importance,
  data->>'religion_type' as religion_type,
  data->>'religion_importance' as religion_importance,
  data->>'political_type' as political_type,
  data->>'political_importance' as political_importance,
  data->>'education_type' as education_type,
  data->>'education_importance' as education_importance,
  data->>'smoking_type' as smoking_type,
  data->>'smoking_importance' as smoking_importance,
  data->>'drinking_type' as drinking_type,
  data->>'drinking_importance' as drinking_importance,
  data->>'marijuana_type' as marijuana_type,
  data->>'marijuana_importance' as marijuana_importance,
  data->>'exercise_type' as exercise_type,
  data->>'languages_type' as languages_type,
  data->>'interests_type' as interests_type,
  data->>'interests_importance' as interests_importance,
  data->>'lifegoals_type' as lifegoals_type,
  data->>'pets_type' as pets_type,
  data->>'photos_boost' as photos_boost,
  data->>'verification_boost' as verification_boost,
  data->>'completeness_boost' as completeness_boost,
  data->>'activity_boost' as activity_boost,
  data->>'activity_hide' as activity_hide,
  data->>'liked_override' as liked_override,
  data->>'passed_return' as passed_return,
  data->>'passed_on_you_show' as passed_on_you_show,
  data->>'pnts_handling' as pnts_handling,
  data->>'new_user_boost' as new_user_boost,
  data->>'mutual_boost' as mutual_boost
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
ORDER BY submitted_at DESC;

-- ────────────────────────────────────────────────────────────────
-- MAINTENANCE QUERIES
-- ────────────────────────────────────────────────────────────────

-- Delete all autosave drafts (keep only final submissions)
DELETE FROM form_submissions
WHERE form_type LIKE '%_autosave';

-- Delete test submissions (if needed)
DELETE FROM form_submissions
WHERE source_url LIKE '%localhost%';

-- View database size
SELECT 
  pg_size_pretty(pg_total_relation_size('form_submissions')) as total_size,
  COUNT(*) as total_rows
FROM form_submissions;

-- ────────────────────────────────────────────────────────────────
-- ANALYTICS QUERIES
-- ────────────────────────────────────────────────────────────────

-- Activity over time
SELECT 
  DATE(submitted_at) as date,
  form_type,
  COUNT(*) as submissions
FROM form_submissions
GROUP BY DATE(submitted_at), form_type
ORDER BY date DESC;

-- Most common answers (for any field)
-- Replace 'philosophy' with any field name
SELECT 
  data->>'philosophy' as answer,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM form_submissions WHERE form_type = 'realsingles_algorithm_worksheet')::numeric * 100, 1) as percentage
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
  AND data->>'philosophy' IS NOT NULL
GROUP BY data->>'philosophy'
ORDER BY count DESC;

-- Completion rate (how many fields filled)
SELECT 
  id,
  submitted_at,
  jsonb_object_keys(data) as total_fields,
  COUNT(jsonb_object_keys(data)) as fields_filled
FROM form_submissions
WHERE form_type = 'realsingles_algorithm_worksheet'
GROUP BY id, submitted_at;

-- ────────────────────────────────────────────────────────────────
-- USEFUL TIPS
-- ────────────────────────────────────────────────────────────────

/*
JSONB Operators:
  ->  : Get JSON object (returns JSONB)
  ->> : Get text value (returns TEXT)
  @>  : Contains (WHERE data @> '{"philosophy": "quality"}')
  ?   : Key exists (WHERE data ? 'philosophy')
  ?&  : All keys exist
  ?|  : Any key exists

Examples:
  data->'user'->>'name'           -- Nested access
  data @> '{"age": "30"}'         -- Contains exact match
  data ? 'philosophy'             -- Has 'philosophy' key
  data->'tags' ? 'important'      -- Array contains value
*/

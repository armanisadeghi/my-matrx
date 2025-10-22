-- ============================================
-- Migration: Simplify html_pages table
-- Purpose: Remove duplicate title/description fields and add indexing control
-- ============================================

-- Step 1: Add is_indexable column (defaults to FALSE for noindex)
ALTER TABLE html_pages 
ADD COLUMN IF NOT EXISTS is_indexable BOOLEAN DEFAULT FALSE;

-- Step 2: Migrate data from old columns to meta columns (if meta columns are empty)
-- This ensures we don't lose any data during migration
UPDATE html_pages
SET 
  meta_title = COALESCE(meta_title, title),
  meta_description = COALESCE(meta_description, description)
WHERE meta_title IS NULL OR meta_description IS NULL;

-- Step 3: Drop the duplicate columns
ALTER TABLE html_pages 
DROP COLUMN IF EXISTS title,
DROP COLUMN IF EXISTS description;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_name = 'html_pages'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show sample data
SELECT 
  id,
  meta_title,
  meta_description,
  is_indexable,
  created_at
FROM html_pages
ORDER BY created_at DESC
LIMIT 5;

SELECT 'Migration completed successfully!' as status;


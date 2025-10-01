-- ============================================
-- Add Page Categories and Hierarchy Support
-- Run this after the main schema
-- ============================================

-- Add category field to client_pages
ALTER TABLE client_pages 
ADD COLUMN category TEXT DEFAULT 'general';

-- Add parent_id for hierarchical pages (optional, for future use)
ALTER TABLE client_pages 
ADD COLUMN parent_id UUID REFERENCES client_pages(id) ON DELETE CASCADE;

-- Add page type for different templates
ALTER TABLE client_pages 
ADD COLUMN page_type TEXT DEFAULT 'standard';

-- Add excerpt/summary for listing pages
ALTER TABLE client_pages
ADD COLUMN excerpt TEXT;

-- Add featured image for cards/listings
ALTER TABLE client_pages
ADD COLUMN featured_image TEXT;

-- Add published date for blogs
ALTER TABLE client_pages
ADD COLUMN published_date TIMESTAMP WITH TIME ZONE;

-- Add author for blogs (optional)
ALTER TABLE client_pages
ADD COLUMN author TEXT;

-- Add tags for filtering/search
ALTER TABLE client_pages
ADD COLUMN tags TEXT[];

-- Comments for documentation
COMMENT ON COLUMN client_pages.category IS 'Page category: general, services, education, about, contact, etc.';
COMMENT ON COLUMN client_pages.page_type IS 'Template type: standard, service, blog, listing, etc.';
COMMENT ON COLUMN client_pages.excerpt IS 'Short description for listing pages and previews';
COMMENT ON COLUMN client_pages.featured_image IS 'Image URL for cards and social sharing';
COMMENT ON COLUMN client_pages.parent_id IS 'Parent page ID for hierarchical pages (optional)';

-- Create indexes for better query performance
CREATE INDEX idx_client_pages_category ON client_pages(client_id, category, is_published);
CREATE INDEX idx_client_pages_type ON client_pages(client_id, page_type);
CREATE INDEX idx_client_pages_parent ON client_pages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_client_pages_published_date ON client_pages(published_date DESC NULLS LAST);
CREATE INDEX idx_client_pages_tags ON client_pages USING GIN(tags) WHERE tags IS NOT NULL;

-- Update existing pages with categories
UPDATE client_pages 
SET category = 'general', 
    page_type = 'standard'
WHERE category IS NULL;

-- Mark home page with special category
UPDATE client_pages 
SET category = 'root',
    page_type = 'home'
WHERE is_home_page = true;

-- Create helper function to get pages by category
CREATE OR REPLACE FUNCTION get_pages_by_category(
  client_uuid UUID,
  page_category TEXT,
  include_unpublished BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title TEXT,
  excerpt TEXT,
  featured_image TEXT,
  published_date TIMESTAMP WITH TIME ZONE,
  author TEXT,
  tags TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.slug,
    p.title,
    p.excerpt,
    p.featured_image,
    p.published_date,
    p.author,
    p.tags
  FROM client_pages p
  WHERE p.client_id = client_uuid
    AND p.category = page_category
    AND (p.is_published = true OR include_unpublished = true)
  ORDER BY 
    CASE 
      WHEN p.published_date IS NOT NULL THEN p.published_date
      ELSE p.created_at
    END DESC;
END;
$$ LANGUAGE plpgsql;

-- Create helper function to get page with category in slug
CREATE OR REPLACE FUNCTION get_page_by_category_slug(
  client_uuid UUID,
  page_category TEXT,
  page_slug TEXT
)
RETURNS UUID AS $$
DECLARE
  page_id UUID;
BEGIN
  SELECT id INTO page_id
  FROM client_pages
  WHERE client_id = client_uuid
    AND category = page_category
    AND slug = page_slug
    AND is_published = true
  LIMIT 1;
  
  RETURN page_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Insert Sample Pages for IOPBM
-- ============================================

DO $$
DECLARE
  iopbm_client_id UUID;
  services_page_id UUID;
  education_page_id UUID;
BEGIN
  -- Get IOPBM client ID
  SELECT id INTO iopbm_client_id FROM client_sites WHERE slug = 'iopbm';

  -- Update existing placeholder pages with categories
  UPDATE client_pages 
  SET category = 'services',
      page_type = 'listing',
      excerpt = 'Comprehensive digestive health and wellness services'
  WHERE client_id = iopbm_client_id AND slug = 'services';

  UPDATE client_pages 
  SET category = 'education',
      page_type = 'listing',
      excerpt = 'Educational resources and health information'
  WHERE client_id = iopbm_client_id AND slug = 'education';

  UPDATE client_pages 
  SET category = 'general',
      page_type = 'standard',
      excerpt = 'Learn more about Dr. Angie Sadeghi and our practice'
  WHERE client_id = iopbm_client_id AND slug = 'about';

  UPDATE client_pages 
  SET category = 'general',
      page_type = 'standard',
      excerpt = 'Get in touch with our Newport Beach office'
  WHERE client_id = iopbm_client_id AND slug = 'contact';

  -- Get IDs for parent pages
  SELECT id INTO services_page_id FROM client_pages WHERE client_id = iopbm_client_id AND slug = 'services';
  SELECT id INTO education_page_id FROM client_pages WHERE client_id = iopbm_client_id AND slug = 'education';

  -- Create sample service pages
  INSERT INTO client_pages (
    client_id,
    slug,
    category,
    page_type,
    title,
    excerpt,
    featured_image,
    html_content_draft,
    parent_id,
    sort_order,
    show_in_nav,
    has_draft
  ) VALUES 
  (
    iopbm_client_id,
    'gastroenterology',
    'services',
    'service',
    'Gastroenterology Services',
    'Advanced diagnostics and treatment for digestive health conditions',
    null,
    '<section style="padding: 4rem 2rem;"><h1>Gastroenterology Services</h1><p>Comprehensive care for digestive health...</p></section>',
    services_page_id,
    1,
    false,
    true
  ),
  (
    iopbm_client_id,
    'concierge-medicine',
    'services',
    'service',
    'Concierge Medicine',
    'Personalized healthcare with direct physician access',
    null,
    '<section style="padding: 4rem 2rem;"><h1>Concierge Medicine</h1><p>Experience personalized care...</p></section>',
    services_page_id,
    2,
    false,
    true
  ),
  (
    iopbm_client_id,
    'weight-management',
    'services',
    'service',
    'Medical Weight Management',
    'Evidence-based weight loss programs and GLP-1 therapies',
    null,
    '<section style="padding: 4rem 2rem;"><h1>Medical Weight Management</h1><p>Achieve your health goals...</p></section>',
    services_page_id,
    3,
    false,
    true
  );

  -- Create sample education/blog posts
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
    html_content_draft,
    parent_id,
    show_in_nav,
    has_draft
  ) VALUES 
  (
    iopbm_client_id,
    'gut-health-basics',
    'education',
    'blog',
    'Understanding Gut Health: The Basics',
    'Learn the fundamentals of digestive health and why it matters for overall wellness',
    'Dr. Angie Sadeghi, MD',
    NOW() - INTERVAL '7 days',
    ARRAY['gut-health', 'wellness', 'digestive-health'],
    '<article style="padding: 4rem 2rem;"><h1>Understanding Gut Health: The Basics</h1><p>Your gut health is foundational...</p></article>',
    education_page_id,
    false,
    true
  ),
  (
    iopbm_client_id,
    'plant-based-nutrition',
    'education',
    'blog',
    'Benefits of Plant-Based Nutrition',
    'Discover how plant-based eating can transform your digestive health',
    'Dr. Angie Sadeghi, MD',
    NOW() - INTERVAL '14 days',
    ARRAY['nutrition', 'plant-based', 'diet'],
    '<article style="padding: 4rem 2rem;"><h1>Benefits of Plant-Based Nutrition</h1><p>Plant-based eating offers numerous benefits...</p></article>',
    education_page_id,
    false,
    true
  );

  RAISE NOTICE 'Sample pages created successfully';
END $$;

-- Verify the updates
SELECT 
  slug,
  category,
  page_type,
  excerpt,
  CASE WHEN parent_id IS NOT NULL THEN 'Has Parent' ELSE 'Root' END as hierarchy
FROM client_pages
WHERE client_id = (SELECT id FROM client_sites WHERE slug = 'iopbm')
ORDER BY category, sort_order;

SELECT 'Page categories and sample content created successfully!' as status;


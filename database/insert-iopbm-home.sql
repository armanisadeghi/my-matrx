-- ============================================
-- Insert IOPBM Home Page Content
-- Run this AFTER schema.sql is executed
-- ============================================

-- Get the IOPBM client ID (we'll use this in the insert)
DO $$
DECLARE
  iopbm_client_id UUID;
BEGIN
  -- Get IOPBM client ID
  SELECT id INTO iopbm_client_id
  FROM client_sites
  WHERE slug = 'iopbm';

  -- Insert home page (initially as draft, will be published manually)
  INSERT INTO client_pages (
    client_id,
    slug,
    title,
    html_content_draft,
    meta_title,
    meta_description,
    is_home_page,
    sort_order,
    show_in_nav,
    has_draft
  ) VALUES (
    iopbm_client_id,
    'home',
    'Home',
    '', -- We'll populate this via API or admin interface
    'Newport Beach Gastroenterology & Concierge Medicine | IOPBM',
    'Dr. Angie Sadeghi, MD: Board-certified GI & internist. Multi-specialty clinic, Newport Beach. Weight management, metabolic health, and hormone therapy.',
    true, -- This is the home page
    0,
    false, -- Don't show "Home" in nav menu
    true -- Has draft content
  );

  RAISE NOTICE 'IOPBM home page created successfully with ID: %', iopbm_client_id;
END $$;

-- Insert placeholder pages for other sections
DO $$
DECLARE
  iopbm_client_id UUID;
BEGIN
  SELECT id INTO iopbm_client_id FROM client_sites WHERE slug = 'iopbm';

  -- Services page
  INSERT INTO client_pages (
    client_id,
    slug,
    title,
    html_content_draft,
    meta_title,
    is_home_page,
    sort_order,
    show_in_nav,
    has_draft
  ) VALUES (
    iopbm_client_id,
    'services',
    'Services',
    '<section style="padding: 4rem 2rem; text-align: center;"><h1>Our Services</h1><p>Content coming soon...</p></section>',
    'Our Services | IOPBM',
    false,
    1,
    true,
    true
  );

  -- Education page
  INSERT INTO client_pages (
    client_id,
    slug,
    title,
    html_content_draft,
    meta_title,
    is_home_page,
    sort_order,
    show_in_nav,
    has_draft
  ) VALUES (
    iopbm_client_id,
    'education',
    'Education',
    '<section style="padding: 4rem 2rem; text-align: center;"><h1>Patient Education</h1><p>Content coming soon...</p></section>',
    'Patient Education | IOPBM',
    false,
    2,
    true,
    true
  );

  -- About page
  INSERT INTO client_pages (
    client_id,
    slug,
    title,
    html_content_draft,
    meta_title,
    is_home_page,
    sort_order,
    show_in_nav,
    has_draft
  ) VALUES (
    iopbm_client_id,
    'about',
    'About',
    '<section style="padding: 4rem 2rem; text-align: center;"><h1>About Dr. Sadeghi</h1><p>Content coming soon...</p></section>',
    'About Dr. Angie Sadeghi, MD | IOPBM',
    false,
    3,
    true,
    true
  );

  -- Contact page
  INSERT INTO client_pages (
    client_id,
    slug,
    title,
    html_content_draft,
    meta_title,
    is_home_page,
    sort_order,
    show_in_nav,
    has_draft
  ) VALUES (
    iopbm_client_id,
    'contact',
    'Contact',
    '<section style="padding: 4rem 2rem; text-align: center;"><h1>Contact Us</h1><p>Content coming soon...</p></section>',
    'Contact Us | IOPBM',
    false,
    4,
    true,
    true
  );

  RAISE NOTICE 'Placeholder pages created successfully';
END $$;

-- Insert header component (will be populated with actual content later)
DO $$
DECLARE
  iopbm_client_id UUID;
BEGIN
  SELECT id INTO iopbm_client_id FROM client_sites WHERE slug = 'iopbm';

  INSERT INTO client_components (
    client_id,
    component_type,
    name,
    html_content,
    is_active
  ) VALUES (
    iopbm_client_id,
    'header',
    'Main Navigation Header',
    '', -- Will be populated from existing home.html
    true
  );

  -- Footer component
  INSERT INTO client_components (
    client_id,
    component_type,
    name,
    html_content,
    is_active
  ) VALUES (
    iopbm_client_id,
    'footer',
    'Main Footer',
    '', -- Will be populated from existing home.html
    true
  );

  RAISE NOTICE 'Header and footer components created';
END $$;

SELECT 'IOPBM pages and components created successfully!' as status;


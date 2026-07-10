-- ============================================
-- MyMatrx Client Sites Database Schema
-- Purpose: Multi-tenant client website management
--
-- ⚠️ HISTORICAL BOOTSTRAP SNAPSHOT — NOT the source of truth.
-- The live CMS database (Supabase viyklljfdhtidwecakwx) is owned by aidream's
-- `db/migrations/cms/*.sql`, tracked in `public._schema_migrations`.
--
-- Page versioning is NOT defined here. It is the canonical append-only
-- `history.row_versions` log (migration 0002) + the `version_list` /
-- `version_get` / `version_snapshot` / `version_restore` public RPCs
-- (migration 0003). The old `client_page_versions` table,
-- `create_page_version()` trigger and `rollback_to_version()` RPC were retired
-- in migration 0004 (the table survives, read-only, as
-- `graveyard.client_page_versions`).
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CLIENT SITES TABLE
-- Stores client configuration and branding
-- ============================================
CREATE TABLE client_sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL, -- URL identifier: 'iopbm'
  name TEXT NOT NULL, -- Display name: 'Institute of Plant-Based Medicine'
  domain TEXT, -- Custom domain: 'iopbm.com' (optional)
  
  -- Theme and styling configuration
  theme_config JSONB DEFAULT '{}', -- Colors, fonts, spacing
  
  -- Navigation structure
  navigation JSONB DEFAULT '[]', -- Array of menu items
  
  -- Footer configuration
  footer_config JSONB DEFAULT '{}', -- Footer content, columns, links
  
  -- Default SEO settings (fallback for pages)
  meta_defaults JSONB DEFAULT '{}', -- Default meta tags, og:image, etc.
  
  -- Contact information
  contact_info JSONB DEFAULT '{}', -- Phone, email, address
  
  -- Social media links
  social_links JSONB DEFAULT '{}', -- Facebook, Instagram, LinkedIn, etc.
  
  -- Site settings
  settings JSONB DEFAULT '{}', -- Analytics, scripts, etc.
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- User relationship (optional)
  owner_user_id UUID -- Link to auth.users if using Supabase Auth
);

-- ============================================
-- 2. CLIENT PAGES TABLE
-- Stores individual pages with draft/published versions
-- ============================================
CREATE TABLE client_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES client_sites(id) ON DELETE CASCADE,
  
  -- Page identification
  slug TEXT NOT NULL, -- 'home', 'services', 'education', 'about'
  title TEXT NOT NULL, -- Display title
  
  -- Content versions
  html_content TEXT NOT NULL, -- Published HTML content
  html_content_draft TEXT, -- Draft HTML content (null if no changes)
  css_content TEXT, -- Page-specific CSS (optional)
  css_content_draft TEXT, -- Draft CSS
  js_content TEXT, -- Page-specific JavaScript (optional)
  js_content_draft TEXT, -- Draft JavaScript
  
  -- Layout settings
  layout_type TEXT DEFAULT 'default', -- 'default', 'full-width', 'minimal', etc.
  use_client_header BOOLEAN DEFAULT true, -- Use global header
  use_client_footer BOOLEAN DEFAULT true, -- Use global footer
  
  -- SEO metadata
  meta_title TEXT,
  meta_title_draft TEXT,
  meta_description TEXT,
  meta_description_draft TEXT,
  meta_keywords TEXT,
  meta_keywords_draft TEXT,
  og_image TEXT, -- Open Graph image URL
  og_image_draft TEXT,
  canonical_url TEXT,
  canonical_url_draft TEXT,
  
  -- Publishing control
  is_published BOOLEAN DEFAULT false,
  has_draft BOOLEAN DEFAULT false, -- Flag to quickly check if draft exists
  publish_date TIMESTAMP WITH TIME ZONE,
  last_published_at TIMESTAMP WITH TIME ZONE,
  last_published_by UUID, -- User who published
  
  -- Page settings
  is_home_page BOOLEAN DEFAULT false, -- Flag for home page
  sort_order INTEGER DEFAULT 0, -- For navigation ordering
  show_in_nav BOOLEAN DEFAULT true, -- Show in navigation menu
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique slug per client
  UNIQUE(client_id, slug)
);

-- ============================================
-- 3. CLIENT COMPONENTS TABLE
-- Reusable components (header, footer, sections)
-- ============================================
CREATE TABLE client_components (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES client_sites(id) ON DELETE CASCADE,
  
  -- Component identification
  component_type TEXT NOT NULL, -- 'header', 'footer', 'hero', 'cta', etc.
  name TEXT NOT NULL, -- Friendly name: 'Main Header', 'Footer 2024'
  
  -- Content versions
  html_content TEXT NOT NULL, -- Published HTML
  html_content_draft TEXT, -- Draft HTML
  css_content TEXT, -- Component-specific CSS
  css_content_draft TEXT, -- Draft CSS
  
  -- Component settings
  is_active BOOLEAN DEFAULT true,
  has_draft BOOLEAN DEFAULT false,
  
  -- Publishing control
  last_published_at TIMESTAMP WITH TIME ZONE,
  last_published_by UUID,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure meaningful naming
  UNIQUE(client_id, component_type, name)
);

-- ============================================
-- 5. CLIENT ASSETS TABLE
-- Manage uploaded images, files, etc.
-- ============================================
CREATE TABLE client_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES client_sites(id) ON DELETE CASCADE,
  
  -- Asset information
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Storage path or URL
  file_type TEXT NOT NULL, -- 'image', 'video', 'document', 'icon'
  mime_type TEXT,
  file_size INTEGER, -- Bytes
  
  -- Image-specific metadata
  width INTEGER,
  height INTEGER,
  alt_text TEXT,
  
  -- Organization
  folder TEXT DEFAULT 'root', -- For organizing assets
  tags TEXT[], -- Array of tags for searching
  
  -- Usage tracking
  used_in_pages UUID[], -- Array of page IDs using this asset
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID
);

-- ============================================
-- 6. ACTIVITY LOG TABLE
-- Audit trail for all changes
-- ============================================
CREATE TABLE client_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES client_sites(id) ON DELETE CASCADE,
  
  -- Activity details
  activity_type TEXT NOT NULL, -- 'page_created', 'page_published', 'component_updated', etc.
  entity_type TEXT, -- 'page', 'component', 'site', 'asset'
  entity_id UUID, -- ID of the affected entity
  
  -- Change details
  changes JSONB, -- Store before/after values
  description TEXT,
  
  -- User context
  user_id UUID,
  user_email TEXT,
  ip_address TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Client Sites
CREATE INDEX idx_client_sites_slug ON client_sites(slug);
CREATE INDEX idx_client_sites_active ON client_sites(is_active);

-- Client Pages
CREATE INDEX idx_client_pages_client ON client_pages(client_id);
CREATE INDEX idx_client_pages_slug ON client_pages(client_id, slug);
CREATE INDEX idx_client_pages_published ON client_pages(client_id, is_published);
CREATE INDEX idx_client_pages_draft ON client_pages(client_id, has_draft) WHERE has_draft = true;
CREATE INDEX idx_client_pages_home ON client_pages(client_id, is_home_page) WHERE is_home_page = true;

-- Client Components
CREATE INDEX idx_client_components_client ON client_components(client_id);
CREATE INDEX idx_client_components_type ON client_components(client_id, component_type);
CREATE INDEX idx_client_components_active ON client_components(client_id, is_active) WHERE is_active = true;

-- Client Assets
CREATE INDEX idx_client_assets_client ON client_assets(client_id);
CREATE INDEX idx_client_assets_type ON client_assets(client_id, file_type);
CREATE INDEX idx_client_assets_folder ON client_assets(client_id, folder);

-- Activity Log
CREATE INDEX idx_activity_log_client ON client_activity_log(client_id, created_at DESC);
CREATE INDEX idx_activity_log_entity ON client_activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_user ON client_activity_log(user_id, created_at DESC);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATING TIMESTAMPS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_client_sites_updated_at BEFORE UPDATE ON client_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_pages_updated_at BEFORE UPDATE ON client_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_components_updated_at BEFORE UPDATE ON client_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_assets_updated_at BEFORE UPDATE ON client_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to promote draft to published
CREATE OR REPLACE FUNCTION publish_page_draft(page_uuid UUID, publisher_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE client_pages
  SET 
    html_content = COALESCE(html_content_draft, html_content),
    css_content = COALESCE(css_content_draft, css_content),
    js_content = COALESCE(js_content_draft, js_content),
    meta_title = COALESCE(meta_title_draft, meta_title),
    meta_description = COALESCE(meta_description_draft, meta_description),
    meta_keywords = COALESCE(meta_keywords_draft, meta_keywords),
    og_image = COALESCE(og_image_draft, og_image),
    canonical_url = COALESCE(canonical_url_draft, canonical_url),
    html_content_draft = NULL,
    css_content_draft = NULL,
    js_content_draft = NULL,
    meta_title_draft = NULL,
    meta_description_draft = NULL,
    meta_keywords_draft = NULL,
    og_image_draft = NULL,
    canonical_url_draft = NULL,
    is_published = true,
    has_draft = false,
    last_published_by = publisher_id,
    -- Set here since migration 0004; the retired create_page_version() BEFORE
    -- trigger used to stamp it, and only on the first publish.
    last_published_at = NOW(),
    publish_date = CASE WHEN publish_date IS NULL THEN NOW() ELSE publish_date END
  WHERE id = page_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to discard draft changes
CREATE OR REPLACE FUNCTION discard_page_draft(page_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE client_pages
  SET 
    html_content_draft = NULL,
    css_content_draft = NULL,
    js_content_draft = NULL,
    meta_title_draft = NULL,
    meta_description_draft = NULL,
    meta_keywords_draft = NULL,
    og_image_draft = NULL,
    canonical_url_draft = NULL,
    has_draft = false
  WHERE id = page_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Optional: Enable if using Supabase Auth
-- ============================================

-- Enable RLS on all tables
ALTER TABLE client_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_activity_log ENABLE ROW LEVEL SECURITY;

-- Public read access for published content (adjust as needed)
CREATE POLICY "Public can view published pages" ON client_pages
  FOR SELECT USING (is_published = true);

CREATE POLICY "Public can view active client sites" ON client_sites
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can view active components" ON client_components
  FOR SELECT USING (is_active = true);

-- Service role has full access (for API routes)
-- You'll use the service role key in your API routes

-- ============================================
-- INITIAL DATA - IOPBM CLIENT
-- ============================================

-- Insert IOPBM as first client
INSERT INTO client_sites (
  slug,
  name,
  theme_config,
  navigation,
  contact_info,
  meta_defaults,
  is_active
) VALUES (
  'iopbm',
  'Institute of Plant-Based Medicine',
  '{
    "colors": {
      "primary_teal": "#3BA5A5",
      "primary_teal_dark": "#2A7A7A",
      "primary_green": "#8DB85C",
      "primary_olive": "#6B8E3D",
      "neutral_gray": "#9B9B8A",
      "neutral_light": "#F5F5F0",
      "text_dark": "#333333",
      "text_secondary": "#5A5A4D"
    },
    "fonts": {
      "primary": "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
    }
  }',
  '[
    {"label": "About", "href": "#about"},
    {"label": "Services", "href": "#services"},
    {"label": "Concierge", "href": "#concierge"},
    {"label": "Education", "href": "#education"},
    {"label": "Contact", "href": "#contact"}
  ]',
  '{
    "phone": "(949) 404-4444",
    "phone_raw": "+19494044444",
    "address": {
      "street": "901 Dover Drive, Suite 205",
      "city": "Newport Beach",
      "state": "CA",
      "zip": ""
    }
  }',
  '{
    "site_name": "IOPBM - Newport Beach Gastroenterology & Concierge Medicine",
    "default_og_image": "/iopbm/assets/IOPBM Newport Beach Gastroenterology Logo Cropped-optimized.PNG",
    "default_description": "Board-certified gastroenterology and concierge medicine in Newport Beach, California. Dr. Angie Sadeghi, MD."
  }',
  true
);

-- Note: We'll insert the home page content in a separate step after schema creation

-- ============================================
-- END OF SCHEMA
-- ============================================

-- Verify schema creation
SELECT 'Schema created successfully!' as status;


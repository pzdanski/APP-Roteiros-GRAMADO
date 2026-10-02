-- ==============================================================================
-- SPRINT 10A — SMART CATALOG & PLACES READY MIGRATION
-- Migration: 20261002_sprint10a_smart_catalog.sql
-- Idempotent schema additions for central places catalog, media, and sync metadata
-- ==============================================================================

-- 1. Ensure columns exist on `places` table
DO $$
BEGIN
    -- Reliable external links
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'official_url') THEN
        ALTER TABLE places ADD COLUMN official_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'instagram_url') THEN
        ALTER TABLE places ADD COLUMN instagram_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'maps_url') THEN
        ALTER TABLE places ADD COLUMN maps_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'ticket_url') THEN
        ALTER TABLE places ADD COLUMN ticket_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'phone') THEN
        ALTER TABLE places ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'whatsapp') THEN
        ALTER TABLE places ADD COLUMN whatsapp TEXT;
    END IF;

    -- Divulga Lugares Content fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'divulga_content_active') THEN
        ALTER TABLE places ADD COLUMN divulga_content_active BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'divulga_instagram_url') THEN
        ALTER TABLE places ADD COLUMN divulga_instagram_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'divulga_youtube_url') THEN
        ALTER TABLE places ADD COLUMN divulga_youtube_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'divulga_tiktok_url') THEN
        ALTER TABLE places ADD COLUMN divulga_tiktok_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'divulga_content_title') THEN
        ALTER TABLE places ADD COLUMN divulga_content_title TEXT;
    END IF;

    -- Google Place ID & Synchronization metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'google_place_id') THEN
        ALTER TABLE places ADD COLUMN google_place_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'google_last_sync_at') THEN
        ALTER TABLE places ADD COLUMN google_last_sync_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'google_sync_status') THEN
        ALTER TABLE places ADD COLUMN google_sync_status TEXT DEFAULT 'NOT_SYNCED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'google_data_version') THEN
        ALTER TABLE places ADD COLUMN google_data_version TEXT;
    END IF;

    -- Pricing notes & validity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'price_notes') THEN
        ALTER TABLE places ADD COLUMN price_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'price_valid_from') THEN
        ALTER TABLE places ADD COLUMN price_valid_from DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'price_valid_until') THEN
        ALTER TABLE places ADD COLUMN price_valid_until DATE;
    END IF;

    -- Data Quality Score & Label
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'data_quality_label') THEN
        ALTER TABLE places ADD COLUMN data_quality_label TEXT DEFAULT 'Incompleto';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'data_quality_score') THEN
        ALTER TABLE places ADD COLUMN data_quality_score INTEGER DEFAULT 0;
    END IF;

    -- Always Open Flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'always_open') THEN
        ALTER TABLE places ADD COLUMN always_open BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 2. Create `place_media_items` table for multi-media & origin tracking
CREATE TABLE IF NOT EXISTS place_media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    caption TEXT,
    is_hero BOOLEAN DEFAULT false,
    is_logo BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    source TEXT NOT NULL CHECK (source IN ('duo21', 'partner', 'official', 'google_places', 'external_licensed', 'fallback')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Defensive check: if table existed previously with TEXT place_id or missing foreign key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'place_media_items' AND column_name = 'place_id' AND data_type = 'text'
    ) THEN
        ALTER TABLE place_media_items ALTER COLUMN place_id TYPE UUID USING place_id::uuid;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'place_media_items'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'place_media_items' AND constraint_name = 'place_media_items_place_id_fkey'
    ) THEN
        ALTER TABLE place_media_items 
            ADD CONSTRAINT place_media_items_place_id_fkey 
            FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Idempotent Indexes for Performance & Search
CREATE INDEX IF NOT EXISTS idx_places_google_place_id ON places(google_place_id);
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'category_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_places_city_category ON places(city, category_id);
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'places' AND column_name = 'category'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_places_city_category ON places(city, category);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_places_active ON places(active);
CREATE INDEX IF NOT EXISTS idx_places_quality_score ON places(data_quality_score);
CREATE INDEX IF NOT EXISTS idx_place_media_place_id ON place_media_items(place_id);
CREATE INDEX IF NOT EXISTS idx_place_media_active ON place_media_items(active);

-- 4. Row Level Security (RLS) Policies
ALTER TABLE place_media_items ENABLE ROW LEVEL SECURITY;

-- Public can read active media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'place_media_items' AND policyname = 'Public read active place media'
    ) THEN
        CREATE POLICY "Public read active place media" ON place_media_items
            FOR SELECT USING (active = true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'place_media_items' AND policyname = 'Admin manage place media'
    ) THEN
        CREATE POLICY "Admin manage place media" ON place_media_items
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

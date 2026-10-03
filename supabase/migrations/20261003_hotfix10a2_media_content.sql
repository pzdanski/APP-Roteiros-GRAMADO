-- ==============================================================================
-- HOTFIX 10A.2 — MEDIA UPLOAD, STORAGE & DUO21 ARTICLE MIGRATION
-- Migration: 20261003_hotfix10a2_media_content.sql
-- Idempotent schema additions for DUO21/Divulga Lugares article URLs,
-- responsive image variants, and Supabase Storage bucket configuration.
-- ==============================================================================

-- 1. Ensure `divulga_article_url` exists on `places` table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'places' AND column_name = 'divulga_article_url'
    ) THEN
        ALTER TABLE places ADD COLUMN divulga_article_url TEXT;
    END IF;
END $$;

-- 2. Ensure responsive and dimension columns exist on `place_media_items` table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'place_media_items') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'place_media_items' AND column_name = 'thumbnail_url'
        ) THEN
            ALTER TABLE place_media_items ADD COLUMN thumbnail_url TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'place_media_items' AND column_name = 'card_url'
        ) THEN
            ALTER TABLE place_media_items ADD COLUMN card_url TEXT;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'place_media_items' AND column_name = 'width'
        ) THEN
            ALTER TABLE place_media_items ADD COLUMN width INTEGER;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'place_media_items' AND column_name = 'height'
        ) THEN
            ALTER TABLE place_media_items ADD COLUMN height INTEGER;
        END IF;
    END IF;
END $$;

-- 3. Configure Supabase Storage Bucket for 'places' (10MB limit, WebP/JPG/PNG)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'places',
            'places',
            true,
            10485760, -- 10MB limit
            ARRAY['image/jpeg', 'image/png', 'image/webp']
        )
        ON CONFLICT (id) DO UPDATE SET 
            public = true,
            file_size_limit = 10485760,
            allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

        -- Public Read Access for tourist media
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access places'
        ) THEN
            CREATE POLICY "Public Access places" ON storage.objects
                FOR SELECT USING (bucket_id = 'places');
        END IF;

        -- Admin/Service Role Upload & Management Access
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Admin Upload places'
        ) THEN
            CREATE POLICY "Admin Upload places" ON storage.objects
                FOR ALL USING (bucket_id = 'places' AND (auth.role() = 'service_role' OR auth.role() = 'authenticated'));
        END IF;
    END IF;
END $$;

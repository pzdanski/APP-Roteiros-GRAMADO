-- ==============================================================================
-- SPRINT 10B — GOOGLE PLACES API (NEW) & COST GUARD MIGRATION
-- Migration: 20261003_sprint10b_places_costguard.sql
-- Idempotent schema additions for api_usage audit metadata & place sync indexes
-- ==============================================================================

DO $$
BEGIN
    -- 1. Add optional metadata column to api_usage for granular credit audit records
    -- (stores endpoint, SKU, fields, place_id, pricing details)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'api_usage' 
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.api_usage ADD COLUMN metadata JSONB;
    END IF;

    -- 2. Indexes for fast lookup of Google Place IDs and Sync Status
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'places' 
        AND indexname = 'idx_places_google_place_id'
    ) THEN
        CREATE INDEX idx_places_google_place_id ON public.places (google_place_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'places' 
        AND indexname = 'idx_places_google_sync_status'
    ) THEN
        CREATE INDEX idx_places_google_sync_status ON public.places (google_sync_status);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'places' 
        AND indexname = 'idx_places_google_last_sync_at'
    ) THEN
        CREATE INDEX idx_places_google_last_sync_at ON public.places (google_last_sync_at);
    END IF;
END $$;

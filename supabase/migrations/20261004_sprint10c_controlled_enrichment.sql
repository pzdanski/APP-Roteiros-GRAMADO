-- ==============================================================================
-- SPRINT 10C / HOTFIX 10C.1 — ENRIQUECIMENTO CONTROLADO DO CATÁLOGO (PILOTO LAGO NEGRO)
-- Migration: 20261004_sprint10c_controlled_enrichment.sql
-- Idempotent schema additions for:
--   - rating NUMERIC(2,1) CHECK (rating IS NULL OR (rating >= 0.0 AND rating <= 5.0))
--   - rating_count INTEGER CHECK (rating_count IS NULL OR rating_count >= 0)
--   - hours_source TEXT DEFAULT 'manual'
--   - hours_last_checked_at TIMESTAMPTZ
--   - rating_source TEXT DEFAULT 'manual'
--   - rating_last_checked_at TIMESTAMPTZ
--
-- REGRA ARQUITETURAL CANÔNICA:
--   - public.place_hours permanece como a ÚNICA fonte relacional canônica de horários.
--   - NÃO cria coluna opening_hours JSONB na tabela places.
--
-- NOTE: Conforme diretriz estrita da Sprint 10C / Hotfix 10C.1, este arquivo é apenas
-- preparado e auditado, NUNCA EXECUTADO automaticamente durante o desenvolvimento.
-- ==============================================================================

DO $$
BEGIN
    -- 1. Avaliações / Rating Canônico
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'places' 
        AND column_name = 'rating'
    ) THEN
        ALTER TABLE public.places ADD COLUMN rating NUMERIC(2,1);
    END IF;

    -- Constraint de intervalo 0.0 a 5.0 para rating (idempotente)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_places_rating_range'
    ) THEN
        ALTER TABLE public.places 
        ADD CONSTRAINT chk_places_rating_range 
        CHECK (rating IS NULL OR (rating >= 0.0 AND rating <= 5.0));
    END IF;

    -- 2. Quantidade de Avaliações / Rating Count Canônico
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'places' 
        AND column_name = 'rating_count'
    ) THEN
        ALTER TABLE public.places ADD COLUMN rating_count INTEGER;
    END IF;

    -- Constraint de não-negatividade para rating_count (idempotente)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_places_rating_count_non_negative'
    ) THEN
        ALTER TABLE public.places 
        ADD CONSTRAINT chk_places_rating_count_non_negative 
        CHECK (rating_count IS NULL OR rating_count >= 0);
    END IF;

    -- 3. Proveniência e Auditoria de Horários
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'places' 
        AND column_name = 'hours_source'
    ) THEN
        ALTER TABLE public.places ADD COLUMN hours_source TEXT DEFAULT 'manual';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'places' 
        AND column_name = 'hours_last_checked_at'
    ) THEN
        ALTER TABLE public.places ADD COLUMN hours_last_checked_at TIMESTAMPTZ;
    END IF;

    -- 4. Proveniência e Auditoria de Avaliações
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'places' 
        AND column_name = 'rating_source'
    ) THEN
        ALTER TABLE public.places ADD COLUMN rating_source TEXT DEFAULT 'manual';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'places' 
        AND column_name = 'rating_last_checked_at'
    ) THEN
        ALTER TABLE public.places ADD COLUMN rating_last_checked_at TIMESTAMPTZ;
    END IF;

    -- 5. Índices de performance e auditoria
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'places' 
        AND indexname = 'idx_places_hours_source'
    ) THEN
        CREATE INDEX idx_places_hours_source ON public.places (hours_source);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'places' 
        AND indexname = 'idx_places_rating_source'
    ) THEN
        CREATE INDEX idx_places_rating_source ON public.places (rating_source);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'places' 
        AND indexname = 'idx_places_rating'
    ) THEN
        CREATE INDEX idx_places_rating ON public.places (rating);
    END IF;
END $$;

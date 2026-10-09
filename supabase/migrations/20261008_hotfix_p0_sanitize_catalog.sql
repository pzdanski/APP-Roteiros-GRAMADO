-- ============================================================================
-- SPRINT 10D HOTFIX P0 — SANEAMENTO REAL DO CATÁLOGO DE LUGARES
-- Idempotente, não-destrutivo e auditável
-- ============================================================================

-- 1. Garante coluna audit_status na tabela public.places
ALTER TABLE public.places 
ADD COLUMN IF NOT EXISTS audit_status VARCHAR(30) DEFAULT 'PENDING_VERIFICATION';

-- 2. Garante coluna is_placeholder na tabela public.place_media_items se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'place_media_items'
  ) THEN
    ALTER TABLE public.place_media_items 
    ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT false;

    -- Marca imagens que usam o fallback genérico do Unsplash como placeholders visuais
    UPDATE public.place_media_items
    SET is_placeholder = true
    WHERE media_url ILIKE '%photo-1506744038136-46273834b3fb%'
       OR media_url ILIKE '%placeholder.com%';
  END IF;
END $$;

-- 3. Neutraliza Google Place IDs demonstrativos ('-demo') na tabela public.places:
-- - Mantém os registros e UUIDs intactos (não deleta nenhum dado)
-- - Define google_sync_status como 'NOT_SYNCED' para que não sejam considerados validados
-- - Define audit_status como 'PENDING_VERIFICATION' para aguardar resolução com Smart Resolver
UPDATE public.places
SET 
  google_sync_status = 'NOT_SYNCED',
  audit_status = 'PENDING_VERIFICATION',
  updated_at = NOW()
WHERE 
  google_place_id ILIKE '%demo%'
  AND id <> 'a0000001-0000-0000-0000-000000000001';

-- 4. Preserva integralmente o Lago Negro homologado com Google Places real (Sprint 10C)
UPDATE public.places
SET 
  audit_status = 'VERIFIED',
  google_sync_status = 'SYNCED',
  updated_at = NOW()
WHERE 
  id = 'a0000001-0000-0000-0000-000000000001'
  OR (name ILIKE '%Lago Negro%' AND city = 'Gramado');

-- 5. Remove ou normaliza o selo comercial 'partner' para estabelecimentos sem contrato comprovado:
-- Recomendações e curadoria editorial do Divulga Lugares continuam ativas em divulga_lugares_tip,
-- mas a marcação comercial partner só é válida com comprovação documental.
UPDATE public.places
SET 
  partner = false,
  updated_at = NOW()
WHERE 
  partner = true
  AND id <> 'a0000001-0000-0000-0000-000000000001';

-- 6. Registra na tabela de log/auditoria se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (action, target_table, details, created_at)
    VALUES (
      'HOTFIX_P0_CATALOG_SANITIZE',
      'places',
      '{"status": "applied", "description": "Saneamento de Google Place IDs -demo, normalizacao de parcerias e classificacao auditada"}',
      NOW()
    );
  END IF;
END $$;

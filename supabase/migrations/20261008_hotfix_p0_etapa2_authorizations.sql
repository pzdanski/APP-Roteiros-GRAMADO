-- ============================================================================
-- SPRINT 10D HOTFIX P0 ETAPA 2 — AUTORIZAÇÃO ADMINISTRATIVA PERSISTENTE
-- Tabela dedicada: public.accelerator_phase_authorizations
-- Idempotente, não-destrutivo e auditável
-- ============================================================================

-- 1. Criação da tabela de autorizações de fase do Catalog Accelerator
CREATE TABLE IF NOT EXISTS public.accelerator_phase_authorizations (
  authorization_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id INT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'AGUARDANDO_AUTORIZACAO',
  authorized_by VARCHAR(255) NOT NULL,
  authorized_at TIMESTAMPTZ,
  approved_limits JSONB DEFAULT '{}'::jsonb,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices para consultas frequentes de status e auditoria
CREATE INDEX IF NOT EXISTS idx_accelerator_auth_phase_status 
ON public.accelerator_phase_authorizations (phase_id, status);

CREATE INDEX IF NOT EXISTS idx_accelerator_auth_created_at
ON public.accelerator_phase_authorizations (created_at DESC);

-- 3. Habilita RLS para proteção estrita
ALTER TABLE public.accelerator_phase_authorizations ENABLE ROW LEVEL SECURITY;

-- 4. Política RLS: Leitura pública bloqueada, apenas service_role e administradores autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'accelerator_phase_authorizations' 
      AND policyname = 'service_role_accelerator_auth_all'
  ) THEN
    CREATE POLICY service_role_accelerator_auth_all 
    ON public.accelerator_phase_authorizations 
    FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);
  END IF;
END $$;

-- 5. Registro de auditoria na tabela audit_logs se existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    INSERT INTO public.audit_logs (action, target_table, details, created_at)
    VALUES (
      'HOTFIX_P0_ETAPA2_CREATE_AUTHORIZATIONS_TABLE',
      'accelerator_phase_authorizations',
      '{"status": "applied", "description": "Tabela persistente de autorizacoes administrativas criada com sucesso"}',
      NOW()
    );
  END IF;
END $$;

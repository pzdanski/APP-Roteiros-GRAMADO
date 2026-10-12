-- ==============================================================================
-- SPRINT 11.5 / HOTFIX 11.5: ESTRUTURAS DO CATALOG ACCELERATOR & RECONCILIAÇÃO
-- Idempotente, não-destrutivo e seguro para execução no Supabase de Produção
-- ==============================================================================

-- 1. Tabela de Autorizações de Fase (Fonte da Verdade de Autorizações)
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

CREATE INDEX IF NOT EXISTS idx_accelerator_auth_phase_status 
  ON public.accelerator_phase_authorizations (phase_id, status);
CREATE INDEX IF NOT EXISTS idx_accelerator_auth_created_at
  ON public.accelerator_phase_authorizations (created_at DESC);

ALTER TABLE public.accelerator_phase_authorizations ENABLE ROW LEVEL SECURITY;

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

-- 2. Tabela de Execuções de Microlotes
CREATE TABLE IF NOT EXISTS public.accelerator_executions (
  execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id INT NOT NULL CHECK (phase_id IN (1, 2, 3)),
  microlot_number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED')),
  total_items INT NOT NULL DEFAULT 10,
  processed_items INT NOT NULL DEFAULT 0,
  discovered_items INT NOT NULL DEFAULT 0,
  analyzed_items INT NOT NULL DEFAULT 0,
  imported_items INT NOT NULL DEFAULT 0,
  duplicate_items INT NOT NULL DEFAULT 0,
  review_required_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  current_step TEXT NOT NULL DEFAULT 'INICIANDO',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  google_calls_by_sku JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost_brl NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  authorized_by TEXT NOT NULL,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_accelerator_executions_phase_status 
  ON public.accelerator_executions(phase_id, status);
CREATE INDEX IF NOT EXISTS idx_accelerator_executions_created_at 
  ON public.accelerator_executions(created_at DESC);

ALTER TABLE public.accelerator_executions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'accelerator_executions' AND policyname = 'service_role_all_accelerator_executions'
  ) THEN
    CREATE POLICY service_role_all_accelerator_executions ON public.accelerator_executions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3. Tabela de Locks / Leases Distribuídos por Fase (Concorrência Multinstância Cloud Run)
CREATE TABLE IF NOT EXISTS public.accelerator_phase_locks (
  phase_id INT PRIMARY KEY CHECK (phase_id IN (1, 2, 3)),
  current_execution_id UUID NOT NULL REFERENCES public.accelerator_executions(execution_id) ON DELETE CASCADE,
  locked_by TEXT NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.accelerator_phase_locks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'accelerator_phase_locks' AND policyname = 'service_role_all_accelerator_phase_locks'
  ) THEN
    CREATE POLICY service_role_all_accelerator_phase_locks ON public.accelerator_phase_locks
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Tabela de Checkpoints Granulares
CREATE TABLE IF NOT EXISTS public.accelerator_checkpoints (
  checkpoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.accelerator_executions(execution_id) ON DELETE CASCADE,
  microlot_number INT NOT NULL,
  step_name TEXT NOT NULL,
  processed_items INT NOT NULL DEFAULT 0,
  imported_items INT NOT NULL DEFAULT 0,
  duplicate_items INT NOT NULL DEFAULT 0,
  review_required_items INT NOT NULL DEFAULT 0,
  failed_items INT NOT NULL DEFAULT 0,
  estimated_cost_brl NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
  sample_audited JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_accelerator_checkpoints_exec_id 
  ON public.accelerator_checkpoints(execution_id, created_at ASC);

ALTER TABLE public.accelerator_checkpoints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'accelerator_checkpoints' AND policyname = 'service_role_all_accelerator_checkpoints'
  ) THEN
    CREATE POLICY service_role_all_accelerator_checkpoints ON public.accelerator_checkpoints
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Função Atômica para Aquisição de Leases com Bloqueio de Linha
CREATE OR REPLACE FUNCTION public.acquire_phase_lease_atomic(
  p_phase_id INT,
  p_worker_id TEXT,
  p_execution_id UUID,
  p_lease_duration_ms INT DEFAULT 30000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_expires TIMESTAMPTZ := v_now + ((p_lease_duration_ms / 1000.0) || ' seconds')::interval;
  v_current RECORD;
BEGIN
  SELECT * INTO v_current 
  FROM public.accelerator_phase_locks 
  WHERE phase_id = p_phase_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO public.accelerator_phase_locks (
        phase_id, current_execution_id, locked_by, lease_expires_at, acquired_at, updated_at
      ) VALUES (
        p_phase_id, p_execution_id, p_worker_id, v_expires, v_now, v_now
      );
      RETURN jsonb_build_object('acquired', true, 'locked_by', p_worker_id, 'expires_at', v_expires);
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object('acquired', false, 'reason', 'Conflito de concorrência: lock já inserido por outra instância');
    END;
  ELSE
    IF v_current.locked_by = p_worker_id OR v_current.lease_expires_at < v_now THEN
      UPDATE public.accelerator_phase_locks
      SET current_execution_id = p_execution_id,
          locked_by = p_worker_id,
          lease_expires_at = v_expires,
          updated_at = v_now
      WHERE phase_id = p_phase_id;
      RETURN jsonb_build_object('acquired', true, 'locked_by', p_worker_id, 'expires_at', v_expires);
    ELSE
      RETURN jsonb_build_object(
        'acquired', false, 
        'reason', format('Fase %s com execução ativa pelo worker %s (lease até %s)', p_phase_id, v_current.locked_by, v_current.lease_expires_at)
      );
    END IF;
  END IF;
END;
$$;

-- 6. Reconciliação Segura de Execuções Obsoletas (Limpeza de QUEUED/RUNNING sem lease ativo)
UPDATE public.accelerator_executions
SET status = 'PAUSED',
    current_step = 'RECONCILIADO_MIGRACAO: Execução pendente/obsoleta sem worker ativo reconciliada para PAUSED',
    updated_at = timezone('utc'::text, now())
WHERE status IN ('QUEUED', 'RUNNING', 'PAUSE_REQUESTED')
  AND (lease_expires_at IS NULL OR lease_expires_at < timezone('utc'::text, now()));

-- Remove locks expirados
DELETE FROM public.accelerator_phase_locks
WHERE lease_expires_at < timezone('utc'::text, now());

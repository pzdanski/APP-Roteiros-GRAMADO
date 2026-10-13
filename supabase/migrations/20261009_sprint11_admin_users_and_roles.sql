-- ==============================================================================
-- SPRINT 11 — DUO CONTROL: AUTENTICAÇÃO, USUÁRIOS E PERMISSÕES (RBAC)
-- Data: 2026-10-09
-- Ordem de aplicação: Aplicar após 20261008_hotfix_p0_etapa3_execution_progress.sql
-- ==============================================================================

-- 1. Tabela de Administradores vinculada à identidade do Supabase Auth (auth.users)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'editor', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  mfa_secret TEXT,
  mfa_recovery_codes TEXT[],
  sessions_revoked_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  last_sign_in_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Auditoria Administrativa Imutável
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_resource TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Índices de Desempenho e Busca
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs(admin_user_id);

-- 4. Habilitação Estrita de Row Level Security (RLS)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 5. FUNÇÕES AUXILIARES SEGURAS PARA RLS (Anti-Recursão e Zero Hijacking)
-- SECURITY DEFINER com search_path vazio impede recursão RLS infinita em admin_users
-- e protege contra vetores de sequestro de caminho de busca.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
  );
$$;

-- Restrição estrita de execução das funções auxiliares
REVOKE EXECUTE ON FUNCTION public.is_active_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_active_admin() TO postgres;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO postgres;

-- 6. Políticas RLS: Escrita exclusiva pelo backend (service_role)
-- Visitantes anônimos não possuem qualquer acesso às tabelas administrativas
DROP POLICY IF EXISTS "service_role_all_admin_users" ON public.admin_users;
CREATE POLICY "service_role_all_admin_users"
  ON public.admin_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_admin_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "service_role_all_admin_audit_logs"
  ON public.admin_audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Administradores autenticados e ativos podem consultar seus dados e demais administradores
-- CORREÇÃO SPRINT 11.1: Elimina recursão RLS infinita usando função SECURITY DEFINER is_active_admin()
DROP POLICY IF EXISTS "authenticated_admins_read_users" ON public.admin_users;
CREATE POLICY "authenticated_admins_read_users"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_admin()
  );

-- Super Admins autenticados e ativos podem consultar logs de auditoria
-- CORREÇÃO SPRINT 11.1: Validação segura via função SECURITY DEFINER is_super_admin()
DROP POLICY IF EXISTS "super_admins_read_audit_logs" ON public.admin_audit_logs;
CREATE POLICY "super_admins_read_audit_logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin()
  );

-- ==============================================================================
-- 6. FUNÇÃO DE BOOTSTRAP DO PRIMEIRO SUPER ADMIN (Ação Controlada)
-- Executar no Supabase SQL Editor passando o email do usuário criado no Supabase Auth:
-- Exemplo de uso: SELECT public.bootstrap_initial_super_admin('paulinhozdanski@gmail.com', 'Paulo Zdansky');
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.bootstrap_initial_super_admin(
  p_email TEXT,
  p_full_name TEXT DEFAULT 'Super Administrador DUO21'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_existing_super_admins INT;
  v_result JSONB;
BEGIN
  -- 0. Trava estrita contra escalonamento indevido:
  -- Apenas permitido durante o bootstrap inicial quando não há nenhum Super Admin ativo no sistema
  SELECT count(*) INTO v_existing_super_admins 
  FROM public.admin_users 
  WHERE role = 'super_admin' AND is_active = true;
  
  IF v_existing_super_admins > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'BOOTSTRAP_BLOQUEADO: Já existe Super Admin ativo configurado no sistema. Novos administradores devem ser convidados via painel DUO Control.'
    );
  END IF;

  -- 1. Verifica se o usuário existe em auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USUARIO_NAO_ENCONTRADO: Crie o usuário primeiro no Supabase Auth com o email fornecido.'
    );
  END IF;

  -- 2. Insere ou atualiza para super_admin
  INSERT INTO public.admin_users (id, email, full_name, role, is_active, mfa_enabled, updated_at)
  VALUES (v_user_id, p_email, p_full_name, 'super_admin', true, false, timezone('utc'::text, now()))
  ON CONFLICT (id) DO UPDATE SET
    role = 'super_admin',
    is_active = true,
    full_name = EXCLUDED.full_name,
    updated_at = timezone('utc'::text, now());

  -- 3. Registra na auditoria
  INSERT INTO public.admin_audit_logs (admin_user_id, admin_email, action, target_resource, details, status)
  VALUES (v_user_id, p_email, 'BOOTSTRAP_SUPER_ADMIN', 'admin_users', jsonb_build_object('promoted_user', p_email), 'SUCCESS');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Super Admin inicial configurado com sucesso!',
    'user_id', v_user_id,
    'email', p_email,
    'role', 'super_admin'
  );
END;
$$;

-- 7. Restrição Estrita de Execução da Função de Bootstrap
-- Garante que chamadas anônimas ou de clientes comuns via PostgREST RPC sejam totalmente rejeitadas
REVOKE EXECUTE ON FUNCTION public.bootstrap_initial_super_admin(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bootstrap_initial_super_admin(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.bootstrap_initial_super_admin(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_super_admin(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_super_admin(TEXT, TEXT) TO postgres;

-- ==============================================================================
-- 8. TABELA DE SESSÕES REVOGADAS PERSISTENTES (Multi-Instância Cloud Run)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_revoked_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revoked_sessions_token ON public.admin_revoked_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_user ON public.admin_revoked_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON public.admin_revoked_sessions(expires_at);

ALTER TABLE public.admin_revoked_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_admin_revoked_sessions" ON public.admin_revoked_sessions;
CREATE POLICY "service_role_all_admin_revoked_sessions"
  ON public.admin_revoked_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 9. PROCEDIMENTO SEGURO DE RECUPERAÇÃO / RESET DE MFA (Ação Controlada)
-- Executar no Supabase SQL Editor em caso de perda de dispositivo pelo Super Admin:
-- Exemplo: SELECT public.reset_admin_mfa('paulinhozdanski@gmail.com');
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.reset_admin_mfa(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.admin_users WHERE email = p_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Administrador não encontrado.');
  END IF;

  UPDATE public.admin_users
  SET 
    mfa_enabled = false,
    mfa_secret = NULL,
    mfa_recovery_codes = NULL,
    sessions_revoked_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  WHERE id = v_user_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, admin_email, action, target_resource, details, status)
  VALUES (v_user_id, p_email, 'RESET_ADMIN_MFA_EMERGENCY', 'admin_users', jsonb_build_object('target', p_email), 'SUCCESS');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'MFA resetado com sucesso e sessões existentes revogadas. Novo cadastro TOTP será exigido no próximo login.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_admin_mfa(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_admin_mfa(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_admin_mfa(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reset_admin_mfa(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_admin_mfa(TEXT) TO postgres;

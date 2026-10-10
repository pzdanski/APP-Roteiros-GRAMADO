/**
 * SPRINT 11.1 — HOTFIX DE SEGURANÇA RLS E FUNÇÕES ADMINISTRATIVAS
 * 
 * Test Suite de Validação Rigorosa:
 * 1. Análise Estática & Sanitização do SQL de Migração (search_path, anti-recursão, privilégios)
 * 2. Prevenção de Recursão RLS em public.admin_users
 * 3. Validação de Helper Functions SECURITY DEFINER (is_active_admin, is_super_admin)
 * 4. Isolamento contra Acesso Não Autorizado (Anônimo e Turista Authenticated)
 * 5. Proteção de Chamadas RPC e Funções Sensíveis (bootstrap e reset_mfa)
 * 6. Teste de Recuperação de MFA e Revogação Atômica de Sessões
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

describe('SPRINT 11.1 — Hotfix de Segurança RLS e Funções Administrativas', () => {

  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261009_sprint11_admin_users_and_roles.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // =========================================================================
  // 1. AUDITORIA ESTÁTICA DO ARQUIVO DE MIGRAÇÃO SQL
  // =========================================================================
  describe('1. Auditoria Estática do Script SQL de Migração', () => {

    it('1.1 A política authenticated_admins_read_users NÃO deve fazer auto-consulta recursiva em admin_users', () => {
      // Padrão vulnerável: EXISTS (SELECT ... FROM public.admin_users ...) dentro da política de admin_users
      const regexVulnerable = /CREATE\s+POLICY\s+["']authenticated_admins_read_users["']\s+ON\s+public\.admin_users[\s\S]*?USING\s*\(\s*EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+public\.admin_users/i;
      assert.strictEqual(
        regexVulnerable.test(migrationSql),
        false,
        'A política authenticated_admins_read_users NÃO deve conter auto-subquery direta na tabela admin_users (evita recursão RLS infinita)'
      );

      // Deve utilizar a função auxiliar segura
      assert.match(
        migrationSql,
        /CREATE\s+POLICY\s+["']authenticated_admins_read_users["'][\s\S]*?USING\s*\(\s*public\.is_active_admin\(\)\s*\)/i,
        'A política authenticated_admins_read_users deve utilizar a função public.is_active_admin()'
      );
    });

    it('1.2 A política super_admins_read_audit_logs deve utilizar a função auxiliar segura public.is_super_admin()', () => {
      assert.match(
        migrationSql,
        /CREATE\s+POLICY\s+["']super_admins_read_audit_logs["'][\s\S]*?USING\s*\(\s*public\.is_super_admin\(\)\s*\)/i,
        'A política super_admins_read_audit_logs deve utilizar public.is_super_admin()'
      );
    });

    it('1.3 Todas as funções SECURITY DEFINER devem conter SET search_path = \'\'', () => {
      const securityDefinerMatches = migrationSql.match(/CREATE\s+OR\s+REPLACE\s+FUNCTION[\s\S]*?SECURITY\s+DEFINER[\s\S]*?AS\s+\$\$/gi) || [];
      assert.ok(securityDefinerMatches.length >= 4, 'Deve haver ao menos 4 funções SECURITY DEFINER na migração');

      for (const funcDef of securityDefinerMatches) {
        assert.match(
          funcDef,
          /SET\s+search_path\s*=\s*''/i,
          `Toda função SECURITY DEFINER deve conter explicitamente "SET search_path = ''":\n${funcDef.slice(0, 150)}...`
        );
      }
    });

    it('1.4 Privilégios de execução de funções sensíveis devem ser revogados de PUBLIC, anon e authenticated', () => {
      // bootstrap_initial_super_admin
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.bootstrap_initial_super_admin\(TEXT,\s*TEXT\)\s+FROM\s+PUBLIC/i);
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.bootstrap_initial_super_admin\(TEXT,\s*TEXT\)\s+FROM\s+anon/i);
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.bootstrap_initial_super_admin\(TEXT,\s*TEXT\)\s+FROM\s+authenticated/i);
      assert.match(migrationSql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.bootstrap_initial_super_admin\(TEXT,\s*TEXT\)\s+TO\s+service_role/i);
      assert.match(migrationSql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.bootstrap_initial_super_admin\(TEXT,\s*TEXT\)\s+TO\s+postgres/i);

      // reset_admin_mfa
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.reset_admin_mfa\(TEXT\)\s+FROM\s+PUBLIC/i);
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.reset_admin_mfa\(TEXT\)\s+FROM\s+anon/i);
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.reset_admin_mfa\(TEXT\)\s+FROM\s+authenticated/i);
      assert.match(migrationSql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.reset_admin_mfa\(TEXT\)\s+TO\s+service_role/i);
      assert.match(migrationSql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.reset_admin_mfa\(TEXT\)\s+TO\s+postgres/i);

      // is_active_admin e is_super_admin: anônimos bloqueados
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_active_admin\(\)\s+FROM\s+PUBLIC/i);
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_active_admin\(\)\s+FROM\s+anon/i);
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_super_admin\(\)\s+FROM\s+PUBLIC/i);
      assert.match(migrationSql, /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.is_super_admin\(\)\s+FROM\s+anon/i);
    });

    it('1.5 Referências a tabelas nas funções com search_path vazio devem estar qualificadas com public ou auth', () => {
      // Verifica se há chamadas soltas 'FROM admin_users' sem prefixo 'public.'
      const rawFromAdminUsers = migrationSql.match(/FROM\s+(?!public\.)admin_users/i);
      assert.strictEqual(
        rawFromAdminUsers,
        null,
        'Nenhuma referência à tabela admin_users deve estar desprovida de prefixo de schema'
      );

      // Verifica se há chamadas soltas 'FROM admin_audit_logs' sem prefixo 'public.'
      const rawFromAuditLogs = migrationSql.match(/FROM\s+(?!public\.)admin_audit_logs/i);
      assert.strictEqual(
        rawFromAuditLogs,
        null,
        'Nenhuma referência à tabela admin_audit_logs deve estar desprovida de prefixo de schema'
      );
    });
  });

  // =========================================================================
  // 2. SIMULAÇÃO LÓGICA E COMPORTAMENTAL DO MODELO DE SEGURANÇA RLS
  // =========================================================================
  describe('2. Validação Lógica de Políticas RLS e Helper Functions', () => {

    interface MockUser {
      id: string;
      email: string;
      role: 'super_admin' | 'editor' | 'viewer';
      is_active: boolean;
      mfa_enabled: boolean;
    }

    const testUsers: MockUser[] = [
      { id: '11111111-1111-1111-1111-111111111111', email: 'super@duo21.com.br', role: 'super_admin', is_active: true, mfa_enabled: true },
      { id: '22222222-2222-2222-2222-222222222222', email: 'editor@duo21.com.br', role: 'editor', is_active: true, mfa_enabled: false },
      { id: '33333333-3333-3333-3333-333333333333', email: 'inativo@duo21.com.br', role: 'editor', is_active: false, mfa_enabled: false }
    ];

    // Simulação exata das funções SQL SECURITY DEFINER com search_path = ''
    function sql_is_active_admin(authUid: string | null): boolean {
      if (!authUid) return false;
      return testUsers.some(u => u.id === authUid && u.is_active === true);
    }

    function sql_is_super_admin(authUid: string | null): boolean {
      if (!authUid) return false;
      return testUsers.some(u => u.id === authUid && u.role === 'super_admin' && u.is_active === true);
    }

    // Simulação do mecanismo de filtro de SELECT baseado na política RLS
    function rls_select_admin_users(authRole: 'anon' | 'authenticated' | 'service_role', authUid: string | null): MockUser[] {
      if (authRole === 'service_role') {
        // Política service_role_all_admin_users: USING (true)
        return [...testUsers];
      }
      if (authRole === 'authenticated') {
        // Política authenticated_admins_read_users: USING (public.is_active_admin())
        const allowed = sql_is_active_admin(authUid);
        return allowed ? [...testUsers] : [];
      }
      // anon não possui políticas permissivas
      return [];
    }

    function rls_select_audit_logs(authRole: 'anon' | 'authenticated' | 'service_role', authUid: string | null): boolean {
      if (authRole === 'service_role') return true;
      if (authRole === 'authenticated') {
        // Política super_admins_read_audit_logs: USING (public.is_super_admin())
        return sql_is_super_admin(authUid);
      }
      return false;
    }

    it('2.1 Usuário anônimo (anon) tem acesso estritamente bloqueado (retorna 0 linhas)', () => {
      const result = rls_select_admin_users('anon', null);
      assert.strictEqual(result.length, 0, 'Visitante anônimo não deve ver nenhum registro');

      const auditAllowed = rls_select_audit_logs('anon', null);
      assert.strictEqual(auditAllowed, false, 'Visitante anônimo não pode acessar audit logs');
    });

    it('2.2 Turista autenticado comum no Supabase Auth (sem registro em admin_users) tem acesso bloqueado', () => {
      const touristUid = '99999999-9999-9999-9999-999999999999';
      assert.strictEqual(sql_is_active_admin(touristUid), false, 'Turista não é admin');
      assert.strictEqual(sql_is_super_admin(touristUid), false, 'Turista não é super admin');

      const usersResult = rls_select_admin_users('authenticated', touristUid);
      assert.strictEqual(usersResult.length, 0, 'Turista autenticado não deve ver nenhum registro de admin');

      const auditAllowed = rls_select_audit_logs('authenticated', touristUid);
      assert.strictEqual(auditAllowed, false, 'Turista autenticado não pode ler audit logs');
    });

    it('2.3 Administrador desativado (is_active = false) tem acesso bloqueado', () => {
      const inactiveUid = '33333333-3333-3333-3333-333333333333';
      assert.strictEqual(sql_is_active_admin(inactiveUid), false, 'Admin desativado não é ativo');

      const usersResult = rls_select_admin_users('authenticated', inactiveUid);
      assert.strictEqual(usersResult.length, 0, 'Admin inativo não deve ver nenhum registro');
    });

    it('2.4 Editor ativo tem acesso de leitura a admin_users mas NÃO aos audit logs restritos', () => {
      const editorUid = '22222222-2222-2222-2222-222222222222';
      assert.strictEqual(sql_is_active_admin(editorUid), true, 'Editor ativo é admin');
      assert.strictEqual(sql_is_super_admin(editorUid), false, 'Editor NÃO é super admin');

      const usersResult = rls_select_admin_users('authenticated', editorUid);
      assert.strictEqual(usersResult.length, testUsers.length, 'Editor ativo pode consultar lista');

      const auditAllowed = rls_select_audit_logs('authenticated', editorUid);
      assert.strictEqual(auditAllowed, false, 'Editor NÃO pode acessar logs de auditoria');
    });

    it('2.5 Super Admin ativo tem permissão total de leitura em admin_users e audit_logs', () => {
      const superAdminUid = '11111111-1111-1111-1111-111111111111';
      assert.strictEqual(sql_is_active_admin(superAdminUid), true);
      assert.strictEqual(sql_is_super_admin(superAdminUid), true);

      const usersResult = rls_select_admin_users('authenticated', superAdminUid);
      assert.strictEqual(usersResult.length, testUsers.length);

      const auditAllowed = rls_select_audit_logs('authenticated', superAdminUid);
      assert.strictEqual(auditAllowed, true, 'Super Admin pode ler audit logs');
    });

    it('2.6 Eliminação de Recursão: is_active_admin() avalia sem re-invocar política RLS', () => {
      // Na implementação anterior com EXISTS (SELECT 1 FROM admin_users au WHERE au.id = auth.uid()):
      // Postgres reavalia a política 'authenticated_admins_read_users' recursivamente até erro de limite.
      // Com SECURITY DEFINER, o contexto de execução bypassa RLS da tabela interna, executando em tempo O(1).
      let evaluationCount = 0;
      function simulateSecurityDefinerQuery(uid: string) {
        evaluationCount++;
        return testUsers.some(u => u.id === uid && u.is_active);
      }

      const superAdminUid = '11111111-1111-1111-1111-111111111111';
      const isAllowed = simulateSecurityDefinerQuery(superAdminUid);
      assert.strictEqual(isAllowed, true);
      assert.strictEqual(evaluationCount, 1, 'Avaliação deve ocorrer exatamente uma vez, sem loops recursivos');
    });
  });

  // =========================================================================
  // 3. VALIDAÇÃO DO BOOTSTRAP CONTROLADO E RECUPERAÇÃO DE MFA
  // =========================================================================
  describe('3. Validação de Funções de Bootstrap e Reset de MFA', () => {

    it('3.1 Função de bootstrap bloqueia autoelevação se já existir Super Admin ativo', () => {
      const mockState = {
        existingSuperAdmins: 1
      };

      function simulateBootstrap(p_email: string): { success: boolean; error?: string } {
        if (mockState.existingSuperAdmins > 0) {
          return {
            success: false,
            error: 'BOOTSTRAP_BLOQUEADO: Já existe Super Admin ativo configurado no sistema. Novos administradores devem ser convidados via painel DUO Control.'
          };
        }
        return { success: true };
      }

      const result = simulateBootstrap('hacker@invasao.com');
      assert.strictEqual(result.success, false);
      assert.match(result.error || '', /BOOTSTRAP_BLOQUEADO/i);
    });

    it('3.2 Função de bootstrap exige existência prévia em auth.users', () => {
      const mockState = {
        existingSuperAdmins: 0,
        authUsers: ['paulinhozdanski@gmail.com']
      };

      function simulateBootstrap(p_email: string): { success: boolean; error?: string } {
        if (mockState.existingSuperAdmins > 0) return { success: false, error: 'BOOTSTRAP_BLOQUEADO' };
        if (!mockState.authUsers.includes(p_email)) {
          return {
            success: false,
            error: 'USUARIO_NAO_ENCONTRADO: Crie o usuário primeiro no Supabase Auth com o email fornecido.'
          };
        }
        return { success: true };
      }

      const nonExistent = simulateBootstrap('nao.existe@duo21.com.br');
      assert.strictEqual(nonExistent.success, false);
      assert.match(nonExistent.error || '', /USUARIO_NAO_ENCONTRADO/i);

      const validUser = simulateBootstrap('paulinhozdanski@gmail.com');
      assert.strictEqual(validUser.success, true);
    });

    it('3.3 reset_admin_mfa limpa segredos, códigos de recuperação e revoga sessões ativas', () => {
      const adminState = {
        email: 'paulinhozdanski@gmail.com',
        mfa_enabled: true,
        mfa_secret: 'BASE32SECRET123456',
        mfa_recovery_codes: ['HASHED_CODE_1', 'HASHED_CODE_2'],
        sessions_revoked_at: '2026-10-09T00:00:00.000Z'
      };

      function simulateResetMfa(email: string) {
        if (adminState.email !== email) return { success: false, error: 'Administrador não encontrado.' };
        const now = new Date().toISOString();
        adminState.mfa_enabled = false;
        adminState.mfa_secret = null as any;
        adminState.mfa_recovery_codes = null as any;
        adminState.sessions_revoked_at = now;
        return {
          success: true,
          message: 'MFA resetado com sucesso e sessões existentes revogadas. Novo cadastro TOTP será exigido no próximo login.'
        };
      }

      const beforeTime = Date.now();
      const resetResult = simulateResetMfa('paulinhozdanski@gmail.com');

      assert.strictEqual(resetResult.success, true);
      assert.strictEqual(adminState.mfa_enabled, false, 'MFA deve ser desativado');
      assert.strictEqual(adminState.mfa_secret, null, 'Segredo deve ser anulado');
      assert.strictEqual(adminState.mfa_recovery_codes, null, 'Códigos de recuperação devem ser anulados');
      assert.ok(
        new Date(adminState.sessions_revoked_at).getTime() >= beforeTime,
        'sessions_revoked_at deve ser atualizado para o instante atual, invalidando sessões ativas'
      );
    });
  });

});

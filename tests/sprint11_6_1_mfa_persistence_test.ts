import { test } from 'node:test';
import assert from 'node:assert';
import { TotpService } from '../src/server/security/TotpService';
import { adminAuthService } from '../src/server/security/AdminAuthService';
import { createAdminAuthMiddleware } from '../src/server/adminAuth';
import { Request, Response } from 'express';

test('HOTFIX 11.6.1 — Persistência Estrita de MFA e Resiliência contra Falha de Gravação', async (t) => {
  const adminApiKey = 'test-duo21-secret-key-11-6-1';
  const requireAdmin = createAdminAuthMiddleware(adminApiKey);

  const testUser = {
    id: 'usr-test-persistence-11-6-1',
    email: 'persistence.superadmin@duo21.com.br',
    full_name: 'Super Admin Persistência Teste',
    role: 'super_admin' as const,
    is_active: true,
    mfa_enabled: false,
    mfa_secret: undefined as string | undefined,
    mfa_recovery_codes: undefined as string[] | undefined,
    last_sign_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Registra no mock local
  (adminAuthService as any).mockUsers.push({ ...testUser });

  await t.test('1. Iniciar cadastro de MFA e receber segredo Base32', async () => {
    const setup = await adminAuthService.startMfaSetup(testUser.id);
    assert.ok(setup.secret, 'Deve gerar segredo');
    assert.ok(setup.otpauthUri.includes(setup.secret), 'URI deve conter o segredo');
  });

  await t.test('2. Simulação de Falha de Gravação no Banco Aborta Ativação', async () => {
    const pending = (adminAuthService as any).pendingMfaRegistrations.get(testUser.id);
    assert.ok(pending, 'Registro pendente deve existir');
    const counter = Math.floor(Date.now() / 1000 / 30);
    const validCode = TotpService.generateTokenForCounter(pending.secret, counter);

    // Simula cliente Supabase ativo com erro na gravação
    const originalIsSupabase = (adminAuthService as any).isSupabaseMode;
    (adminAuthService as any).isSupabaseMode = () => true;

    // Injeta mock do getRawClient que falha na gravação
    const { supabaseServer } = await import('../src/server/supabaseServer');
    const originalGetRaw = supabaseServer.getRawClient;
    supabaseServer.getRawClient = () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: testUser, error: null })
          })
        }),
        update: () => ({
          eq: () => ({
            select: async () => ({
              data: null,
              error: { message: 'SIMULATED_DB_ERROR: Conexao interrompida com Postgres' }
            })
          })
        })
      })
    } as any);

    let errorThrown = false;
    try {
      await adminAuthService.confirmMfaSetup({
        userId: testUser.id,
        code: validCode,
        callerEmail: testUser.email
      });
    } catch (err: any) {
      errorThrown = true;
      assert.ok(err.message.includes('SIMULATED_DB_ERROR'), 'Erro do banco deve ser propagado e impedir sucesso');
    } finally {
      // Restaura métodos originais incondicionalmente no finally
      (adminAuthService as any).isSupabaseMode = originalIsSupabase;
      supabaseServer.getRawClient = originalGetRaw;
    }

    assert.strictEqual(errorThrown, true, 'Deve lançar exceção em caso de falha de persistência');
  });

  await t.test('3. Confirmação Criptográfica com Persistência Bem-Sucedida', async () => {
    // Reinicia setup para obter novo pendente
    const setup = await adminAuthService.startMfaSetup(testUser.id);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const validCode = TotpService.generateTokenForCounter(setup.secret, counter);

    const result = await adminAuthService.confirmMfaSetup({
      userId: testUser.id,
      code: validCode,
      callerEmail: testUser.email
    });

    assert.strictEqual(result.success, true, 'Ativação deve suceder');
    assert.strictEqual(result.recoveryCodes.length, 8, '8 códigos de recuperação devem ser gerados');

    // Verifica que o registro agora possui mfa_enabled = true
    const updated = await adminAuthService.getAdminUserById(testUser.id);
    assert.strictEqual(updated?.mfa_enabled, true, 'mfa_enabled DEVE ser true após confirmação');
    assert.ok(updated?.mfa_secret, 'Segredo deve estar registrado');
    assert.strictEqual(updated?.mfa_recovery_codes?.length, 8, 'Hashes dos 8 códigos de recuperação salvos');
  });

  await t.test('4. Novo Login com Senha Exige e Aceita TOTP', async () => {
    const user = await adminAuthService.getAdminUserById(testUser.id);
    assert.ok(user?.mfa_secret, 'Usuário possui segredo');

    // Tentativa sem código
    const challenge = await adminAuthService.authenticate({
      email: testUser.email,
      password: 'qualquer-senha'
    });
    assert.strictEqual(challenge.mfaRequired, true, 'Login deve exigir segundo fator');

    // Login com código correto
    const counter = Math.floor(Date.now() / 1000 / 30);
    const validCode = TotpService.generateTokenForCounter(user.mfa_secret, counter);

    const authSuccess = await adminAuthService.authenticate({
      email: testUser.email,
      password: 'qualquer-senha',
      mfaCode: validCode
    });

    assert.ok(authSuccess.user, 'Login concluído');
    assert.strictEqual(authSuccess.user.mfa_enabled, true, 'Usuário autenticado mantém mfa_enabled true');
  });

  await t.test('5. Acesso a Operações Críticas Liberado Após Elevação', async () => {
    const user = await adminAuthService.getAdminUserById(testUser.id);
    const verifiedToken = requireAdmin.generateSessionToken({
      ...user!,
      mfa_verified: true
    });

    let nextCalled = false;
    let statusCode = 0;
    const mockReq = {
      headers: {
        'x-admin-session': verifiedToken
      },
      body: {}
    } as unknown as Request;

    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      }
    } as unknown as Response;

    await requireAdmin.requireSuperAdminSensitive(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Super Admin com MFA verificado e persistido tem acesso total');
    assert.strictEqual(statusCode, 0, 'Nenhum erro de HTTP');
  });
});

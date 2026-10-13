import { test } from 'node:test';
import assert from 'node:assert';
import { TotpService } from '../src/server/security/TotpService';
import { adminAuthService } from '../src/server/security/AdminAuthService';
import { createAdminAuthMiddleware } from '../src/server/adminAuth';
import { Request, Response } from 'express';

// Esta suíte valida o comportamento COM exigência de MFA (reativável por flag).
process.env.ADMIN_MFA_ENFORCED = 'true';

test('HOTFIX 11.6 — Configuração Inicial de MFA e Resiliência de Sessão', async (t) => {
  const adminApiKey = 'test-duo21-secret-key-11-6';
  const requireAdmin = createAdminAuthMiddleware(adminApiKey);

  // Setup: criar um usuário Super Admin de teste SEM MFA ativo
  const superAdminWithoutMfa = {
    id: 'usr-test-superadmin-no-mfa',
    email: 'superadmin.teste@duo21.com.br',
    full_name: 'Super Admin Teste Sem MFA',
    role: 'super_admin' as const,
    is_active: true,
    mfa_enabled: false,
    last_sign_in_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Cadastra no store em memória do adminAuthService
  (adminAuthService as any).mockUsers.push({ ...superAdminWithoutMfa });

  await t.test('1. Bloqueio de Operação Sensível antes de ativar MFA', async () => {
    // Gera sessão para o usuário SEM mfa_verified
    const sessionToken = requireAdmin.generateSessionToken({
      ...superAdminWithoutMfa,
      mfa_verified: false
    });

    let statusCode = 0;
    let responseBody: any = null;

    const mockReq = {
      headers: {
        'x-admin-session': sessionToken
      },
      body: {}
    } as unknown as Request;

    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
        return this;
      }
    } as unknown as Response;

    let nextCalled = false;
    await requireAdmin.requireSuperAdminSensitive(mockReq, mockRes, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'Super Admin sem MFA não deve conseguir executar operação sensível');
    assert.strictEqual(statusCode, 403, 'Deve retornar HTTP 403 Forbidden');
    assert.strictEqual(responseBody?.code, 'MFA_REQUIRED', 'Deve retornar código MFA_REQUIRED');
  });

  await t.test('2. Início de Configuração de MFA (startMfaSetup)', async () => {
    const setupResult = await adminAuthService.startMfaSetup(superAdminWithoutMfa.id);
    assert.ok(setupResult.secret, 'Deve retornar um segredo TOTP em Base32');
    assert.ok(setupResult.otpauthUri.startsWith('otpauth://totp/'), 'Deve retornar URI otpauth válida');
    assert.ok(setupResult.otpauthUri.includes(setupResult.secret), 'URI deve conter o segredo');
  });

  await t.test('3. Rejeição de Código TOTP Inválido na Confirmação', async () => {
    let errorCaught = false;
    try {
      await adminAuthService.confirmMfaSetup({
        userId: superAdminWithoutMfa.id,
        code: '000000', // código incorreto
        callerEmail: superAdminWithoutMfa.email
      });
    } catch (err: any) {
      errorCaught = true;
      assert.ok(err.message.includes('inválido'), 'Mensagem deve indicar código inválido');
    }
    assert.strictEqual(errorCaught, true, 'Deve rejeitar código inválido');

    // Usuário continua sem MFA ativo
    const userStillNoMfa = await adminAuthService.getAdminUserById(superAdminWithoutMfa.id);
    assert.strictEqual(userStillNoMfa?.mfa_enabled, false, 'MFA não deve ter sido ativado');
  });

  let validTotpCode = '';
  await t.test('4. Confirmação Criptográfica com Código Válido e Ativação do MFA', async () => {
    const pending = (adminAuthService as any).pendingMfaRegistrations.get(superAdminWithoutMfa.id);
    assert.ok(pending, 'Registro pendente deve existir');

    // Gera o token válido usando o algoritmo RFC 6238
    const counter = Math.floor(Date.now() / 1000 / 30);
    validTotpCode = TotpService.generateTokenForCounter(pending.secret, counter);

    const confirmResult = await adminAuthService.confirmMfaSetup({
      userId: superAdminWithoutMfa.id,
      code: validTotpCode,
      callerEmail: superAdminWithoutMfa.email
    });

    assert.strictEqual(confirmResult.success, true, 'Confirmação deve ser bem-sucedida');
    assert.strictEqual(confirmResult.recoveryCodes.length, 8, 'Devem ser gerados exatamente 8 códigos de recuperação');

    // Valida que o usuário agora tem mfa_enabled = true
    const userWithMfa = await adminAuthService.getAdminUserById(superAdminWithoutMfa.id);
    assert.strictEqual(userWithMfa?.mfa_enabled, true, 'mfa_enabled deve ser true no perfil');
    assert.ok(userWithMfa?.mfa_secret, 'Segredo deve estar gravado no perfil');
    assert.strictEqual(userWithMfa?.mfa_recovery_codes?.length, 8, 'Códigos de recuperação devem estar armazenados com hash');
  });

  await t.test('5. Re-autenticação Exigindo MFA e Emissão de Sessão Verificada', async () => {
    // Tentativa de login sem código MFA
    const loginChallenge = await adminAuthService.authenticate({
      email: superAdminWithoutMfa.email,
      password: 'qualquer-senha'
    });

    assert.strictEqual(loginChallenge.mfaRequired, true, 'Deve exigir código MFA no login');

    // Login com o código MFA válido
    const loginSuccess = await adminAuthService.authenticate({
      email: superAdminWithoutMfa.email,
      password: 'qualquer-senha',
      mfaCode: validTotpCode
    });

    assert.ok(loginSuccess.user, 'Login deve retornar o usuário');
    assert.ok(loginSuccess.authMethod, 'Método de autenticação retornado');

    // Gera token de sessão com mfa_verified = true
    const sessionTokenVerified = requireAdmin.generateSessionToken({
      ...loginSuccess.user,
      mfa_verified: true
    });

    // Teste da operação sensível com a sessão verificada
    let nextCalled = false;
    let statusCode = 0;
    const mockReq = {
      headers: {
        'x-admin-session': sessionTokenVerified
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

    assert.strictEqual(nextCalled, true, 'Super Admin com MFA verificado deve ter acesso liberado à operação sensível');
    assert.strictEqual(statusCode, 0, 'Não deve retornar código de erro');
  });

  await t.test('6. Validação e Consumo de Código de Recuperação de Uso Único', async () => {
    const user = await adminAuthService.getAdminUserById(superAdminWithoutMfa.id);
    assert.ok(user && user.mfa_recovery_codes, 'Usuário deve possuir códigos de recuperação');

    // Inicia um novo registro de MFA para obter novos códigos conhecidos
    const { recoveryCodes } = await adminAuthService.confirmMfaSetup({
      userId: superAdminWithoutMfa.id,
      code: validTotpCode, // simulando
      callerEmail: superAdminWithoutMfa.email
    }).catch(async () => {
      // Se não havia pendente, já temos os códigos do teste 4:
      // Vamos testar o consumo com código temporário
      const { rawCodes, hashedCodes } = TotpService.generateRecoveryCodes(8);
      user!.mfa_recovery_codes = hashedCodes;
      return { recoveryCodes: rawCodes };
    });

    const singleUseCode = recoveryCodes[0];
    const initialCount = user!.mfa_recovery_codes!.length;

    // Primeiro uso do código de recuperação
    const isValidFirst = await adminAuthService.verifyMfaCode(superAdminWithoutMfa.id, singleUseCode);
    assert.strictEqual(isValidFirst, true, 'Código de recuperação deve ser aceito');

    const updatedUser = await adminAuthService.getAdminUserById(superAdminWithoutMfa.id);
    assert.strictEqual(updatedUser!.mfa_recovery_codes!.length, initialCount - 1, 'Código usado deve ser removido do banco');

    // Tentativa de reuso (Replay attack prevention)
    const isValidSecond = await adminAuthService.verifyMfaCode(superAdminWithoutMfa.id, singleUseCode);
    assert.strictEqual(isValidSecond, false, 'Código de recuperação NÃO pode ser reutilizado');
  });
});

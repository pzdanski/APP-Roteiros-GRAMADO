import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { adminAuthService } from '../src/server/security/AdminAuthService';
import { createAdminAuthMiddleware } from '../src/server/adminAuth';
import { TotpService } from '../src/server/security/TotpService';

describe('HOTFIX 11.4 — Autenticação do Catalog Accelerator e Resiliência de Sessão', () => {
  const adminApiKey = 'test-master-admin-key-hotfix-11-4-secret-123456';
  const adminAuth = createAdminAuthMiddleware(adminApiKey);

  test('1.1 Sessão mestre (id: master-session) NÃO deve ser considerada revogada automaticamente', async () => {
    const isRevoked = await adminAuthService.isSessionRevoked('master-session');
    assert.strictEqual(isRevoked, false, 'Sessão master-session não deve ser tratada como revogada por ausência na tabela');
  });

  test('1.2 Token HMAC para master-session deve ser gerado e validado com sucesso pelo middleware', async () => {
    const token = adminAuth.generateSessionToken();
    assert.ok(token, 'Token deve ser gerado');
    const verified = adminAuth.verifySessionToken(token);
    assert.ok(verified, 'Assinatura HMAC deve ser válida');
    assert.strictEqual(verified.id, 'master-session');
    assert.strictEqual(verified.role, 'super_admin');

    // Simula execução de requireAdminMiddleware
    const req: any = {
      headers: {
        'x-admin-session': token
      }
    };
    const res: any = {
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; return this; }
    };

    let nextCalled = false;
    await adminAuth(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Middleware requireAdmin deve aprovar o token master-session com next()');
    assert.strictEqual(req.adminUser.role, 'super_admin');
    assert.strictEqual(req.adminUser.id, 'master-session');
  });

  test('1.3 Sessão individual de master-session expressamente revogada deve ser bloqueada', async () => {
    const token = adminAuth.generateSessionToken();
    const tokenSig = token.split('.')[1];

    await adminAuthService.revokeSessionToken(token, 'master-session');

    const isRevoked = await adminAuthService.isSessionRevoked('master-session', undefined, tokenSig);
    assert.strictEqual(isRevoked, true, 'Token revogado especificamente deve ser bloqueado');

    const req: any = {
      headers: {
        'x-admin-session': token
      }
    };
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; return this; }
    };

    let nextCalled = false;
    await adminAuth(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'Middleware não deve chamar next() para token revogado');
    assert.strictEqual(res.statusCode, 401, 'Deve retornar HTTP 401');
    assert.strictEqual(res.body.code, 'SESSION_REVOKED');
  });

  test('2.1 Autenticação via Authorization Bearer token deve funcionar de forma idêntica a x-admin-session', async () => {
    const token = adminAuth.generateSessionToken();

    const req: any = {
      headers: {
        'authorization': `Bearer ${token}`
      }
    };
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; return this; }
    };

    let nextCalled = false;
    await adminAuth(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Bearer token deve autenticar com sucesso');
    assert.strictEqual(req.adminUser.id, 'master-session');
    assert.strictEqual(req.adminUser.role, 'super_admin');
  });

  test('2.2 Autenticação sem qualquer cabeçalho ou cookie deve retornar 401 Unauthorized', async () => {
    const req: any = {
      headers: {}
    };
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; return this; }
    };

    let nextCalled = false;
    await adminAuth(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.code, 'UNAUTHORIZED');
  });

  test('3.1 Super Admin autenticado com MFA deve poder executar operações sensíveis', async () => {
    const superAdminUser = await adminAuthService.getAdminUserByEmail('admin@duo21.com.br');
    assert.ok(superAdminUser, 'Super Admin padrão deve existir');

    const token = adminAuth.generateSessionToken({
      ...superAdminUser,
      mfa_verified: true
    });

    const req: any = {
      headers: {
        'x-admin-session': token
      }
    };
    const res: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; return this; }
    };

    let nextCalled = false;
    await adminAuth.requireSuperAdminSensitive(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Super Admin com MFA verificado deve ter acesso autorizado');
  });

  test('3.2 Editor deve ter acesso a status (requireAdmin) mas ser bloqueado em autorização de fases (requireSuperAdminSensitive)', async () => {
    const editorUser = await adminAuthService.getAdminUserByEmail('editor@duo21.com.br');
    assert.ok(editorUser, 'Editor padrão deve existir');

    const token = adminAuth.generateSessionToken({
      ...editorUser,
      mfa_verified: false
    });

    // 1. Status (requireAdmin)
    const reqStatus: any = {
      headers: { 'x-admin-session': token }
    };
    const resStatus: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; return this; }
    };
    let nextStatusCalled = false;
    await adminAuth(reqStatus, resStatus, () => {
      nextStatusCalled = true;
    });
    assert.strictEqual(nextStatusCalled, true, 'Editor pode visualizar status');

    // 2. Operação Crítica (requireSuperAdminSensitive)
    const reqSensitive: any = {
      headers: { 'x-admin-session': token }
    };
    const resSensitive: any = {
      statusCode: 200,
      status(code: number) { this.statusCode = code; return this; },
      json(payload: any) { this.body = payload; return this; }
    };
    let nextSensitiveCalled = false;
    await adminAuth.requireSuperAdminSensitive(reqSensitive, resSensitive, () => {
      nextSensitiveCalled = true;
    });
    assert.strictEqual(nextSensitiveCalled, false, 'Editor não pode autorizar fases');
    assert.strictEqual(resSensitive.statusCode, 403, 'Editor deve receber 403 Forbidden');
  });
});

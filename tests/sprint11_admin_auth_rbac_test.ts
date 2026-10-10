/**
 * SPRINT 11 — DUO CONTROL: AUTENTICAÇÃO, USUÁRIOS E PERMISSÕES (RBAC)
 * Test Suite de Validação Rigorosa
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { adminAuthService } from '../src/server/security/AdminAuthService';
import { createAdminAuthMiddleware } from '../src/server/adminAuth';
import { TripAccessService } from '../src/services/security/TripAccessService';
import { TotpService } from '../src/server/security/TotpService';

describe('SPRINT 11 — DUO CONTROL: Autenticação, Usuários e RBAC', () => {

  const testApiKey = 'test-duo21-master-api-key-12345';
  const adminAuth = createAdminAuthMiddleware(testApiKey);

  // =========================================================================
  // 1. AUTENTICAÇÃO INDIVIDUAL E SESSÃO SEGURA
  // =========================================================================
  it('1.1 Deve autenticar Super Admin com credenciais válidas e retornar permissões completas', async () => {
    const user = await adminAuthService.getAdminUserByEmail('admin@duo21.com.br');
    const validTotp = user?.mfa_secret 
      ? TotpService.generateTokenForCounter(user.mfa_secret, Math.floor(Date.now() / 1000 / 30))
      : '123456';

    const authResult = await adminAuthService.authenticate({
      email: 'admin@duo21.com.br',
      mfaCode: validTotp
    });

    assert.ok(authResult.user, 'Usuário deve ser retornado');
    assert.strictEqual(authResult.user.role, 'super_admin');
    assert.strictEqual(authResult.permissions.canManageUsers, true);
    assert.strictEqual(authResult.permissions.canAuthorizePhases, true);
    assert.strictEqual(authResult.permissions.canManageCostGuard, true);
    assert.strictEqual(authResult.permissions.canEditPlaces, true);

    // Geração de token de sessão assinado contendo mfa_verified
    const sessionToken = adminAuth.generateSessionToken({
      ...authResult.user,
      mfa_verified: true
    });
    assert.ok(typeof sessionToken === 'string' && sessionToken.includes('.'), 'Token deve ser assinado com HMAC');

    const verified = adminAuth.verifySessionToken(sessionToken);
    assert.ok(verified, 'Token de sessão deve ser válido');
    assert.strictEqual(verified.email, 'admin@duo21.com.br');
    assert.strictEqual(verified.role, 'super_admin');
    assert.strictEqual(verified.mfa_verified, true);
  });

  it('1.2 Deve exigir MFA/TOTP para Super Admin quando configurado', async () => {
    const authResult = await adminAuthService.authenticate({
      email: 'admin@duo21.com.br'
      // sem mfaCode
    });

    assert.strictEqual(authResult.mfaRequired, true, 'Deve sinalizar exigência de MFA');
    assert.strictEqual(authResult.authMethod, 'mfa_challenge');
  });

  it('1.3 Deve rejeitar código MFA inválido', async () => {
    await assert.rejects(
      async () => {
        await adminAuthService.authenticate({
          email: 'admin@duo21.com.br',
          mfaCode: '000000-invalido'
        });
      },
      /código.*MFA.*inválido/i,
      'Deve rejeitar MFA malformatado ou inválido'
    );
  });

  it('1.4 Deve rejeitar usuário inexistente com mensagem genérica segura', async () => {
    await assert.rejects(
      async () => {
        await adminAuthService.authenticate({
          email: 'invasor@hacker.com'
        });
      },
      /Credenciais administrativas inválidas/i,
      'Deve rejeitar usuário inexistente'
    );
  });

  // =========================================================================
  // 2. CONTROLE DE ACESSO BASEADO EM FUNÇÕES (RBAC)
  // =========================================================================
  it('2.1 Deve conceder perfil de Editor com restrições operacionais estritas', async () => {
    const authResult = await adminAuthService.authenticate({
      email: 'editor@duo21.com.br'
    });

    assert.strictEqual(authResult.user.role, 'editor');
    assert.strictEqual(authResult.permissions.canEditPlaces, true);
    assert.strictEqual(authResult.permissions.canViewMetrics, true);
    assert.strictEqual(authResult.permissions.canManageUsers, false, 'Editor não pode gerenciar usuários');
    assert.strictEqual(authResult.permissions.canAuthorizePhases, false, 'Editor não pode autorizar fases');
    assert.strictEqual(authResult.permissions.canManageCostGuard, false, 'Editor não pode alterar Cost Guard');
    assert.strictEqual(authResult.permissions.canDeletePlaces, false, 'Editor não pode excluir locais');
  });

  it('2.2 Deve conceder perfil de Visualizador exclusivamente em modo somente leitura', async () => {
    const authResult = await adminAuthService.authenticate({
      email: 'viewer@duo21.com.br'
    });

    assert.strictEqual(authResult.user.role, 'viewer');
    assert.strictEqual(authResult.permissions.canViewMetrics, true);
    assert.strictEqual(authResult.permissions.canEditPlaces, false, 'Visualizador não pode editar');
    assert.strictEqual(authResult.permissions.canManageUsers, false);
    assert.strictEqual(authResult.permissions.canAuthorizePhases, false);
    assert.strictEqual(authResult.permissions.canManageCostGuard, false);
  });

  // =========================================================================
  // 3. MIDDLEWARE DE PROTEÇÃO DE ENDPOINTS E AUDITORIA
  // =========================================================================
  it('3.1 Deve bloquear chamadas sem token com 401 Unauthorized', (t, done) => {
    const req: any = { headers: {} };
    const res: any = {
      status(code: number) {
        assert.strictEqual(code, 401);
        return {
          json(body: any) {
            assert.strictEqual(body.code, 'UNAUTHORIZED');
            done();
          }
        };
      }
    };
    const next = () => assert.fail('Não deveria chamar next() sem autenticação');

    adminAuth(req, res, next);
  });

  it('3.2 Middleware requireSuperAdmin deve rejeitar Editor com 403 Forbidden', (t, done) => {
    const editorToken = adminAuth.generateSessionToken({
      id: 'usr-editor-00000000-0002',
      email: 'editor@duo21.com.br',
      role: 'editor'
    });

    const req: any = {
      headers: { 'x-admin-session': editorToken }
    };
    const res: any = {
      status(code: number) {
        assert.strictEqual(code, 403);
        return {
          json(body: any) {
            assert.strictEqual(body.code, 'FORBIDDEN');
            assert.strictEqual(body.currentRole, 'editor');
            done();
          }
        };
      }
    };
    const next = () => assert.fail('Editor não deveria ter acesso a endpoint restrito de Super Admin');

    adminAuth.requireSuperAdmin(req, res, next);
  });

  it('3.3 Middleware requireEditorOrSuperAdmin deve permitir Editor e Super Admin, mas rejeitar Visualizador', (t, done) => {
    const viewerToken = adminAuth.generateSessionToken({
      id: 'usr-viewer-00000000-0003',
      email: 'viewer@duo21.com.br',
      role: 'viewer'
    });

    const req: any = {
      headers: { 'x-admin-session': viewerToken }
    };
    const res: any = {
      status(code: number) {
        assert.strictEqual(code, 403);
        return {
          json(body: any) {
            assert.strictEqual(body.code, 'FORBIDDEN');
            assert.strictEqual(body.currentRole, 'viewer');
            done();
          }
        };
      }
    };
    const next = () => assert.fail('Visualizador não deveria ter acesso a endpoint de edição');

    adminAuth.requireEditorOrSuperAdmin(req, res, next);
  });

  // =========================================================================
  // 4. GESTÃO DE USUÁRIOS, CONVITES E REGRAS DE INTEGRIDADE
  // =========================================================================
  it('4.1 Super Admin pode convidar novo administrador por email', async () => {
    const newUser = await adminAuthService.inviteAdminUser({
      email: 'novo.curador@duo21.com.br',
      full_name: 'Novo Curador Editorial',
      role: 'editor',
      invited_by: 'usr-admin-00000000-0001',
      callerEmail: 'admin@duo21.com.br'
    });

    assert.ok(newUser.id);
    assert.strictEqual(newUser.email, 'novo.curador@duo21.com.br');
    assert.strictEqual(newUser.role, 'editor');
    assert.strictEqual(newUser.is_active, true);

    const found = await adminAuthService.getAdminUserByEmail('novo.curador@duo21.com.br');
    assert.ok(found);
  });

  it('4.2 Deve impedir autoelevação de privilégios pelo próprio usuário', async () => {
    await assert.rejects(
      async () => {
        await adminAuthService.updateAdminRole({
          targetUserId: 'usr-editor-00000000-0002',
          newRole: 'super_admin',
          callerId: 'usr-editor-00000000-0002', // O próprio editor tentando se promover
          callerEmail: 'editor@duo21.com.br'
        });
      },
      /AUTOELEVACAO_NEGADA/i,
      'Deve bloquear autoelevação de função'
    );
  });

  it('4.3 Deve impedir rebaixamento ou desativação do último Super Admin ativo', async () => {
    // Tenta rebaixar o único super admin
    await assert.rejects(
      async () => {
        await adminAuthService.updateAdminRole({
          targetUserId: 'usr-admin-00000000-0001',
          newRole: 'editor',
          callerId: 'usr-admin-other-id',
          callerEmail: 'other@duo21.com.br'
        });
      },
      /OPERACAO_BLOQUEADA.*(último|único) Super Admin/i,
      'Não pode rebaixar o último Super Admin'
    );

    // Tenta desativar o único super admin
    await assert.rejects(
      async () => {
        await adminAuthService.setAdminStatus({
          targetUserId: 'usr-admin-00000000-0001',
          isActive: false,
          callerId: 'usr-admin-other-id',
          callerEmail: 'other@duo21.com.br'
        });
      },
      /OPERACAO_BLOQUEADA.*(último|único) Super Admin/i,
      'Não pode desativar o último Super Admin'
    );
  });

  it('4.4 Deve impedir auto-desativação', async () => {
    await assert.rejects(
      async () => {
        await adminAuthService.setAdminStatus({
          targetUserId: 'usr-admin-00000000-0001',
          isActive: false,
          callerId: 'usr-admin-00000000-0001',
          callerEmail: 'admin@duo21.com.br'
        });
      },
      /OPERACAO_BLOQUEADA.*próprio usuário/i,
      'Não pode desativar o próprio usuário'
    );
  });

  it('4.5 Revogação de sessões e desativação devem bloquear requisições subsequentes', async () => {
    // Desativa o editor recém-criado
    const target = await adminAuthService.getAdminUserByEmail('novo.curador@duo21.com.br');
    assert.ok(target);

    await adminAuthService.setAdminStatus({
      targetUserId: target.id,
      isActive: false,
      callerId: 'usr-admin-00000000-0001',
      callerEmail: 'admin@duo21.com.br'
    });

    // Sessão deve estar revogada
    assert.strictEqual(await adminAuthService.isSessionRevoked(target.id), true);

    // Tentativa de login de usuário desativado deve falhar
    await assert.rejects(
      async () => {
        await adminAuthService.authenticate({
          email: 'novo.curador@duo21.com.br'
        });
      },
      /desativada pelo Super Admin/i,
      'Conta desativada deve ter login bloqueado'
    );
  });

  it('4.6 Ações administrativas devem gerar logs de auditoria imutáveis', async () => {
    const logs = await adminAuthService.listAuditLogs(10);
    assert.ok(Array.isArray(logs), 'Deve retornar lista de logs');
    assert.ok(logs.length > 0, 'Deve conter registros de auditoria');
    
    // Verifica log do convite
    const inviteLog = logs.find(l => l.action === 'INVITE_ADMIN_USER');
    assert.ok(inviteLog, 'Deve conter log do convite');
    assert.strictEqual(inviteLog.admin_email, 'admin@duo21.com.br');
    assert.strictEqual(inviteLog.status, 'SUCCESS');
  });

  // =========================================================================
  // 5. SEGREGAÇÃO ENTRE TURISTAS E ADMINISTRADORES
  // =========================================================================
  it('5.1 Tokens de viagem de turistas são criptográficos e não concedem acesso administrativo', () => {
    const touristToken = TripAccessService.generateSecureToken();
    assert.ok(TripAccessService.isValidTokenFormat(touristToken), 'Token do turista deve ter formato válido');
    assert.ok(touristToken.startsWith('v_'), 'Token do turista inicia com prefixo v_');

    // Validação com o middleware administrativo: turista não é admin
    const verifiedAdmin = adminAuth.verifySessionToken(touristToken);
    assert.strictEqual(verifiedAdmin, null, 'Token de turista não é aceito como sessão administrativa');
  });

  // =========================================================================
  // 6. VALIDAÇÕES CRÍTICAS DO RELEASE GATE
  // =========================================================================
  it('6.1 Super Admin SEM MFA configurado deve ser bloqueado em operações sensíveis (requireSuperAdminSensitive)', async () => {
    // Convida um Super Admin sem MFA ativo
    const invitedAdmin = await adminAuthService.inviteAdminUser({
      email: 'admin-nomfa@duo21.com.br',
      fullName: 'Admin Sem MFA',
      role: 'super_admin',
      callerId: 'usr-admin-00000000-0001',
      callerEmail: 'admin@duo21.com.br'
    });

    const superAdminNoMfaToken = adminAuth.generateSessionToken({
      id: invitedAdmin.id,
      email: invitedAdmin.email,
      role: 'super_admin',
      mfa_verified: false
    });

    await new Promise<void>((resolve, reject) => {
      const req: any = {
        headers: { 'x-admin-session': superAdminNoMfaToken },
        body: {}
      };
      const res: any = {
        status(code: number) {
          try {
            assert.strictEqual(code, 403, 'Deve retornar 403 Forbidden para operação sensível sem MFA');
            return {
              json(body: any) {
                assert.strictEqual(body.code, 'MFA_REQUIRED');
                assert.match(body.error, /MFA\/TOTP/i);
                resolve();
              }
            };
          } catch (err) {
            reject(err);
          }
        }
      };
      const next = () => reject(new Error('Operação sensível não pode prosseguir sem MFA configurado'));

      adminAuth.requireSuperAdminSensitive(req, res, next);
    });
  });

  it('6.2 Falsificação de assinatura HMAC deve ser sumariamente rejeitada pelo backend', () => {
    const validToken = adminAuth.generateSessionToken({
      id: 'usr-admin-00000000-0001',
      email: 'admin@duo21.com.br',
      role: 'super_admin'
    });
    const [payloadB64] = validToken.split('.');
    const forgedToken = `${payloadB64}.assinatura_falsa_forjada_1234567890abcdef`;

    const verified = adminAuth.verifySessionToken(forgedToken);
    assert.strictEqual(verified, null, 'Token com assinatura violada deve retornar null');
  });

  it('6.3 Sessão administrativa é terminantemente rejeitada após desativação do usuário', async () => {
    // Pega usuário existente
    const user = await adminAuthService.getAdminUserByEmail('editor@duo21.com.br');
    assert.ok(user);

    // Gera token válido
    const validToken = adminAuth.generateSessionToken(user);
    assert.ok(adminAuth.verifySessionToken(validToken));

    // Desativa o usuário
    await adminAuthService.setAdminStatus({
      targetUserId: user.id,
      isActive: false,
      callerId: 'usr-admin-00000000-0001',
      callerEmail: 'admin@duo21.com.br'
    });

    // Requisição com o token deve retornar 401
    await new Promise<void>((resolve) => {
      const req: any = {
        headers: { 'x-admin-session': validToken }
      };
      const res: any = {
        status(code: number) {
          assert.strictEqual(code, 401);
          return {
            json(body: any) {
              assert.ok(body.code === 'USER_DEACTIVATED' || body.code === 'SESSION_REVOKED');
              resolve();
            }
          };
        }
      };
      const next = () => assert.fail('Usuário desativado não pode passar no middleware');

      adminAuth(req, res, next);
    });

    // Reativa o usuário para restaurar o estado dos testes
    await adminAuthService.setAdminStatus({
      targetUserId: user.id,
      isActive: true,
      callerId: 'usr-admin-00000000-0001',
      callerEmail: 'admin@duo21.com.br'
    });
  });

});


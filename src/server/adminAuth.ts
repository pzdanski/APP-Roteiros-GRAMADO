import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AdminRole, AdminUserRecord } from '../types';
import { adminAuthService } from './security/AdminAuthService';
import { supabaseServer } from './supabaseServer';

export interface AdminAuthManager {
  (req: Request, res: Response, next: NextFunction): void;
  generateSessionToken: (user?: Partial<AdminUserRecord & { mfa_verified?: boolean }>) => string;
  verifySessionToken: (token: string) => any;
  requireRole: (allowedRoles: AdminRole[]) => (req: Request, res: Response, next: NextFunction) => void;
  requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => void;
  requireSuperAdminSensitive: (req: Request, res: Response, next: NextFunction) => void;
  requireEditorOrSuperAdmin: (req: Request, res: Response, next: NextFunction) => void;
}

export function createAdminAuthMiddleware(adminApiKey: string): AdminAuthManager {
  // Segredo determinístico derivado da master key do servidor
  const sessionSecret = crypto.createHash('sha256').update(adminApiKey || 'duo21-control-secret').digest('hex');

  function generateSessionToken(user?: Partial<AdminUserRecord & { mfa_verified?: boolean }>): string {
    const payload = {
      id: user?.id || 'master-session',
      email: user?.email || 'admin@duo21.com.br',
      role: user?.role || 'super_admin',
      full_name: user?.full_name || 'Administrador DUO21',
      mfa_verified: Boolean(user?.mfa_enabled || user?.mfa_verified),
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 horas
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('hex');
    return `${payloadB64}.${signature}`;
  }

  function verifySessionToken(token: string): any {
    if (!token || typeof token !== 'string') return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return null;
      const [payloadB64, signature] = parts;
      const expectedSig = crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('hex');
      if (signature !== expectedSig) return null;
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      if (payload.exp && Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  }

  const requireAdminMiddleware = async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    const headerKey = req.headers['x-admin-key'] as string | undefined;
    const sessionTokenHeader = req.headers['x-admin-session'] as string | undefined;
    const authHeader = req.headers['authorization'];
    let bearerToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    // 1. Verificação de Cookies HttpOnly (duo_admin_token)
    const cookieHeader = req.headers.cookie;
    let cookieToken: string | undefined;
    if (cookieHeader) {
      const cookieMap = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const trimmed = c.trim();
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) return [trimmed, ''];
          return [trimmed.substring(0, eqIdx), trimmed.substring(eqIdx + 1)];
        })
      );
      cookieToken = cookieMap['duo_admin_token'];
    }

    const candidateToken = bearerToken || sessionTokenHeader || cookieToken;

    // 2. Token de Sessão Assinado HMAC (Sessão Administrativa)
    if (candidateToken) {
      const sessionPayload = verifySessionToken(candidateToken);
      if (sessionPayload) {
        const tokenSig = candidateToken.includes('.') ? candidateToken.split('.')[1] : candidateToken;
        const isRevoked = await adminAuthService.isSessionRevoked(sessionPayload.id, sessionPayload.iat, tokenSig);
        if (isRevoked) {
          res.status(401).json({
            code: 'SESSION_REVOKED',
            error: 'Sessão revogada pelo administrador. Faça login novamente.',
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Validação de conta ativa
        const userRec = await adminAuthService.getAdminUserById(sessionPayload.id);
        if (userRec && !userRec.is_active) {
          res.status(401).json({
            code: 'USER_DEACTIVATED',
            error: 'Conta desativada pelo Super Admin.',
            timestamp: new Date().toISOString()
          });
          return;
        }

        (req as any).adminUser = {
          id: sessionPayload.id,
          email: sessionPayload.email,
          role: (userRec?.role || sessionPayload.role || 'viewer') as AdminRole,
          full_name: sessionPayload.full_name || userRec?.full_name || 'Administrador',
          mfa_verified: Boolean(sessionPayload.mfa_verified),
          authMethod: 'session_token',
          authenticatedAt: new Date().toISOString()
        };
        return next();
      }

      // 3. Token de Acesso JWT do Supabase Auth
      if (process.env.DATA_MODE === 'supabase') {
        try {
          const rawClient = supabaseServer.getRawClient();
          if (rawClient) {
            const { data: authData, error: authErr } = await rawClient.auth.getUser(candidateToken);
            if (!authErr && authData?.user) {
              const adminUser = await adminAuthService.getAdminUserById(authData.user.id) ||
                await adminAuthService.getAdminUserByEmail(authData.user.email || '');

              if (!adminUser) {
                res.status(403).json({
                  code: 'NOT_AN_ADMIN',
                  error: 'Usuário autenticado no Supabase, mas sem perfil administrativo no DUO Control.',
                  timestamp: new Date().toISOString()
                });
                return;
              }

              if (!adminUser.is_active) {
                res.status(401).json({
                  code: 'USER_DEACTIVATED',
                  error: 'Conta administrativa desativada.',
                  timestamp: new Date().toISOString()
                });
                return;
              }

              (req as any).adminUser = {
                id: adminUser.id,
                email: adminUser.email,
                role: adminUser.role,
                full_name: adminUser.full_name,
                authMethod: 'supabase_auth',
                authenticatedAt: new Date().toISOString()
              };
              return next();
            }
          }
        } catch {
          // Ignora e tenta outras formas
        }
      }
    }

    // 4. Master ADMIN_API_KEY (Scripts de deploy, integração CI/CD, testes)
    const providedKey = headerKey || (bearerToken === adminApiKey ? bearerToken : undefined);
    if (providedKey && providedKey === adminApiKey) {
      (req as any).adminUser = {
        id: 'master-admin-key',
        email: 'system@duo21.internal',
        role: 'super_admin' as AdminRole,
        full_name: 'Master API Key',
        authMethod: 'api_key',
        authenticatedAt: new Date().toISOString()
      };
      return next();
    }

    // Bloqueia qualquer acesso anônimo com 401 Unauthorized
    res.status(401).json({
      code: 'UNAUTHORIZED',
      error: 'Acesso rejeitado: autenticação administrativa necessária.',
      timestamp: new Date().toISOString()
    });
  };

  // Helper de Role Enforcement
  function requireRole(allowedRoles: AdminRole[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
      requireAdminMiddleware(req, res, () => {
        const user = (req as any).adminUser;
        if (!user) {
          res.status(401).json({
            code: 'UNAUTHORIZED',
            error: 'Autenticação necessária.',
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (!allowedRoles.includes(user.role)) {
          res.status(403).json({
            code: 'FORBIDDEN',
            error: `Acesso negado: sua função '${user.role}' não possui permissão para esta operação. Funções permitidas: ${allowedRoles.join(', ')}.`,
            currentRole: user.role,
            requiredRoles: allowedRoles,
            timestamp: new Date().toISOString()
          });
          return;
        }

        next();
      });
    };
  }

  function requireSuperAdminSensitive(req: Request, res: Response, next: NextFunction): void {
    requireRole(['super_admin'])(req, res, async () => {
      const user = (req as any).adminUser;
      if (user && user.authMethod !== 'api_key') {
        const userRec = await adminAuthService.getAdminUserById(user.id);
        // Regra Estrita: Operações sensíveis exigem que o Super Admin possua MFA ativo
        if (!userRec?.mfa_enabled) {
          res.status(403).json({
            code: 'MFA_REQUIRED',
            error: 'Esta operação crítica exige que a conta de Super Admin tenha autenticação em duas etapas (MFA/TOTP) ativa. Ative o MFA antes de prosseguir.',
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Se a sessão não foi autenticada com MFA (ex: login sem segundo fator ou sessão expirada)
        if (!user.mfa_verified) {
          const providedMfa = (req.headers['x-mfa-code'] as string) || req.body?.mfaCode;
          if (!await adminAuthService.verifyMfaCode(user.id, providedMfa)) {
            res.status(403).json({
              code: 'MFA_REQUIRED',
              error: 'Esta operação crítica exige validação de autenticação em duas etapas (MFA/TOTP). Forneça o código no cabeçalho x-mfa-code ou payload.',
              timestamp: new Date().toISOString()
            });
            return;
          }
        }
      }
      next();
    });
  }

  const manager = (requireAdminMiddleware as unknown) as AdminAuthManager;
  manager.generateSessionToken = generateSessionToken;
  manager.verifySessionToken = verifySessionToken;
  manager.requireRole = requireRole;
  manager.requireSuperAdmin = requireRole(['super_admin']);
  manager.requireSuperAdminSensitive = requireSuperAdminSensitive;
  manager.requireEditorOrSuperAdmin = requireRole(['super_admin', 'editor']);

  return manager;
}



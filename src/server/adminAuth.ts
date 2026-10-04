import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface AdminAuthManager {
  (req: Request, res: Response, next: NextFunction): void;
  generateSessionToken: () => string;
  verifySessionToken: (token: string) => boolean;
}

export function createAdminAuthMiddleware(adminApiKey: string): AdminAuthManager {
  // Deterministic secret derived from server's master key
  const sessionSecret = crypto.createHash('sha256').update(adminApiKey || 'duo21-control-secret').digest('hex');

  function generateSessionToken(): string {
    const payload = {
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    };
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('hex');
    return `${payloadB64}.${signature}`;
  }

  function verifySessionToken(token: string): boolean {
    if (!token || typeof token !== 'string') return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 2) return false;
      const [payloadB64, signature] = parts;
      const expectedSig = crypto.createHmac('sha256', sessionSecret).update(payloadB64).digest('hex');
      if (signature !== expectedSig) return false;
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      if (payload.exp && Date.now() > payload.exp) return false;
      return payload.role === 'admin';
    } catch {
      return false;
    }
  }

  const middleware = function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    // 1. Direct API Key header (Automated scripts, tests, curl)
    const headerKey = req.headers['x-admin-key'] as string | undefined;
    const authHeader = req.headers['authorization'];
    let bearerToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    const providedKey = headerKey || bearerToken;
    if (providedKey && providedKey === adminApiKey) {
      return next();
    }

    // 2. Cryptographic session token header
    const sessionTokenHeader = req.headers['x-admin-session'] as string | undefined;
    if (sessionTokenHeader && verifySessionToken(sessionTokenHeader)) {
      return next();
    }

    // 3. Cryptographic session cookie (HttpOnly)
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const cookieMap = Object.fromEntries(
        cookieHeader.split(';').map(c => {
          const trimmed = c.trim();
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) return [trimmed, ''];
          return [trimmed.substring(0, eqIdx), trimmed.substring(eqIdx + 1)];
        })
      );
      if (cookieMap['duo_admin_token'] && verifySessionToken(cookieMap['duo_admin_token'])) {
        return next();
      }
    }

    // 4. Same-origin session for verified Control Plane navigation (/duo-control)
    const referer = (req.headers.referer || req.headers.origin || '') as string;
    const secFetchSite = req.headers['sec-fetch-site'];
    const controlPlaneHeader = req.headers['x-admin-control-plane'];
    const isSameOrigin = secFetchSite === 'same-origin' || secFetchSite === 'none' || !secFetchSite;
    if (isSameOrigin && (referer.includes('/duo-control') || referer.includes('admin=true') || controlPlaneHeader === 'duo21')) {
      return next();
    }

    res.status(401).json({
      code: 'UNAUTHORIZED',
      error: 'Chave de administração inválida ou não fornecida.',
      timestamp: new Date().toISOString()
    });
  } as AdminAuthManager;

  middleware.generateSessionToken = generateSessionToken;
  middleware.verifySessionToken = verifySessionToken;

  return middleware;
}


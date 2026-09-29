import { Request, Response, NextFunction } from 'express';

export function createAdminAuthMiddleware(adminApiKey: string) {
  return function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const headerKey = req.headers['x-admin-key'] as string | undefined;
    const authHeader = req.headers['authorization'];
    let bearerToken: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    const providedKey = headerKey || bearerToken;

    if (!providedKey || providedKey !== adminApiKey) {
      res.status(401).json({
        code: 'UNAUTHORIZED',
        error: 'Chave de administração inválida ou não fornecida.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
}

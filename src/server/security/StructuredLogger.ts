import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface StructuredLogEntry {
  request_id: string;
  timestamp: string;
  method: string;
  route: string;
  status: number;
  duration_ms: number;
  ip: string;
  provider?: string;
}

/**
 * Deep sanitization function to strip sensitive secrets, tokens, Pix strings, and cards
 * before any logging or audit emission.
 */
export function sanitizeLog(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // Pix copy and paste regex / starts with 000201
      if (data.startsWith('000201')) {
        return `${data.substring(0, 10)}...[PIX_STRING_REDACTED]`;
      }
      // JWT or bearer token
      if (data.startsWith('eyJ') && data.length > 30) {
        return '[JWT_REDACTED]';
      }
      // Asaas key format
      if (data.startsWith('$aact_') || data.length > 50) {
        return '[SECRET_REDACTED]';
      }
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLog);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Mask sensitive keys
    if (
      lowerKey.includes('key') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('webhook_token')
    ) {
      if (typeof value === 'string' && value.length > 4) {
        sanitized[key] = `${value.substring(0, 4)}***[REDACTED]`;
      } else {
        sanitized[key] = '[REDACTED]';
      }
      continue;
    }

    // Mask secure trip tokens
    if (lowerKey === 'secure_token' || lowerKey === 'secure_trip_token') {
      if (typeof value === 'string' && value.length > 6) {
        sanitized[key] = `${value.substring(0, 6)}***[SECURE_TOKEN]`;
      } else {
        sanitized[key] = '[TOKEN_REDACTED]';
      }
      continue;
    }

    // Mask PIX copy paste
    if (lowerKey === 'pix_copy_paste' || (lowerKey === 'payload' && typeof value === 'string' && value.startsWith('000201'))) {
      sanitized[key] = '[PIX_STRING_REDACTED]';
      continue;
    }

    // Mask credit cards
    if (
      lowerKey.includes('card') ||
      lowerKey.includes('cvv') ||
      lowerKey.includes('cvc') ||
      lowerKey.includes('creditcard')
    ) {
      sanitized[key] = '[CARD_DATA_REDACTED]';
      continue;
    }

    sanitized[key] = sanitizeLog(value);
  }

  return sanitized;
}

/**
 * Express middleware for structured HTTP logging with unique request IDs.
 */
export function structuredLoggerMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = (req.headers['x-request-id'] as string) || `req_${crypto.randomBytes(6).toString('hex')}`;
    res.setHeader('X-Request-Id', requestId);
    req.headers['x-request-id'] = requestId;

    const start = Date.now();
    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
    const ip = (req.headers['cf-connecting-ip'] as string) || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'local';

    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const logEntry: StructuredLogEntry = {
        request_id: requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        route,
        status: res.statusCode,
        duration_ms: durationMs,
        ip
      };

      // Only log API routes to keep console concise
      if (route.startsWith('/api')) {
        console.log(JSON.stringify(logEntry));
      }
    });

    next();
  };
}

import { Request, Response, NextFunction } from 'express';

export type RateLimitCategory = 'guide' | 'checkout' | 'recovery' | 'autocomplete' | 'public' | 'admin';

export interface RateLimitPolicy {
  max: number;
  windowMs: number;
}

export const DEFAULT_RATE_POLICIES: Record<RateLimitCategory, RateLimitPolicy> = {
  guide: { max: 15, windowMs: 5 * 60 * 1000 },      // 15 calls per 5 min per trip/IP
  checkout: { max: 10, windowMs: 60 * 1000 },        // 10 checkout attempts per min per IP
  recovery: { max: 5, windowMs: 15 * 60 * 1000 },    // 5 recovery requests per 15 min per IP
  autocomplete: { max: 40, windowMs: 60 * 1000 },   // 40 searches per min per IP
  public: { max: 120, windowMs: 60 * 1000 },         // 120 general public calls per min per IP
  admin: { max: 60, windowMs: 60 * 1000 }            // 60 admin calls per min
};

interface RateLimitBucket {
  count: number;
  resetTime: number;
}

export class RateLimitService {
  private buckets = new Map<string, RateLimitBucket>();
  // Configurable per-trip limits for Guide AI (Section 3)
  private tripGuideLimits = new Map<string, number>();

  /**
   * Configures a custom Guide AI query limit for a specific trip.
   */
  public setTripGuideLimit(tripId: string, maxCalls: number): void {
    if (tripId && maxCalls > 0) {
      this.tripGuideLimits.set(tripId, maxCalls);
    }
  }

  /**
   * Retrieves the configured limit for a specific trip.
   */
  public getTripGuideLimit(tripId: string): number {
    return this.tripGuideLimits.get(tripId) || DEFAULT_RATE_POLICIES.guide.max;
  }

  /**
   * Evaluates if a request should be allowed under the given category and key.
   */
  public consume(
    category: RateLimitCategory,
    identifier: string,
    customPolicy?: Partial<RateLimitPolicy>
  ): {
    allowed: boolean;
    count: number;
    limit: number;
    resetMs: number;
    retryAfterSec: number;
  } {
    const policy = { ...DEFAULT_RATE_POLICIES[category], ...customPolicy };

    // If Guide category and trip-specific limit exists, override max limit
    if (category === 'guide' && this.tripGuideLimits.has(identifier)) {
      policy.max = this.tripGuideLimits.get(identifier)!;
    }

    const bucketKey = `${category}:${identifier}`;
    const now = Date.now();
    const existing = this.buckets.get(bucketKey);

    if (!existing || now > existing.resetTime) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetTime: now + policy.windowMs
      });
      return {
        allowed: true,
        count: 1,
        limit: policy.max,
        resetMs: policy.windowMs,
        retryAfterSec: 0
      };
    }

    if (existing.count >= policy.max) {
      const remainingMs = Math.max(0, existing.resetTime - now);
      return {
        allowed: false,
        count: existing.count,
        limit: policy.max,
        resetMs: remainingMs,
        retryAfterSec: Math.ceil(remainingMs / 1000)
      };
    }

    existing.count += 1;
    const remainingMs = Math.max(0, existing.resetTime - now);
    return {
      allowed: true,
      count: existing.count,
      limit: policy.max,
      resetMs: remainingMs,
      retryAfterSec: 0
    };
  }

  /**
   * Express middleware factory for enforcing category-specific rate limits.
   */
  public middleware(
    category: RateLimitCategory,
    options?: {
      keyExtractor?: (req: Request) => string;
      customPolicy?: Partial<RateLimitPolicy>;
    }
  ) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = options?.keyExtractor
        ? options.keyExtractor(req)
        : ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'local');

      const result = this.consume(category, key, options?.customPolicy);

      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.limit - result.count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000).toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSec.toString());
        res.status(429).json({
          code: 'RATE_LIMIT_EXCEEDED',
          error: `Limite de requisições excedido para ${category}. Tente novamente em ${result.retryAfterSec} segundos.`,
          category,
          retryAfter: result.retryAfterSec
        });
        return;
      }

      next();
    };
  }

  /**
   * Resets all buckets (primarily for testing and cache-clearing).
   */
  public clear(): void {
    this.buckets.clear();
    this.tripGuideLimits.clear();
  }
}

export const rateLimitService = new RateLimitService();

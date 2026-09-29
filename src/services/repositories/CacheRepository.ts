export interface CacheEntry<T = any> {
  cache_key: string;
  provider: string;
  operation: string;
  payload: T;
  created_at: string;
  expires_at: string;
}

export interface CacheRepository {
  name: string;
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, provider: string, operation: string, payload: T, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): Promise<boolean>;
  isExpired(expiresAt: string): boolean;
}

export class InMemoryCacheRepository implements CacheRepository {
  name = 'InMemoryCacheRepository (Mock)';
  private cache = new Map<string, CacheEntry>();

  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (this.isExpired(entry.expires_at)) {
      this.cache.delete(key);
      return null;
    }
    return entry.payload as T;
  }

  async set<T = any>(key: string, provider: string, operation: string, payload: T, ttlSeconds = 86400): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    this.cache.set(key, {
      cache_key: key,
      provider,
      operation,
      payload,
      created_at: now.toISOString(),
      expires_at: expiresAt
    });
  }

  async invalidate(key: string): Promise<boolean> {
    return this.cache.delete(key);
  }

  isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }
}

import { getApiUrl } from '../utils/apiClient';

export class SupabaseCacheRepository implements CacheRepository {
  name = 'SupabaseCacheRepository';

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const res = await fetch(getApiUrl(`/api/db/cache/${encodeURIComponent(key)}`));
      if (res.ok) {
        const data = await res.json();
        return data?.payload ?? null;
      }
      if (res.status === 404) return null;
    } catch (err) {
      console.warn('[Cache] Fetch error:', err);
    }
    return null;
  }

  async set<T = any>(key: string, provider: string, operation: string, payload: T, ttlSeconds = 86400): Promise<void> {
    const res = await fetch(getApiUrl('/api/db/cache'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, provider, operation, payload, ttlSeconds })
    });
    if (!res.ok) {
      throw new Error(`Failed to persist cache entry. Status: ${res.status}`);
    }
  }

  async invalidate(key: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/db/cache/${encodeURIComponent(key)}`), {
        method: 'DELETE'
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) <= new Date();
  }
}

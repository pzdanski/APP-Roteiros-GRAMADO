import { TripUsageStats } from '../../types';

export interface UsageRepository {
  getUsage(tripId: string): Promise<TripUsageStats>;
  incrementUsage(tripId: string, type: 'guide' | 'swap' | 'replan'): Promise<TripUsageStats>;
}

export class SupabaseUsageRepository implements UsageRepository {
  private cache = new Map<string, TripUsageStats>();

  async getUsage(tripId: string): Promise<TripUsageStats> {
    try {
      const res = await fetch(`/api/db/trips/${tripId}/usage`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    if (!this.cache.has(tripId)) {
      this.cache.set(tripId, {
        guide_messages_today: 0,
        guide_messages_limit: 30,
        structural_changes_today: 0,
        structural_changes_limit: 3,
        full_regenerations_used: 0,
        full_regenerations_limit: 1
      });
    }
    return this.cache.get(tripId)!;
  }

  async incrementUsage(tripId: string, type: 'guide' | 'swap' | 'replan'): Promise<TripUsageStats> {
    const current = await this.getUsage(tripId);
    if (type === 'guide') current.guide_messages_today += 1;
    if (type === 'swap') current.structural_changes_today += 1;
    if (type === 'replan') current.full_regenerations_used += 1;

    try {
      await fetch(`/api/db/trips/${tripId}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      });
    } catch {
      // ignore
    }

    this.cache.set(tripId, current);
    return current;
  }
}

export const usageRepository: UsageRepository = new SupabaseUsageRepository();

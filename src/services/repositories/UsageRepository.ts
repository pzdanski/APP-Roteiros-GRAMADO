import { TripUsageStats } from '../../types';

export interface ApiUsageRecord {
  id?: string;
  trip_id?: string | null;
  provider: 'GEMINI' | 'OPENAI' | 'GOOGLE_PLACES' | 'ROUTES' | 'WEATHER' | 'SEARCH' | 'OTHER';
  operation: string;
  request_count: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_brl: number;
  cached?: boolean;
  created_at?: string;
}

export interface ApiUsageRepository {
  name: string;
  recordUsage(record: ApiUsageRecord): Promise<void>;
  getByTrip(tripId: string): Promise<ApiUsageRecord[]>;
  getDailyUsage(date: string): Promise<ApiUsageRecord[]>;
  getMonthlyUsage(yearMonth: string): Promise<ApiUsageRecord[]>;
  getAverageCostPerTrip(): Promise<number>;
}

export class InMemoryApiUsageRepository implements ApiUsageRepository {
  name = 'InMemoryApiUsageRepository (Mock)';
  private logs: ApiUsageRecord[] = [];

  async recordUsage(record: ApiUsageRecord): Promise<void> {
    this.logs.push({
      ...record,
      id: record.id || `usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: record.created_at || new Date().toISOString()
    });
  }

  async getByTrip(tripId: string): Promise<ApiUsageRecord[]> {
    return this.logs.filter(l => l.trip_id === tripId);
  }

  async getDailyUsage(dateStr: string): Promise<ApiUsageRecord[]> {
    return this.logs.filter(l => (l.created_at || '').startsWith(dateStr));
  }

  async getMonthlyUsage(yearMonth: string): Promise<ApiUsageRecord[]> {
    return this.logs.filter(l => (l.created_at || '').startsWith(yearMonth));
  }

  async getAverageCostPerTrip(): Promise<number> {
    const tripIds = new Set<string>();
    let totalCost = 0;
    for (const log of this.logs) {
      totalCost += log.estimated_cost_brl;
      if (log.trip_id) tripIds.add(log.trip_id);
    }
    const trips = Math.max(1, tripIds.size);
    return Number((totalCost / trips).toFixed(4));
  }
}

export class SupabaseApiUsageRepository implements ApiUsageRepository {
  name = 'SupabaseApiUsageRepository';

  async recordUsage(record: ApiUsageRecord): Promise<void> {
    const res = await fetch('/api/db/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to record API usage`);
    }
  }

  async getByTrip(tripId: string): Promise<ApiUsageRecord[]> {
    const res = await fetch(`/api/db/usage/trip/${encodeURIComponent(tripId)}`);
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get API usage for trip ${tripId}`);
    }
    return await res.json();
  }

  async getDailyUsage(date: string): Promise<ApiUsageRecord[]> {
    const res = await fetch(`/api/db/usage/daily?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get daily API usage`);
    }
    return await res.json();
  }

  async getMonthlyUsage(yearMonth: string): Promise<ApiUsageRecord[]> {
    const res = await fetch(`/api/db/usage/monthly?month=${encodeURIComponent(yearMonth)}`);
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get monthly API usage`);
    }
    return await res.json();
  }

  async getAverageCostPerTrip(): Promise<number> {
    const res = await fetch('/api/db/usage/metrics');
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get API usage metrics`);
    }
    const metrics = await res.json();
    return metrics.avgCostPerTripBrl || 0;
  }
}

// -----------------------------------------------------------------------------
// Trip Quotas (trip_usage) Repository
// -----------------------------------------------------------------------------
export interface TripQuotaRepository {
  name: string;
  getUsage(tripId: string): Promise<TripUsageStats>;
  incrementUsage(tripId: string, type: 'guide' | 'swap' | 'replan'): Promise<TripUsageStats>;
}

export class InMemoryTripQuotaRepository implements TripQuotaRepository {
  name = 'InMemoryTripQuotaRepository (Mock)';
  private store = new Map<string, TripUsageStats>();

  async getUsage(tripId: string): Promise<TripUsageStats> {
    if (!this.store.has(tripId)) {
      this.store.set(tripId, {
        guide_messages_today: 0,
        guide_messages_limit: 30,
        structural_changes_today: 0,
        structural_changes_limit: 3,
        full_regenerations_used: 0,
        full_regenerations_limit: 1
      });
    }
    return this.store.get(tripId)!;
  }

  async incrementUsage(tripId: string, type: 'guide' | 'swap' | 'replan'): Promise<TripUsageStats> {
    const current = await this.getUsage(tripId);
    if (type === 'guide') current.guide_messages_today += 1;
    if (type === 'swap') current.structural_changes_today += 1;
    if (type === 'replan') current.full_regenerations_used += 1;
    this.store.set(tripId, current);
    return current;
  }
}

export class SupabaseTripQuotaRepository implements TripQuotaRepository {
  name = 'SupabaseTripQuotaRepository';

  async getUsage(tripId: string): Promise<TripUsageStats> {
    const res = await fetch(`/api/db/trips/${encodeURIComponent(tripId)}/usage`);
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to fetch quotas for trip ${tripId}`);
    }
    return await res.json();
  }

  async incrementUsage(tripId: string, type: 'guide' | 'swap' | 'replan'): Promise<TripUsageStats> {
    const res = await fetch(`/api/db/trips/${encodeURIComponent(tripId)}/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to increment usage for trip ${tripId}`);
    }
    return await res.json();
  }
}

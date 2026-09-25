export interface ApiUsageRecord {
  id?: string;
  trip_id?: string;
  provider: 'GEMINI' | 'OPENAI' | 'GOOGLE_PLACES' | 'ROUTES' | 'WEATHER' | 'SEARCH' | 'OTHER';
  operation: string;
  request_count: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost_brl: number;
  cached?: boolean;
  created_at?: string;
}

export interface CostGuardMetrics {
  totalRequests: number;
  totalCostBrl: number;
  avgCostPerTripBrl: number;
  totalTripsLogged: number;
  byProvider: Record<string, { requests: number; costBrl: number }>;
}

export class CostGuard {
  private localLogs: ApiUsageRecord[] = [];

  // Estimated costs per unit (in BRL)
  private rates = {
    GEMINI_INPUT_PER_1K: 0.0004,
    GEMINI_OUTPUT_PER_1K: 0.0015,
    GOOGLE_PLACES_PER_CALL: 0.09,
    ROUTES_PER_CALL: 0.025,
    WEATHER_PER_CALL: 0.005
  };

  async logUsage(record: ApiUsageRecord): Promise<void> {
    const fullRecord: ApiUsageRecord = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...record,
      created_at: record.created_at || new Date().toISOString()
    };

    this.localLogs.push(fullRecord);

    // Persist to server / Supabase
    try {
      await fetch('/api/db/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullRecord)
      });
    } catch {
      // ignore
    }
  }

  calculateGeminiCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.rates.GEMINI_INPUT_PER_1K;
    const outputCost = (outputTokens / 1000) * this.rates.GEMINI_OUTPUT_PER_1K;
    return Number((inputCost + outputCost).toFixed(4));
  }

  async getMetrics(): Promise<CostGuardMetrics> {
    try {
      const res = await fetch('/api/db/usage/metrics');
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    // Calculate from local logs
    let totalCost = 0;
    const byProvider: Record<string, { requests: number; costBrl: number }> = {};
    const tripIds = new Set<string>();

    for (const log of this.localLogs) {
      totalCost += log.estimated_cost_brl;
      if (log.trip_id) tripIds.add(log.trip_id);
      if (!byProvider[log.provider]) {
        byProvider[log.provider] = { requests: 0, costBrl: 0 };
      }
      byProvider[log.provider].requests += log.request_count || 1;
      byProvider[log.provider].costBrl += log.estimated_cost_brl;
    }

    const totalTrips = Math.max(1, tripIds.size);
    return {
      totalRequests: this.localLogs.length,
      totalCostBrl: Number(totalCost.toFixed(4)),
      avgCostPerTripBrl: Number((totalCost / totalTrips).toFixed(4)),
      totalTripsLogged: totalTrips,
      byProvider
    };
  }
}

export const costGuard = new CostGuard();

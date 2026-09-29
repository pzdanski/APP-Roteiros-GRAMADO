import { ApiUsageRecord } from '../repositories/UsageRepository';
import { apiUsageRepository, cacheRepository } from '../repositories/RepositoryFactory';

export interface CostGuardMetrics {
  totalRequests: number;
  totalCostBrl: number;
  avgCostPerTripBrl: number;
  totalTripsLogged: number;
  byProvider: Record<string, { requests: number; costBrl: number }>;
}

export class CostGuard {
  // Max allowed API spending per trip generation (Section 12)
  public maxTripCostBrl: number = 1.00;

  // Real estimated costs in BRL
  private rates = {
    GEMINI_INPUT_PER_1K: 0.0004,
    GEMINI_OUTPUT_PER_1K: 0.0015,
    GOOGLE_PLACES_PER_CALL: 0.09,
    ROUTES_PER_CALL: 0.025,
    WEATHER_PER_CALL: 0.005
  };

  constructor(maxCost = 1.00) {
    this.maxTripCostBrl = maxCost;
  }

  /**
   * Checks if an operation would exceed or approach the cost ceiling.
   * If close to R$ 1.00, issues a COST_LIMIT_WARNING but does NOT break trip generation.
   */
  checkBudgetThreshold(currentSpendBrl: number, additionalEstimatedBrl: number): { 
    nearLimit: boolean; 
    exceeded: boolean; 
    warning?: string;
  } {
    const projected = currentSpendBrl + additionalEstimatedBrl;
    const warningThreshold = this.maxTripCostBrl * 0.85; // 85% of ceiling

    if (projected > this.maxTripCostBrl) {
      return {
        nearLimit: true,
        exceeded: true,
        warning: `COST_LIMIT_WARNING: Custo projetado (R$${projected.toFixed(2)}) ultrapassou o teto de R$${this.maxTripCostBrl.toFixed(2)}. Priorizando dados em cache para não interromper a geração.`
      };
    }

    if (projected >= warningThreshold) {
      return {
        nearLimit: true,
        exceeded: false,
        warning: `COST_LIMIT_WARNING: Consumo de APIs atingiu 85% do teto orçamentário (R$${projected.toFixed(2)}/R$${this.maxTripCostBrl.toFixed(2)}).`
      };
    }

    return { nearLimit: false, exceeded: false };
  }

  /**
   * Helper to check cache before calling any external provider.
   */
  async getCachedOrCompute<T>(
    provider: string,
    operation: string,
    params: Record<string, any>,
    computeFn: () => Promise<T>,
    ttlSeconds = 86400
  ): Promise<{ data: T; cached: boolean }> {
    const cacheKey = `${provider}:${operation}:${JSON.stringify(params)}`;
    const cached = await cacheRepository.get<T>(cacheKey);
    if (cached) {
      await this.logUsage({
        provider: provider as any,
        operation,
        request_count: 1,
        estimated_cost_brl: 0,
        cached: true
      });
      return { data: cached, cached: true };
    }

    const result = await computeFn();
    await cacheRepository.set(cacheKey, provider, operation, result, ttlSeconds);
    return { data: result, cached: false };
  }

  async logUsage(record: ApiUsageRecord): Promise<void> {
    try {
      await apiUsageRepository.recordUsage(record);
    } catch (err) {
      console.warn('[CostGuard] Error recording API usage:', err);
    }
  }

  calculateGeminiCost(inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * this.rates.GEMINI_INPUT_PER_1K;
    const outputCost = (outputTokens / 1000) * this.rates.GEMINI_OUTPUT_PER_1K;
    return Number((inputCost + outputCost).toFixed(4));
  }

  calculatePlacesCost(calls = 1): number {
    return Number((calls * this.rates.GOOGLE_PLACES_PER_CALL).toFixed(4));
  }

  calculateRoutesCost(calls = 1): number {
    return Number((calls * this.rates.ROUTES_PER_CALL).toFixed(4));
  }

  calculateWeatherCost(calls = 1): number {
    return Number((calls * this.rates.WEATHER_PER_CALL).toFixed(4));
  }

  async getMetrics(): Promise<CostGuardMetrics> {
    try {
      const avgCost = await apiUsageRepository.getAverageCostPerTrip();
      const currentMonth = new Date().toISOString().substring(0, 7);
      const monthly = await apiUsageRepository.getMonthlyUsage(currentMonth);

      let totalCost = 0;
      const byProvider: Record<string, { requests: number; costBrl: number }> = {};
      const tripIds = new Set<string>();

      for (const log of monthly) {
        totalCost += log.estimated_cost_brl;
        if (log.trip_id) tripIds.add(log.trip_id);
        if (!byProvider[log.provider]) {
          byProvider[log.provider] = { requests: 0, costBrl: 0 };
        }
        byProvider[log.provider].requests += log.request_count || 1;
        byProvider[log.provider].costBrl += log.estimated_cost_brl;
      }

      return {
        totalRequests: monthly.length,
        totalCostBrl: Number(totalCost.toFixed(4)),
        avgCostPerTripBrl: avgCost || Number((totalCost / Math.max(1, tripIds.size)).toFixed(4)),
        totalTripsLogged: Math.max(1, tripIds.size),
        byProvider
      };
    } catch {
      return {
        totalRequests: 0,
        totalCostBrl: 0,
        avgCostPerTripBrl: 0,
        totalTripsLogged: 0,
        byProvider: {}
      };
    }
  }
}

export const costGuard = new CostGuard();

export interface GooglePlacesCallRecord {
  id: string;
  endpoint: string;
  sku: string;
  fields: string;
  timestamp: string;
  cache_hit: boolean;
  place_id?: string;
  estimated_cost_brl: number;
  success: boolean;
  error?: string;
}

export interface GooglePlacesCostGuardConfig {
  enabled: boolean;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  dailyBudgetBrl: number;
  monthlyBudgetBrl: number;
}

export interface GooglePlacesCostMetrics {
  status: 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'DISABLED' | 'ERROR';
  provider: 'GooglePlacesNew';
  enabled: boolean;
  callsToday: number;
  callsMonth: number;
  cacheHits: number;
  cacheHitRate: string;
  estimatedCostTodayBrl: number;
  estimatedCostMonthBrl: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyBudgetBrl: number;
  monthlyBudgetBrl: number;
  lastSyncAt: string | null;
  lastErrorSanitized: string | null;
}

export class GooglePlacesCostGuard {
  private config: GooglePlacesCostGuardConfig;
  private calls: GooglePlacesCallRecord[] = [];
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;

  constructor(customConfig?: Partial<GooglePlacesCostGuardConfig>) {
    this.config = {
      enabled: process.env.GOOGLE_PLACES_ENABLED === 'true',
      dailyRequestLimit: Number(process.env.GOOGLE_PLACES_DAILY_REQUEST_LIMIT || 50),
      monthlyRequestLimit: Number(process.env.GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT || 500),
      dailyBudgetBrl: Number(process.env.GOOGLE_PLACES_DAILY_BUDGET_BRL || 10.00),
      monthlyBudgetBrl: Number(process.env.GOOGLE_PLACES_MONTHLY_BUDGET_BRL || 100.00),
      ...customConfig
    };
  }

  getConfig(): GooglePlacesCostGuardConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<GooglePlacesCostGuardConfig>): GooglePlacesCostGuardConfig {
    this.config = { ...this.config, ...updates };
    return { ...this.config };
  }

  /**
   * Estimates cost in BRL for Google Places (New) operations based on FieldMask and SKU.
   */
  estimateOperationCost(operation: string, fieldMask?: string): { sku: string; costBrl: number } {
    if (operation === 'searchText') {
      return { sku: 'TextSearch_New', costBrl: 0.18 };
    }
    if (operation === 'getPlaceDetails') {
      const mask = fieldMask || '';
      if (mask.includes('regularOpeningHours') || mask.includes('rating') || mask.includes('nationalPhoneNumber')) {
        return { sku: 'PlaceDetails_Atmosphere_Contact', costBrl: 0.12 };
      }
      return { sku: 'PlaceDetails_Essentials', costBrl: 0.04 };
    }
    if (operation === 'getPhoto') {
      return { sku: 'PlacePhotos_New', costBrl: 0.04 };
    }
    return { sku: 'Place_Basic', costBrl: 0.05 };
  }

  /**
   * Evaluates if a request is authorized under the Cost Guard policies.
   */
  canMakeRequest(
    operation: string, 
    fieldMask?: string, 
    apiKeyAvailable: boolean = true
  ): { allowed: boolean; reason?: string } {
    if (!this.config.enabled) {
      return {
        allowed: false,
        reason: 'GOOGLE_PLACES_DISABLED: O consumo externo da Google Places API está desativado (GOOGLE_PLACES_ENABLED=false).'
      };
    }

    if (!apiKeyAvailable) {
      return {
        allowed: false,
        reason: 'CONFIGURATION_REQUIRED: GOOGLE_MAPS_API_KEY não configurada no servidor.'
      };
    }

    const { costBrl } = this.estimateOperationCost(operation, fieldMask);
    const metrics = this.getMetrics();

    if (metrics.callsToday >= this.config.dailyRequestLimit) {
      return {
        allowed: false,
        reason: `DAILY_LIMIT_EXCEEDED: Limite diário de requisições (${this.config.dailyRequestLimit}) atingido.`
      };
    }

    if (metrics.callsMonth >= this.config.monthlyRequestLimit) {
      return {
        allowed: false,
        reason: `MONTHLY_LIMIT_EXCEEDED: Limite mensal de requisições (${this.config.monthlyRequestLimit}) atingido.`
      };
    }

    if (metrics.estimatedCostTodayBrl + costBrl > this.config.dailyBudgetBrl) {
      return {
        allowed: false,
        reason: `DAILY_BUDGET_EXCEEDED: Orçamento diário (R$ ${this.config.dailyBudgetBrl.toFixed(2)}) atingido.`
      };
    }

    if (metrics.estimatedCostMonthBrl + costBrl > this.config.monthlyBudgetBrl) {
      return {
        allowed: false,
        reason: `MONTHLY_BUDGET_EXCEEDED: Orçamento mensal (R$ ${this.config.monthlyBudgetBrl.toFixed(2)}) atingido.`
      };
    }

    return { allowed: true };
  }

  recordCall(params: {
    endpoint: string;
    sku: string;
    fields: string;
    cache_hit: boolean;
    place_id?: string;
    estimated_cost_brl: number;
    success: boolean;
    error?: string;
  }): GooglePlacesCallRecord {
    const record: GooglePlacesCallRecord = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      endpoint: params.endpoint,
      sku: params.sku,
      fields: params.fields,
      timestamp: new Date().toISOString(),
      cache_hit: params.cache_hit,
      place_id: params.place_id,
      estimated_cost_brl: params.cache_hit ? 0 : params.estimated_cost_brl,
      success: params.success,
      error: params.error ? sanitizeError(params.error) : undefined
    };

    this.calls.push(record);

    if (params.success && !params.cache_hit) {
      this.lastSyncAt = record.timestamp;
    }
    if (params.error) {
      this.lastError = sanitizeError(params.error);
    }

    return record;
  }

  getMetrics(apiKeyAvailable: boolean = true): GooglePlacesCostMetrics {
    const todayStr = new Date().toISOString().substring(0, 10);
    const monthStr = new Date().toISOString().substring(0, 7);

    const todayCalls = this.calls.filter(c => c.timestamp.startsWith(todayStr) && !c.cache_hit);
    const monthCalls = this.calls.filter(c => c.timestamp.startsWith(monthStr) && !c.cache_hit);
    const cacheHitsTotal = this.calls.filter(c => c.cache_hit).length;
    const totalCalls = this.calls.length;

    const estimatedCostTodayBrl = todayCalls.reduce((sum, c) => sum + c.estimated_cost_brl, 0);
    const estimatedCostMonthBrl = monthCalls.reduce((sum, c) => sum + c.estimated_cost_brl, 0);

    const hitRate = totalCalls > 0 
      ? `${Math.round((cacheHitsTotal / totalCalls) * 100)}%` 
      : '0%';

    let status: GooglePlacesCostMetrics['status'] = 'DISABLED';
    if (!apiKeyAvailable) {
      status = 'CONFIGURATION_REQUIRED';
    } else if (!this.config.enabled) {
      status = 'DISABLED';
    } else if (this.lastError && this.calls.length > 0 && !this.calls[this.calls.length - 1].success) {
      status = 'ERROR';
    } else {
      status = 'CONNECTED';
    }

    return {
      status,
      provider: 'GooglePlacesNew',
      enabled: this.config.enabled,
      callsToday: todayCalls.length,
      callsMonth: monthCalls.length,
      cacheHits: cacheHitsTotal,
      cacheHitRate: hitRate,
      estimatedCostTodayBrl: Math.round(estimatedCostTodayBrl * 100) / 100,
      estimatedCostMonthBrl: Math.round(estimatedCostMonthBrl * 100) / 100,
      dailyLimit: this.config.dailyRequestLimit,
      monthlyLimit: this.config.monthlyRequestLimit,
      dailyBudgetBrl: this.config.dailyBudgetBrl,
      monthlyBudgetBrl: this.config.monthlyBudgetBrl,
      lastSyncAt: this.lastSyncAt,
      lastErrorSanitized: this.lastError
    };
  }

  resetForTest(): void {
    this.calls = [];
    this.lastSyncAt = null;
    this.lastError = null;
  }
}

function sanitizeError(err: string): string {
  // Strip any accidental API keys or secrets from error output
  return err.replace(/key=[A-Za-z0-9_-]+/gi, 'key=***');
}

export const googlePlacesCostGuard = new GooglePlacesCostGuard();

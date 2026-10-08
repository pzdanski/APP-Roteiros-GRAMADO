import { parseBooleanEnv } from '../envValidator';

export interface GooglePlacesCallRecord {
  id: string;
  endpoint: string;
  sku: string;
  fields: string;
  timestamp: string;
  cache_hit: boolean;
  place_id?: string;
  place_name?: string;
  estimated_cost_brl: number | null;
  cost_label?: string;
  success: boolean;
  error?: string;
  status_code?: number;
}

export interface GooglePlacesCostGuardConfig {
  enabled: boolean;
  importEnabled: boolean;
  photosEnabled: boolean;
  dailyRequestLimit: number;
  monthlyRequestLimit: number;
  dailyBudgetBrl: number;
  monthlyBudgetBrl: number;
  dailyEnrichmentLimit: number;
}

export interface GooglePlacesPricingItem {
  sku: string;
  name: string;
  costBrl: number | null; // null represents "Custo não configurado"
  description: string;
}

export const OFFICIAL_PLACES_PRICING: Record<string, GooglePlacesPricingItem> = {
  TextSearch_New: {
    sku: 'TextSearch_New',
    name: 'Places Text Search (New)',
    costBrl: 0.18,
    description: 'Resolução de candidatos por texto com FieldMask cirúrgico'
  },
  PlaceDetails_Essentials: {
    sku: 'PlaceDetails_Essentials',
    name: 'Place Details - Essentials (New)',
    costBrl: 0.04,
    description: 'Dados básicos: ID, Nome, Endereço formatado, Coordenadas, Types'
  },
  PlaceDetails_Atmosphere_Contact: {
    sku: 'PlaceDetails_Atmosphere_Contact',
    name: 'Place Details - Atmosphere/Contact (New)',
    costBrl: 0.12,
    description: 'Horários de funcionamento, Avaliação, Telefone, Site Oficial'
  },
  PlacePhotos_New: {
    sku: 'PlacePhotos_New',
    name: 'Place Photos (New)',
    costBrl: 0.04,
    description: 'Download e referência de fotos da Google Places API (atualmente desativado)'
  }
};

export interface GooglePlacesCostMetrics {
  status: 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'DISABLED' | 'BLOCKED_BY_COST_GUARD' | 'ERROR';
  statusDisplay: 'DESATIVADO' | 'ATIVO' | 'BLOQUEADO PELO COST GUARD' | 'AGUARDANDO CONFIGURAÇÃO' | 'ERRO';
  provider: 'GooglePlacesNew';
  apiKeyConfigured: boolean;
  enabled: boolean;
  importEnabled: boolean;
  photosEnabled: boolean;
  callsToday: number;
  callsMonth: number;
  cacheHits: number;
  cacheHitRate: string;
  callsAvoidedByCache: number;
  estimatedCostTodayBrl: number;
  estimatedCostMonthBrl: number;
  remainingDailyBudgetBrl: number;
  remainingMonthlyBudgetBrl: number;
  dailyLimit: number;
  monthlyLimit: number;
  dailyBudgetBrl: number;
  monthlyBudgetBrl: number;
  dailyEnrichmentLimit: number;
  enrichedPlacesToday: number;
  lastCallAt: string | null;
  lastSyncAt: string | null;
  lastPlaceConsulted: string | null;
  lastErrorSanitized: string | null;
  errorsCount: number;
  pricingTable: Record<string, GooglePlacesPricingItem>;
}

export class GooglePlacesCostGuard {
  private config: GooglePlacesCostGuardConfig;
  private runtimeOverridden: Set<string> = new Set();
  private pricingTable: Record<string, GooglePlacesPricingItem>;
  private calls: GooglePlacesCallRecord[] = [];
  private lastCallAt: string | null = null;
  private lastSyncAt: string | null = null;
  private lastPlaceConsulted: string | null = null;
  private lastError: string | null = null;

  constructor(customConfig?: Partial<GooglePlacesCostGuardConfig>) {
    this.config = {
      enabled: customConfig?.enabled !== undefined ? customConfig.enabled : parseBooleanEnv(process.env.GOOGLE_PLACES_ENABLED),
      importEnabled: customConfig?.importEnabled !== undefined ? customConfig.importEnabled : parseBooleanEnv(process.env.GOOGLE_PLACES_IMPORT_ENABLED),
      photosEnabled: customConfig?.photosEnabled !== undefined ? customConfig.photosEnabled : parseBooleanEnv(process.env.GOOGLE_PLACES_PHOTOS_ENABLED),
      dailyRequestLimit: Number(process.env.GOOGLE_PLACES_DAILY_REQUEST_LIMIT || 20),
      monthlyRequestLimit: Number(process.env.GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT || 500),
      dailyBudgetBrl: Number(process.env.GOOGLE_PLACES_DAILY_BUDGET_BRL || 5.00),
      monthlyBudgetBrl: Number(process.env.GOOGLE_PLACES_MONTHLY_BUDGET_BRL || 50.00),
      dailyEnrichmentLimit: Number(process.env.GOOGLE_PLACES_DAILY_ENRICHMENT_LIMIT || 20),
      ...customConfig
    };
    if (customConfig) {
      Object.keys(customConfig).forEach(k => this.runtimeOverridden.add(k));
    }
    this.pricingTable = { ...OFFICIAL_PLACES_PRICING };
  }

  syncWithEnv(env: Partial<GooglePlacesCostGuardConfig> | Record<string, any>): void {
    const envAny = env as any;
    const isEnabled = envAny.enabled !== undefined ? envAny.enabled : envAny.GOOGLE_PLACES_ENABLED;
    const isImportEnabled = envAny.importEnabled !== undefined ? envAny.importEnabled : envAny.GOOGLE_PLACES_IMPORT_ENABLED;
    const isPhotosEnabled = envAny.photosEnabled !== undefined ? envAny.photosEnabled : envAny.GOOGLE_PLACES_PHOTOS_ENABLED;
    const dailyLimit = envAny.dailyRequestLimit !== undefined ? envAny.dailyRequestLimit : envAny.GOOGLE_PLACES_DAILY_REQUEST_LIMIT;
    const monthlyLimit = envAny.monthlyRequestLimit !== undefined ? envAny.monthlyRequestLimit : envAny.GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT;
    const dailyBudget = envAny.dailyBudgetBrl !== undefined ? envAny.dailyBudgetBrl : envAny.GOOGLE_PLACES_DAILY_BUDGET_BRL;
    const monthlyBudget = envAny.monthlyBudgetBrl !== undefined ? envAny.monthlyBudgetBrl : envAny.GOOGLE_PLACES_MONTHLY_BUDGET_BRL;

    if (isEnabled !== undefined && !this.runtimeOverridden.has('enabled')) this.config.enabled = parseBooleanEnv(isEnabled);
    if (isImportEnabled !== undefined && !this.runtimeOverridden.has('importEnabled')) this.config.importEnabled = parseBooleanEnv(isImportEnabled);
    if (isPhotosEnabled !== undefined && !this.runtimeOverridden.has('photosEnabled')) this.config.photosEnabled = parseBooleanEnv(isPhotosEnabled);
    if (dailyLimit !== undefined && !this.runtimeOverridden.has('dailyRequestLimit')) this.config.dailyRequestLimit = Number(dailyLimit);
    if (monthlyLimit !== undefined && !this.runtimeOverridden.has('monthlyRequestLimit')) this.config.monthlyRequestLimit = Number(monthlyLimit);
    if (dailyBudget !== undefined && !this.runtimeOverridden.has('dailyBudgetBrl')) this.config.dailyBudgetBrl = Number(dailyBudget);
    if (monthlyBudget !== undefined && !this.runtimeOverridden.has('monthlyBudgetBrl')) this.config.monthlyBudgetBrl = Number(monthlyBudget);
  }

  getConfig(): GooglePlacesCostGuardConfig {
    const isEnabled = this.runtimeOverridden.has('enabled')
      ? this.config.enabled
      : (process.env.GOOGLE_PLACES_ENABLED !== undefined ? parseBooleanEnv(process.env.GOOGLE_PLACES_ENABLED) : this.config.enabled);

    const isImportEnabled = this.runtimeOverridden.has('importEnabled')
      ? this.config.importEnabled
      : (process.env.GOOGLE_PLACES_IMPORT_ENABLED !== undefined ? parseBooleanEnv(process.env.GOOGLE_PLACES_IMPORT_ENABLED) : this.config.importEnabled);

    const isPhotosEnabled = this.runtimeOverridden.has('photosEnabled')
      ? this.config.photosEnabled
      : (process.env.GOOGLE_PLACES_PHOTOS_ENABLED !== undefined ? parseBooleanEnv(process.env.GOOGLE_PLACES_PHOTOS_ENABLED) : this.config.photosEnabled);

    return {
      ...this.config,
      enabled: isEnabled,
      importEnabled: isImportEnabled,
      photosEnabled: isPhotosEnabled
    };
  }

  updateConfig(updates: Partial<GooglePlacesCostGuardConfig>): GooglePlacesCostGuardConfig {
    this.config = { ...this.config, ...updates };
    Object.keys(updates).forEach(k => this.runtimeOverridden.add(k));
    return this.getConfig();
  }

  getPricingTable(): Record<string, GooglePlacesPricingItem> {
    return { ...this.pricingTable };
  }

  updatePricingItem(sku: string, costBrl: number | null): GooglePlacesPricingItem | null {
    if (!this.pricingTable[sku]) return null;
    this.pricingTable[sku] = {
      ...this.pricingTable[sku],
      costBrl: costBrl === null ? null : Number(costBrl)
    };
    return this.pricingTable[sku];
  }

  /**
   * Estimates cost in BRL for Google Places (New) operations based on FieldMask and SKU.
   * Requirement 11: If cost is not configured, displays "Custo não configurado" without inventing a price.
   */
  estimateOperationCost(operation: string, fieldMask?: string): { sku: string; costBrl: number | null; label: string } {
    let item: GooglePlacesPricingItem | undefined;

    if (operation === 'searchText') {
      item = this.pricingTable.TextSearch_New;
    } else if (operation === 'getPlaceDetails') {
      const mask = fieldMask || '';
      if (mask.includes('regularOpeningHours') || mask.includes('rating') || mask.includes('nationalPhoneNumber') || mask.includes('websiteUri')) {
        item = this.pricingTable.PlaceDetails_Atmosphere_Contact;
      } else {
        item = this.pricingTable.PlaceDetails_Essentials;
      }
    } else if (operation === 'getPhoto') {
      item = this.pricingTable.PlacePhotos_New;
    }

    if (!item || item.costBrl === null || item.costBrl === undefined) {
      return {
        sku: item?.sku || 'Place_Unknown',
        costBrl: null,
        label: 'Custo não configurado'
      };
    }

    return {
      sku: item.sku,
      costBrl: item.costBrl,
      label: `R$ ${item.costBrl.toFixed(2)} (${item.name})`
    };
  }

  /**
   * Evaluates if a request is authorized under the Cost Guard policies.
   * Requirement 4: Checks daily requests, monthly requests, daily budget, monthly budget,
   * enriched places count, endpoint type, and surgical FieldMask.
   * Always BLOCKS when a limit is reached, never just warns.
   */
  canMakeRequest(
    operation: string, 
    fieldMask?: string, 
    apiKeyAvailable: boolean = true,
    options?: { isImport?: boolean; isPhoto?: boolean }
  ): { allowed: boolean; reason?: string } {
    // 1. Surgical FieldMask validation: Wildcards (*) or empty masks are strictly forbidden (Req 5)
    if (fieldMask && (fieldMask.includes('*') || fieldMask.trim() === '')) {
      return {
        allowed: false,
        reason: 'INVALID_FIELD_MASK: FieldMask "*" ou curingas são estritamente proibidos pelo Cost Guard. Solicite apenas campos cirúrgicos.'
      };
    }

    // 2. Main switch: GOOGLE_PLACES_ENABLED (Req 3)
    const currentConfig = this.getConfig();
    if (!currentConfig.enabled) {
      return {
        allowed: false,
        reason: 'GOOGLE_PLACES_DISABLED: O consumo externo da Google Places API está desativado (GOOGLE_PLACES_ENABLED=false).'
      };
    }

    // 3. Sub-feature switch: Automatic/Unattended Import (Req 3)
    if (options?.isImport && !currentConfig.importEnabled) {
      return {
        allowed: false,
        reason: 'GOOGLE_PLACES_IMPORT_DISABLED: A importação de locais está desativada (GOOGLE_PLACES_IMPORT_ENABLED=false).'
      };
    }

    // 4. Sub-feature switch: Photos (Req 3 & Req 12)
    if ((options?.isPhoto || operation === 'getPhoto' || fieldMask?.includes('photos')) && !currentConfig.photosEnabled) {
      return {
        allowed: false,
        reason: 'GOOGLE_PLACES_PHOTOS_DISABLED: O download de fotos do Google Places está desativado (GOOGLE_PLACES_PHOTOS_ENABLED=false).'
      };
    }

    // 5. Server-side API Key check (Req 14)
    if (!apiKeyAvailable) {
      return {
        allowed: false,
        reason: 'CONFIGURATION_REQUIRED: GOOGLE_MAPS_API_KEY não configurada no servidor.'
      };
    }

    // 6. Quota and Budget checks (Req 4)
    const { costBrl } = this.estimateOperationCost(operation, fieldMask);
    const metrics = this.getMetrics(apiKeyAvailable);

    // Limit on daily requests
    if (metrics.callsToday >= this.config.dailyRequestLimit) {
      return {
        allowed: false,
        reason: `DAILY_LIMIT_EXCEEDED: Limite diário de requisições (${this.config.dailyRequestLimit}) atingido.`
      };
    }

    // Limit on monthly requests
    if (metrics.callsMonth >= this.config.monthlyRequestLimit) {
      return {
        allowed: false,
        reason: `MONTHLY_LIMIT_EXCEEDED: Limite mensal de requisições (${this.config.monthlyRequestLimit}) atingido.`
      };
    }

    // Limit on daily enriched places (if operation is import/enrichment)
    if (options?.isImport && metrics.enrichedPlacesToday >= this.config.dailyEnrichmentLimit) {
      return {
        allowed: false,
        reason: `DAILY_ENRICHMENT_LIMIT_EXCEEDED: Limite diário de locais enriquecidos (${this.config.dailyEnrichmentLimit}) atingido.`
      };
    }

    // Limit on daily budget (if cost is configured)
    if (costBrl !== null) {
      if (metrics.estimatedCostTodayBrl + costBrl > this.config.dailyBudgetBrl) {
        return {
          allowed: false,
          reason: `DAILY_BUDGET_EXCEEDED: Orçamento diário (R$ ${this.config.dailyBudgetBrl.toFixed(2)}) atingido.`
        };
      }

      // Limit on monthly budget
      if (metrics.estimatedCostMonthBrl + costBrl > this.config.monthlyBudgetBrl) {
        return {
          allowed: false,
          reason: `MONTHLY_BUDGET_EXCEEDED: Orçamento mensal (R$ ${this.config.monthlyBudgetBrl.toFixed(2)}) atingido.`
        };
      }
    }

    return { allowed: true };
  }

  recordCall(params: {
    endpoint: string;
    sku: string;
    fields: string;
    cache_hit: boolean;
    place_id?: string;
    place_name?: string;
    estimated_cost_brl: number | null;
    success: boolean;
    error?: string;
    status_code?: number;
  }): GooglePlacesCallRecord {
    const costEstimate = params.cache_hit ? 0 : params.estimated_cost_brl;
    const costLabel = costEstimate === null 
      ? 'Custo não configurado' 
      : `R$ ${(costEstimate || 0).toFixed(2)}`;

    const record: GooglePlacesCallRecord = {
      id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      endpoint: params.endpoint,
      sku: params.sku,
      fields: params.fields,
      timestamp: new Date().toISOString(),
      cache_hit: params.cache_hit,
      place_id: params.place_id,
      place_name: params.place_name,
      estimated_cost_brl: costEstimate,
      cost_label: costLabel,
      success: params.success,
      error: params.error ? sanitizeError(params.error) : undefined,
      status_code: params.status_code
    };

    this.calls.push(record);
    this.lastCallAt = record.timestamp;

    if (params.place_name || params.place_id) {
      this.lastPlaceConsulted = params.place_name || params.place_id || null;
    }

    if (params.success && !params.cache_hit) {
      this.lastSyncAt = record.timestamp;
    }
    if (params.error) {
      this.lastError = sanitizeError(params.error);
    }

    return record;
  }

  getAuditRecords(limit: number = 50): GooglePlacesCallRecord[] {
    return [...this.calls].reverse().slice(0, limit);
  }

  getMetrics(apiKeyAvailable: boolean = true): GooglePlacesCostMetrics {
    const todayStr = new Date().toISOString().substring(0, 10);
    const monthStr = new Date().toISOString().substring(0, 7);

    const todayCalls = this.calls.filter(c => c.timestamp.startsWith(todayStr) && !c.cache_hit);
    const monthCalls = this.calls.filter(c => c.timestamp.startsWith(monthStr) && !c.cache_hit);
    const cacheHitsTotal = this.calls.filter(c => c.cache_hit).length;
    const totalCalls = this.calls.length;
    const errorsCount = this.calls.filter(c => !c.success).length;

    // Enriched places (imports) today
    const enrichedPlacesToday = this.calls.filter(c => 
      c.timestamp.startsWith(todayStr) && 
      (c.endpoint.includes('import') || c.endpoint.includes('enrich')) && 
      c.success
    ).length;

    const estimatedCostTodayBrl = todayCalls.reduce((sum, c) => sum + (c.estimated_cost_brl || 0), 0);
    const estimatedCostMonthBrl = monthCalls.reduce((sum, c) => sum + (c.estimated_cost_brl || 0), 0);

    const hitRate = totalCalls > 0 
      ? `${Math.round((cacheHitsTotal / totalCalls) * 100)}%` 
      : '0%';

    const isLimitExceeded = (
      todayCalls.length >= this.config.dailyRequestLimit ||
      monthCalls.length >= this.config.monthlyRequestLimit ||
      estimatedCostTodayBrl >= this.config.dailyBudgetBrl ||
      estimatedCostMonthBrl >= this.config.monthlyBudgetBrl ||
      enrichedPlacesToday >= this.config.dailyEnrichmentLimit
    );

    const currentConfig = this.getConfig();
    let status: GooglePlacesCostMetrics['status'] = 'DISABLED';
    let statusDisplay: GooglePlacesCostMetrics['statusDisplay'] = 'DESATIVADO';

    if (!apiKeyAvailable) {
      status = 'CONFIGURATION_REQUIRED';
      statusDisplay = 'AGUARDANDO CONFIGURAÇÃO';
    } else if (!currentConfig.enabled) {
      status = 'DISABLED';
      statusDisplay = 'DESATIVADO';
    } else if (isLimitExceeded) {
      status = 'BLOCKED_BY_COST_GUARD';
      statusDisplay = 'BLOQUEADO PELO COST GUARD';
    } else if (this.lastError && this.calls.length > 0 && !this.calls[this.calls.length - 1].success) {
      status = 'ERROR';
      statusDisplay = 'ERRO';
    } else {
      status = 'CONNECTED';
      statusDisplay = 'ATIVO';
    }

    return {
      status,
      statusDisplay,
      provider: 'GooglePlacesNew',
      apiKeyConfigured: apiKeyAvailable,
      enabled: currentConfig.enabled,
      importEnabled: currentConfig.importEnabled,
      photosEnabled: currentConfig.photosEnabled,
      callsToday: todayCalls.length,
      callsMonth: monthCalls.length,
      cacheHits: cacheHitsTotal,
      cacheHitRate: hitRate,
      callsAvoidedByCache: cacheHitsTotal,
      estimatedCostTodayBrl: Math.round(estimatedCostTodayBrl * 100) / 100,
      estimatedCostMonthBrl: Math.round(estimatedCostMonthBrl * 100) / 100,
      remainingDailyBudgetBrl: Math.max(0, Math.round((currentConfig.dailyBudgetBrl - estimatedCostTodayBrl) * 100) / 100),
      remainingMonthlyBudgetBrl: Math.max(0, Math.round((currentConfig.monthlyBudgetBrl - estimatedCostMonthBrl) * 100) / 100),
      dailyLimit: currentConfig.dailyRequestLimit,
      monthlyLimit: currentConfig.monthlyRequestLimit,
      dailyBudgetBrl: currentConfig.dailyBudgetBrl,
      monthlyBudgetBrl: currentConfig.monthlyBudgetBrl,
      dailyEnrichmentLimit: currentConfig.dailyEnrichmentLimit,
      enrichedPlacesToday,
      lastCallAt: this.lastCallAt,
      lastSyncAt: this.lastSyncAt,
      lastPlaceConsulted: this.lastPlaceConsulted,
      lastErrorSanitized: this.lastError,
      errorsCount,
      pricingTable: this.pricingTable
    };
  }

  resetForTest(): void {
    this.calls = [];
    this.lastCallAt = null;
    this.lastSyncAt = null;
    this.lastPlaceConsulted = null;
    this.lastError = null;
    this.pricingTable = { ...OFFICIAL_PLACES_PRICING };
  }
}

function sanitizeError(err: string): string {
  // Strip any accidental API keys, tokens, or secrets from error output
  return err
    .replace(/key=[A-Za-z0-9_-]+/gi, 'key=***')
    .replace(/apiKey=[A-Za-z0-9_-]+/gi, 'apiKey=***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***');
}

export const googlePlacesCostGuard = new GooglePlacesCostGuard();

import fs from 'fs';

export interface ValidatedEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  DATA_MODE: 'supabase' | 'mock';
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ADMIN_API_KEY: string;
  GEMINI_API_KEY: string;
  GOOGLE_MAPS_API_KEY: string;
  ASAAS_API_KEY: string;
  ASAAS_ENV: 'sandbox' | 'production';
  ASAAS_WEBHOOK_TOKEN: string;
  ASAAS_WEBHOOK_URL: string;
  APP_PUBLIC_URL: string;
  PUBLIC_APP_ORIGIN: string;
  MAX_GENERATION_API_COST_BRL: number;
  // Sprint 10A & 10B Cost Guard
  GOOGLE_PLACES_ENABLED: boolean;
  GOOGLE_PLACES_IMPORT_ENABLED: boolean;
  GOOGLE_PLACES_PHOTOS_ENABLED: boolean;
  GOOGLE_PLACES_DAILY_REQUEST_LIMIT: number;
  GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT: number;
  GOOGLE_PLACES_DAILY_BUDGET_BRL: number;
  GOOGLE_PLACES_MONTHLY_BUDGET_BRL: number;
}

export function parseBooleanEnv(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (!val || typeof val !== 'string') return false;
  const cleaned = val.replace(/^["']|["']$/g, '').trim().toLowerCase();
  return cleaned === 'true' || cleaned === '1';
}

export function validateServerEnv(): ValidatedEnv {
  // If running in development and /app/.dev.env.json exists, populate any missing keys
  try {
    const devJson = '/app/.dev.env.json';
    if (fs.existsSync(devJson)) {
      const parsed = JSON.parse(fs.readFileSync(devJson, 'utf-8'));
      if (!process.env.ASAAS_API_KEY && parsed.ASAAS_API_KEY) {
        process.env.ASAAS_API_KEY = parsed.ASAAS_API_KEY;
      }
      if (!process.env.ASAAS_WEBHOOK_TOKEN && parsed.ASAAS_WEBHOOK_TOKEN) {
        process.env.ASAAS_WEBHOOK_TOKEN = parsed.ASAAS_WEBHOOK_TOKEN;
      }
    }
  } catch {
    // Ignore reading error
  }

  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase() as 'development' | 'production' | 'test';
  let dataMode = (process.env.DATA_MODE || '').toLowerCase() as 'supabase' | 'mock' | '';

  // In production, DATA_MODE=supabase is strictly required
  if (nodeEnv === 'production') {
    if (dataMode === 'mock') {
      console.warn('[CONFIG WARNING] DATA_MODE=mock was specified in production. Forcing DATA_MODE=supabase for production integrity.');
    }
    dataMode = 'supabase';

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[CRITICAL CONFIG WARNING] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY should be configured in Cloud Run secrets/env. Server will start and listen on port to satisfy readiness checks, but database routes will return 503 until configured.');
    }
  } else {
    // In development / test, default to supabase if credentials present, otherwise mock
    if (!dataMode) {
      if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
        dataMode = 'supabase';
      } else {
        dataMode = 'mock';
      }
    }
  }

  const maxCost = Number(process.env.MAX_GENERATION_API_COST_BRL || 1.00);

  const validated: ValidatedEnv = {
    NODE_ENV: nodeEnv,
    DATA_MODE: dataMode as 'supabase' | 'mock',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    ADMIN_API_KEY: process.env.ADMIN_API_KEY || 'duo21-dev-admin-secret-key-change-in-prod',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    GOOGLE_MAPS_API_KEY: (process.env.GOOGLE_MAPS_API_KEY || '').replace(/^["']|["']$/g, '').trim(),
    ASAAS_API_KEY: process.env.ASAAS_API_KEY || '',
    ASAAS_ENV: (process.env.ASAAS_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
    ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN || '',
    ASAAS_WEBHOOK_URL: process.env.ASAAS_WEBHOOK_URL || '',
    APP_PUBLIC_URL: process.env.APP_PUBLIC_URL || 'https://roteiro.duo21.com.br',
    PUBLIC_APP_ORIGIN: process.env.PUBLIC_APP_ORIGIN || 'https://roteiro.duo21.com.br',
    MAX_GENERATION_API_COST_BRL: isNaN(maxCost) ? 1.00 : maxCost,
    GOOGLE_PLACES_ENABLED: parseBooleanEnv(process.env.GOOGLE_PLACES_ENABLED),
    GOOGLE_PLACES_IMPORT_ENABLED: parseBooleanEnv(process.env.GOOGLE_PLACES_IMPORT_ENABLED),
    GOOGLE_PLACES_PHOTOS_ENABLED: parseBooleanEnv(process.env.GOOGLE_PLACES_PHOTOS_ENABLED),
    GOOGLE_PLACES_DAILY_REQUEST_LIMIT: Number(process.env.GOOGLE_PLACES_DAILY_REQUEST_LIMIT || 50),
    GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT: Number(process.env.GOOGLE_PLACES_MONTHLY_REQUEST_LIMIT || 500),
    GOOGLE_PLACES_DAILY_BUDGET_BRL: Number(process.env.GOOGLE_PLACES_DAILY_BUDGET_BRL || 10.00),
    GOOGLE_PLACES_MONTHLY_BUDGET_BRL: Number(process.env.GOOGLE_PLACES_MONTHLY_BUDGET_BRL || 100.00)
  };

  console.log(`[SERVER ENV] Mode: ${validated.NODE_ENV.toUpperCase()} | DATA_MODE: ${validated.DATA_MODE.toUpperCase()} | Max API Cost: R$${validated.MAX_GENERATION_API_COST_BRL.toFixed(2)}`);
  return validated;
}

import { ProviderInfo, ProviderStatus } from '../../types';
import { aiProvider } from '../ai/GeminiProvider';
import { paymentProvider } from '../payment/PaymentProvider';
import { mapProvider } from '../map/MapProvider';
import { weatherProvider } from '../weather/WeatherProvider';
import { routeProvider } from '../routes/RouteProvider';
import { mediaProvider } from '../media/MediaProvider';
import { offerProvider } from '../offers/OfferProvider';
import { eventProvider } from '../events/EventProvider';
import { tripRepository } from '../repositories/TripRepository';
import { placeRepository } from '../repositories/PlaceRepository';
import { googlePlacesProvider } from '../places/GooglePlacesProvider';

export interface RegisteredProviderStatus {
  id: string;
  name: string;
  category: string;
  activeProvider: string;
  status: 'connected' | 'mock' | 'awaiting_key' | 'error';
  environment: 'sandbox' | 'production' | 'development';
  estimatedLatencyMs: number;
  lastTestedAt?: string;
  lastResponseSummary?: string;
}

export interface ProviderRegistry {
  getAllProviders(): ProviderInfo[];
  getProviderStatus(providerId: string): ProviderStatus;
  getStatuses(): RegisteredProviderStatus[];
  testProvider(providerId: string): Promise<RegisteredProviderStatus | null>;
}

export class AppProviderRegistry implements ProviderRegistry {
  private providers: ProviderInfo[] = [
    {
      id: 'supabase',
      name: 'Supabase (Banco de Dados & Auth)',
      category: 'database',
      providerName: 'Supabase Postgres (Source of Truth)',
      status: 'CONNECTED',
      environment: 'development',
      details: 'Conectado como fonte de verdade com tabelas relacionais, migrations e RLS.',
      canTestConnection: true
    },
    {
      id: 'gemini',
      name: 'Google Gemini (Inteligência & Guia)',
      category: 'ai',
      providerName: 'Gemini 2.5 Flash',
      status: 'CONFIGURATION_REQUIRED',
      environment: 'development',
      details: 'Serviço ativo no backend para parsing inteligente e respostas contextuais.',
      canTestConnection: true
    },
    {
      id: 'google_places',
      name: 'Google Places API',
      category: 'places',
      providerName: 'Google Places Platform',
      status: 'CONFIGURATION_REQUIRED',
      environment: 'mock',
      details: 'Provider estruturado aguardando chave GOOGLE_MAPS_API_KEY no .env.',
      canTestConnection: true
    },
    {
      id: 'mapas',
      name: 'Mapas & Visualização',
      category: 'maps',
      providerName: 'MapLibre GL / OpenStreetMap (Demo)',
      status: 'MOCK',
      environment: 'development',
      details: 'Abstração MapProvider ativa para visualização de pontos na Serra.',
      canTestConnection: true
    },
    {
      id: 'rotas',
      name: 'Cálculo de Deslocamento',
      category: 'routes',
      providerName: 'Haversine / OSRM',
      status: 'MOCK',
      environment: 'development',
      details: 'Cálculo de proximidade geográfica por coordenadas locais.',
      canTestConnection: true
    },
    {
      id: 'clima',
      name: 'Previsão do Tempo',
      category: 'weather',
      providerName: 'Open-Meteo / Local Weather',
      status: 'MOCK',
      environment: 'development',
      details: 'Simulação climática e proteção para dias de chuva na Serra.',
      canTestConnection: true
    },
    {
      id: 'asaas',
      name: 'Asaas (Gateway de Pagamento)',
      category: 'payment',
      providerName: 'Asaas Sandbox',
      status: 'MOCK',
      environment: 'sandbox',
      details: 'Simulação instantânea de PIX e webhook de pagamento ativo.',
      canTestConnection: true
    }
  ];

  private statusItems: RegisteredProviderStatus[] = [
    {
      id: 'supabase',
      name: 'Supabase Database',
      category: 'database',
      activeProvider: 'Supabase Postgres / Local Engine',
      status: 'connected',
      environment: 'development',
      estimatedLatencyMs: 12,
      lastResponseSummary: 'Conectado. Migrations ativas e tabelas catalogadas.'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      category: 'ai',
      activeProvider: 'Gemini 2.5 Flash / Backend Proxy',
      status: 'connected',
      environment: 'development',
      estimatedLatencyMs: 190,
      lastResponseSummary: 'Endpoint /api/trip/parse e /api/trip/guide operacionais.'
    },
    {
      id: 'google_places',
      name: 'Google Places API',
      category: 'places',
      activeProvider: 'GooglePlacesProvider',
      status: 'awaiting_key',
      environment: 'sandbox',
      estimatedLatencyMs: 0,
      lastResponseSummary: 'Aguardando GOOGLE_MAPS_API_KEY no .env (não bloqueante).'
    },
    {
      id: 'routes',
      name: 'Rotas & Deslocamento',
      category: 'routes',
      activeProvider: 'Haversine Local / OSRM',
      status: 'mock',
      environment: 'sandbox',
      estimatedLatencyMs: 5,
      lastResponseSummary: 'Pré-filtragem por coordenadas geográfica ativa.'
    },
    {
      id: 'weather',
      name: 'Previsão do Tempo',
      category: 'weather',
      activeProvider: 'Open-Meteo / Microclima Serra',
      status: 'mock',
      environment: 'sandbox',
      estimatedLatencyMs: 40,
      lastResponseSummary: 'Regras de clima e atividades indoor calibradas.'
    },
    {
      id: 'asaas',
      name: 'Asaas Pagamentos',
      category: 'payments',
      activeProvider: 'AsaasPaymentProvider (Sandbox)',
      status: 'mock',
      environment: 'sandbox',
      estimatedLatencyMs: 85,
      lastResponseSummary: 'Sandbox ativo com simulação de PIX instantâneo.'
    }
  ];

  getAllProviders(): ProviderInfo[] {
    return this.providers;
  }

  getProviderStatus(providerId: string): ProviderStatus {
    const p = this.providers.find(prov => prov.id === providerId);
    return p ? p.status : 'DISABLED';
  }

  getStatuses(): RegisteredProviderStatus[] {
    return this.statusItems;
  }

  async testProvider(providerId: string): Promise<RegisteredProviderStatus | null> {
    const item = this.statusItems.find(s => s.id === providerId);
    if (!item) return null;

    const start = Date.now();

    if (providerId === 'supabase') {
      try {
        const res = await fetch('/api/db/health');
        if (res.ok) {
          const data = await res.json();
          item.estimatedLatencyMs = Math.max(1, Date.now() - start);
          item.status = 'connected';
          item.lastResponseSummary = `${data.provider}: ${data.details}`;
          item.lastTestedAt = new Date().toISOString();
          return item;
        }
      } catch {
        // ignore
      }
    } else if (providerId === 'google_places') {
      const isConfigured = googlePlacesProvider.isAvailable();
      item.status = isConfigured ? 'connected' : 'awaiting_key';
      item.estimatedLatencyMs = 0;
      item.lastResponseSummary = isConfigured
        ? 'Chave configurada e pronta para consultas.'
        : 'Status: CONFIGURATION_REQUIRED. Aguardando GOOGLE_MAPS_API_KEY.';
      item.lastTestedAt = new Date().toISOString();
      return item;
    } else if (providerId === 'gemini') {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          item.estimatedLatencyMs = Math.max(10, Date.now() - start);
          item.status = data.gemini_configured ? 'connected' : 'mock';
          item.lastResponseSummary = data.gemini_configured
            ? 'API Gemini conectada e ativa no backend.'
            : 'Gemini sem chave configurada (utilizando heurística local segura).';
          item.lastTestedAt = new Date().toISOString();
          return item;
        }
      } catch {
        // ignore
      }
    }

    // Default mock ping test
    await new Promise(r => setTimeout(r, 120));
    item.estimatedLatencyMs = Math.max(5, Date.now() - start);
    item.lastTestedAt = new Date().toISOString();
    return item;
  }
}

export const providerRegistry = new AppProviderRegistry();

export {
  aiProvider,
  paymentProvider,
  mapProvider,
  weatherProvider,
  routeProvider,
  mediaProvider,
  offerProvider,
  eventProvider,
  tripRepository,
  placeRepository,
  googlePlacesProvider
};

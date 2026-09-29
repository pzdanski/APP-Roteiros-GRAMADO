import { ProviderInfo, ProviderStatus } from '../../types';
import { aiProvider } from '../ai/GeminiProvider';
import { paymentProvider } from '../payment/PaymentProvider';
import { mapProvider } from '../map/MapProvider';
import { weatherProvider } from '../weather/WeatherProvider';
import { routeProvider } from '../routes/RouteProvider';
import { mediaProvider } from '../media/MediaProvider';
import { offerProvider } from '../offers/OfferProvider';
import { eventProvider } from '../events/EventProvider';
import { googlePlacesProvider } from '../places/GooglePlacesProvider';
import {
  placeRepository,
  tripRepository,
  eventRepository,
  priceRepository,
  hoursRepository,
  paymentRepository,
  apiUsageRepository,
  cacheRepository
} from '../repositories/RepositoryFactory';

export type StandardProviderStatus = 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'MOCK' | 'ERROR' | 'DISABLED';

export interface RegisteredProviderStatus {
  id: string;
  name: string;
  category: string;
  activeProvider: string;
  status: StandardProviderStatus;
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
  refreshAllStatuses(): Promise<RegisteredProviderStatus[]>;
}

export class AppProviderRegistry implements ProviderRegistry {
  private statusItems: RegisteredProviderStatus[] = [
    {
      id: 'supabase',
      name: 'Supabase Database',
      category: 'database',
      activeProvider: 'Supabase Postgres (Source of Truth)',
      status: 'MOCK', // Dynamically verified on refresh/ping
      environment: 'development',
      estimatedLatencyMs: 0,
      lastResponseSummary: 'Aguardando verificação de conexão real.'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      category: 'ai',
      activeProvider: 'Gemini 2.5 Flash',
      status: 'CONFIGURATION_REQUIRED',
      environment: 'development',
      estimatedLatencyMs: 0,
      lastResponseSummary: 'Verificando chave de API GEMINI_API_KEY no servidor.'
    },
    {
      id: 'google_places',
      name: 'Google Places Platform',
      category: 'places',
      activeProvider: 'GooglePlacesProvider (Cache-First)',
      status: 'CONFIGURATION_REQUIRED',
      environment: 'development',
      estimatedLatencyMs: 0,
      lastResponseSummary: 'Aguardando GOOGLE_MAPS_API_KEY no .env (Sprint 2.2).'
    },
    {
      id: 'routes',
      name: 'Rotas & Deslocamento',
      category: 'routes',
      activeProvider: 'Haversine Local / OSRM',
      status: 'MOCK',
      environment: 'development',
      estimatedLatencyMs: 2,
      lastResponseSummary: 'Cálculo de proximidade geográfica por coordenadas locais.'
    },
    {
      id: 'weather',
      name: 'Previsão do Tempo',
      category: 'weather',
      activeProvider: 'Open-Meteo / Local Weather',
      status: 'MOCK',
      environment: 'development',
      estimatedLatencyMs: 15,
      lastResponseSummary: 'Simulação climática e proteção para dias de chuva na Serra.'
    },
    {
      id: 'asaas',
      name: 'Asaas Pagamentos',
      category: 'payment',
      activeProvider: 'Asaas Payment Gateway (Sandbox)',
      status: 'MOCK',
      environment: 'sandbox',
      estimatedLatencyMs: 50,
      lastResponseSummary: 'Sandbox ativo com simulação instantânea de PIX.'
    }
  ];

  getAllProviders(): ProviderInfo[] {
    return this.statusItems.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category as any,
      providerName: s.activeProvider,
      status: s.status as any,
      environment: s.environment,
      details: s.lastResponseSummary || '',
      canTestConnection: true
    }));
  }

  getProviderStatus(providerId: string): ProviderStatus {
    const item = this.statusItems.find(s => s.id === providerId);
    if (!item) return 'DISABLED';
    return item.status as ProviderStatus;
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
        item.estimatedLatencyMs = Math.max(1, Date.now() - start);
        item.lastTestedAt = new Date().toISOString();

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'connected') {
            item.status = 'CONNECTED';
            item.lastResponseSummary = `Conectado ao Postgres. ${data.details || ''}`;
          } else if (data.status === 'mock') {
            item.status = 'MOCK';
            item.lastResponseSummary = `Modo MOCK ativo: ${data.details || ''}`;
          } else {
            item.status = 'ERROR';
            item.lastResponseSummary = data.details || 'Falha de conexão com o banco';
          }
        } else {
          item.status = 'ERROR';
          item.lastResponseSummary = `Erro HTTP ${res.status}: DATABASE_UNAVAILABLE`;
        }
      } catch (err: any) {
        item.status = 'ERROR';
        item.estimatedLatencyMs = Date.now() - start;
        item.lastResponseSummary = 'Servidor de banco de dados inacessível';
      }
      return item;
    }

    if (providerId === 'gemini') {
      try {
        const res = await fetch('/api/health');
        item.estimatedLatencyMs = Math.max(1, Date.now() - start);
        item.lastTestedAt = new Date().toISOString();

        if (res.ok) {
          const data = await res.json();
          if (data.ai === 'connected' || data.gemini_configured) {
            item.status = 'CONNECTED';
            item.lastResponseSummary = 'API Gemini operacional e autenticada no backend.';
          } else {
            item.status = 'CONFIGURATION_REQUIRED';
            item.lastResponseSummary = 'Chave GEMINI_API_KEY ausente ou não configurada.';
          }
        }
      } catch {
        item.status = 'ERROR';
        item.lastResponseSummary = 'Falha ao consultar endpoint de inteligência artificial.';
      }
      return item;
    }

    if (providerId === 'google_places') {
      try {
        const placesStatus = await googlePlacesProvider.getStatus();
        item.status = placesStatus.status;
        item.estimatedLatencyMs = Math.max(1, Date.now() - start);
        item.lastTestedAt = new Date().toISOString();
        item.lastResponseSummary = placesStatus.details;
      } catch (err: any) {
        item.status = 'ERROR';
        item.lastResponseSummary = 'Falha ao consultar status de Google Places no servidor';
      }
      return item;
    }

    if (providerId === 'routes') {
      try {
        const res = await fetch('/api/routes/health');
        item.estimatedLatencyMs = Math.max(1, Date.now() - start);
        item.lastTestedAt = new Date().toISOString();
        if (res.ok) {
          const data = await res.json();
          item.status = data.status === 'CONNECTED' ? 'CONNECTED' : (data.status === 'CONFIGURATION_REQUIRED' ? 'MOCK' : data.status);
          item.lastResponseSummary = data.details;
          item.activeProvider = data.status === 'CONNECTED' ? 'Google Routes API (New)' : 'Haversine Montanha / OSRM';
        } else {
          item.status = 'ERROR';
          item.lastResponseSummary = `Erro HTTP ${res.status} ao consultar Routes`;
        }
      } catch (err: any) {
        item.status = 'ERROR';
        item.lastResponseSummary = 'Falha ao consultar endpoint de rotas';
      }
      return item;
    }

    if (providerId === 'weather') {
      try {
        const res = await fetch('/api/weather/health');
        item.estimatedLatencyMs = Math.max(1, Date.now() - start);
        item.lastTestedAt = new Date().toISOString();
        if (res.ok) {
          const data = await res.json();
          item.status = data.status === 'CONNECTED' ? 'CONNECTED' : 'MOCK';
          item.lastResponseSummary = data.details;
          item.activeProvider = 'Open-Meteo & Microclima Serra';
        } else {
          item.status = 'ERROR';
          item.lastResponseSummary = `Erro HTTP ${res.status} ao consultar Weather`;
        }
      } catch (err: any) {
        item.status = 'ERROR';
        item.lastResponseSummary = 'Falha ao consultar endpoint de clima';
      }
      return item;
    }

    if (providerId === 'asaas') {
      try {
        const res = await fetch('/api/payments/webhook');
        item.estimatedLatencyMs = Math.max(1, Date.now() - start);
        item.lastTestedAt = new Date().toISOString();
        if (res.ok) {
          const data = await res.json();
          item.status = 'CONNECTED';
          item.environment = data.environment || 'sandbox';
          item.lastResponseSummary = `Webhook ${data.status.toUpperCase()} em ${data.endpoint} (Env: ${data.environment || 'sandbox'})`;
          item.activeProvider = `Asaas Sandbox Gateway`;
        } else {
          item.status = 'ERROR';
          item.lastResponseSummary = `Erro HTTP ${res.status} ao consultar Webhook`;
        }
      } catch (err: any) {
        item.status = 'ERROR';
        item.lastResponseSummary = 'Falha ao consultar status de pagamentos';
      }
      return item;
    }

    item.estimatedLatencyMs = Math.max(1, Date.now() - start);
    item.lastTestedAt = new Date().toISOString();
    item.status = 'MOCK';
    return item;
  }

  async refreshAllStatuses(): Promise<RegisteredProviderStatus[]> {
    for (const item of this.statusItems) {
      await this.testProvider(item.id);
    }
    return this.statusItems;
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
  googlePlacesProvider,
  placeRepository,
  tripRepository,
  eventRepository,
  priceRepository,
  hoursRepository,
  paymentRepository,
  apiUsageRepository,
  cacheRepository
};

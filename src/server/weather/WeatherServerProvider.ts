import { City, NormalizedWeatherForecast, WeatherCondition } from '../../types';
import { supabaseServer } from '../supabaseServer';

export const SERRA_CITIES_COORDS: Record<City, { latitude: number; longitude: number }> = {
  'Gramado': { latitude: -29.3789, longitude: -50.8741 },
  'Canela': { latitude: -29.3592, longitude: -50.8142 },
  'Nova Petrópolis': { latitude: -29.3142, longitude: -50.9083 }
};

import { singleFlight } from '../cache/SingleFlight';
import { externalFetch } from '../utils/externalFetch';

export class WeatherServerProvider {
  private mockRainDates = new Set<string>();
  private lastHealthCheck: { data: any; timestamp: number } | null = null;

  async setMockRainDate(dateStr: string, isRain: boolean = true) {
    if (isRain) {
      this.mockRainDates.add(dateStr);
      for (const city of ['gramado', 'canela', 'nova petrópolis']) {
        const mockRainForecast: NormalizedWeatherForecast = {
          date: dateStr,
          city: (city === 'nova petrópolis' ? 'Nova Petrópolis' : (city.charAt(0).toUpperCase() + city.slice(1))) as any,
          condition: 'HEAVY_RAIN',
          temp_min: 11,
          temp_max: 15,
          rain_probability: 95,
          precipitation_mm: 32.5,
          is_indoor_recommended: true,
          summary: 'Alerta de chuva forte contínua na Serra Gaúcha. Recomendado focar em atrações cobertas e gastronomia.',
          confidence: 'HIGH',
          provider: 'MOCK',
          cached: false
        };
        try {
          await supabaseServer.setCache(`weather:${city}:${dateStr}`, 'WEATHER', 'getForecast', mockRainForecast, 86400);
        } catch {
          // ignore
        }
      }
    } else {
      this.mockRainDates.delete(dateStr);
    }
  }

  async healthCheck(): Promise<{
    status: 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'MOCK' | 'ERROR';
    details: string;
    latency_ms: number;
  }> {
    // 5-minute health check cache to prevent expensive outbound calls on every ping (Section 13)
    const now = Date.now();
    if (this.lastHealthCheck && (now - this.lastHealthCheck.timestamp) < 300000) {
      return this.lastHealthCheck.data;
    }

    const start = Date.now();
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await this.getForecast('Gramado', today, { skipCache: false });
      const latency = Date.now() - start;

      const healthResult = {
        status: 'CONNECTED' as const,
        details: `Weather Provider (Open-Meteo / Serra Microclimate) operacional. Clima hoje em Gramado: ${res.condition} (${res.temp_min}°C a ${res.temp_max}°C).`,
        latency_ms: latency
      };

      this.lastHealthCheck = { data: healthResult, timestamp: now };
      return healthResult;
    } catch (err: any) {
      return {
        status: 'ERROR',
        details: `Falha ao consultar serviço meteorológico: ${err.message}`,
        latency_ms: Date.now() - start
      };
    }
  }

  async getForecast(
    city: City = 'Gramado',
    dateStr: string,
    options: { tripId?: string; skipCache?: boolean } = {}
  ): Promise<NormalizedWeatherForecast> {
    const cacheKey = `weather:${city.toLowerCase()}:${dateStr}`;

    // 1. Check external_data_cache first (Section 22: Cache por cidade + data)
    if (!options.skipCache) {
      try {
        const cached = await supabaseServer.getCache(cacheKey);
        if (cached && cached.payload) {
          await supabaseServer.logApiUsage({
            trip_id: options.tripId || null,
            provider: 'WEATHER',
            operation: 'getForecast',
            request_count: 1,
            estimated_cost_brl: 0,
            cached: true
          });
          return {
            ...cached.payload,
            cached: true,
            provider: 'CACHE'
          };
        }
      } catch (err) {
        console.warn('[Weather Cache] Error looking up cache:', err);
      }
    }

    // Check mock rain override for test suites (Section 46)
    if (this.mockRainDates.has(dateStr)) {
      const mockRainForecast: NormalizedWeatherForecast = {
        date: dateStr,
        city,
        condition: 'HEAVY_RAIN',
        temp_min: 11,
        temp_max: 15,
        rain_probability: 95,
        precipitation_mm: 32.5,
        is_indoor_recommended: true,
        summary: 'Chuva forte e contínua prevista na Serra. Priorizar atrações cobertas, chocolaterias e fondues.',
        confidence: 'HIGH',
        provider: 'MOCK',
        cached: false
      };

      await supabaseServer.setCache(cacheKey, 'WEATHER', 'getForecast', mockRainForecast, 86400);
      return mockRainForecast;
    }

    // 2. Check if date is within 14 days forecasting horizon (Section 23)
    const targetDate = new Date(dateStr);
    const today = new Date();
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays > 14 || isNaN(diffDays)) {
      // Historical seasonality fallback without inventing false daily forecasts
      const seasonal = this.getSeasonalClimate(city, dateStr);
      await supabaseServer.setCache(cacheKey, 'WEATHER', 'getForecast', seasonal, 7 * 86400);
      return seasonal;
    }

    // 3. Real Open-Meteo API call
    try {
      const coords = SERRA_CITIES_COORDS[city] || SERRA_CITIES_COORDS['Gramado'];
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=America%2FSao_Paulo&start_date=${dateStr}&end_date=${dateStr}`;

      const res = await externalFetch(url, { timeoutMs: 5000, isIdempotent: true, retries: 1 });
      if (res.ok) {
        const data = await res.json();
        const daily = data.daily;
        if (daily && daily.time && daily.time.length > 0) {
          const wmoCode = daily.weathercode?.[0] ?? 1;
          const tMax = Math.round(daily.temperature_2m_max?.[0] ?? 20);
          const tMin = Math.round(daily.temperature_2m_min?.[0] ?? 12);
          const rainProb = Math.round(daily.precipitation_probability_max?.[0] ?? 10);
          const precipMm = Number(daily.precipitation_sum?.[0] ?? 0);

          const condition = this.mapWmoToCondition(wmoCode, precipMm, tMin);
          const isIndoor = condition === 'HEAVY_RAIN' || condition === 'STORM' || rainProb > 75;

          const forecast: NormalizedWeatherForecast = {
            date: dateStr,
            city,
            condition,
            temp_min: tMin,
            temp_max: tMax,
            rain_probability: rainProb,
            precipitation_mm: precipMm,
            is_indoor_recommended: isIndoor,
            summary: this.generateWeatherSummary(condition, tMin, tMax, city),
            confidence: diffDays <= 3 ? 'HIGH' : 'MEDIUM',
            provider: 'OPEN_METEO',
            cached: false
          };

          // Cache for 24h
          await supabaseServer.setCache(cacheKey, 'WEATHER', 'getForecast', forecast, 86400);

          await supabaseServer.logApiUsage({
            trip_id: options.tripId || null,
            provider: 'WEATHER',
            operation: 'getForecast',
            request_count: 1,
            estimated_cost_brl: 0.00,
            cached: false
          });

          return forecast;
        }
      }
    } catch (err) {
      console.warn('[Weather API] Open-Meteo call failed, using seasonal fallback:', err);
    }

    // Fallback if network fails
    const fallback = this.getSeasonalClimate(city, dateStr);
    return fallback;
  }

  private mapWmoToCondition(wmoCode: number, precipMm: number, tempMin: number): WeatherCondition {
    if (wmoCode === 0) return 'CLEAR';
    if (wmoCode === 1 || wmoCode === 2) return 'PARTLY_CLOUDY';
    if (wmoCode === 3 || wmoCode === 45 || wmoCode === 48) return 'CLOUDY';
    if (wmoCode >= 95) return 'STORM';
    if (wmoCode === 65 || wmoCode === 82 || precipMm > 15) return 'HEAVY_RAIN';
    if ((wmoCode >= 51 && wmoCode <= 65) || (wmoCode >= 80 && wmoCode <= 81)) return 'RAIN';
    if (tempMin < 6) return 'COLD';
    return 'PARTLY_CLOUDY';
  }

  private generateWeatherSummary(condition: WeatherCondition, min: number, max: number, city: City): string {
    switch (condition) {
      case 'CLEAR':
        return `Céu limpo e ensolarado em ${city}. Excelente para parques e mirantes (${min}°C a ${max}°C).`;
      case 'PARTLY_CLOUDY':
        return `Sol com algumas nuvens na Serra. Clima agradável para passeios (${min}°C a ${max}°C).`;
      case 'CLOUDY':
        return `Tempo encoberto e clima ameno em ${city} (${min}°C a ${max}°C).`;
      case 'RAIN':
        return `Possibilidade de chuviscos ou chuva fraca em ${city}. Leve capa ou guarda-chuva (${min}°C a ${max}°C).`;
      case 'HEAVY_RAIN':
        return `Alerta de chuva forte em ${city}. Recomendado focar em atrações cobertas, museus e gastronomia (${min}°C a ${max}°C).`;
      case 'STORM':
        return `Alerta de temporais isolados na Serra. Evitar atividades radicais ao ar livre (${min}°C a ${max}°C).`;
      case 'COLD':
        return `Frio clássico da Serra Gaúcha (${min}°C a ${max}°C). Agasalho reforçado essencial.`;
      case 'HOT':
        return `Tarde quente na Serra (${max}°C). Mantenha hidratação em passeios abertos.`;
      default:
        return `Clima ameno em ${city} (${min}°C a ${max}°C).`;
    }
  }

  private getSeasonalClimate(city: City, dateStr: string): NormalizedWeatherForecast {
    const month = new Date(dateStr).getMonth(); // 0 to 11
    let min = 12;
    let max = 22;
    let condition: WeatherCondition = 'PARTLY_CLOUDY';
    let summary = `Clima típico sazonal de ${city}.`;

    if (month >= 5 && month <= 7) {
      // Inverno (Jun-Ago)
      min = 6;
      max = 15;
      condition = 'COLD';
      summary = `Inverno na Serra Gaúcha: clima frio e charmoso com névoas matinais (${min}°C a ${max}°C). Perfeito para vinhos e fondue.`;
    } else if (month >= 8 && month <= 10) {
      // Primavera (Set-Nov)
      min = 11;
      max = 21;
      condition = 'PARTLY_CLOUDY';
      summary = `Primavera na Serra Gaúcha: clima ameno, flores e dias agradáveis (${min}°C a ${max}°C).`;
    } else if (month === 11 || month <= 1) {
      // Verão (Dez-Fev)
      min = 15;
      max = 26;
      condition = 'CLEAR';
      summary = `Verão na Serra Gaúcha: manhãs frescas e tardes agradáveis com possibilidade de pancadas rápidas (${min}°C a ${max}°C).`;
    } else {
      // Outono (Mar-Mai)
      min = 10;
      max = 20;
      condition = 'PARTLY_CLOUDY';
      summary = `Outono na Serra Gaúcha: temperaturas amenas, folhas douradas e noites frescas (${min}°C a ${max}°C).`;
    }

    return {
      date: dateStr,
      city,
      condition,
      temp_min: min,
      temp_max: max,
      rain_probability: 25,
      precipitation_mm: 2,
      is_indoor_recommended: false,
      summary,
      forecast_unavailable: true,
      confidence: 'LOW',
      provider: 'SEASONAL',
      cached: false
    };
  }
}

export const weatherServer = new WeatherServerProvider();

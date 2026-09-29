import { City, NormalizedWeatherForecast } from '../../types';
import { getApiUrl } from '../utils/apiClient';

export interface WeatherForecastDay {
  date: string;
  city: string;
  summary: string;
  temp_min: number;
  temp_max: number;
  rain_probability: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'foggy';
  period: 'Manhã' | 'Tarde' | 'Noite' | 'Dia todo';
  is_indoor_recommended: boolean;
  is_demo: boolean;
  raw?: NormalizedWeatherForecast;
}

export interface WeatherProvider {
  name: string;
  isDemo: boolean;
  getForecast(city: City | string, date: string, options?: { tripId?: string }): Promise<WeatherForecastDay>;
  getNormalizedForecast(city: City, date: string, options?: { tripId?: string }): Promise<NormalizedWeatherForecast>;
}

export class AppWeatherProvider implements WeatherProvider {
  name = 'Open-Meteo & Microclima Serra Gaúcha';
  isDemo = false;

  async getNormalizedForecast(
    city: City,
    date: string,
    options: { tripId?: string } = {}
  ): Promise<NormalizedWeatherForecast> {
    try {
      const qCity = encodeURIComponent(city);
      const qDate = encodeURIComponent(date);
      const qTrip = options.tripId ? `&tripId=${encodeURIComponent(options.tripId)}` : '';
      const url = getApiUrl(`/api/weather/forecast?city=${qCity}&date=${qDate}${qTrip}`);

      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[WeatherProvider] Server request failed, using local fallback:', err);
    }

    // Local deterministic fallback
    return {
      date,
      city,
      condition: 'PARTLY_CLOUDY',
      temp_min: 12,
      temp_max: 21,
      rain_probability: 20,
      precipitation_mm: 1.0,
      is_indoor_recommended: false,
      summary: `Clima ameno em ${city} com sol entre nuvens.`,
      confidence: 'MEDIUM',
      provider: 'SEASONAL',
      cached: false
    };
  }

  async getForecast(
    city: City | string,
    date: string,
    options: { tripId?: string } = {}
  ): Promise<WeatherForecastDay> {
    const norm = await this.getNormalizedForecast(city as City, date, options);

    let simpleCondition: 'sunny' | 'cloudy' | 'rainy' | 'foggy' = 'cloudy';
    if (norm.condition === 'CLEAR') simpleCondition = 'sunny';
    else if (norm.condition === 'RAIN' || norm.condition === 'HEAVY_RAIN' || norm.condition === 'STORM') simpleCondition = 'rainy';
    else if (norm.condition === 'COLD') simpleCondition = 'foggy';

    return {
      date,
      city,
      summary: norm.summary,
      temp_min: norm.temp_min,
      temp_max: norm.temp_max,
      rain_probability: norm.rain_probability,
      condition: simpleCondition,
      period: 'Dia todo',
      is_indoor_recommended: norm.is_indoor_recommended,
      is_demo: norm.provider === 'MOCK' || norm.provider === 'SEASONAL',
      raw: norm
    };
  }
}

export const weatherProvider: WeatherProvider = new AppWeatherProvider();

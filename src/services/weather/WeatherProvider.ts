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
}

export interface WeatherProvider {
  name: string;
  isDemo: boolean;
  getForecast(city: string, date: string): Promise<WeatherForecastDay>;
}

export class MockWeatherProvider implements WeatherProvider {
  name = 'WeatherAPI (Simulado Serra Gaúcha)';
  isDemo = true;

  async getForecast(city: string, date: string): Promise<WeatherForecastDay> {
    // Realistic microclimate simulation for Serra Gaúcha
    const isWinter = [5, 6, 7, 8].includes(new Date(date).getMonth());
    const min = isWinter ? 6 : 14;
    const max = isWinter ? 17 : 24;

    return {
      date,
      city,
      summary: 'Clima ameno da Serra com sol entre nuvens',
      temp_min: min,
      temp_max: max,
      rain_probability: 15,
      condition: 'cloudy',
      period: 'Dia todo',
      is_indoor_recommended: false,
      is_demo: true
    };
  }
}

export const weatherProvider: WeatherProvider = new MockWeatherProvider();

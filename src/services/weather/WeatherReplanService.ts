import { Trip, TripDay, TripActivity, Place } from '../../types';
import { placeRepository } from '../repositories/RepositoryFactory';
import { weatherProvider } from './WeatherProvider';

export interface WeatherImpactAnalysis {
  hasImpact: boolean;
  dayNumber: number;
  date: string;
  condition: string;
  impactedActivities: TripActivity[];
  suggestedAlternatives: {
    originalActivityId: string;
    originalPlaceName: string;
    replacementPlace: Place;
    reason: string;
  }[];
  consumedQuota: false;
}

export class WeatherReplanService {
  /**
   * Analyzes an itinerary against real weather forecasts to detect outdoor activities during rain/storm.
   */
  async analyzeWeatherImpact(trip: Trip): Promise<WeatherImpactAnalysis | null> {
    for (const day of trip.days) {
      const forecast = await weatherProvider.getNormalizedForecast(day.city_focus, day.date, { tripId: trip.id });
      
      const isSevereRain = forecast.condition === 'HEAVY_RAIN' || forecast.condition === 'STORM' || forecast.rain_probability >= 80;
      
      if (!isSevereRain) continue;

      // Identify outdoor activities scheduled on this rainy day
      const outdoorActivities = day.activities.filter(a => a.place.indoor_type === 'outdoor');

      if (outdoorActivities.length === 0) continue;

      // Find indoor alternatives from local catalog
      const allPlaces = await placeRepository.getAllPlaces();
      const availableIndoor = allPlaces.filter(p => 
        (p.city === day.city_focus || p.city === 'Gramado') &&
        (p.indoor_type === 'indoor' || p.indoor_type === 'mixed' || p.indoor_type === 'rain_ok') &&
        p.active &&
        !day.activities.some(act => act.place.id === p.id)
      );

      const indoorFallback = availableIndoor[0] || allPlaces.find(p => p.indoor_type === 'indoor') || allPlaces[0];

      const suggestions = outdoorActivities.map((act, index) => {
        const replacement = availableIndoor[index % availableIndoor.length] || indoorFallback;
        return {
          originalActivityId: act.id,
          originalPlaceName: act.place.name,
          replacementPlace: replacement,
          reason: `Substituição por atração 100% coberta devido a ${forecast.condition} (${forecast.rain_probability}% de chuva).`
        };
      });

      return {
        hasImpact: true,
        dayNumber: day.day_number,
        date: day.date,
        condition: forecast.condition,
        impactedActivities: outdoorActivities,
        suggestedAlternatives: suggestions,
        consumedQuota: false
      };
    }

    return null;
  }

  /**
   * Applies the weather adaptation without consuming daily structural change quota (Section 30).
   */
  applyWeatherAdaptation(trip: Trip, analysis: WeatherImpactAnalysis): Trip {
    const updatedDays: TripDay[] = trip.days.map(day => {
      if (day.day_number !== analysis.dayNumber) return day;

      const updatedActivities = day.activities.map(act => {
        const match = analysis.suggestedAlternatives.find(s => s.originalActivityId === act.id);
        if (!match) return act;

        return {
          ...act,
          place: match.replacementPlace,
          weather_status: 'indoor_safe' as const,
          notes: `[Adaptação Climática DUO21] ${match.reason}`
        };
      });

      return {
        ...day,
        activities: updatedActivities
      };
    });

    return {
      ...trip,
      days: updatedDays,
      usage_stats: {
        ...trip.usage_stats,
        // Crucial: consumed_quota = false! Weather replan never counts as a structural change limit consumption
        structural_changes_today: trip.usage_stats.structural_changes_today
      }
    };
  }
}

export const weatherReplanService = new WeatherReplanService();

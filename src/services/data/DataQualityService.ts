import { Place, DataQualityScore } from '../../types';
import { dataFreshnessService } from './DataFreshnessService';

export class DataQualityService {
  /**
   * Calculates a comprehensive data quality score (0 - 100) for a place.
   */
  evaluateQuality(place: Place): DataQualityScore {
    let score = 0;
    const missing: string[] = [];

    // 1. Coordinates (+20 pts)
    const hasCoordinates = Boolean(
      typeof place.latitude === 'number' &&
      typeof place.longitude === 'number' &&
      place.latitude !== 0 &&
      place.longitude !== 0 &&
      place.latitude >= -31 && place.latitude <= -28 && // Serra Gaúcha bounding box check
      place.longitude >= -52 && place.longitude <= -50
    );
    if (hasCoordinates) score += 20;
    else missing.push('Coordenadas geográficas válidas');

    // 2. Google Place ID (+15 pts)
    const hasPlaceId = Boolean(place.google_place_id && place.google_place_id.trim().length > 5);
    if (hasPlaceId) score += 15;
    else missing.push('Google Place ID');

    // 3. Operating Hours (+15 pts)
    const hasHours = Boolean(
      place.opening_hours &&
      Object.keys(place.opening_hours).length > 0 &&
      Object.values(place.opening_hours).some(v => v && v.trim().length > 0)
    );
    if (hasHours) score += 15;
    else missing.push('Horários de funcionamento');

    // 4. Cost range / Price info (+15 pts)
    const hasCostRange = Boolean(
      place.cost_band ||
      place.cost_min !== undefined ||
      (place.price_info && (place.price_info.is_free || place.price_info.adult_price >= 0))
    );
    if (hasCostRange) score += 15;
    else missing.push('Faixa de custo estimada');

    // 5. Categorization & Tags (+10 pts)
    const hasTags = Boolean(place.tags && place.tags.length >= 2);
    if (hasTags) score += 10;
    else missing.push('Tags de categorização (mínimo 2)');

    // 6. Realistic Duration (+10 pts)
    const hasDuration = Boolean(
      (place.average_duration_minutes && place.average_duration_minutes > 0) ||
      (place.duration_min && place.duration_max && place.duration_max >= place.duration_min)
    );
    if (hasDuration) score += 10;
    else missing.push('Duração estimada da atividade');

    // 7. Freshness (+10 pts)
    const freshness = dataFreshnessService.evaluatePlace(place);
    const isFresh = freshness.overall_status === 'FRESH' || freshness.overall_status === 'AGING';
    if (isFresh) score += 10;
    else missing.push('Atualização recente dos dados (dado desatualizado)');

    // 8. Source verification (+5 pts)
    const isVerified = Boolean(
      place.data_status === 'ACTIVE' ||
      place.data_status === 'VERIFIED' ||
      place.is_divulga_lugares_partner
    );
    if (isVerified) score += 5;

    // Grade calculation
    let grade: 'A' | 'B' | 'C' | 'D' = 'D';
    if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 50) grade = 'C';

    return {
      place_id: place.id,
      score,
      grade,
      breakdown: {
        has_coordinates: hasCoordinates,
        has_place_id: hasPlaceId,
        has_hours: hasHours,
        has_cost_range: hasCostRange,
        has_tags: hasTags,
        is_fresh: isFresh,
        source_reliability: place.confidence || 'medium',
        verified: isVerified
      },
      missing_fields: missing
    };
  }
}

export const dataQualityService = new DataQualityService();

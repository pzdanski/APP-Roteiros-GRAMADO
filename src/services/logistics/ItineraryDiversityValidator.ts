import { Trip, TripActivity } from '../../types';

export interface DiversityIssue {
  type: 'CATEGORY_OVERLOAD' | 'TAG_OVERLOAD' | 'EXPERIENCE_REPETITION';
  entity: string;
  count: number;
  maxAllowed: number;
  message: string;
}

export interface DiversityReport {
  isDiverse: boolean;
  score: number; // 0 - 100
  issues: DiversityIssue[];
  categoryDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
}

export class ItineraryDiversityValidator {
  /**
   * Validates that the itinerary does not repetitively overload identical experiences (Section 32, 33).
   * E.g., avoids 4 similar theme parks, 3 chocolate shops in a row, or 3 similar museums,
   * unless explicitly requested by tourist preferences.
   */
  validate(trip: Trip): DiversityReport {
    const categoryCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    const uniquePlaces = new Set<string>();
    const issues: DiversityIssue[] = [];

    const allActivities: TripActivity[] = [];
    trip.days.forEach(d => allActivities.push(...d.activities));

    for (const act of allActivities) {
      const place = act.place;
      if (!place) continue;

      uniquePlaces.add(place.id);

      // Category count
      const cat = place.category || 'outro';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      // Tags count
      (place.tags || []).forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }

    const totalDays = trip.days.length || 1;

    // Rules:
    // 1. Chocolate shops/tours: max 2 in a 4-day trip unless heavily requested
    if ((tagCounts['chocolate'] || 0) > 2 && !trip.preferences.interests.includes('Chocolate')) {
      issues.push({
        type: 'TAG_OVERLOAD',
        entity: 'chocolate',
        count: tagCounts['chocolate'],
        maxAllowed: 2,
        message: `Excesso de paradas de chocolate (${tagCounts['chocolate']}), diversifique com natureza ou cultura.`
      });
    }

    // 2. Theme parks: max 1 per day on average, max 3 in 4 days
    const wantsNature = trip.preferences.interests.some(i => i.toLowerCase().includes('natureza'));
    const wantsParks = trip.preferences.interests.some(i => i.toLowerCase().includes('parque'));
    const isNatureOrPublicPark = (p: any) => {
      const tags = p.tags || [];
      return tags.includes('natureza') || tags.includes('lago') || tags.includes('praca') || tags.includes('caminhada') || tags.includes('gratis') || p.price_level === 1;
    };
    const themeParkCount = allActivities.filter(a => a.place.category === 'parque' && !isNatureOrPublicPark(a.place)).length;
    if (themeParkCount > 2 && !wantsParks) {
      issues.push({
        type: 'CATEGORY_OVERLOAD',
        entity: 'parque_tematico',
        count: themeParkCount,
        maxAllowed: 2,
        message: `Muitos parques temáticos concentrados (${themeParkCount}).`
      });
    } else if ((categoryCounts['parque'] || 0) > Math.max(5, totalDays + 1) && !wantsNature && !wantsParks) {
      issues.push({
        type: 'CATEGORY_OVERLOAD',
        entity: 'parque',
        count: categoryCounts['parque'],
        maxAllowed: 3,
        message: `Muitos parques concentrados (${categoryCounts['parque']}).`
      });
    }

    // 3. Similar museums
    if ((categoryCounts['museu'] || 0) > 2) {
      const wantsCulture = trip.preferences.interests.some(i => i.toLowerCase().includes('cultur') || i.toLowerCase().includes('hist'));
      if (!wantsCulture) {
        issues.push({
          type: 'CATEGORY_OVERLOAD',
          entity: 'museu',
          count: categoryCounts['museu'],
          maxAllowed: 2,
          message: `Mais de 2 museus agendados (${categoryCounts['museu']}) sem interesse cultural explícito.`
        });
      }
    }

    // Score calculation
    let score = 100;
    score -= issues.length * 15;
    if (uniquePlaces.size < allActivities.length) {
      // Duplicate places penalty
      const duplicates = allActivities.length - uniquePlaces.size;
      score -= duplicates * 25;
      issues.push({
        type: 'EXPERIENCE_REPETITION',
        entity: 'duplicate_place',
        count: duplicates,
        maxAllowed: 0,
        message: `${duplicates} atrações repetidas no mesmo roteiro.`
      });
    }

    score = Math.max(0, Math.min(100, score));

    return {
      isDiverse: issues.length === 0,
      score,
      issues,
      categoryDistribution: categoryCounts,
      tagDistribution: tagCounts
    };
  }
}

export const itineraryDiversityValidator = new ItineraryDiversityValidator();

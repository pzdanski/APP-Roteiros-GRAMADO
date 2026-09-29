import { Trip } from '../../types';
import { itineraryValidator } from './ItineraryValidator';
import { itineraryDiversityValidator } from './ItineraryDiversityValidator';

export interface QualityMetrics {
  overallScore: number; // 0 - 100
  grade: 'EXCELLENT' | 'GOOD' | 'NEEDS_REPAIR' | 'REJECTED';
  isReadyForClient: boolean;
  components: {
    constraintSatisfaction: number; // 0 - 100
    logisticsViability: number;     // 0 - 100
    budgetCompatibility: number;    // 0 - 100
    interestMatch: number;          // 0 - 100
    dataConfidence: number;         // 0 - 100
    diversityScore: number;         // 0 - 100
    weatherCompatibility: number;   // 0 - 100
    paceAppropriateness: number;    // 0 - 100
  };
  rejectionReasons: string[];
  repairsApplied: string[];
}

export class ItineraryQualityService {
  /**
   * Evaluates the comprehensive quality score of an itinerary (Sections 34, 35, 36).
   * Not shown directly to the tourist; used internally by DUO21 to gate quality.
   */
  evaluate(trip: Trip): QualityMetrics {
    const rejectionReasons: string[] = [];
    const repairsApplied: string[] = [];

    // 1. Constraint & Operational Validity
    const valReport = itineraryValidator.validate(trip);
    const criticalErrors = valReport.issues.filter(i => i.severity === 'ERROR');
    if (criticalErrors.length > 0) {
      criticalErrors.forEach(e => rejectionReasons.push(`[Operacional] ${e.message}`));
    }

    const constraintSatisfaction = criticalErrors.length === 0 ? 100 : Math.max(0, 100 - criticalErrors.length * 30);
    const logisticsViability = valReport.summary.travelFeasibilityScore;
    const weatherCompatibility = valReport.summary.weatherSuitabilityScore;

    // 2. Diversity Score
    const divReport = itineraryDiversityValidator.validate(trip);
    const diversityScore = divReport.score;
    if (!divReport.isDiverse) {
      divReport.issues.forEach(i => rejectionReasons.push(`[Diversidade] ${i.message}`));
    }

    // 3. Must-Have Satisfaction
    if (trip.preferences.must_have && trip.preferences.must_have.length > 0) {
      const allPlaceTags = trip.days.flatMap(d => d.activities.flatMap(a => [
        ...(a.place.tags || []),
        a.place.name.toLowerCase(),
        (a.notes || '').toLowerCase()
      ]));

      for (const must of trip.preferences.must_have) {
        const mustLower = must.toLowerCase();
        const keywords = mustLower.split(/\s+/).filter(w => w.length >= 4 && !['sequência', 'tradicional', 'especial'].includes(w));
        const satisfied = allPlaceTags.some(t => {
          if (t.includes(mustLower) || mustLower.includes(t)) return true;
          return keywords.some(k => t.includes(k));
        });

        if (!satisfied) {
          rejectionReasons.push(`[Must-Have] Item essencial "${must}" não foi contemplado no roteiro.`);
        }
      }
    }

    // 4. Budget Compatibility
    let budgetScore = 100;
    if (trip.preferences.budget_food_per_person) {
      const maxFood = trip.preferences.budget_food_per_person;
      trip.days.forEach(day => {
        const lunch = day.activities.find(a => a.place.category === 'restaurante' && a.time.startsWith('12'));
        if (lunch && (lunch.estimated_cost_per_person || 0) > maxFood * 1.25) {
          budgetScore -= 15;
          rejectionReasons.push(`[Orçamento] Almoço dia ${day.day_number} (${lunch.place.name}) custa R$ ${lunch.estimated_cost_per_person}, excedendo teto de R$ ${maxFood}.`);
        }
      });
    }

    // 5. Children Suitability
    let paceScore = 100;
    if (trip.preferences.children_count > 0) {
      // Pace shouldn't exceed 4 activities per day for families with kids
      trip.days.forEach(day => {
        if (day.activities.length > 4) {
          paceScore -= 20;
          rejectionReasons.push(`[Ritmo Família] Dia ${day.day_number} possui ${day.activities.length} atividades, cansativo para crianças.`);
        }
      });
    }

    // 6. Interest Match
    let interestScore = 90;
    if (trip.preferences.interests.includes('Natureza')) {
      const hasNature = trip.days.some(d => d.activities.some(a => a.place.tags?.includes('natureza') || a.place.category === 'parque'));
      if (hasNature) interestScore += 10;
      else interestScore -= 25;
    }

    // 7. Data Confidence
    const dataConfidence = 95; // Based on curated Serra catalog

    // Calculate Weighted Total Score
    const overallScore = Math.round(
      constraintSatisfaction * 0.25 +
      logisticsViability * 0.20 +
      budgetScore * 0.15 +
      interestScore * 0.10 +
      diversityScore * 0.10 +
      weatherCompatibility * 0.10 +
      paceScore * 0.10
    );

    let grade: QualityMetrics['grade'] = 'EXCELLENT';
    if (overallScore < 70 || rejectionReasons.length > 2) {
      grade = 'REJECTED';
    } else if (overallScore < 85 || rejectionReasons.length > 0) {
      grade = 'NEEDS_REPAIR';
    } else if (overallScore < 92) {
      grade = 'GOOD';
    }

    return {
      overallScore,
      grade,
      isReadyForClient: grade === 'EXCELLENT' || grade === 'GOOD',
      components: {
        constraintSatisfaction,
        logisticsViability,
        budgetCompatibility: Math.max(0, budgetScore),
        interestMatch: Math.max(0, interestScore),
        dataConfidence,
        diversityScore,
        weatherCompatibility,
        paceAppropriateness: Math.max(0, paceScore)
      },
      rejectionReasons,
      repairsApplied
    };
  }
}

export const itineraryQualityService = new ItineraryQualityService();

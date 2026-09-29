import { CostBand, PriceSeasonality, PriceObservation, Place, ConfidenceLevel } from '../../types';

export interface RestaurantCostConfig {
  economico_max: number; // default: R$ 50
  moderado_max: number;  // default: R$ 80
  superior_max: number;  // default: R$ 120
  premium_min: number;   // default: R$ 120
}

export const DEFAULT_RESTAURANT_COST_CONFIG: RestaurantCostConfig = {
  economico_max: 50,
  moderado_max: 80,
  superior_max: 120,
  premium_min: 120
};

export class PriceRangeService {
  private restaurantConfig: RestaurantCostConfig;

  constructor(config: RestaurantCostConfig = DEFAULT_RESTAURANT_COST_CONFIG) {
    this.restaurantConfig = config;
  }

  getRestaurantConfig(): RestaurantCostConfig {
    return { ...this.restaurantConfig };
  }

  updateRestaurantConfig(updates: Partial<RestaurantCostConfig>): void {
    this.restaurantConfig = { ...this.restaurantConfig, ...updates };
  }

  /**
   * Classifies a cost per person into a canonical Restaurant Cost Band.
   */
  classifyRestaurantCost(costPerPerson: number): 'ECONOMICO' | 'MODERADO' | 'SUPERIOR' | 'PREMIUM' {
    if (costPerPerson <= this.restaurantConfig.economico_max) return 'ECONOMICO';
    if (costPerPerson <= this.restaurantConfig.moderado_max) return 'MODERADO';
    if (costPerPerson <= this.restaurantConfig.superior_max) return 'SUPERIOR';
    return 'PREMIUM';
  }

  /**
   * Classifies an attraction's adult price into a general Cost Band.
   */
  classifyCostBand(estimatedCost: number, isFree: boolean = false): CostBand {
    if (isFree || estimatedCost === 0) return 'FREE';
    if (estimatedCost <= 55) return 'LOW';
    if (estimatedCost <= 110) return 'MEDIUM';
    if (estimatedCost <= 220) return 'HIGH';
    return 'PREMIUM';
  }

  /**
   * Evaluates price observations across sources:
   * - Filters out expired observations (valid_until passed)
   * - Filters low-confidence or extreme outliers (outside 3x median)
   * - Yields robust reference min/max range.
   */
  aggregateObservations(
    observations: PriceObservation[],
    seasonality: PriceSeasonality = 'REGULAR'
  ): {
    min: number;
    max: number;
    costBand: CostBand;
    confidence: ConfidenceLevel;
    observationCount: number;
  } {
    const now = new Date();

    // 1. Filter out expired observations
    const activeObs = observations.filter(o => {
      if (o.valid_until && new Date(o.valid_until) < now) return false;
      return true;
    });

    if (activeObs.length === 0) {
      return {
        min: 0,
        max: 0,
        costBand: 'UNKNOWN',
        confidence: 'unknown',
        observationCount: 0
      };
    }

    // 2. Filter matching seasonality or fallback to regular
    let seasonMatched = activeObs.filter(o => o.seasonality === seasonality);
    if (seasonMatched.length === 0) {
      seasonMatched = activeObs.filter(o => o.seasonality === 'REGULAR');
    }
    const finalObs = seasonMatched.length > 0 ? seasonMatched : activeObs;

    // 3. Extract ranges and exclude obvious outliers
    const mins = finalObs.map(o => o.estimated_min).filter(v => typeof v === 'number' && !isNaN(v));
    const maxs = finalObs.map(o => o.estimated_max).filter(v => typeof v === 'number' && !isNaN(v));

    if (mins.length === 0) {
      return { min: 0, max: 0, costBand: 'UNKNOWN', confidence: 'unknown', observationCount: 0 };
    }

    mins.sort((a, b) => a - b);
    maxs.sort((a, b) => a - b);

    // Median-based bounds
    const minVal = mins[0];
    const maxVal = maxs[maxs.length - 1];

    const hasHighConf = finalObs.some(o => o.confidence === 'high');
    const confidence: ConfidenceLevel = hasHighConf ? 'high' : (finalObs.length > 1 ? 'medium' : 'low');

    return {
      min: minVal,
      max: maxVal,
      costBand: this.classifyCostBand((minVal + maxVal) / 2, maxVal === 0),
      confidence,
      observationCount: finalObs.length
    };
  }

  /**
   * Generates friendly tourist-facing copy without promising exact prices.
   */
  formatTouristPriceDisplay(place: Partial<Place>, season: PriceSeasonality = 'REGULAR'): {
    badge: string;
    description: string;
    disclaimer: string;
    isFree: boolean;
  } {
    const isFree = place.price_info?.is_free || place.cost_band === 'FREE' || place.price_level === 1 && (place.price_info?.adult_price === 0);
    const disclaimer = 'Valores podem variar conforme data, lote e temporada.';

    if (isFree) {
      return {
        badge: 'Gratuito',
        description: 'Acesso livre e gratuito',
        disclaimer,
        isFree: true
      };
    }

    const min = place.cost_min ?? (place.price_info?.adult_price ? Math.round(place.price_info.adult_price * 0.9) : undefined);
    const max = place.cost_max ?? (place.price_info?.adult_price ? Math.round(place.price_info.adult_price * 1.15) : undefined);

    let badge = 'Custo moderado';
    const band = place.cost_band || (place.price_level === 1 ? 'LOW' : place.price_level === 2 ? 'MEDIUM' : place.price_level === 3 ? 'HIGH' : 'PREMIUM');

    if (band === 'LOW') badge = 'Custo baixo';
    else if (band === 'MEDIUM') badge = 'Custo moderado';
    else if (band === 'HIGH') badge = 'Custo superior';
    else if (band === 'PREMIUM') badge = 'Experiência premium';

    if (min !== undefined && max !== undefined && min > 0) {
      return {
        badge,
        description: `Faixa estimada: R$ ${min} – R$ ${max} por pessoa`,
        disclaimer,
        isFree: false
      };
    }

    if (place.price_info?.adult_price) {
      return {
        badge,
        description: `A partir de R$ ${place.price_info.adult_price} (referência)`,
        disclaimer,
        isFree: false
      };
    }

    return {
      badge: 'Custo a consultar',
      description: 'Consultar opções no local',
      disclaimer,
      isFree: false
    };
  }

  /**
   * Checks if a restaurant fits a budget filter (e.g. "almoço até 80")
   */
  fitsRestaurantBudget(place: Place, maxBudgetPerPerson: number): boolean {
    const cost = place.cost_min ?? place.price_info?.adult_price ?? (place.price_level * 40);
    return cost <= maxBudgetPerPerson * 1.1; // 10% flexibility
  }
}

export const priceRangeService = new PriceRangeService();

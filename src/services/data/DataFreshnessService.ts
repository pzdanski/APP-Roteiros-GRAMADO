import { Place, DataFreshnessStatus, PlaceFreshnessReport, FieldFreshness } from '../../types';

export interface FreshnessThresholds {
  hours_max_days: number;       // default: 60 days
  prices_max_days: number;      // default: 45 days
  coordinates_max_days: number; // default: 180 days
  general_max_days: number;     // default: 90 days
}

export const DEFAULT_FRESHNESS_THRESHOLDS: FreshnessThresholds = {
  hours_max_days: 60,
  prices_max_days: 45,
  coordinates_max_days: 180,
  general_max_days: 90
};

export class DataFreshnessService {
  private thresholds: FreshnessThresholds;

  constructor(thresholds: FreshnessThresholds = DEFAULT_FRESHNESS_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Evaluates freshness status for a given timestamp and max days threshold.
   */
  evaluateTimestamp(dateString?: string, maxDays = 90): { status: DataFreshnessStatus; ageDays?: number } {
    if (!dateString) return { status: 'UNKNOWN' };

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { status: 'UNKNOWN' };

    const now = new Date();
    const ageDays = Math.max(0, Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));

    if (ageDays <= Math.floor(maxDays * 0.6)) {
      return { status: 'FRESH', ageDays };
    }
    if (ageDays <= maxDays) {
      return { status: 'AGING', ageDays };
    }
    return { status: 'STALE', ageDays };
  }

  /**
   * Generates a full freshness report for a place.
   */
  evaluatePlace(place: Place): PlaceFreshnessReport {
    const fields: FieldFreshness[] = [];

    // 1. Hours freshness
    const hoursEval = this.evaluateTimestamp(place.checked_at || place.updated_at, this.thresholds.hours_max_days);
    fields.push({
      field_name: 'hours',
      status: hoursEval.status,
      last_observed_at: place.checked_at || place.updated_at,
      age_days: hoursEval.ageDays,
      max_age_days: this.thresholds.hours_max_days
    });

    // 2. Price info freshness
    const priceEval = this.evaluateTimestamp(
      place.price_info?.checked_at || place.checked_at || place.updated_at,
      this.thresholds.prices_max_days
    );
    fields.push({
      field_name: 'price_info',
      status: priceEval.status,
      last_observed_at: place.price_info?.checked_at || place.checked_at,
      age_days: priceEval.ageDays,
      max_age_days: this.thresholds.prices_max_days
    });

    // 3. Coordinates freshness
    const coordsEval = this.evaluateTimestamp(place.updated_at, this.thresholds.coordinates_max_days);
    fields.push({
      field_name: 'coordinates',
      status: coordsEval.status,
      last_observed_at: place.updated_at,
      age_days: coordsEval.ageDays,
      max_age_days: this.thresholds.coordinates_max_days
    });

    // Overall status determination
    const hasStale = fields.some(f => f.status === 'STALE');
    const hasAging = fields.some(f => f.status === 'AGING');
    const allFresh = fields.every(f => f.status === 'FRESH');

    let overall: DataFreshnessStatus = 'UNKNOWN';
    if (hasStale) overall = 'STALE';
    else if (hasAging) overall = 'AGING';
    else if (allFresh) overall = 'FRESH';

    // A place only needs validation if its data is genuinely STALE and essential
    const isStale = overall === 'STALE';
    const needsValidation = isStale || (!place.google_place_id && place.active);

    return {
      place_id: place.id,
      overall_status: overall,
      is_stale: isStale,
      needs_validation: needsValidation,
      fields
    };
  }

  /**
   * Fast check for trip generation: determines whether external validation is truly required.
   * If data is FRESH or AGING, use directly from Supabase / Seed without calling external APIs.
   */
  shouldValidateForTrip(place: Place): boolean {
    const report = this.evaluatePlace(place);
    return report.needs_validation;
  }
}

export const dataFreshnessService = new DataFreshnessService();

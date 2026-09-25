export interface PriceObservation {
  id: string;
  place_id: string;
  price_min: number;
  price_max: number;
  price_type: 'PER_PERSON' | 'PER_COUPLE' | 'PER_FAMILY' | 'PER_ENTRY' | 'AVERAGE_MEAL' | 'FREE' | 'UNKNOWN';
  season: 'LOW_SEASON' | 'REGULAR' | 'HIGH_SEASON' | 'SPECIAL_EVENT';
  source_id?: string;
  observed_at: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PriceRepository {
  getPricesForPlace(placeId: string): Promise<PriceObservation[]>;
  savePriceObservation(observation: Partial<PriceObservation>): Promise<PriceObservation>;
}

export class SupabasePriceRepository implements PriceRepository {
  async getPricesForPlace(placeId: string): Promise<PriceObservation[]> {
    try {
      const res = await fetch(`/api/db/places/${placeId}/prices`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return [];
  }

  async savePriceObservation(observation: Partial<PriceObservation>): Promise<PriceObservation> {
    const res = await fetch('/api/db/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(observation)
    });
    if (res.ok) {
      return await res.json();
    }
    return {
      id: `price_${Date.now()}`,
      place_id: observation.place_id || '',
      price_min: observation.price_min || 0,
      price_max: observation.price_max || 0,
      price_type: observation.price_type || 'PER_PERSON',
      season: observation.season || 'REGULAR',
      observed_at: new Date().toISOString(),
      confidence: observation.confidence || 'high'
    };
  }
}

export const priceRepository: PriceRepository = new SupabasePriceRepository();

export type PriceType = 'PER_PERSON' | 'PER_COUPLE' | 'PER_FAMILY' | 'PER_ENTRY' | 'AVERAGE_MEAL' | 'FREE' | 'UNKNOWN';
export type PriceSeason = 'LOW_SEASON' | 'REGULAR' | 'HIGH_SEASON' | 'SPECIAL_EVENT';

export interface PriceObservation {
  id: string;
  place_id: string;
  price_min: number;
  price_max: number;
  price_type: PriceType;
  season: PriceSeason;
  valid_from?: string;
  valid_until?: string;
  source_id?: string;
  observed_at: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PriceRepository {
  name: string;
  getByPlaceId(placeId: string): Promise<PriceObservation[]>;
  getCurrentForPlace(placeId: string, season?: PriceSeason): Promise<PriceObservation | null>;
  create(observation: Partial<PriceObservation>): Promise<PriceObservation>;
  update(id: string, updates: Partial<PriceObservation>): Promise<PriceObservation>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryPriceRepository implements PriceRepository {
  name = 'InMemoryPriceRepository (Mock)';
  private observations = new Map<string, PriceObservation>();

  async getByPlaceId(placeId: string): Promise<PriceObservation[]> {
    return Array.from(this.observations.values()).filter(p => p.place_id === placeId);
  }

  async getCurrentForPlace(placeId: string, season: PriceSeason = 'REGULAR'): Promise<PriceObservation | null> {
    const list = await this.getByPlaceId(placeId);
    return list.find(o => o.season === season) || list[0] || null;
  }

  async create(observation: Partial<PriceObservation>): Promise<PriceObservation> {
    const id = observation.id || `price_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const full: PriceObservation = {
      id,
      place_id: observation.place_id || '',
      price_min: observation.price_min || 0,
      price_max: observation.price_max || 0,
      price_type: observation.price_type || 'PER_PERSON',
      season: observation.season || 'REGULAR',
      valid_from: observation.valid_from,
      valid_until: observation.valid_until,
      source_id: observation.source_id || 'duo21_curatorship',
      observed_at: observation.observed_at || new Date().toISOString(),
      confidence: observation.confidence || 'high'
    };
    this.observations.set(id, full);
    return full;
  }

  async update(id: string, updates: Partial<PriceObservation>): Promise<PriceObservation> {
    const existing = this.observations.get(id);
    if (!existing) {
      throw new Error(`PriceObservation ${id} not found.`);
    }
    const updated: PriceObservation = {
      ...existing,
      ...updates,
      id
    };
    this.observations.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.observations.delete(id);
  }
}

export class SupabasePriceRepository implements PriceRepository {
  name = 'SupabasePriceRepository';

  async getByPlaceId(placeId: string): Promise<PriceObservation[]> {
    const res = await fetch(`/api/db/places/${encodeURIComponent(placeId)}/prices`);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get price observations for ${placeId}`);
    }
    return await res.json();
  }

  async getCurrentForPlace(placeId: string, season: PriceSeason = 'REGULAR'): Promise<PriceObservation | null> {
    const res = await fetch(`/api/db/places/${encodeURIComponent(placeId)}/prices?season=${encodeURIComponent(season)}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`DATABASE_UNAVAILABLE: Failed to get current price for ${placeId}`);
    }
    return await res.json();
  }

  async create(observation: Partial<PriceObservation>): Promise<PriceObservation> {
    const res = await fetch('/api/db/prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(observation)
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to create price observation`);
    }
    return await res.json();
  }

  async update(id: string, updates: Partial<PriceObservation>): Promise<PriceObservation> {
    const res = await fetch(`/api/db/prices/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to update price observation ${id}`);
    }
    return await res.json();
  }

  async delete(id: string): Promise<boolean> {
    const res = await fetch(`/api/db/prices/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to delete price observation ${id}`);
    }
    return true;
  }
}

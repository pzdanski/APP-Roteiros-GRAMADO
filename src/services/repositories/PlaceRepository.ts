import { Place, City, PlaceCategory } from '../../types';
import { SEED_PLACES } from '../../data/seedData';
import { getSupabaseClient } from '../supabase/client';

export interface PlaceRepository {
  name: string;
  isRealDatabase: boolean;
  getAllPlaces(): Promise<Place[]>;
  getPlaceById(id: string): Promise<Place | null>;
  getPlacesByCity(city: City): Promise<Place[]>;
  getPlacesByCategory(category: PlaceCategory): Promise<Place[]>;
  savePlace(place: Partial<Place>): Promise<Place>;
  updatePlace(id: string, updates: Partial<Place>): Promise<Place>;
  deactivatePlace(id: string): Promise<boolean>;
}

export class InMemoryPlaceRepository implements PlaceRepository {
  name = 'InMemoryPlaceRepository (Mock)';
  isRealDatabase = false;
  private places = new Map<string, Place>();

  constructor(initialSeed: Place[] = SEED_PLACES) {
    for (const p of initialSeed) {
      this.places.set(p.id, { ...p });
    }
  }

  async getAllPlaces(): Promise<Place[]> {
    return Array.from(this.places.values()).filter(p => p.active !== false);
  }

  async getPlaceById(id: string): Promise<Place | null> {
    return this.places.get(id) || null;
  }

  async getPlacesByCity(city: City): Promise<Place[]> {
    return Array.from(this.places.values()).filter(p => p.city === city && p.active !== false);
  }

  async getPlacesByCategory(category: PlaceCategory): Promise<Place[]> {
    return Array.from(this.places.values()).filter(p => p.category === category && p.active !== false);
  }

  async savePlace(placeData: Partial<Place>): Promise<Place> {
    const id = placeData.id || `place_${Date.now()}`;
    const newPlace: Place = {
      id,
      name: placeData.name || 'Novo Local',
      slug: placeData.slug || id,
      city: placeData.city || 'Gramado',
      category: placeData.category || 'parque',
      description: placeData.description || '',
      latitude: placeData.latitude || -29.3789,
      longitude: placeData.longitude || -50.8741,
      address: placeData.address || 'Gramado - RS',
      rating: placeData.rating || 4.8,
      rating_count: placeData.rating_count || 100,
      price_level: placeData.price_level || 2,
      price_info: placeData.price_info || {
        adult_price: 0,
        is_free: false,
        currency: 'BRL',
        source_name: 'Curadoria DUO21',
        checked_at: new Date().toISOString(),
        confidence: 'high'
      },
      average_duration_minutes: placeData.average_duration_minutes || 90,
      reservation_required: placeData.reservation_required || false,
      accessible: placeData.accessible ?? true,
      pet_friendly: placeData.pet_friendly || false,
      children_friendly: placeData.children_friendly ?? true,
      indoor_type: placeData.indoor_type || 'outdoor',
      opening_hours: placeData.opening_hours || { 'seg': '09:00 - 18:00', 'ter': '09:00 - 18:00' },
      media: placeData.media || [{ url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80', is_hero: true }],
      is_divulga_lugares_partner: placeData.is_divulga_lugares_partner || false,
      active: placeData.active ?? true,
      is_demo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.places.set(id, newPlace);
    return newPlace;
  }

  async updatePlace(id: string, updates: Partial<Place>): Promise<Place> {
    const existing = this.places.get(id);
    if (!existing) {
      throw new Error(`Place with id ${id} not found.`);
    }
    const updated: Place = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.places.set(id, updated);
    return updated;
  }

  async deactivatePlace(id: string): Promise<boolean> {
    const existing = this.places.get(id);
    if (!existing) return false;
    existing.active = false;
    existing.updated_at = new Date().toISOString();
    this.places.set(id, existing);
    return true;
  }
}

import { getApiUrl } from '../utils/apiClient';

export class SupabasePlaceRepository implements PlaceRepository {
  name = 'SupabasePlaceRepository';
  isRealDatabase = true;

  async getAllPlaces(): Promise<Place[]> {
    try {
      const res = await fetch(getApiUrl('/api/db/places'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map(this.mapRowToPlace);
        }
      }
    } catch {
      // Fallback to canonical seed catalog
    }
    return SEED_PLACES;
  }

  async getPlaceById(id: string): Promise<Place | null> {
    const res = await fetch(getApiUrl(`/api/db/places/${encodeURIComponent(id)}`));
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Falha ao obter local ${id} do Supabase (HTTP ${res.status})`);
    }
    const data = await res.json();
    return this.mapRowToPlace(data);
  }

  async getPlacesByCity(city: City): Promise<Place[]> {
    const all = await this.getAllPlaces();
    return all.filter(p => p.city === city && p.active !== false);
  }

  async getPlacesByCategory(category: PlaceCategory): Promise<Place[]> {
    const all = await this.getAllPlaces();
    return all.filter(p => p.category === category && p.active !== false);
  }

  async savePlace(placeData: Partial<Place>): Promise<Place> {
    const res = await fetch(getApiUrl('/api/db/places'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(placeData)
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Falha ao salvar local no Supabase (HTTP ${res.status})`);
    }
    const data = await res.json();
    return this.mapRowToPlace(data);
  }

  async updatePlace(id: string, updates: Partial<Place>): Promise<Place> {
    const res = await fetch(getApiUrl(`/api/db/places/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Falha ao atualizar local ${id} no Supabase (HTTP ${res.status})`);
    }
    const data = await res.json();
    return this.mapRowToPlace(data);
  }

  async deactivatePlace(id: string): Promise<boolean> {
    const res = await fetch(getApiUrl(`/api/db/places/${encodeURIComponent(id)}`), {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Falha ao desativar local ${id} no Supabase`);
    }
    return true;
  }

  private mapRowToPlace(row: any): Place {
    if (!row) return row;
    const rawCat = (row.category_id || '').toLowerCase();
    let normalizedCategory: PlaceCategory = 'parque';
    if (rawCat === 'restaurant' || rawCat === 'restaurante') normalizedCategory = 'restaurante';
    else if (rawCat === 'cafe') normalizedCategory = 'cafe';
    else if (rawCat === 'museu') normalizedCategory = 'museu';
    else if (rawCat === 'vinicola') normalizedCategory = 'vinicola';
    else if (rawCat === 'chocolate') normalizedCategory = 'chocolate';
    else if (rawCat === 'mirante') normalizedCategory = 'mirante';
    else if (rawCat === 'show') normalizedCategory = 'show';
    else if (rawCat === 'compras') normalizedCategory = 'compras';
    else if (rawCat === 'noturno') normalizedCategory = 'noturno';

    return {
      id: row.id,
      name: row.name,
      slug: row.slug || row.id,
      city: row.city as City,
      category: normalizedCategory,
      description: row.description_short || row.description || '',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      address: row.address || `${row.city} - RS`,
      rating: Number(row.rating || 4.8),
      rating_count: Number(row.rating_count || 120),
      price_level: (row.cost_level || 2) as 1 | 2 | 3 | 4,
      price_info: row.price_info || {
        adult_price: Number(row.cost_per_person || row.estimated_cost_min || 0),
        is_free: Number(row.cost_per_person || 0) === 0,
        currency: 'BRL',
        source_name: row.source_id || 'Curadoria DUO21',
        checked_at: row.checked_at || new Date().toISOString(),
        confidence: 'high'
      },
      average_duration_minutes: row.duration_min || 90,
      reservation_required: Boolean(row.reservation_required),
      accessible: Boolean(row.accessibility ?? true),
      pet_friendly: Boolean(row.pet_friendly),
      children_friendly: Boolean(row.suitable_for_children ?? true),
      indoor_type: (row.indoor_outdoor || 'outdoor') as any,
      opening_hours: row.opening_hours || { 'seg': '09:00 - 18:00' },
      media: [{ url: row.media_url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80', is_hero: true }],
      is_divulga_lugares_partner: Boolean(row.partner || row.divulga_lugares_recommended),
      active: Boolean(row.active ?? true),
      is_demo: Boolean(row.is_demo ?? true),
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString()
    };
  }
}

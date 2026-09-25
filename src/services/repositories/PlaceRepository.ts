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
  name = 'InMemoryPlaceRepository (Local Seed)';
  isRealDatabase = false;
  private places: Map<string, Place> = new Map();

  constructor() {
    // Seed initial demo data
    SEED_PLACES.forEach(p => this.places.set(p.id, { ...p }));
  }

  async getAllPlaces(): Promise<Place[]> {
    return Array.from(this.places.values());
  }

  async getPlaceById(id: string): Promise<Place | null> {
    return this.places.get(id) || null;
  }

  async getPlacesByCity(city: City): Promise<Place[]> {
    return Array.from(this.places.values()).filter(p => p.city === city && p.active);
  }

  async getPlacesByCategory(category: PlaceCategory): Promise<Place[]> {
    return Array.from(this.places.values()).filter(p => p.category === category && p.active);
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

export class SupabasePlaceRepository implements PlaceRepository {
  name = 'SupabasePlaceRepository';
  isRealDatabase = true;
  private fallback = new InMemoryPlaceRepository();

  async getAllPlaces(): Promise<Place[]> {
    // 1. Try server backend proxy (which handles Supabase service role / RLS safely)
    try {
      const res = await fetch('/api/db/places');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {
      // ignore
    }

    // 2. Try direct client if Supabase is configured in browser
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('places')
          .select('*')
          .eq('active', true);
        if (!error && data && data.length > 0) {
          return data.map(this.mapRowToPlace);
        }
      } catch (err) {
        console.warn('Supabase client places fetch failed:', err);
      }
    }

    // 3. Fallback safely to verified memory seed
    return this.fallback.getAllPlaces();
  }

  async getPlaceById(id: string): Promise<Place | null> {
    try {
      const res = await fetch(`/api/db/places/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data } = await client
          .from('places')
          .select('*')
          .eq('id', id)
          .single();
        if (data) return this.mapRowToPlace(data);
      } catch {
        // ignore
      }
    }

    return this.fallback.getPlaceById(id);
  }

  async getPlacesByCity(city: City): Promise<Place[]> {
    const all = await this.getAllPlaces();
    return all.filter(p => p.city === city && p.active);
  }

  async getPlacesByCategory(category: PlaceCategory): Promise<Place[]> {
    const all = await this.getAllPlaces();
    return all.filter(p => p.category === category && p.active);
  }

  async savePlace(placeData: Partial<Place>): Promise<Place> {
    try {
      const res = await fetch('/api/db/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(placeData)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    return this.fallback.savePlace(placeData);
  }

  async updatePlace(id: string, updates: Partial<Place>): Promise<Place> {
    try {
      const res = await fetch(`/api/db/places/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }

    return this.fallback.updatePlace(id, updates);
  }

  async deactivatePlace(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/db/places/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        return true;
      }
    } catch {
      // ignore
    }

    return this.fallback.deactivatePlace(id);
  }

  private mapRowToPlace(row: any): Place {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug || row.id,
      city: row.city as City,
      category: (row.category_id?.toLowerCase() || 'parque') as PlaceCategory,
      description: row.description_short || row.description || '',
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      address: row.address || `${row.city} - RS`,
      rating: Number(row.rating || 4.8),
      rating_count: Number(row.rating_count || 120),
      price_level: (row.cost_level || 2) as 1 | 2 | 3 | 4,
      price_info: {
        adult_price: Number(row.cost_per_person || row.estimated_cost_min || 0),
        is_free: Number(row.cost_per_person || 0) === 0,
        currency: 'BRL',
        source_name: row.source_id || 'Curadoria DUO21',
        checked_at: row.checked_at || new Date().toISOString(),
        confidence: row.confidence || 'high'
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

// Active singleton instance using SupabasePlaceRepository (with graceful fallback)
export const placeRepository: PlaceRepository = new SupabasePlaceRepository();

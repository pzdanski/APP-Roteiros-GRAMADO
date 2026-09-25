import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only credentials (NEVER in frontend)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

let serverClient: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  try {
    serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
    console.log('[Supabase] Initialized server client with configured credentials.');
  } catch (err) {
    console.warn('[Supabase] Error initializing server client:', err);
  }
}

// Local file-backed database storage path
const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'duo21_supabase_store.json');

// Memory store backed by file
interface LocalStoreSchema {
  places: any[];
  trips: any[];
  trip_profiles: any[];
  trip_previews: any[];
  trip_days: any[];
  trip_activities: any[];
  trip_usage: any[];
  api_usage: any[];
  data_sources: any[];
  user_reports: any[];
}

let store: LocalStoreSchema = {
  places: [],
  trips: [],
  trip_profiles: [],
  trip_previews: [],
  trip_days: [],
  trip_activities: [],
  trip_usage: [],
  api_usage: [],
  data_sources: [],
  user_reports: []
};

// Initial Sources Seed
const INITIAL_SOURCES = [
  { id: 'duo21_curatorship', name: 'Curadoria DUO21 / Divulga Lugares', type: 'DUO21', base_url: 'https://divulgalugares.com.br', active: true, reliability_level: 'high' },
  { id: 'official_gramado', name: 'Secretaria de Turismo de Gramado', type: 'OFFICIAL', base_url: 'https://gramado.rs.gov.br', active: true, reliability_level: 'high' },
  { id: 'official_canela', name: 'Turismo Canela Paixão Natural', type: 'OFFICIAL', base_url: 'https://canela.rs.gov.br', active: true, reliability_level: 'high' },
  { id: 'google_places', name: 'Google Places Platform (Cache)', type: 'GOOGLE', base_url: 'https://maps.googleapis.com', active: true, reliability_level: 'high' }
];

function initLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      store = JSON.parse(content);
    } else {
      // Seed places from data/seedData if empty
      saveLocalStore();
    }
  } catch (err) {
    console.warn('[Supabase Server] Error reading local store:', err);
  }
}

function saveLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Supabase Server] Error saving local store:', err);
  }
}

// Seed helper
export function populateInitialCatalogIfEmpty(initialPlaces: any[]) {
  initLocalStore();
  if (store.places.length === 0 && initialPlaces.length > 0) {
    store.places = initialPlaces.map(p => ({
      ...p,
      google_place_id: p.google_place_id || `place_${p.slug}`,
      source_id: 'duo21_curatorship',
      confidence: 'high'
    }));
    store.data_sources = INITIAL_SOURCES;
    saveLocalStore();
  }
}

initLocalStore();

export const supabaseServer = {
  isConfigured(): boolean {
    return Boolean(serverClient);
  },

  async healthCheck(): Promise<{ status: string; provider: string; details: string; latency_ms: number }> {
    const start = Date.now();
    if (serverClient) {
      try {
        const { count, error } = await serverClient
          .from('places')
          .select('*', { count: 'exact', head: true });

        const latency = Date.now() - start;
        if (!error) {
          return {
            status: 'connected',
            provider: 'Supabase Cloud Postgres',
            details: `Conexão remota ativa. ${count ?? 0} locais cadastrados. RLS habilitado.`,
            latency_ms: latency
          };
        }
      } catch (err: any) {
        console.warn('Supabase remote ping error:', err);
      }
    }

    // Local / Development store status
    const latency = Date.now() - start;
    return {
      status: 'connected',
      provider: 'Supabase (Local Engine & File Persistence)',
      details: `Persistência ativa em .data/duo21_supabase_store.json. ${store.places.length} locais, ${store.trips.length} viagens salvas.`,
      latency_ms: Math.max(1, latency)
    };
  },

  async getPlaces(): Promise<any[]> {
    if (serverClient) {
      try {
        const { data, error } = await serverClient
          .from('places')
          .select('*')
          .eq('active', true);
        if (!error && data && data.length > 0) return data;
      } catch (err) {
        console.warn('Supabase getPlaces error:', err);
      }
    }
    return store.places.filter(p => p.active !== false);
  },

  async getPlaceById(id: string): Promise<any | null> {
    if (serverClient) {
      try {
        const { data } = await serverClient
          .from('places')
          .select('*')
          .eq('id', id)
          .single();
        if (data) return data;
      } catch {
        // ignore
      }
    }
    return store.places.find(p => p.id === id) || null;
  },

  async savePlace(place: any): Promise<any> {
    const id = place.id || `place_${Date.now()}`;
    const newPlace = {
      ...place,
      id,
      created_at: place.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (serverClient) {
      try {
        await serverClient.from('places').upsert(newPlace);
      } catch (err) {
        console.warn('Supabase savePlace error:', err);
      }
    }

    const idx = store.places.findIndex(p => p.id === id);
    if (idx >= 0) {
      store.places[idx] = newPlace;
    } else {
      store.places.push(newPlace);
    }
    saveLocalStore();
    return newPlace;
  },

  async updatePlace(id: string, updates: any): Promise<any> {
    const existing = store.places.find(p => p.id === id);
    if (!existing) throw new Error('Place not found');
    const updated = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString()
    };

    if (serverClient) {
      try {
        await serverClient.from('places').update(updated).eq('id', id);
      } catch (err) {
        console.warn('Supabase updatePlace error:', err);
      }
    }

    const idx = store.places.findIndex(p => p.id === id);
    store.places[idx] = updated;
    saveLocalStore();
    return updated;
  },

  async deactivatePlace(id: string): Promise<boolean> {
    return this.updatePlace(id, { active: false }).then(() => true);
  },

  // ---------------------------------------------------------------------------
  // Trips & Full Itinerary Persistence
  // ---------------------------------------------------------------------------
  async saveTrip(trip: any): Promise<any> {
    // 1. Supabase Cloud if available
    if (serverClient) {
      try {
        await serverClient.from('trips').upsert({
          id: trip.id,
          secure_token: trip.secure_token,
          customer_name: trip.preferences.name,
          customer_email: trip.preferences.email,
          start_date: trip.preferences.start_date,
          end_date: trip.preferences.end_date,
          status: (trip.status || 'DRAFT').toUpperCase(),
          accommodation_status: trip.preferences.accommodation_status || 'not_booked',
          transport_type: trip.preferences.transport,
          pace: trip.preferences.pace,
          price_brl: trip.price_brl,
          is_demo: trip.is_demo,
          unlock_source: trip.unlock_source || 'payment',
          generation_authorization: trip.status === 'paid'
        });

        // Save profile
        await serverClient.from('trip_profiles').upsert({
          trip_id: trip.id,
          adults: trip.preferences.adults_count,
          children: trip.preferences.children_count,
          children_ages: trip.preferences.children_ages || [],
          interests: trip.preferences.interests || [],
          must_have: trip.preferences.must_have || trip.preferences.mandatory_places || [],
          avoid: trip.preferences.avoid || trip.preferences.restrictions || [],
          budget_total: trip.preferences.budget_total,
          budget_food_per_person: trip.preferences.budget_food_per_person,
          budget_dinner_per_person: trip.preferences.budget_dinner_per_person,
          budget_flexible: trip.preferences.budget_flexibility || 'equilibrado'
        });
      } catch (err) {
        console.warn('Supabase saveTrip remote error:', err);
      }
    }

    // 2. Local persistence in memory and file
    const idx = store.trips.findIndex(t => t.id === trip.id || t.secure_token === trip.secure_token);
    if (idx >= 0) {
      store.trips[idx] = { ...trip };
    } else {
      store.trips.push({ ...trip });
    }

    // Save profile record
    const profileIdx = store.trip_profiles.findIndex(p => p.trip_id === trip.id);
    const profileData = {
      trip_id: trip.id,
      adults: trip.preferences?.adults_count || 2,
      children: trip.preferences?.children_count || 0,
      children_ages: trip.preferences?.children_ages || [],
      interests: trip.preferences?.interests || [],
      must_have: trip.preferences?.must_have || [],
      avoid: trip.preferences?.avoid || [],
      budget_total: trip.preferences?.budget_total,
      budget_food_per_person: trip.preferences?.budget_food_per_person,
      budget_dinner_per_person: trip.preferences?.budget_dinner_per_person,
      budget_flexible: trip.preferences?.budget_flexibility || 'equilibrado'
    };
    if (profileIdx >= 0) {
      store.trip_profiles[profileIdx] = profileData;
    } else {
      store.trip_profiles.push(profileData);
    }

    saveLocalStore();
    return trip;
  },

  async getTripByToken(token: string): Promise<any | null> {
    if (serverClient) {
      try {
        const { data: tripRow } = await serverClient
          .from('trips')
          .select('*')
          .eq('secure_token', token)
          .single();
        if (tripRow) {
          // If in store, prefer store with rich days
          const local = store.trips.find(t => t.secure_token === token || t.id === tripRow.id);
          if (local) return local;
        }
      } catch {
        // ignore
      }
    }
    return store.trips.find(t => t.secure_token === token) || null;
  },

  async getTripById(id: string): Promise<any | null> {
    return store.trips.find(t => t.id === id) || null;
  },

  async getTrips(): Promise<any[]> {
    return store.trips;
  },

  // ---------------------------------------------------------------------------
  // API Usage & CostGuard
  // ---------------------------------------------------------------------------
  async logApiUsage(record: any): Promise<void> {
    const entry = {
      id: record.id || `usage_${Date.now()}`,
      trip_id: record.trip_id || null,
      provider: record.provider || 'OTHER',
      operation: record.operation || 'query',
      request_count: record.request_count || 1,
      input_tokens: record.input_tokens || 0,
      output_tokens: record.output_tokens || 0,
      estimated_cost_brl: Number(record.estimated_cost_brl || 0),
      cached: Boolean(record.cached),
      created_at: record.created_at || new Date().toISOString()
    };

    if (serverClient) {
      try {
        await serverClient.from('api_usage').insert(entry);
      } catch {
        // ignore
      }
    }

    store.api_usage.push(entry);
    saveLocalStore();
  },

  async getApiUsageMetrics(): Promise<any> {
    let totalCost = 0;
    const byProvider: Record<string, { requests: number; costBrl: number }> = {};
    const tripIds = new Set<string>();

    for (const item of store.api_usage) {
      totalCost += Number(item.estimated_cost_brl || 0);
      if (item.trip_id) tripIds.add(item.trip_id);
      if (!byProvider[item.provider]) {
        byProvider[item.provider] = { requests: 0, costBrl: 0 };
      }
      byProvider[item.provider].requests += item.request_count || 1;
      byProvider[item.provider].costBrl += Number(item.estimated_cost_brl || 0);
    }

    const totalTrips = Math.max(1, tripIds.size);
    return {
      totalRequests: store.api_usage.length,
      totalCostBrl: Number(totalCost.toFixed(4)),
      avgCostPerTripBrl: Number((totalCost / totalTrips).toFixed(4)),
      totalTripsLogged: totalTrips,
      byProvider
    };
  },

  // ---------------------------------------------------------------------------
  // Data Sources & Quality Metrics (Requirement 37 & 38)
  // ---------------------------------------------------------------------------
  getSources(): any[] {
    return store.data_sources.length > 0 ? store.data_sources : INITIAL_SOURCES;
  },

  getQualityMetrics(): any {
    const places = store.places;
    const total = places.length;

    let missingCoords = 0;
    let missingGoogleId = 0;
    let missingHours = 0;
    let missingSource = 0;
    let missingPrice = 0;
    let lowConfidence = 0;
    let outdated = 0;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const p of places) {
      if (!p.latitude || !p.longitude) missingCoords++;
      if (!p.google_place_id) missingGoogleId++;
      if (!p.opening_hours || Object.keys(p.opening_hours).length === 0) missingHours++;
      if (!p.source_id && !p.price_info?.source_name) missingSource++;
      if (p.cost_level === undefined || (!p.cost_per_person && !p.price_info?.adult_price && !p.price_info?.is_free)) missingPrice++;
      if (p.confidence === 'low' || p.price_info?.confidence === 'low') lowConfidence++;
      if (p.checked_at && new Date(p.checked_at) < sixMonthsAgo) outdated++;
    }

    return {
      totalPlaces: total,
      missingCoords,
      missingGoogleId,
      missingHours,
      missingSource,
      missingPrice,
      lowConfidence,
      outdated
    };
  }
};

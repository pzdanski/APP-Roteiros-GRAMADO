import { Trip } from '../../types';
import { getSupabaseClient } from '../supabase/client';

export interface TripRepository {
  name: string;
  isRealDatabase: boolean;
  saveTrip(trip: Trip): Promise<Trip>;
  getTripByToken(token: string): Promise<Trip | null>;
  getTripById(id: string): Promise<Trip | null>;
  updateTrip(trip: Trip): Promise<Trip>;
}

export class InMemoryTripRepository implements TripRepository {
  name = 'InMemoryTripRepository (Local/Dev)';
  isRealDatabase = false;
  private trips = new Map<string, Trip>();

  async saveTrip(trip: Trip): Promise<Trip> {
    this.trips.set(trip.id, { ...trip });
    if (trip.secure_token) {
      this.trips.set(trip.secure_token, { ...trip });
    }
    // Also save in localStorage for client persistence
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(`duo21_trip_${trip.secure_token}`, JSON.stringify(trip));
        localStorage.setItem(`duo21_trip_${trip.id}`, JSON.stringify(trip));
      }
    } catch {
      // ignore
    }
    return trip;
  }

  async getTripByToken(token: string): Promise<Trip | null> {
    const memory = this.trips.get(token);
    if (memory) return memory;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(`duo21_trip_${token}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.trips.set(token, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async getTripById(id: string): Promise<Trip | null> {
    const memory = this.trips.get(id);
    if (memory) return memory;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(`duo21_trip_${id}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.trips.set(id, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  async updateTrip(trip: Trip): Promise<Trip> {
    return this.saveTrip(trip);
  }
}

export class SupabaseTripRepository implements TripRepository {
  name = 'SupabaseTripRepository';
  isRealDatabase = true;
  private fallback = new InMemoryTripRepository();

  async saveTrip(trip: Trip): Promise<Trip> {
    // 1. Always save in memory/local first as immediate safety
    await this.fallback.saveTrip(trip);

    // 2. Persist via server proxy (which handles server-side Supabase client & credentials safely)
    try {
      const res = await fetch('/api/db/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trip)
      });
      if (res.ok) {
        const persisted = await res.json();
        return persisted;
      }
    } catch {
      // ignore
    }

    // 3. If direct Supabase client is configured in browser
    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client
          .from('trips')
          .upsert({
            id: trip.id,
            secure_token: trip.secure_token,
            customer_name: trip.preferences.name,
            customer_email: trip.preferences.email,
            start_date: trip.preferences.start_date,
            end_date: trip.preferences.end_date,
            status: trip.status.toUpperCase(),
            accommodation_status: trip.preferences.accommodation_status || 'not_booked',
            transport_type: trip.preferences.transport,
            pace: trip.preferences.pace,
            price_brl: trip.price_brl,
            is_demo: trip.is_demo,
            unlock_source: trip.unlock_source || 'payment',
            generation_authorization: trip.status === 'paid'
          });

        if (!error) {
          // Upsert travel profile
          await client.from('trip_profiles').upsert({
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
        }
      } catch (err) {
        console.warn('Supabase trip upsert error:', err);
      }
    }

    return trip;
  }

  async getTripByToken(token: string): Promise<Trip | null> {
    // 1. Try server endpoint
    try {
      const res = await fetch(`/api/db/trips/token/${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          await this.fallback.saveTrip(data);
          return data;
        }
      }
    } catch {
      // ignore
    }

    // 2. Try direct Supabase client
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: tripRow } = await client
          .from('trips')
          .select('*')
          .eq('secure_token', token)
          .single();

        if (tripRow) {
          const { data: profile } = await client
            .from('trip_profiles')
            .select('*')
            .eq('trip_id', tripRow.id)
            .single();

          // Reconstitute trip
          const reconstituted: Trip = {
            id: tripRow.id,
            secure_token: tripRow.secure_token,
            status: tripRow.status.toLowerCase() as any,
            price_tier_id: 'standard',
            price_brl: Number(tripRow.price_brl || 19.9),
            total_estimated_spend_brl: 0,
            is_demo: Boolean(tripRow.is_demo),
            unlock_source: tripRow.unlock_source || 'payment',
            created_at: tripRow.created_at,
            paid_at: tripRow.status === 'PAID' ? tripRow.updated_at : undefined,
            preferences: {
              name: tripRow.customer_name || 'Viajante',
              email: tripRow.customer_email,
              start_date: tripRow.start_date,
              end_date: tripRow.end_date,
              adults_count: profile?.adults || 2,
              children_count: profile?.children || 0,
              children_ages: profile?.children_ages || [],
              pace: tripRow.pace || 'equilibrado',
              transport: tripRow.transport_type || 'carro_alugado',
              interests: profile?.interests || ['Gastronomia', 'Natureza'],
              mandatory_places: profile?.must_have || [],
              restrictions: profile?.avoid || [],
              budget_total: profile?.budget_total || 3000,
              budget_food_per_person: profile?.budget_food_per_person,
              budget_dinner_per_person: profile?.budget_dinner_per_person,
              budget_flexibility: profile?.budget_flexible || 'equilibrado'
            },
            days: [],
            usage_stats: {
              guide_messages_today: 0,
              guide_messages_limit: 30,
              structural_changes_today: 0,
              structural_changes_limit: 3,
              full_regenerations_used: 0,
              full_regenerations_limit: 1
            }
          };
          return reconstituted;
        }
      } catch {
        // ignore
      }
    }

    // 3. Fallback to memory
    return this.fallback.getTripByToken(token);
  }

  async getTripById(id: string): Promise<Trip | null> {
    try {
      const res = await fetch(`/api/db/trips/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          return data;
        }
      }
    } catch {
      // ignore
    }
    return this.fallback.getTripById(id);
  }

  async updateTrip(trip: Trip): Promise<Trip> {
    return this.saveTrip(trip);
  }
}

export const tripRepository: TripRepository = new SupabaseTripRepository();

import { Trip } from '../../types';

export interface TripRepository {
  name: string;
  isRealDatabase: boolean;
  saveTrip(trip: Trip): Promise<Trip>;
  getTripByToken(token: string): Promise<Trip | null>;
  getTripById(id: string): Promise<Trip | null>;
  updateTrip(trip: Trip): Promise<Trip>;
}

export class InMemoryTripRepository implements TripRepository {
  name = 'InMemoryTripRepository (Mock)';
  isRealDatabase = false;
  private trips = new Map<string, Trip>();

  async saveTrip(trip: Trip): Promise<Trip> {
    this.trips.set(trip.id, { ...trip });
    if (trip.secure_token) {
      this.trips.set(trip.secure_token, { ...trip });
    }
    // Also save in localStorage for client persistence in mock dev mode
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

  async saveTrip(trip: Trip): Promise<Trip> {
    const res = await fetch('/api/db/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip)
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(`DATABASE_UNAVAILABLE: Falha ao salvar viagem no Supabase (${errJson.error || res.statusText})`);
    }
    return await res.json();
  }

  async getTripByToken(token: string): Promise<Trip | null> {
    const res = await fetch(`/api/db/trips/token/${encodeURIComponent(token)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Falha ao obter viagem pelo token ${token} no Supabase`);
    }
    return await res.json();
  }

  async getTripById(id: string): Promise<Trip | null> {
    const res = await fetch(`/api/db/trips/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Falha ao obter viagem ${id} no Supabase`);
    }
    return await res.json();
  }

  async updateTrip(trip: Trip): Promise<Trip> {
    return this.saveTrip(trip);
  }
}

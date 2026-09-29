import { SerraEvent, City } from '../../types';
import { SEED_EVENTS } from '../../data/seedData';

export interface EventRepository {
  name: string;
  getAllEvents(): Promise<SerraEvent[]>;
  getEventsByDateRange(startDate: string, endDate: string): Promise<SerraEvent[]>;
  getEventsByCity(city: City): Promise<SerraEvent[]>;
}

export class InMemoryEventRepository implements EventRepository {
  name = 'InMemoryEventRepository (Mock)';
  private events: SerraEvent[] = [...SEED_EVENTS];

  async getAllEvents(): Promise<SerraEvent[]> {
    return this.events;
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<SerraEvent[]> {
    return this.events.filter(e => e.start_date <= endDate && e.end_date >= startDate);
  }

  async getEventsByCity(city: City): Promise<SerraEvent[]> {
    return this.events.filter(e => e.city === city);
  }
}

export class SupabaseEventRepository implements EventRepository {
  name = 'SupabaseEventRepository';

  async getAllEvents(): Promise<SerraEvent[]> {
    const res = await fetch('/api/db/events');
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to fetch events from Supabase`);
    }
    return await res.json();
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<SerraEvent[]> {
    const res = await fetch(`/api/db/events?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`);
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to fetch events for range ${startDate} - ${endDate}`);
    }
    return await res.json();
  }

  async getEventsByCity(city: City): Promise<SerraEvent[]> {
    const res = await fetch(`/api/db/events?city=${encodeURIComponent(city)}`);
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to fetch events for city ${city}`);
    }
    return await res.json();
  }
}

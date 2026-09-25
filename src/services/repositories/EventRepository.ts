import { SerraEvent, City } from '../../types';
import { SEED_EVENTS } from '../../data/seedData';

export interface EventRepository {
  name: string;
  getAllEvents(): Promise<SerraEvent[]>;
  getEventsByDateRange(startDate: string, endDate: string): Promise<SerraEvent[]>;
  getEventsByCity(city: City): Promise<SerraEvent[]>;
}

export class SupabaseEventRepository implements EventRepository {
  name = 'SupabaseEventRepository';

  async getAllEvents(): Promise<SerraEvent[]> {
    try {
      const res = await fetch('/api/db/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // ignore
    }
    return SEED_EVENTS;
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<SerraEvent[]> {
    const all = await this.getAllEvents();
    return all.filter(e => e.start_date <= endDate && e.end_date >= startDate);
  }

  async getEventsByCity(city: City): Promise<SerraEvent[]> {
    const all = await this.getAllEvents();
    return all.filter(e => e.city === city);
  }
}

export const eventRepository: EventRepository = new SupabaseEventRepository();

import { SerraEvent } from '../../types';
import { SEED_EVENTS } from '../../data/seedData';

export interface EventProvider {
  name: string;
  getEventsForDates(startDate: string, endDate: string): Promise<SerraEvent[]>;
  getAllEvents(): Promise<SerraEvent[]>;
}

export class MockEventProvider implements EventProvider {
  name = 'DUO21 Event Calendar (Seed/Mock)';

  async getAllEvents(): Promise<SerraEvent[]> {
    return SEED_EVENTS;
  }

  async getEventsForDates(startDate: string, endDate: string): Promise<SerraEvent[]> {
    // Filter anchor events that overlap with trip dates
    return SEED_EVENTS.filter(evt => {
      return (evt.start_date <= endDate && evt.end_date >= startDate);
    });
  }
}

export const eventProvider: EventProvider = new MockEventProvider();

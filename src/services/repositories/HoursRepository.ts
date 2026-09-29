export interface PlaceHourRecord {
  id: string;
  place_id: string;
  day_of_week: number; // 0 = Domingo, 1 = Segunda ...
  open_time?: string;
  close_time?: string;
  closed: boolean;
  special_date?: string;
  source_id?: string;
  checked_at?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface HoursRepository {
  name: string;
  getByPlaceId(placeId: string): Promise<PlaceHourRecord[]>;
  getByPlaceAndDate(placeId: string, date: string): Promise<PlaceHourRecord | null>;
  upsert(record: Partial<PlaceHourRecord>): Promise<PlaceHourRecord>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryHoursRepository implements HoursRepository {
  name = 'InMemoryHoursRepository (Mock)';
  private hours = new Map<string, PlaceHourRecord>();

  async getByPlaceId(placeId: string): Promise<PlaceHourRecord[]> {
    return Array.from(this.hours.values()).filter(h => h.place_id === placeId);
  }

  async getByPlaceAndDate(placeId: string, dateStr: string): Promise<PlaceHourRecord | null> {
    const records = await this.getByPlaceId(placeId);
    // 1. Check special date
    const special = records.find(r => r.special_date === dateStr);
    if (special) return special;

    // 2. Check day of week
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    return records.find(r => r.day_of_week === dayOfWeek && !r.special_date) || null;
  }

  async upsert(record: Partial<PlaceHourRecord>): Promise<PlaceHourRecord> {
    const id = record.id || `hour_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const full: PlaceHourRecord = {
      id,
      place_id: record.place_id || '',
      day_of_week: record.day_of_week ?? 0,
      open_time: record.open_time,
      close_time: record.close_time,
      closed: record.closed ?? false,
      special_date: record.special_date,
      source_id: record.source_id || 'duo21_curatorship',
      checked_at: record.checked_at || new Date().toISOString(),
      confidence: record.confidence || 'high'
    };
    this.hours.set(id, full);
    return full;
  }

  async delete(id: string): Promise<boolean> {
    return this.hours.delete(id);
  }
}

export class SupabaseHoursRepository implements HoursRepository {
  name = 'SupabaseHoursRepository';

  async getByPlaceId(placeId: string): Promise<PlaceHourRecord[]> {
    const res = await fetch(`/api/db/places/${encodeURIComponent(placeId)}/hours`);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`DATABASE_UNAVAILABLE: Failed to fetch hours for place ${placeId}`);
    }
    return await res.json();
  }

  async getByPlaceAndDate(placeId: string, date: string): Promise<PlaceHourRecord | null> {
    const res = await fetch(`/api/db/places/${encodeURIComponent(placeId)}/hours?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`DATABASE_UNAVAILABLE: Failed to fetch hours for place ${placeId} on ${date}`);
    }
    return await res.json();
  }

  async upsert(record: Partial<PlaceHourRecord>): Promise<PlaceHourRecord> {
    const res = await fetch(`/api/db/places/${encodeURIComponent(record.place_id || '')}/hours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to upsert hours record`);
    }
    return await res.json();
  }

  async delete(id: string): Promise<boolean> {
    const res = await fetch(`/api/db/hours/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`DATABASE_UNAVAILABLE: Failed to delete hour record ${id}`);
    }
    return true;
  }
}

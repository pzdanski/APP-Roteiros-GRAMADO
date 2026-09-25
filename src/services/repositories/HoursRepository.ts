export interface PlaceHourRecord {
  id: string;
  place_id: string;
  day_of_week: number; // 0 = Domingo, 1 = Segunda ...
  open_time?: string;
  close_time?: string;
  closed: boolean;
  special_date?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface HoursRepository {
  getHoursForPlace(placeId: string): Promise<PlaceHourRecord[]>;
}

export class SupabaseHoursRepository implements HoursRepository {
  async getHoursForPlace(placeId: string): Promise<PlaceHourRecord[]> {
    try {
      const res = await fetch(`/api/db/places/${placeId}/hours`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return [];
  }
}

export const hoursRepository: HoursRepository = new SupabaseHoursRepository();

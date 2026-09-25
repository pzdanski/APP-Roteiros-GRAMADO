export interface GooglePlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  openingHours?: string[];
  types?: string[];
}

export class GooglePlacesProvider {
  name = 'GooglePlacesProvider';
  private apiKey: string;

  constructor() {
    this.apiKey =
      (typeof process !== 'undefined' ? process.env?.GOOGLE_MAPS_API_KEY || process.env?.GOOGLE_PLACES_API_KEY : '') ||
      ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '');
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  getStatus(): 'CONNECTED' | 'CONFIGURATION_REQUIRED' {
    return this.isAvailable() ? 'CONNECTED' : 'CONFIGURATION_REQUIRED';
  }

  async searchPlace(query: string, city: string = 'Gramado'): Promise<GooglePlaceResult[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
          `${query} em ${city} RS`
        )}&key=${this.apiKey}`
      );
      if (res.ok) {
        const data = await res.json();
        return (data.results || []).map((r: any) => ({
          placeId: r.place_id,
          name: r.name,
          address: r.formatted_address,
          latitude: r.geometry?.location?.lat,
          longitude: r.geometry?.location?.lng,
          rating: r.rating,
          types: r.types
        }));
      }
    } catch (err) {
      console.warn('Google Places search error:', err);
    }
    return [];
  }

  async getPlaceDetails(googlePlaceId: string): Promise<Partial<GooglePlaceResult> | null> {
    if (!this.isAvailable()) return null;

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=name,rating,formatted_phone_number,opening_hours,geometry,formatted_address&key=${this.apiKey}`
      );
      if (res.ok) {
        const data = await res.json();
        const r = data.result;
        return {
          placeId: googlePlaceId,
          name: r.name,
          address: r.formatted_address,
          latitude: r.geometry?.location?.lat,
          longitude: r.geometry?.location?.lng,
          rating: r.rating,
          openingHours: r.opening_hours?.weekday_text
        };
      }
    } catch (err) {
      console.warn('Google Place details error:', err);
    }
    return null;
  }

  async getOpeningHours(googlePlaceId: string): Promise<string[] | null> {
    const details = await this.getPlaceDetails(googlePlaceId);
    return details?.openingHours || null;
  }

  async resolvePlaceId(name: string, city: string): Promise<string | null> {
    const results = await this.searchPlace(name, city);
    return results[0]?.placeId || null;
  }

  async getCoordinates(address: string): Promise<{ latitude: number; longitude: number } | null> {
    if (!this.isAvailable()) return null;

    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`
      );
      if (res.ok) {
        const data = await res.json();
        const loc = data.results?.[0]?.geometry?.location;
        if (loc) {
          return { latitude: loc.lat, longitude: loc.lng };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
}

export const googlePlacesProvider = new GooglePlacesProvider();

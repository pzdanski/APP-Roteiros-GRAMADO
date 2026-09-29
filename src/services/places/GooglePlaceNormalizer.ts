import { City } from '../../types';

export interface GoogleApiPlaceRaw {
  id?: string;
  name?: string; // Resource name format: "places/ChIJ..."
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }>;
    weekdayDescriptions?: string[];
  };
  types?: string[];
}

export interface ResolvedPlace {
  externalId: string; // Google Place ID (e.g. "ChIJ...")
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  city: City;
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  openingHours?: Record<string, string>;
  weekdayDescriptions?: string[];
  rating?: number;
  userRatingCount?: number;
  provider: 'GOOGLE_PLACES' | 'SUPABASE' | 'CACHE' | 'MOCK';
  cached: boolean;
  resolvedAt: string;
}

export class GooglePlaceNormalizer {
  /**
   * Detects which Serra Gaúcha municipality the place belongs to based on address / coordinates.
   */
  static detectCity(address: string = '', lat?: number, lng?: number): City {
    const addr = address.toLowerCase();
    if (addr.includes('canela')) return 'Canela';
    if (addr.includes('nova petrópolis') || addr.includes('nova petropolis')) return 'Nova Petrópolis';
    if (addr.includes('gramado')) return 'Gramado';

    // Coordinate heuristics for Serra Gaúcha
    if (lat && lng) {
      // Canela is generally further east (longitude > -50.84)
      if (lng > -50.84) return 'Canela';
      // Nova Petrópolis is further west (longitude < -50.89)
      if (lng < -50.89) return 'Nova Petrópolis';
    }

    return 'Gramado'; // Default Serra anchor
  }

  /**
   * Normalizes raw response from Google Places API (New) into standard ResolvedPlace.
   */
  static normalize(
    raw: GoogleApiPlaceRaw,
    provider: 'GOOGLE_PLACES' | 'CACHE' | 'MOCK' = 'GOOGLE_PLACES',
    cached = false
  ): ResolvedPlace {
    // In Places API (New), id is either in `id` or parsed from `places/{placeId}` in `name`
    let placeId = raw.id || '';
    if (!placeId && raw.name && raw.name.startsWith('places/')) {
      placeId = raw.name.replace('places/', '');
    }

    const name = raw.displayName?.text || raw.name || 'Local Não Identificado';
    const address = raw.formattedAddress || 'Endereço não informado';
    const lat = Number(raw.location?.latitude || -29.3789);
    const lng = Number(raw.location?.longitude || -50.8741);
    const city = this.detectCity(address, lat, lng);

    let status: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' = 'OPERATIONAL';
    if (raw.businessStatus === 'CLOSED_PERMANENTLY') {
      status = 'CLOSED_PERMANENTLY';
    } else if (raw.businessStatus === 'CLOSED_TEMPORARILY') {
      status = 'CLOSED_TEMPORARILY';
    }

    // Convert weekday descriptions to opening hours dictionary
    const openingHours: Record<string, string> = {};
    const descriptions = raw.regularOpeningHours?.weekdayDescriptions || [];
    const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

    for (const desc of descriptions) {
      const lower = desc.toLowerCase();
      for (let i = 0; i < dayMap.length; i++) {
        const short = dayMap[i];
        if (lower.startsWith(short) || lower.includes(short)) {
          const parts = desc.split(':');
          if (parts.length > 1) {
            openingHours[short] = parts.slice(1).join(':').trim();
          }
        }
      }
    }

    return {
      externalId: placeId,
      name,
      address,
      latitude: lat,
      longitude: lng,
      city,
      businessStatus: status,
      openingHours: Object.keys(openingHours).length > 0 ? openingHours : undefined,
      weekdayDescriptions: descriptions.length > 0 ? descriptions : undefined,
      rating: raw.rating,
      userRatingCount: raw.userRatingCount,
      provider,
      cached,
      resolvedAt: new Date().toISOString()
    };
  }
}

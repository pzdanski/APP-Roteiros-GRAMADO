import { ResolvedPlace } from './GooglePlaceNormalizer';
import { getApiUrl } from '../utils/apiClient';

export interface AutocompleteSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
}

export class GooglePlacesProvider {
  name = 'GooglePlacesProvider';

  /**
   * Health check and status inquiry against backend
   */
  async getStatus(): Promise<{ status: 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'MOCK' | 'ERROR'; details: string }> {
    try {
      const res = await fetch(getApiUrl('/api/places/health'));
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // ignore
    }
    return {
      status: 'CONFIGURATION_REQUIRED',
      details: 'Serviço de Places indisponível ou aguardando configuração de chave no servidor.'
    };
  }

  /**
   * Text search through server-side proxy with minimum field mask.
   */
  async searchText(query: string, options: { tripId?: string; maxResults?: number } = {}): Promise<ResolvedPlace[]> {
    try {
      const res = await fetch(getApiUrl('/api/places/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          tripId: options.tripId,
          maxResults: options.maxResults || 5
        })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[GooglePlacesProvider] searchText error:', err);
    }
    return [];
  }

  async searchPlace(query: string, city: string = 'Gramado'): Promise<ResolvedPlace[]> {
    return this.searchText(`${query} ${city}`);
  }

  /**
   * Place details through server-side proxy
   */
  async getPlaceDetails(placeId: string, tripId?: string): Promise<ResolvedPlace | null> {
    try {
      const res = await fetch(getApiUrl(`/api/places/${encodeURIComponent(placeId)}${tripId ? `?tripId=${encodeURIComponent(tripId)}` : ''}`));
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[GooglePlacesProvider] getPlaceDetails error:', err);
    }
    return null;
  }

  /**
   * Resolve Google Place ID
   */
  async resolvePlaceId(placeName: string, city: string = 'Gramado'): Promise<string | null> {
    const results = await this.searchText(`${placeName} ${city}`);
    return results[0]?.externalId || null;
  }

  /**
   * Coordinates
   */
  async getCoordinates(placeId: string): Promise<{ latitude: number; longitude: number } | null> {
    const details = await this.getPlaceDetails(placeId);
    if (details && details.latitude && details.longitude) {
      return { latitude: details.latitude, longitude: details.longitude };
    }
    return null;
  }

  /**
   * Opening hours
   */
  async getOpeningHours(placeId: string): Promise<Record<string, string> | null> {
    const details = await this.getPlaceDetails(placeId);
    return details?.openingHours || null;
  }

  /**
   * Place operational status
   */
  async getPlaceStatus(placeId: string): Promise<string | null> {
    const details = await this.getPlaceDetails(placeId);
    return details?.businessStatus || null;
  }

  /**
   * Autocomplete with debounce support (Section 31 & 32)
   */
  async autocomplete(input: string, cityHint = 'Gramado'): Promise<AutocompleteSuggestion[]> {
    if (!input || input.trim().length < 3) return [];
    try {
      const res = await fetch(getApiUrl(`/api/places/autocomplete?input=${encodeURIComponent(input)}&city=${encodeURIComponent(cityHint)}`));
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[GooglePlacesProvider] autocomplete error:', err);
    }
    return [];
  }
}

export const googlePlacesProvider = new GooglePlacesProvider();

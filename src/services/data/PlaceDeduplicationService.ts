import { Place } from '../../types';

export interface DuplicateMatch {
  existingPlace: Place;
  candidatePlace: Partial<Place>;
  matchReason: 'GOOGLE_PLACE_ID' | 'NAME_AND_PROXIMITY' | 'EXACT_COORDINATES' | 'SIMILAR_SLUG';
  confidenceScore: number; // 0 - 100
}

export class PlaceDeduplicationService {
  /**
   * Normalizes place names for robust phonetic and substring comparison.
   * Examples:
   * "Parque Lago Negro" -> "lago negro"
   * "Catedral de Pedra (Canela)" -> "catedral de pedra"
   */
  normalizeName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(parque|praca|restaurante|pizzaria|cafe|cantina|museu|loja|chocolates?|hotel|pousada)\b/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculates straight-line distance in meters between two coordinates.
   */
  calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Checks whether a new candidate place is a duplicate of any existing place in the catalog.
   */
  findDuplicate(candidate: Partial<Place>, existingCatalog: Place[]): DuplicateMatch | null {
    // 1. Google Place ID match (Exact - 100% confidence)
    if (candidate.google_place_id) {
      const match = existingCatalog.find(
        p => p.google_place_id && p.google_place_id === candidate.google_place_id
      );
      if (match) {
        return {
          existingPlace: match,
          candidatePlace: candidate,
          matchReason: 'GOOGLE_PLACE_ID',
          confidenceScore: 100
        };
      }
    }

    const candNameNorm = candidate.name ? this.normalizeName(candidate.name) : '';
    const candSlug = candidate.slug || (candNameNorm ? candNameNorm.replace(/\s+/g, '-') : '');

    for (const existing of existingCatalog) {
      // 2. Slug exact match
      if (existing.slug && candSlug && existing.slug === candSlug && existing.city === candidate.city) {
        return {
          existingPlace: existing,
          candidatePlace: candidate,
          matchReason: 'SIMILAR_SLUG',
          confidenceScore: 95
        };
      }

      // 3. Proximity and name similarity
      if (
        typeof candidate.latitude === 'number' &&
        typeof candidate.longitude === 'number' &&
        typeof existing.latitude === 'number' &&
        typeof existing.longitude === 'number'
      ) {
        const distanceM = this.calculateDistanceMeters(
          candidate.latitude,
          candidate.longitude,
          existing.latitude,
          existing.longitude
        );

        // Under 30 meters is virtually identical address/building
        if (distanceM < 30) {
          return {
            existingPlace: existing,
            candidatePlace: candidate,
            matchReason: 'EXACT_COORDINATES',
            confidenceScore: 90
          };
        }

        // Under 200 meters with overlapping normalized names
        if (distanceM < 200 && candNameNorm && existing.name) {
          const existNameNorm = this.normalizeName(existing.name);
          const isSubstring = candNameNorm.includes(existNameNorm) || existNameNorm.includes(candNameNorm);
          if (isSubstring || candNameNorm === existNameNorm) {
            return {
              existingPlace: existing,
              candidatePlace: candidate,
              matchReason: 'NAME_AND_PROXIMITY',
              confidenceScore: 88
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Reconciles an existing place with updated candidate information without overwriting authoritative fields.
   */
  reconcile(existing: Place, candidate: Partial<Place>): Place {
    return {
      ...existing,
      google_place_id: existing.google_place_id || candidate.google_place_id,
      phone: existing.phone || candidate.phone,
      website: existing.website || candidate.website,
      instagram: existing.instagram || candidate.instagram,
      booking_url: existing.booking_url || candidate.booking_url,
      // Keep authoritative opening_hours if already present
      opening_hours: Object.keys(existing.opening_hours || {}).length > 0
        ? existing.opening_hours
        : (candidate.opening_hours || existing.opening_hours),
      // Update coordinates if missing or refine
      latitude: existing.latitude || candidate.latitude || 0,
      longitude: existing.longitude || candidate.longitude || 0,
      // Merge tags safely
      tags: Array.from(new Set([...(existing.tags || []), ...(candidate.tags || [])])),
      updated_at: new Date().toISOString()
    };
  }
}

export const placeDeduplicationService = new PlaceDeduplicationService();

import { Place, City, PlaceCategory } from '../../types';
import { placeRepository } from '../repositories/RepositoryFactory';
import { placeQueryService } from './PlaceQueryService';
import { ResolvedPlace } from './GooglePlaceNormalizer';
import { getApiUrl } from '../utils/apiClient';

export const MIN_LOCAL_CANDIDATES = 5;

export interface DiscoveryResult {
  source: 'SUPABASE' | 'GOOGLE_DISCOVERY' | 'HYBRID';
  places: Array<Place | ResolvedPlace>;
  googleCallPerformed: boolean;
  message: string;
}

export class PlaceDiscoveryService {
  /**
   * Discovers places for a specific cuisine, interest or category.
   * STRICT RULE (Section 21 & 22):
   * 1. Check Supabase catalog first.
   * 2. If candidates >= MIN_LOCAL_CANDIDATES (5): GOOGLE IS NOT CALLED! Zero cost.
   * 3. If candidates < 5: Controlled Google Places discovery is permitted.
   */
  async discoverCandidates(options: {
    city: City;
    queryText?: string;
    category?: PlaceCategory;
    tag?: string;
    tripId?: string;
  }): Promise<DiscoveryResult> {
    const { city, queryText, category, tag, tripId } = options;

    // 1. Query local Supabase candidates first
    let localCandidates: Place[] = [];
    try {
      localCandidates = await placeQueryService.queryPlaces({
        city,
        category,
        queryText: queryText || tag
      });
    } catch (err) {
      console.warn('[DiscoveryService] Error querying local candidates:', err);
    }

    // 2. Check candidate count against MIN_LOCAL_CANDIDATES threshold
    if (localCandidates.length >= MIN_LOCAL_CANDIDATES) {
      console.log(`[DiscoveryService] Found ${localCandidates.length} local candidates for "${queryText || tag}". Google Places Discovery SKIPPED (Threshold: ${MIN_LOCAL_CANDIDATES}).`);
      return {
        source: 'SUPABASE',
        places: localCandidates,
        googleCallPerformed: false,
        message: `Encontrados ${localCandidates.length} estabelecimentos catalogados na base DUO21. Consulta externa evitada.`
      };
    }

    // 3. Candidates < 5: Controlled Google Discovery permitted (Section 22 & 24)
    console.log(`[DiscoveryService] Found only ${localCandidates.length} local candidates. Executing controlled Google Discovery for "${queryText || tag}" in ${city}.`);

    try {
      const searchPrompt = `${queryText || tag || category || 'atração'} ${city}`;
      const res = await fetch(getApiUrl('/api/places/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchPrompt,
          tripId
        })
      });

      if (!res.ok) {
        throw new Error(`Google Places discovery returned HTTP ${res.status}`);
      }

      const googleResults: ResolvedPlace[] = await res.json();

      // Filter out permanently closed establishments (Section 29)
      const validGoogle = googleResults.filter(r => r.businessStatus !== 'CLOSED_PERMANENTLY');

      // Combine local catalog + normalized Google discoveries
      const combined: Array<Place | ResolvedPlace> = [...localCandidates, ...validGoogle];

      return {
        source: localCandidates.length > 0 ? 'HYBRID' : 'GOOGLE_DISCOVERY',
        places: combined,
        googleCallPerformed: true,
        message: `Descoberta controlada executada: ${localCandidates.length} locais próprios + ${validGoogle.length} novos identificados.`
      };
    } catch (err: any) {
      console.warn('[DiscoveryService] Google discovery failed, returning available local candidates:', err);
      return {
        source: 'SUPABASE',
        places: localCandidates,
        googleCallPerformed: false,
        message: `Falha na consulta externa. Utilizando ${localCandidates.length} locais disponíveis na base DUO21.`
      };
    }
  }

  /**
   * Specialized fondue discovery test (Section 44)
   */
  async discoverFondueRestaurants(city: City = 'Gramado', tripId?: string): Promise<DiscoveryResult> {
    return this.discoverCandidates({
      city,
      queryText: 'fondue',
      category: 'restaurante',
      tag: 'fondue',
      tripId
    });
  }
}

export const placeDiscoveryService = new PlaceDiscoveryService();

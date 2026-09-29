import { Place, City } from '../../types';
import { placeRepository, cacheRepository } from '../repositories/RepositoryFactory';
import { ResolvedPlace } from './GooglePlaceNormalizer';
import { getApiUrl } from '../utils/apiClient';

export interface AccommodationResolutionResult {
  status: 'RESOLVED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'PROVISIONAL';
  place?: ResolvedPlace;
  candidates?: ResolvedPlace[];
  internalPlace?: Place;
  provisionalCoordinates?: { latitude: number; longitude: number; city: City };
  message: string;
}

export interface MustHaveResolutionResult {
  status: 'FOUND_IN_CATALOG' | 'RESOLVED_EXTERNAL' | 'NOT_FOUND';
  internalPlaceId?: string;
  place?: Place | ResolvedPlace;
  message: string;
}

export class PlaceResolutionService {
  /**
   * Resolves accommodation specified by user briefing.
   * Section 10 & 11 & 33:
   * 1. If "Ainda não reservei" -> zero external calls, returns provisional anchor.
   * 2. Search in Supabase catalog first.
   * 3. Check external data cache.
   * 4. Call Google Places API via backend proxy.
   */
  async resolveAccommodation(
    hotelName: string,
    cityHint: City = 'Gramado',
    tripId?: string
  ): Promise<AccommodationResolutionResult> {
    const raw = (hotelName || '').trim();

    // Section 33: UX Sem Hospedagem
    if (!raw || raw.toLowerCase().includes('não reservei') || raw.toLowerCase().includes('nao reservei') || raw.toLowerCase().includes('sem hotel')) {
      const provisional = this.getProvisionalLogisticsBase(cityHint);
      return {
        status: 'PROVISIONAL',
        provisionalCoordinates: provisional,
        message: `Hospedagem provisória ancorada no centro de ${cityHint}. Nenhuma chamada externa realizada.`
      };
    }

    // 1. Search in Supabase catalog first
    try {
      const localPlaces = await placeRepository.getAllPlaces();
      const lowerRaw = raw.toLowerCase();
      const localMatch = localPlaces.find(p => {
        const pName = p.name.toLowerCase();
        return (
          pName.includes(lowerRaw) ||
          lowerRaw.includes(pName) ||
          p.slug.toLowerCase().includes(lowerRaw)
        );
      });

      if (localMatch && localMatch.latitude && localMatch.longitude) {
        return {
          status: 'RESOLVED',
          internalPlace: localMatch,
          place: {
            externalId: localMatch.google_place_id || localMatch.id,
            name: localMatch.name,
            address: localMatch.address,
            latitude: localMatch.latitude,
            longitude: localMatch.longitude,
            city: localMatch.city,
            businessStatus: 'OPERATIONAL',
            provider: 'SUPABASE',
            cached: true,
            resolvedAt: new Date().toISOString()
          },
          message: `✓ Hospedagem identificada na base DUO21: ${localMatch.name} (${localMatch.city})`
        };
      }
    } catch (err) {
      console.warn('[PlaceResolution] Local catalog lookup failed:', err);
    }

    // 2. Check external data cache before Google
    const cacheKey = `accommodation:resolution:${raw.toLowerCase()}:${cityHint}`;
    const cached = await cacheRepository.get<ResolvedPlace>(cacheKey);
    if (cached) {
      return {
        status: 'RESOLVED',
        place: { ...cached, provider: 'CACHE', cached: true },
        message: `✓ Hospedagem localizada (Cache): ${cached.name} (${cached.city})`
      };
    }

    // 3. Consult Google Places API via secure backend endpoint
    try {
      const queryText = `${raw} ${cityHint}`;
      const res = await fetch(getApiUrl('/api/places/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          includedType: 'lodging',
          tripId
        })
      });

      if (!res.ok) {
        throw new Error(`Google Places search returned HTTP ${res.status}`);
      }

      const results: ResolvedPlace[] = await res.json();

      if (!results || results.length === 0) {
        // Fallback to provisional anchor
        const provisional = this.getProvisionalLogisticsBase(cityHint);
        return {
          status: 'NOT_FOUND',
          provisionalCoordinates: provisional,
          message: `Não foi possível encontrar "${raw}". Usando centro de ${cityHint} como referência.`
        };
      }

      // Check confidence & ambiguity (Section 11)
      if (results.length === 1 || this.isHighConfidenceMatch(results[0], raw, cityHint)) {
        const topMatch = results[0];
        // Cache resolution for 30 days
        await cacheRepository.set(cacheKey, 'GOOGLE_PLACES', 'resolveAccommodation', topMatch, 30 * 86400);

        return {
          status: 'RESOLVED',
          place: topMatch,
          message: `✓ Hospedagem localizada: ${topMatch.name} (${topMatch.city})`
        };
      }

      // Multiple candidates found -> Ambiguous (Section 11)
      return {
        status: 'AMBIGUOUS',
        candidates: results.slice(0, 3),
        message: `Encontrei ${results.length} opções para "${raw}". Qual é a sua hospedagem?`
      };
    } catch (err: any) {
      console.warn('[PlaceResolution] Google Places search error:', err);
      const provisional = this.getProvisionalLogisticsBase(cityHint);
      return {
        status: 'PROVISIONAL',
        provisionalCoordinates: provisional,
        message: `Serviço de busca temporariamente indisponível. Usando referência central em ${cityHint}.`
      };
    }
  }

  /**
   * Resolves a mandatory "must-have" place specified by the user.
   * Section 15 & 16: Must-have cannot be invented by LLM! Must resolve to real entity.
   */
  async resolveMustHave(mustHaveItem: string, cityHint?: City, tripId?: string): Promise<MustHaveResolutionResult> {
    const raw = (mustHaveItem || '').trim();
    if (!raw) {
      return { status: 'NOT_FOUND', message: 'Item obrigatório vazio.' };
    }

    // 1. Search in local catalog first
    try {
      const places = await placeRepository.getAllPlaces();
      const lower = raw.toLowerCase();
      const local = places.find(p => 
        p.name.toLowerCase().includes(lower) ||
        lower.includes(p.name.toLowerCase()) ||
        p.slug.toLowerCase().includes(lower)
      );

      if (local) {
        return {
          status: 'FOUND_IN_CATALOG',
          internalPlaceId: local.id,
          place: local,
          message: `Local obrigatório identificado no catálogo oficial: ${local.name}`
        };
      }
    } catch (err) {
      console.warn('[PlaceResolution] Error searching mustHave in catalog:', err);
    }

    // 2. Query Google Places via backend proxy
    try {
      const res = await fetch(getApiUrl('/api/places/search'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `${raw} Serra Gaúcha`,
          tripId
        })
      });

      if (res.ok) {
        const results: ResolvedPlace[] = await res.json();
        if (results.length > 0) {
          const top = results[0];
          return {
            status: 'RESOLVED_EXTERNAL',
            place: top,
            message: `Local resolvido via Google Places: ${top.name}`
          };
        }
      }
    } catch {
      // ignore
    }

    return {
      status: 'NOT_FOUND',
      message: `Não foi possível localizar o ponto obrigatório "${raw}".`
    };
  }

  /**
   * Provisional base coordinates when hotel is not booked (Section 33).
   */
  getProvisionalLogisticsBase(city: City = 'Gramado'): { latitude: number; longitude: number; city: City } {
    switch (city) {
      case 'Canela':
        return { latitude: -29.3592, longitude: -50.8142, city: 'Canela' };
      case 'Nova Petrópolis':
        return { latitude: -29.3142, longitude: -50.9083, city: 'Nova Petrópolis' };
      case 'Gramado':
      default:
        return { latitude: -29.3789, longitude: -50.8741, city: 'Gramado' };
    }
  }

  private isHighConfidenceMatch(place: ResolvedPlace, rawQuery: string, cityHint: City): boolean {
    const pName = place.name.toLowerCase();
    const qName = rawQuery.toLowerCase();
    return pName.includes(qName) || (qName.includes(pName) && place.city === cityHint);
  }
}

export const placeResolutionService = new PlaceResolutionService();

import { GooglePlaceNormalizer, ResolvedPlace } from '../../services/places/GooglePlaceNormalizer';
import { supabaseServer } from '../supabaseServer';
import { singleFlight } from '../cache/SingleFlight';
import { externalFetch } from '../utils/externalFetch';
import { googlePlacesCostGuard } from '../costguard/GooglePlacesCostGuard';
import {
  rankAndScoreCandidates,
  buildPlaceResolutionQuery,
  DEFAULT_RESOLUTION_RADIUS_METERS,
  PlaceCandidateDTO
} from '../../services/places/SmartPlaceResolver';
import { CATALOG_ACCELERATOR_FIXTURES } from './MockCatalogSeed';

export interface LocationBiasCircle {
  center: { latitude: number; longitude: number };
  radius: number; // in meters
}

export const SERRA_GAUCHA_LOCATION_BIAS: LocationBiasCircle = {
  center: { latitude: -29.3748, longitude: -50.8764 },
  radius: 25000.0 // 25km covers Gramado, Canela, Nova Petrópolis
};

// Field Masks (Sprint 10A & 10B: Surgical FieldMasks only, never *)
export const GOOGLE_FIELD_MASKS = {
  RESOLUTION_INITIAL: 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
  SMART_RESOLUTION: 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount',
  PLACE_RESOLUTION: 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
  ENRICHMENT: 'id,displayName,formattedAddress,location,types,regularOpeningHours,rating,userRatingCount,websiteUri,googleMapsUri,nationalPhoneNumber',
  MEDIA: 'id,displayName,photos',
  HOURS: 'id,displayName,businessStatus,regularOpeningHours',
  DETAIL: 'id,displayName,formattedAddress,location,types,regularOpeningHours,rating,userRatingCount,websiteUri,googleMapsUri,nationalPhoneNumber',
  DISCOVERY: 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.rating,places.userRatingCount'
};

// TTL in seconds (Section 7)
export const CACHE_TTLS = {
  PLACE_ID_COORDS: 30 * 86400, // 30 days
  ADDRESS: 30 * 86400,        // 30 days
  BUSINESS_STATUS: 86400,     // 24 hours
  HOURS: 86400,               // 24 hours
  SEARCH_RESULTS: 7 * 86400   // 7 days
};

// Curated seed for MOCK / Development fallback
const MOCK_PLACES_CATALOG: Record<string, ResolvedPlace> = {
  'hotel sky gramado': {
    externalId: 'ChIJ-hotel-sky-gramado-real',
    name: 'Hotel Sky Gramado',
    address: 'Av. das Hortênsias, 680, Gramado - RS, 95670-000',
    latitude: -29.3878,
    longitude: -50.8752,
    city: 'Gramado',
    businessStatus: 'OPERATIONAL',
    provider: 'MOCK',
    cached: false,
    resolvedAt: new Date().toISOString()
  },
  'lago negro': {
    externalId: 'ChIJQ3y-demo-lago-negro',
    name: 'Lago Negro',
    address: 'R. A. J. Renner, Bairro Planalto, Gramado - RS, 95670-000',
    latitude: -29.3888,
    longitude: -50.8808,
    city: 'Gramado',
    businessStatus: 'OPERATIONAL',
    types: ['tourist_attraction', 'park', 'point_of_interest'],
    rating: 4.8,
    userRatingCount: 28450,
    websiteUri: 'https://gramado.rs.gov.br/turismo/lago-negro',
    googleMapsUri: 'https://maps.google.com/?cid=1029384756192837465',
    nationalPhoneNumber: '(54) 3286-0000',
    openingHours: {
      'seg': 'Aberto 24 horas',
      'ter': 'Aberto 24 horas',
      'qua': 'Aberto 24 horas',
      'qui': 'Aberto 24 horas',
      'sex': 'Aberto 24 horas',
      'sab': 'Aberto 24 horas',
      'dom': 'Aberto 24 horas'
    },
    weekdayDescriptions: [
      'segunda-feira: Aberto 24 horas',
      'terça-feira: Aberto 24 horas',
      'quarta-feira: Aberto 24 horas',
      'quinta-feira: Aberto 24 horas',
      'sexta-feira: Aberto 24 horas',
      'sábado: Aberto 24 horas',
      'domingo: Aberto 24 horas'
    ],
    provider: 'MOCK',
    cached: false,
    resolvedAt: new Date().toISOString()
  },
  'lago negro casa grande': {
    externalId: 'ChIJ-lago-negro-casa-grande',
    name: 'Lago Negro',
    address: 'R. Vinte e Cinco de Julho, 439 - Casa Grande, Gramado - RS',
    latitude: -29.3520,
    longitude: -50.8880,
    city: 'Gramado',
    businessStatus: 'OPERATIONAL',
    types: ['point_of_interest', 'establishment'],
    rating: 4.8,
    userRatingCount: 104,
    provider: 'MOCK',
    cached: false,
    resolvedAt: new Date().toISOString()
  },
  'mini mundo': {
    externalId: 'ChIJmini-mundo-demo',
    name: 'Mini Mundo',
    address: 'Rua Horácio Cardoso, 291, Gramado - RS',
    latitude: -29.3820,
    longitude: -50.8770,
    city: 'Gramado',
    businessStatus: 'OPERATIONAL',
    provider: 'MOCK',
    cached: false,
    resolvedAt: new Date().toISOString()
  },
  'catedral de pedra': {
    externalId: 'ChIJcatedral-pedra-canela',
    name: 'Catedral de Pedra (Paróquia N. S. de Lourdes)',
    address: 'Praça da Matriz, 69, Centro, Canela - RS',
    latitude: -29.3595,
    longitude: -50.8145,
    city: 'Canela',
    businessStatus: 'OPERATIONAL',
    provider: 'MOCK',
    cached: false,
    resolvedAt: new Date().toISOString()
  },
  'rua coberta': {
    externalId: 'ChIJrua-coberta-gramado',
    name: 'Rua Coberta de Gramado',
    address: 'Rua Madre Verônica, Centro, Gramado - RS',
    latitude: -29.3789,
    longitude: -50.8741,
    city: 'Gramado',
    businessStatus: 'OPERATIONAL',
    provider: 'MOCK',
    cached: false,
    resolvedAt: new Date().toISOString()
  }
};

export class GooglePlacesServerProvider {
  private apiKey: string;
  private baseUrl = 'https://places.googleapis.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = (apiKey || process.env.GOOGLE_MAPS_API_KEY || '').replace(/^["']|["']$/g, '').trim();
  }

  syncWithEnv(validatedEnv?: { GOOGLE_MAPS_API_KEY?: string }): void {
    if (validatedEnv?.GOOGLE_MAPS_API_KEY) {
      this.apiKey = validatedEnv.GOOGLE_MAPS_API_KEY.replace(/^["']|["']$/g, '').trim();
    } else if (process.env.GOOGLE_MAPS_API_KEY) {
      this.apiKey = process.env.GOOGLE_MAPS_API_KEY.replace(/^["']|["']$/g, '').trim();
    }
  }

  getApiKey(): string {
    const raw = this.apiKey || process.env.GOOGLE_MAPS_API_KEY || '';
    return raw.replace(/^["']|["']$/g, '').trim();
  }

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.length > 10);
  }

  /**
   * Health check to test Google Places connection.
   * Safe status check: evaluates configuration & Cost Guard state without consuming API quota.
   */
  async healthCheck(): Promise<{ status: 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'DISABLED' | 'ERROR'; details: string; latency_ms: number }> {
    if (!this.isConfigured()) {
      return {
        status: 'CONFIGURATION_REQUIRED',
        details: 'GOOGLE_MAPS_API_KEY não configurada no servidor (esperada no .env ou Secret Manager).',
        latency_ms: 0
      };
    }

    if (!googlePlacesCostGuard.getConfig().enabled) {
      return {
        status: 'DISABLED',
        details: 'Google Places desativado pelo Cost Guard (GOOGLE_PLACES_ENABLED=false). Nenhuma chamada externa é permitida.',
        latency_ms: 0
      };
    }

    return {
      status: 'CONNECTED',
      details: 'Google Places API (New) operacional e pronta para consumo controlado.',
      latency_ms: 0
    };
  }

  /**
   * Text Search (New)
   * POST https://places.googleapis.com/v1/places:searchText
   */
  async searchText(
    query: string,
    options: {
      fieldMask?: string;
      locationBias?: LocationBiasCircle;
      maxResultCount?: number;
      includedType?: string;
      skipCache?: boolean;
      tripId?: string;
    } = {}
  ): Promise<ResolvedPlace[]> {
    const mask = options.fieldMask || GOOGLE_FIELD_MASKS.PLACE_RESOLUTION;
    if (mask.includes('*')) {
      throw new Error('INVALID_FIELD_MASK: FieldMask "*" ou curingas são estritamente proibidos pelo Cost Guard. Solicite apenas campos cirúrgicos.');
    }

    const cleanQuery = query.trim();
    const biasPart = options.locationBias
      ? `:${options.locationBias.center.latitude.toFixed(4)},${options.locationBias.center.longitude.toFixed(4)},${Math.round(options.locationBias.radius)}`
      : '';
    const cacheKey = `google_places:search:${cleanQuery.toLowerCase()}:${mask}${biasPart}`;

    // 1. Check external data cache first (Section 6 & 19)
    if (!options.skipCache) {
      try {
        const cached = await supabaseServer.getCache(cacheKey);
        if (cached && cached.payload) {
          googlePlacesCostGuard.recordCall({
            endpoint: '/places:searchText',
            sku: 'TextSearch_New',
            fields: mask,
            cache_hit: true,
            estimated_cost_brl: 0,
            success: true
          });
          await supabaseServer.logApiUsage({
            trip_id: options.tripId || null,
            provider: 'GOOGLE_PLACES',
            operation: 'searchText',
            request_count: 1,
            estimated_cost_brl: 0,
            cached: true
          });
          return cached.payload.map((item: any) => ({ ...item, cached: true, provider: 'CACHE' }));
        }
      } catch (err) {
        console.warn('[Places Cache] Cache lookup error:', err);
      }
    }

    // 2. Mock mode if key is missing or mock key in test
    const apiKey = this.getApiKey();
    if (!this.isConfigured() || apiKey.startsWith('mock-')) {
      const mockResults = await this.mockSearch(cleanQuery, options.tripId);
      googlePlacesCostGuard.recordCall({
        endpoint: '/places:searchText',
        sku: 'TextSearch_New',
        fields: mask,
        cache_hit: false,
        place_name: cleanQuery,
        estimated_cost_brl: 0.18,
        success: true
      });
      try {
        await supabaseServer.setCache(
          cacheKey,
          'GOOGLE_PLACES',
          'searchText',
          mockResults,
          CACHE_TTLS.SEARCH_RESULTS
        );
      } catch (err) {
        console.warn('[Places Cache] Cache save error in mock:', err);
      }
      return mockResults;
    }

    return singleFlight.do(cacheKey, async () => {
      // Sprint 10B: Cost Guard Gate - Validate before ANY real external call
      const guardCheck = googlePlacesCostGuard.canMakeRequest('searchText', mask, this.isConfigured());
      if (!guardCheck.allowed) {
        throw new Error(guardCheck.reason || 'Chamada bloqueada pelo Cost Guard.');
      }

      // 3. Real Google Places API (New) call
      const payloadBody: any = {
        textQuery: cleanQuery,
        pageSize: options.maxResultCount || 5,
        languageCode: 'pt-BR'
      };

      if (options.includedType) {
        payloadBody.includedType = options.includedType;
      }

      const bias = options.locationBias || SERRA_GAUCHA_LOCATION_BIAS;
      payloadBody.locationBias = {
        circle: {
          center: {
            latitude: bias.center.latitude,
            longitude: bias.center.longitude
          },
          radius: bias.radius
        }
      };

      console.log(`[Google Places API] Requesting searchText. Query: "${cleanQuery}" | Mask: ${mask}`);

      const response = await externalFetch(`${this.baseUrl}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': mask
        },
        body: JSON.stringify(payloadBody),
        timeoutMs: 7000
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Google Places API Error] HTTP ${response.status}:`, errText);
        googlePlacesCostGuard.recordCall({
          endpoint: '/places:searchText',
          sku: 'TextSearch_New',
          fields: mask,
          cache_hit: false,
          place_name: cleanQuery,
          estimated_cost_brl: null,
          success: false,
          error: `HTTP ${response.status}: ${errText.substring(0, 100)}`,
          status_code: response.status
        });
        throw new Error(`PROVIDER_UNAVAILABLE: Google Places API retornou erro HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawPlaces = data.places || [];

      // Normalize results
      const results: ResolvedPlace[] = rawPlaces.map((raw: any) =>
        GooglePlaceNormalizer.normalize(raw, 'GOOGLE_PLACES', false)
      );

      // 4. Save in external_data_cache with TTL (7 days for search results)
      await supabaseServer.setCache(
        cacheKey,
        'GOOGLE_PLACES',
        'searchText',
        results,
        CACHE_TTLS.SEARCH_RESULTS
      );

      // 5. Register cost in CostGuard & api_usage
      const costEstimate = googlePlacesCostGuard.estimateOperationCost('searchText', mask);
      googlePlacesCostGuard.recordCall({
        endpoint: '/places:searchText',
        sku: 'TextSearch_New',
        fields: mask,
        cache_hit: false,
        place_name: cleanQuery,
        estimated_cost_brl: costEstimate.costBrl,
        success: true
      });

      await supabaseServer.logApiUsage({
        trip_id: options.tripId || null,
        provider: 'GOOGLE_PLACES',
        operation: 'searchText',
        request_count: 1,
        estimated_cost_brl: costEstimate.costBrl || 0.18,
        cached: false,
        metadata: {
          endpoint: '/places:searchText',
          sku: 'TextSearch_New',
          fields: mask,
          query: cleanQuery
        }
      });

      return results;
    });
  }

  /**
   * Place Details (New)
   * GET https://places.googleapis.com/v1/places/{placeId}
   */
  async getPlaceDetails(
    placeId: string,
    options: {
      fieldMask?: string;
      skipCache?: boolean;
      tripId?: string;
    } = {}
  ): Promise<ResolvedPlace | null> {
    const mask = options.fieldMask || GOOGLE_FIELD_MASKS.DETAIL;
    if (mask.includes('*')) {
      throw new Error('INVALID_FIELD_MASK: FieldMask "*" ou curingas são estritamente proibidos pelo Cost Guard. Solicite apenas campos cirúrgicos.');
    }

    const cacheKey = `google_places:details:${placeId}:${mask}`;

    // 1. Cache first
    if (!options.skipCache) {
      const cached = await supabaseServer.getCache(cacheKey);
      if (cached && cached.payload) {
        googlePlacesCostGuard.recordCall({
          endpoint: `/places/${placeId}`,
          sku: 'PlaceDetails_Essentials',
          fields: mask,
          place_id: placeId,
          cache_hit: true,
          estimated_cost_brl: 0,
          success: true
        });
        await supabaseServer.logApiUsage({
          trip_id: options.tripId || null,
          provider: 'GOOGLE_PLACES',
          operation: 'getPlaceDetails',
          request_count: 1,
          estimated_cost_brl: 0,
          cached: true
        });
        return { ...cached.payload, cached: true, provider: 'CACHE' };
      }
    }

    // 2. Mock mode if key missing or mock key in test
    const apiKey = this.getApiKey();
    if (!this.isConfigured() || apiKey.startsWith('mock-')) {
      for (const p of Object.values(MOCK_PLACES_CATALOG)) {
        if (p.externalId === placeId) {
          try {
            await supabaseServer.setCache(
              cacheKey,
              'GOOGLE_PLACES',
              'getPlaceDetails',
              p,
              CACHE_TTLS.PLACE_ID_COORDS
            );
          } catch (err) {
            console.warn('[Places Cache] Cache save error in mock details:', err);
          }
          const { sku, costBrl } = googlePlacesCostGuard.estimateOperationCost('getPlaceDetails', mask);
          googlePlacesCostGuard.recordCall({
            endpoint: `/places/${placeId}`,
            sku,
            fields: mask,
            place_id: placeId,
            cache_hit: false,
            estimated_cost_brl: costBrl || 0.12,
            success: true
          });
          await supabaseServer.logApiUsage({
            trip_id: options.tripId || null,
            provider: 'GOOGLE_PLACES',
            operation: 'getPlaceDetails',
            request_count: 1,
            estimated_cost_brl: costBrl || 0.12,
            cached: false
          });
          return p;
        }
      }
      return null;
    }

    // Sprint 10B: Cost Guard Gate - Validate before ANY real external call
    const guardCheck = googlePlacesCostGuard.canMakeRequest('getPlaceDetails', mask, this.isConfigured());
    if (!guardCheck.allowed) {
      throw new Error(guardCheck.reason || 'Chamada bloqueada pelo Cost Guard.');
    }

    console.log(`[Google Places API] Requesting details for ${placeId} | Mask: ${mask}`);

    const response = await fetch(`${this.baseUrl}/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.getApiKey(),
        'X-Goog-FieldMask': mask
      }
    });

    if (response.status === 404) return null;
    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Google Places Details Error] HTTP ${response.status}:`, errText);
      throw new Error(`PROVIDER_UNAVAILABLE: Google Places Details falhou (HTTP ${response.status})`);
    }

    const raw = await response.json();
    const resolved = GooglePlaceNormalizer.normalize(raw, 'GOOGLE_PLACES', false);

    // Save in cache (30 days for details/location)
    await supabaseServer.setCache(
      cacheKey,
      'GOOGLE_PLACES',
      'getPlaceDetails',
      resolved,
      CACHE_TTLS.PLACE_ID_COORDS
    );

    // Log cost
    await supabaseServer.logApiUsage({
      trip_id: options.tripId || null,
      provider: 'GOOGLE_PLACES',
      operation: 'getPlaceDetails',
      request_count: 1,
      estimated_cost_brl: 0.09,
      cached: false
    });

    return resolved;
  }

  /**
   * Search Nearby (New)
   * POST https://places.googleapis.com/v1/places:searchNearby
   */
  async searchNearby(
    options: {
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      includedTypes?: string[];
      fieldMask?: string;
      tripId?: string;
    }
  ): Promise<ResolvedPlace[]> {
    const mask = options.fieldMask || GOOGLE_FIELD_MASKS.DISCOVERY;
    const cacheKey = `google_places:nearby:${options.latitude.toFixed(4)},${options.longitude.toFixed(4)}:${options.includedTypes?.join(',') || 'all'}`;

    const cached = await supabaseServer.getCache(cacheKey);
    if (cached && cached.payload) {
      return cached.payload.map((item: any) => ({ ...item, cached: true, provider: 'CACHE' }));
    }

    if (!this.isConfigured()) {
      const mockNearby = Object.values(MOCK_PLACES_CATALOG);
      try {
        await supabaseServer.setCache(cacheKey, 'GOOGLE_PLACES', 'searchNearby', mockNearby, CACHE_TTLS.SEARCH_RESULTS);
      } catch (err) {
        console.warn('[Places Cache] Cache save error in nearby mock:', err);
      }
      return mockNearby;
    }

    const payload = {
      includedTypes: options.includedTypes || ['restaurant', 'tourist_attraction'],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude: options.latitude, longitude: options.longitude },
          radius: options.radiusMeters || 5000.0
        }
      }
    };

    const response = await fetch(`${this.baseUrl}/places:searchNearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.getApiKey(),
        'X-Goog-FieldMask': mask
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`PROVIDER_UNAVAILABLE: Nearby search error HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawPlaces = data.places || [];
    const results = rawPlaces.map((r: any) => GooglePlaceNormalizer.normalize(r, 'GOOGLE_PLACES', false));

    await supabaseServer.setCache(cacheKey, 'GOOGLE_PLACES', 'searchNearby', results, CACHE_TTLS.SEARCH_RESULTS);
    await supabaseServer.logApiUsage({
      trip_id: options.tripId || null,
      provider: 'GOOGLE_PLACES',
      operation: 'searchNearby',
      request_count: 1,
      estimated_cost_brl: 0.12,
      cached: false
    });

    return results;
  }

  /**
   * Internal mock resolution when key is not present (Development only)
   */
  private async mockSearch(query: string, tripId?: string): Promise<ResolvedPlace[]> {
    const q = query.toLowerCase();
    const matched: ResolvedPlace[] = [];

    for (const [key, place] of Object.entries(MOCK_PLACES_CATALOG)) {
      if (q.includes(key) || key.includes(q) || (key.startsWith('lago negro') && q.includes('lago negro'))) {
        matched.push({ ...place });
      }
    }

    // Busca nas fixtures do Catalog Accelerator (Sprint 10D)
    for (const fixture of CATALOG_ACCELERATOR_FIXTURES) {
      const nameMatch = q.includes(fixture.name.toLowerCase()) || fixture.name.toLowerCase().includes(q);
      const catMatch = fixture.category && q.includes(fixture.category.toLowerCase());
      const cityMatch = fixture.city && q.includes(fixture.city.toLowerCase());
      
      if (nameMatch || (catMatch && cityMatch)) {
        if (!matched.some(m => m.externalId === fixture.externalId)) {
          matched.push({ ...fixture });
        }
      }
    }

    if (matched.length === 0) {
      // Create a deterministic fallback place anchored in Gramado
      matched.push({
        externalId: `mock_place_${Date.now()}`,
        name: query,
        address: `${query}, Gramado - RS`,
        latitude: -29.3789,
        longitude: -50.8741,
        city: 'Gramado',
        businessStatus: 'OPERATIONAL',
        provider: 'MOCK',
        cached: false,
        resolvedAt: new Date().toISOString()
      });
    }

    await supabaseServer.logApiUsage({
      trip_id: tripId || null,
      provider: 'GOOGLE_PLACES',
      operation: 'mockSearch',
      request_count: 1,
      estimated_cost_brl: 0,
      cached: false
    });

    return matched;
  }

  /**
   * Generates a candidate preview from Google Places for a specific local place (Sprint 10A & 10B).
   * Strictly adheres to Cache-First/Supabase-First principles.
   * Does NOT persist or mutate any data until the admin explicitly confirms import.
   */
  async previewPlaceFromGoogle(query: string, localPlace?: any): Promise<{
    status: 'READY' | 'ALREADY_SYNCED' | 'DISABLED' | 'BLOCKED_BY_COST_GUARD' | 'CONFIGURATION_REQUIRED' | 'NO_MATCH';
    message?: string;
    candidate?: {
      google_place_id: string;
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      rating: number;
      rating_count: number;
      opening_hours?: Record<string, string>;
      website_url?: string;
      phone?: string;
      photo_available?: boolean;
      photo_url?: string;
    };
    comparison?: {
      nameDiff: boolean;
      addressDiff: boolean;
      hasNewHours: boolean;
      hasNewRating: boolean;
      hasNewWebsite: boolean;
      hasNewPhone: boolean;
    };
  }> {
    // 1. Model Cache-First / Supabase-First (Sprint 10B Section 6):
    // If localPlace already has Google Place ID and fresh data (< 30 days), DO NOT query Google!
    if (localPlace && localPlace.google_place_id && localPlace.google_sync_status === 'ENRICHED') {
      const lastSync = localPlace.google_last_sync_at ? new Date(localPlace.google_last_sync_at).getTime() : 0;
      const isFresh = (Date.now() - lastSync) < (30 * 24 * 60 * 60 * 1000); // 30 days freshness window
      if (isFresh && localPlace.opening_hours && localPlace.rating) {
        googlePlacesCostGuard.recordCall({
          endpoint: 'places:checkCacheFirst',
          sku: 'SupabaseFirst_CacheHit',
          fields: GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
          cache_hit: true,
          place_id: localPlace.id,
          place_name: localPlace.name,
          estimated_cost_brl: 0,
          success: true
        });

        return {
          status: 'ALREADY_SYNCED',
          message: 'Local já sincronizado e com dados atualizados no Supabase (Cache-First). Nenhuma chamada externa necessária.',
          candidate: {
            google_place_id: localPlace.google_place_id,
            name: localPlace.name,
            address: localPlace.address,
            latitude: localPlace.latitude,
            longitude: localPlace.longitude,
            rating: localPlace.rating,
            rating_count: localPlace.rating_count,
            opening_hours: localPlace.opening_hours,
            website_url: localPlace.official_url || localPlace.website,
            phone: localPlace.phone
          },
          comparison: {
            nameDiff: false,
            addressDiff: false,
            hasNewHours: false,
            hasNewRating: false,
            hasNewWebsite: false,
            hasNewPhone: false
          }
        };
      }
    }

    // 2. Feature Flag Check: GOOGLE_PLACES_ENABLED
    if (!googlePlacesCostGuard.getConfig().enabled) {
      return {
        status: 'DISABLED',
        message: 'Google Places desativado pelo Cost Guard (GOOGLE_PLACES_ENABLED=false). Nenhuma chamada externa é permitida.'
      };
    }

    // 3. API Key check
    if (!this.isConfigured()) {
      return {
        status: 'CONFIGURATION_REQUIRED',
        message: 'Google Places ainda não configurado no servidor (GOOGLE_MAPS_API_KEY ausente).'
      };
    }

    // 4. Cost Guard Budget & Limit check
    const guardCheck = googlePlacesCostGuard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, this.isConfigured());
    if (!guardCheck.allowed) {
      return {
        status: 'BLOCKED_BY_COST_GUARD',
        message: guardCheck.reason || 'Chamada bloqueada pelo Cost Guard.'
      };
    }

    try {
      const candidates = await this.searchText(query, {
        fieldMask: GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
        maxResultCount: 1
      });

      if (!candidates || candidates.length === 0) {
        return {
          status: 'NO_MATCH',
          message: 'Nenhum local correspondente encontrado no Google Places.'
        };
      }

      const top = candidates[0];
      const details = await this.getPlaceDetails(top.externalId, {
        fieldMask: GOOGLE_FIELD_MASKS.ENRICHMENT
      });

      const candidateData = {
        google_place_id: top.externalId,
        name: top.name,
        address: top.address,
        latitude: top.latitude,
        longitude: top.longitude,
        rating: (details as any)?.rating || (top as any).rating || 4.8,
        rating_count: (details as any)?.rating_count || (top as any).rating_count || 100,
        opening_hours: (details as any)?.opening_hours || { 'seg': '09:00 - 18:00' },
        website_url: (details as any)?.website || (details as any)?.websiteUri,
        phone: (details as any)?.phone || (details as any)?.nationalPhoneNumber,
        photo_available: false, // Sprint 10B: Photos disabled
        photo_url: undefined
      };

      const comparison = {
        nameDiff: localPlace ? localPlace.name !== candidateData.name : false,
        addressDiff: localPlace ? localPlace.address !== candidateData.address : false,
        hasNewHours: Boolean(candidateData.opening_hours && (!localPlace?.opening_hours || Object.keys(localPlace.opening_hours).length === 0)),
        hasNewRating: Boolean(candidateData.rating && (!localPlace?.rating || localPlace.rating === 0)),
        hasNewWebsite: Boolean(candidateData.website_url && !localPlace?.website && !localPlace?.official_url),
        hasNewPhone: Boolean(candidateData.phone && !localPlace?.phone)
      };

      return {
        status: 'READY',
        candidate: candidateData,
        comparison
      };
    } catch (err: any) {
      return {
        status: 'NO_MATCH',
        message: err.message || 'Falha ao buscar candidato no Google Places.'
      };
    }
  }

  /**
   * HOTFIX P1 & Sprint 10B Requirement 8: Smart Place Resolver.
   * Utiliza dados locais do Supabase como âncora, locationBias por coordenadas,
   * query determinística, FieldMask cirúrgico enriquecido e score determinístico (0-100).
   * Ordena candidatos por match_score decrescente (o mais compatível primeiro).
   */
  async searchCandidates(
    query: string,
    options: {
      maxResults?: number;
      localPlaceId?: string;
      localPlace?: any;
      fieldMask?: string;
      radiusMeters?: number;
    } = {}
  ): Promise<{
    status: 'READY' | 'DISABLED' | 'BLOCKED_BY_COST_GUARD' | 'CONFIGURATION_REQUIRED' | 'NO_MATCH';
    message?: string;
    candidates: PlaceCandidateDTO[];
  }> {
    // 1. Resolução do local local como âncora (Seção 1)
    let localPlace = options.localPlace;
    if (!localPlace && options.localPlaceId) {
      try {
        localPlace = await supabaseServer.getPlaceById(options.localPlaceId);
      } catch (err) {
        console.warn('[SmartPlaceResolver] Não foi possível carregar local pelo ID:', err);
      }
    }

    // 2. Query Inteligente determinística (Seção 3)
    let cleanQuery = (query || '').trim();
    if (!cleanQuery && localPlace) {
      cleanQuery = buildPlaceResolutionQuery(localPlace);
    }

    if (!cleanQuery) {
      return {
        status: 'NO_MATCH',
        message: 'Query de busca vazia.',
        candidates: []
      };
    }

    // Cost Guard feature flag check (Req 3 & 17)
    if (!googlePlacesCostGuard.getConfig().enabled) {
      return {
        status: 'DISABLED',
        message: 'Google Places desativado pelo Cost Guard (GOOGLE_PLACES_ENABLED=false). Nenhuma chamada externa é permitida.',
        candidates: []
      };
    }

    // API Key check (Req 14)
    if (!this.isConfigured()) {
      return {
        status: 'CONFIGURATION_REQUIRED',
        message: 'Google Places ainda não configurado no servidor (GOOGLE_MAPS_API_KEY ausente).',
        candidates: []
      };
    }

    // 3. FieldMask cirúrgico enriquecido (Seção 4)
    const mask = options.fieldMask || GOOGLE_FIELD_MASKS.SMART_RESOLUTION;

    // Cost Guard Budget & Limit check (Req 4 & 17)
    const guardCheck = googlePlacesCostGuard.canMakeRequest('searchText', mask, this.isConfigured());
    if (!guardCheck.allowed) {
      return {
        status: 'BLOCKED_BY_COST_GUARD',
        message: guardCheck.reason || 'Chamada bloqueada pelo Cost Guard.',
        candidates: []
      };
    }

    try {
      // 4. Text Search com Location Bias nas coordenadas DUO21 (Seção 2)
      let locationBias: LocationBiasCircle | undefined = undefined;
      const radius = options.radiusMeters || Number(process.env.GOOGLE_PLACES_RESOLUTION_RADIUS_METERS) || DEFAULT_RESOLUTION_RADIUS_METERS;

      if (
        localPlace &&
        typeof localPlace.latitude === 'number' &&
        typeof localPlace.longitude === 'number' &&
        !isNaN(localPlace.latitude) &&
        !isNaN(localPlace.longitude)
      ) {
        locationBias = {
          center: {
            latitude: Number(localPlace.latitude),
            longitude: Number(localPlace.longitude)
          },
          radius
        };
      }

      const places = await this.searchText(cleanQuery, {
        fieldMask: mask,
        maxResultCount: options.maxResults || 5,
        locationBias
      });

      if (!places || places.length === 0) {
        return {
          status: 'NO_MATCH',
          message: `Nenhum candidato encontrado no Google Places para "${cleanQuery}".`,
          candidates: []
        };
      }

      // 5. Match Confidence & Ranking determinístico (Seções 5, 6, 7, 8, 9, 10, 11, 12)
      const rankedCandidates = rankAndScoreCandidates(
        localPlace || { name: cleanQuery },
        places
      );

      return {
        status: 'READY',
        candidates: rankedCandidates
      };
    } catch (err: any) {
      return {
        status: 'NO_MATCH',
        message: err.message || 'Erro ao consultar candidatos no Google Places.',
        candidates: []
      };
    }
  }

  /**
   * Sprint 10B Requirement 8 & Sprint 10C: Explicitly links a selected Google Place ID to a local place.
   * Only persists google_place_id and sets google_sync_status = 'LINKED'.
   * Never overwrites curatorial fields, places.id, or relationships.
   * Registers audit record.
   */
  async linkGooglePlaceId(localPlaceId: string, googlePlaceId: string): Promise<any> {
    const existing = await supabaseServer.getPlaceById(localPlaceId);
    if (!existing) {
      throw new Error('Local não encontrado no catálogo local.');
    }

    const updated = await supabaseServer.updatePlace(localPlaceId, {
      google_place_id: googlePlaceId.trim(),
      google_sync_status: 'LINKED'
    });

    await supabaseServer.logApiUsage({
      trip_id: null,
      provider: 'GOOGLE_PLACES',
      operation: 'linkGooglePlaceId',
      request_count: 0,
      estimated_cost_brl: 0,
      cached: false,
      metadata: {
        place_id: localPlaceId,
        google_place_id: googlePlaceId.trim(),
        action: 'LINK_ONLY_PRESERVE_UUID'
      }
    });

    return updated;
  }

  /**
   * Sprint 10C Section 3, 5, 6, 7, 8, 9, 13: Controlled Place Details query.
   * Gated strictly by Cost Guard.
   * Uses Place Details (New) with surgical FieldMask (no wildcards *).
   * Models Cache-First: returns cached data when available and provides refresh option.
   * Compares field-by-field against local DUO21 catalog.
   */
  async getControlledPlaceDetails(
    localPlaceId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<{
    status: 'READY' | 'DISABLED' | 'BLOCKED_BY_COST_GUARD' | 'CONFIGURATION_REQUIRED' | 'NO_MATCH' | 'NOT_LINKED';
    message?: string;
    fromCache: boolean;
    cachedAt?: string;
    googlePlaceId: string;
    costGuardEstimate: {
      operation: string;
      fieldMask: string;
      fieldMaskList: string[];
      sku: string;
      skuName: string;
      costBrl: number;
      disclaimer: string;
    };
    googleData?: any;
    localData?: any;
    diff?: Record<string, { local: any; google: any; different: boolean; label: string }>;
  }> {
    const localPlace = await supabaseServer.getPlaceById(localPlaceId);
    if (!localPlace) {
      throw new Error(`Local "${localPlaceId}" não encontrado no catálogo.`);
    }

    if (!localPlace.google_place_id) {
      return {
        status: 'NOT_LINKED',
        message: 'Local não possui Google Place ID vinculado. Pesquise e vincule um candidato antes de consultar dados.',
        fromCache: false,
        googlePlaceId: '',
        costGuardEstimate: {
          operation: 'Place Details (New)',
          fieldMask: GOOGLE_FIELD_MASKS.DETAIL,
          fieldMaskList: GOOGLE_FIELD_MASKS.DETAIL.split(','),
          sku: 'PlaceDetails_Atmosphere_Contact',
          skuName: 'Place Details - Atmosphere/Contact (New)',
          costBrl: 0.12,
          disclaimer: 'Custo estimado pelo Cost Guard interno (não confundir com Cobrança efetiva Google Cloud).'
        }
      };
    }

    const googlePlaceId = localPlace.google_place_id;
    const mask = GOOGLE_FIELD_MASKS.DETAIL;
    const cacheKey = `google_places:details:${googlePlaceId}:${mask}`;

    const estimate = {
      operation: 'Place Details (New)',
      fieldMask: mask,
      fieldMaskList: mask.split(','),
      sku: 'PlaceDetails_Atmosphere_Contact',
      skuName: 'Place Details - Atmosphere & Contact (New)',
      costBrl: 0.12,
      disclaimer: 'Custo estimado pelo Cost Guard interno (não confundir com Cobrança efetiva Google Cloud).'
    };

    // 1. Cache-First check (Requirement 13)
    if (!options.forceRefresh) {
      const cached = await supabaseServer.getCache(cacheKey);
      if (cached && cached.payload) {
        const cachedGoogle = cached.payload;
        return {
          status: 'READY',
          fromCache: true,
          cachedAt: cached.created_at || localPlace.google_last_sync_at || new Date().toISOString(),
          googlePlaceId,
          costGuardEstimate: estimate,
          googleData: cachedGoogle,
          localData: this.extractLocalDiffData(localPlace),
          diff: this.buildDiffComparison(localPlace, cachedGoogle)
        };
      }
    }

    // 2. Cost Guard Gate
    if (!googlePlacesCostGuard.getConfig().enabled) {
      return {
        status: 'DISABLED',
        message: 'Google Places desativado pelo Cost Guard (GOOGLE_PLACES_ENABLED=false). Nenhuma chamada externa é permitida.',
        fromCache: false,
        googlePlaceId,
        costGuardEstimate: estimate
      };
    }

    // Mock Mode fallback if key not configured
    if (!this.isConfigured()) {
      let mockFound: any = null;
      for (const p of Object.values(MOCK_PLACES_CATALOG)) {
        if (p.externalId === googlePlaceId || (localPlace.name && p.name.toLowerCase().includes(localPlace.name.toLowerCase()))) {
          mockFound = p;
          break;
        }
      }

      if (!mockFound) {
        mockFound = {
          externalId: googlePlaceId,
          name: localPlace.name,
          address: localPlace.address || `${localPlace.name}, Gramado - RS`,
          latitude: localPlace.latitude || -29.3888,
          longitude: localPlace.longitude || -50.8808,
          types: ['tourist_attraction', 'point_of_interest'],
          rating: 4.8,
          userRatingCount: 28450,
          websiteUri: localPlace.official_url || localPlace.website || 'https://gramado.rs.gov.br',
          googleMapsUri: `https://maps.google.com/?cid=${Date.now()}`,
          nationalPhoneNumber: localPlace.phone || '(54) 3286-0000',
          openingHours: {
            seg: 'Aberto 24 horas',
            ter: 'Aberto 24 horas',
            qua: 'Aberto 24 horas',
            qui: 'Aberto 24 horas',
            sex: 'Aberto 24 horas',
            sab: 'Aberto 24 horas',
            dom: 'Aberto 24 horas'
          }
        };
      }

      await supabaseServer.setCache(cacheKey, 'GOOGLE_PLACES', 'getPlaceDetails', mockFound, CACHE_TTLS.PLACE_ID_COORDS);

      return {
        status: 'READY',
        fromCache: false,
        cachedAt: new Date().toISOString(),
        googlePlaceId,
        costGuardEstimate: estimate,
        googleData: mockFound,
        localData: this.extractLocalDiffData(localPlace),
        diff: this.buildDiffComparison(localPlace, mockFound)
      };
    }

    // 3. Quota & Limits check
    const guardCheck = googlePlacesCostGuard.canMakeRequest('getPlaceDetails', mask, this.isConfigured());
    if (!guardCheck.allowed) {
      return {
        status: 'BLOCKED_BY_COST_GUARD',
        message: guardCheck.reason || 'Chamada bloqueada pelo Cost Guard.',
        fromCache: false,
        googlePlaceId,
        costGuardEstimate: estimate
      };
    }

    // 4. Server-side Place Details (New) fetch
    try {
      const details = await this.getPlaceDetails(googlePlaceId, {
        fieldMask: mask,
        skipCache: options.forceRefresh
      });

      if (!details) {
        return {
          status: 'NO_MATCH',
          message: `Nenhum detalhe retornado para o Place ID "${googlePlaceId}".`,
          fromCache: false,
          googlePlaceId,
          costGuardEstimate: estimate
        };
      }

      // Invariante 15: Place Details protegido — o ID retornado pelo Google DEVE ser estritamente igual ao solicitado
      if (details.externalId && details.externalId !== googlePlaceId) {
        console.error(`[Place Details Invariant Violation] requested=${googlePlaceId} vs returned=${details.externalId}`);
        return {
          status: 'NO_MATCH',
          message: `Inconsistência de Place ID detectada: o ID retornado pelo Google (${details.externalId}) diverge do solicitado (${googlePlaceId}). Operação bloqueada por segurança.`,
          fromCache: false,
          googlePlaceId,
          costGuardEstimate: estimate
        };
      }

      return {
        status: 'READY',
        fromCache: false,
        cachedAt: new Date().toISOString(),
        googlePlaceId,
        costGuardEstimate: estimate,
        googleData: details,
        localData: this.extractLocalDiffData(localPlace),
        diff: this.buildDiffComparison(localPlace, details)
      };
    } catch (err: any) {
      return {
        status: 'NO_MATCH',
        message: err.message || 'Falha ao consultar detalhes no Google Places.',
        fromCache: false,
        googlePlaceId,
        costGuardEstimate: estimate
      };
    }
  }

  private extractLocalDiffData(local: any): any {
    return {
      name: local.name || '',
      address: local.address || '',
      latitude: local.latitude ?? null,
      longitude: local.longitude ?? null,
      opening_hours: local.opening_hours || null,
      rating: local.rating ?? null,
      rating_count: local.rating_count || 0,
      website: local.official_url || local.website || '',
      maps_url: local.maps_url || '',
      phone: local.phone || ''
    };
  }

  private buildDiffComparison(local: any, google: any): Record<string, { local: any; google: any; different: boolean; label: string }> {
    const googleRating = typeof google.rating === 'number' ? google.rating : null;
    const googleRatingCount = typeof google.userRatingCount === 'number' ? google.userRatingCount : (google.rating_count || null);
    const googleWebsite = google.websiteUri || google.website_url || google.website || '';
    const googleMapsUrl = google.googleMapsUri || google.maps_url || '';
    const googlePhone = google.nationalPhoneNumber || google.phone || '';
    const googleHours = google.openingHours || google.opening_hours || null;

    const areHoursDifferent = (h1: any, h2: any): boolean => {
      if (!h1 && !h2) return false;
      if (!h1 || !h2) return true;
      const keys = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
      return keys.some(k => (h1[k] || '').trim() !== (h2[k] || '').trim());
    };

    return {
      name: {
        label: 'Nome',
        local: local.name || 'Não informado',
        google: google.name || 'Não informado',
        different: (local.name || '').trim() !== (google.name || '').trim()
      },
      address: {
        label: 'Endereço',
        local: local.address || 'Não informado',
        google: google.address || 'Não informado',
        different: (local.address || '').trim() !== (google.address || '').trim()
      },
      latitude: {
        label: 'Latitude',
        local: local.latitude !== undefined && local.latitude !== null ? Number(local.latitude) : 'Não informado',
        google: google.latitude !== undefined && google.latitude !== null ? Number(google.latitude) : 'Não informado',
        different: Number(local.latitude || 0).toFixed(4) !== Number(google.latitude || 0).toFixed(4)
      },
      longitude: {
        label: 'Longitude',
        local: local.longitude !== undefined && local.longitude !== null ? Number(local.longitude) : 'Não informado',
        google: google.longitude !== undefined && google.longitude !== null ? Number(google.longitude) : 'Não informado',
        different: Number(local.longitude || 0).toFixed(4) !== Number(google.longitude || 0).toFixed(4)
      },
      hours: {
        label: 'Horários de Funcionamento',
        local: local.opening_hours || null,
        google: googleHours,
        different: areHoursDifferent(local.opening_hours, googleHours)
      },
      rating: {
        label: 'Avaliação (Rating)',
        local: local.rating !== undefined && local.rating !== null ? Number(local.rating) : 'Não informado',
        google: googleRating !== null ? Number(googleRating) : 'Não informado',
        different: Number(local.rating || 0).toFixed(1) !== Number(googleRating || 0).toFixed(1)
      },
      ratingCount: {
        label: 'Quantidade de Avaliações',
        local: local.rating_count !== undefined && local.rating_count !== null ? Number(local.rating_count) : 'Não informado',
        google: googleRatingCount !== null ? Number(googleRatingCount) : 'Não informado',
        different: Number(local.rating_count || 0) !== Number(googleRatingCount || 0)
      },
      website: {
        label: 'Site Oficial',
        local: local.official_url || local.website || 'Não informado',
        google: googleWebsite || 'Não informado',
        different: (local.official_url || local.website || '').trim() !== googleWebsite.trim()
      },
      mapsUrl: {
        label: 'Link Google Maps',
        local: local.maps_url || 'Não informado',
        google: googleMapsUrl || 'Não informado',
        different: (local.maps_url || '').trim() !== googleMapsUrl.trim()
      },
      phone: {
        label: 'Telefone',
        local: local.phone || 'Não informado',
        google: googlePhone || 'Não informado',
        different: (local.phone || '').trim() !== googlePhone.trim()
      }
    };
  }

  /**
   * Sprint 10C Requirement 9, 10, 11, 12: Applies ONLY administrator-selected fields from Google Places.
   * Strictly enforces curatorial preservation:
   * - photo atual, cover, place_media_items, Supabase Storage
   * - descrição DUO21 & descrição curta
   * - preço, price_notes, price_level
   * - duração
   * - tags & suitable_for
   * - partner status & prioridade comercial
   * - Dica Divulga Lugares & divulga_content & divulga_article_url
   * - Instagram & ticket_url & WhatsApp
   * Updates hours_source and rating_source when those fields are accepted.
   * Syncs place_hours table in Supabase.
   */
  async applyControlledEnrichment(
    localPlaceId: string,
    payload: {
      selectedFields: {
        name?: boolean;
        address?: boolean;
        latitude?: boolean;
        longitude?: boolean;
        hours?: boolean;
        rating?: boolean;
        ratingCount?: boolean;
        website?: boolean;
        mapsUrl?: boolean;
        phone?: boolean;
      };
      googleData: any;
    }
  ): Promise<any> {
    const existing = await supabaseServer.getPlaceById(localPlaceId);
    if (!existing) {
      throw new Error(`Local "${localPlaceId}" não encontrado no catálogo.`);
    }

    const { selectedFields, googleData } = payload;
    const now = new Date().toISOString();

    const updates: Record<string, any> = {
      google_last_sync_at: now,
      google_sync_status: 'ENRICHED',
      google_data_version: 'v10c'
    };

    if (selectedFields.name && googleData.name) {
      updates.name = googleData.name;
    }
    if (selectedFields.address && googleData.address) {
      updates.address = googleData.address;
    }
    if (selectedFields.latitude && googleData.latitude !== undefined && googleData.latitude !== null) {
      updates.latitude = Number(googleData.latitude);
    }
    if (selectedFields.longitude && googleData.longitude !== undefined && googleData.longitude !== null) {
      updates.longitude = Number(googleData.longitude);
    }
    if (selectedFields.rating && googleData.rating !== undefined && googleData.rating !== null) {
      updates.rating = Number(googleData.rating);
      updates.rating_source = 'google_places';
      updates.rating_last_checked_at = now;
    }
    if (selectedFields.ratingCount) {
      const count = googleData.userRatingCount ?? googleData.rating_count;
      if (count !== undefined && count !== null) {
        updates.rating_count = Number(count);
      }
    }
    if (selectedFields.website) {
      const site = googleData.websiteUri || googleData.website_url || googleData.website;
      if (site) {
        updates.official_url = site;
        updates.website = site;
      }
    }
    if (selectedFields.mapsUrl) {
      const maps = googleData.googleMapsUri || googleData.maps_url;
      if (maps) {
        updates.maps_url = maps;
      }
    }
    if (selectedFields.phone) {
      const tel = googleData.nationalPhoneNumber || googleData.phone;
      if (tel) {
        updates.phone = tel;
      }
    }
    if (selectedFields.hours) {
      const hours = googleData.openingHours || googleData.opening_hours;
      if (hours && typeof hours === 'object' && Object.keys(hours).length > 0) {
        updates.hours_source = 'google_places';
        updates.hours_last_checked_at = now;
        await supabaseServer.syncPlaceHours(localPlaceId, hours);
      }
    }

    // STRICT CURATORIAL & MEDIA PROTECTION (Sprint 10C Requirement 11 & 12):
    // The following manual/DUO21 fields are 100% IMMUTABLE and NEVER overwritten by Google:
    // Notice: updates does NOT include media so existing place_media_items / media array is preserved untouched
    updates.description = existing.description;
    updates.description_short = existing.description_short;
    updates.price_info = existing.price_info;
    updates.price_notes = existing.price_notes;
    updates.price_level = existing.price_level;
    updates.duration_min = existing.duration_min;
    updates.duration_max = existing.duration_max;
    updates.average_duration_minutes = existing.average_duration_minutes;
    updates.tags = existing.tags;
    updates.suitable_for = existing.suitable_for;
    updates.partner = existing.partner;
    updates.is_divulga_lugares_partner = existing.is_divulga_lugares_partner;
    updates.partner_status = existing.partner_status;
    updates.partner_priority = existing.partner_priority;
    updates.divulga_lugares_tip = existing.divulga_lugares_tip;
    updates.divulga_content_active = existing.divulga_content_active;
    updates.divulga_article_url = existing.divulga_article_url;
    updates.divulga_instagram_url = existing.divulga_instagram_url;
    updates.divulga_youtube_url = existing.divulga_youtube_url;
    updates.divulga_tiktok_url = existing.divulga_tiktok_url;
    updates.instagram = existing.instagram;
    updates.instagram_url = existing.instagram_url;
    updates.ticket_url = existing.ticket_url;
    updates.booking_url = existing.booking_url;
    updates.whatsapp = existing.whatsapp;

    const updated = await supabaseServer.updatePlace(localPlaceId, updates);

    // Audit log
    await supabaseServer.logApiUsage({
      trip_id: null,
      provider: 'GOOGLE_PLACES',
      operation: 'applyControlledEnrichment',
      request_count: 0,
      estimated_cost_brl: 0,
      cached: false,
      metadata: {
        place_id: localPlaceId,
        google_place_id: existing.google_place_id,
        applied_fields: Object.keys(selectedFields).filter(k => (selectedFields as any)[k])
      }
    });

    return updated;
  }

  /**
   * Imports selected candidate fields into the local place while strictly protecting:
   * 1. DUO21 curatorial description & duration (never overwritten)
   * 2. Manual price tables & commercial curatorship (never overwritten)
   * 3. Divulga content & article URL (never overwritten)
   * 4. Manual photos / hero photo (never overwritten)
   * 5. Partner status (never overwritten)
   */
  async importPlaceFromGoogle(
    localPlaceId: string,
    candidate: any,
    options: {
      importHours?: boolean;
      importRating?: boolean;
      importAddress?: boolean;
      importPhone?: boolean;
      importWebsite?: boolean;
      importCoordinates?: boolean;
    } = {}
  ): Promise<any> {
    const existing = await supabaseServer.getPlaceById(localPlaceId);
    if (!existing) {
      throw new Error('Local não encontrado no catálogo local.');
    }

    const updates: any = {
      google_place_id: candidate.google_place_id,
      google_last_sync_at: new Date().toISOString(),
      google_sync_status: 'ENRICHED',
      google_data_version: 'v1'
    };

    if (options.importCoordinates && candidate.latitude && candidate.longitude) {
      updates.latitude = candidate.latitude;
      updates.longitude = candidate.longitude;
    }
    if (options.importAddress && candidate.address) {
      updates.address = candidate.address;
    }
    if (options.importHours && candidate.opening_hours) {
      updates.hours_source = 'google_places';
      updates.hours_last_checked_at = new Date().toISOString();
      await supabaseServer.syncPlaceHours(localPlaceId, candidate.opening_hours);
    }
    if (options.importRating && candidate.rating) {
      updates.rating = candidate.rating;
      updates.rating_count = candidate.rating_count || existing.rating_count;
      updates.rating_source = 'google_places';
      updates.rating_last_checked_at = new Date().toISOString();
    }
    if (options.importWebsite && candidate.website_url) {
      updates.official_url = candidate.website_url;
      updates.website = candidate.website_url;
    }
    if (options.importPhone && candidate.phone) {
      updates.phone = candidate.phone;
    }

    // STRICT CURATORIAL PROTECTION (Sprint 10B Requirement 7):
    // Google NUNCA pode sobrescrever automaticamente:
    // descrição curatorial DUO21, preço manual, price_notes, links inseridos manualmente,
    // mídia DUO21, conteúdo Divulga Lugares, status de parceiro, duração estimada manual,
    // atributos definidos manualmente, foto de capa DUO21.
    updates.description = existing.description;
    updates.description_short = existing.description_short;
    updates.price_info = existing.price_info;
    updates.price_notes = existing.price_notes;
    updates.partner = existing.partner;
    updates.is_divulga_lugares_partner = existing.is_divulga_lugares_partner;
    updates.divulga_content_active = existing.divulga_content_active;
    updates.divulga_article_url = existing.divulga_article_url;
    updates.divulga_lugares_tip = existing.divulga_lugares_tip;
    updates.average_duration_minutes = existing.average_duration_minutes;
    updates.duration_min = existing.duration_min;
    updates.duration_max = existing.duration_max;

    // Photos: In Sprint 10B, GOOGLE_PLACES_PHOTOS_ENABLED=false
    // No photo is imported from Google Places unless explicitly enabled by feature flag
    if (candidate.photo_url && googlePlacesCostGuard.getConfig().photosEnabled) {
      const existingMedia = Array.isArray(existing.media) ? [...existing.media] : [];
      const hasDuoHero = existingMedia.some((m: any) => m.is_hero && m.source === 'duo21');
      const alreadyHasGooglePhoto = existingMedia.some((m: any) => m.url === candidate.photo_url);

      if (!alreadyHasGooglePhoto) {
        await supabaseServer.savePlaceMediaItem(localPlaceId, {
          url: candidate.photo_url,
          caption: 'Foto via Google Places',
          is_hero: !hasDuoHero && existingMedia.length === 0,
          source: 'google_places',
          active: true,
          order: existingMedia.length + 1
        });
      }
    }

    return await supabaseServer.updatePlace(localPlaceId, updates);
  }

  /**
   * Sprint 10B Section 13 & Hotfix 10B.1: Controlled Single Test Call for Mini Mundo
   * Executes at most ONE real call to Google Places (New) Text Search only when:
   * 1. Confirmed explicitly by administrator (confirmed === true)
   * 2. GOOGLE_PLACES_ENABLED === true
   * 3. GOOGLE_MAPS_API_KEY is configured
   * 4. Cost Guard authorizes the call
   * Never persists candidates automatically into the catalog.
   */
  async testMiniMundoPreActivation(options: { confirmed?: boolean } = {}): Promise<{
    success: boolean;
    ready: boolean;
    executedRealCall: boolean;
    externalCallsCount: number;
    target: string;
    fieldMask: string;
    estimatedRequests: number;
    estimatedCostBrl: number;
    costGuardStatus: string;
    message: string;
    candidates?: Array<{
      google_place_id: string;
      name: string;
      address: string;
      types?: string[];
      latitude?: number;
      longitude?: number;
    }>;
    persistedToDatabase: boolean;
    error?: string;
  }> {
    const fieldMask = GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL;
    const costGuard = googlePlacesCostGuard.getConfig();

    // 1. Mandatory Explicit Confirmation
    if (options.confirmed !== true) {
      return {
        success: false,
        ready: false,
        executedRealCall: false,
        externalCallsCount: 0,
        target: 'Mini Mundo (Gramado - RS)',
        fieldMask,
        estimatedRequests: 0,
        estimatedCostBrl: 0,
        costGuardStatus: 'CONFIRMATION_REQUIRED',
        message: 'Confirmação explícita do administrador é obrigatória antes de executar qualquer chamada.',
        persistedToDatabase: false
      };
    }

    // 2. Feature Flag Check: GOOGLE_PLACES_ENABLED
    if (!costGuard.enabled) {
      return {
        success: false,
        ready: false,
        executedRealCall: false,
        externalCallsCount: 0,
        target: 'Mini Mundo (Gramado - RS)',
        fieldMask,
        estimatedRequests: 1,
        estimatedCostBrl: 0.18,
        costGuardStatus: 'DISABLED (GOOGLE_PLACES_ENABLED=false)',
        message: 'Consumo externo do Google Places está desativado (GOOGLE_PLACES_ENABLED=false). Nenhuma chamada externa permitida.',
        persistedToDatabase: false
      };
    }

    // 3. API Key Check
    if (!this.isConfigured()) {
      return {
        success: false,
        ready: false,
        executedRealCall: false,
        externalCallsCount: 0,
        target: 'Mini Mundo (Gramado - RS)',
        fieldMask,
        estimatedRequests: 1,
        estimatedCostBrl: 0.18,
        costGuardStatus: 'CONFIGURATION_REQUIRED',
        message: 'GOOGLE_MAPS_API_KEY não configurada no servidor.',
        persistedToDatabase: false
      };
    }

    // 4. Cost Guard Quota & Budget Check
    const guardCheck = googlePlacesCostGuard.canMakeRequest('searchText', fieldMask, this.isConfigured());
    if (!guardCheck.allowed) {
      return {
        success: false,
        ready: false,
        executedRealCall: false,
        externalCallsCount: 0,
        target: 'Mini Mundo (Gramado - RS)',
        fieldMask,
        estimatedRequests: 1,
        estimatedCostBrl: 0.18,
        costGuardStatus: 'BLOCKED_BY_COST_GUARD',
        message: guardCheck.reason || 'Chamada bloqueada pelo Cost Guard.',
        persistedToDatabase: false
      };
    }

    // 5. Execute Exactly ONE controlled Search Call (New)
    try {
      const places = await this.searchText('Mini Mundo Gramado RS', {
        fieldMask,
        maxResultCount: 3,
        skipCache: true
      });

      const candidates = (places || []).map(p => ({
        google_place_id: p.externalId,
        name: p.name,
        address: p.address,
        types: (p as any).types || [],
        latitude: p.latitude,
        longitude: p.longitude
      }));

      const apiKey = this.getApiKey();
      const isMock = apiKey.startsWith('mock-');
      return {
        success: true,
        ready: true,
        executedRealCall: this.isConfigured() && !isMock,
        externalCallsCount: 1,
        target: 'Mini Mundo (Gramado - RS)',
        fieldMask,
        estimatedRequests: 1,
        estimatedCostBrl: 0.18,
        costGuardStatus: 'AUTHORIZED',
        candidates,
        persistedToDatabase: false,
        message: isMock
          ? 'Chamada de teste mockada executada com sucesso. Candidatos retornados exclusivamente para apresentação. Nenhum dado foi salvo no catálogo.'
          : 'Chamada controlada realizada com sucesso ao Google Places API (New). Candidatos retornados exclusivamente para apresentação. Nenhum dado foi salvo no catálogo.'
      };
    } catch (err: any) {
      return {
        success: false,
        ready: false,
        executedRealCall: false,
        externalCallsCount: 0,
        target: 'Mini Mundo (Gramado - RS)',
        fieldMask,
        estimatedRequests: 1,
        estimatedCostBrl: 0.18,
        costGuardStatus: 'ERROR',
        error: err.message,
        message: `Erro na execução da chamada Google Places: ${err.message}`,
        persistedToDatabase: false
      };
    }
  }
}

export const googlePlacesServer = new GooglePlacesServerProvider();

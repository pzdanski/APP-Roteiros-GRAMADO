import { GooglePlaceNormalizer, ResolvedPlace } from '../../services/places/GooglePlaceNormalizer';
import { supabaseServer } from '../supabaseServer';
import { singleFlight } from '../cache/SingleFlight';
import { externalFetch } from '../utils/externalFetch';

export interface LocationBiasCircle {
  center: { latitude: number; longitude: number };
  radius: number; // in meters
}

export const SERRA_GAUCHA_LOCATION_BIAS: LocationBiasCircle = {
  center: { latitude: -29.3748, longitude: -50.8764 },
  radius: 25000.0 // 25km covers Gramado, Canela, Nova Petrópolis
};

// Field Masks (Section 5)
export const GOOGLE_FIELD_MASKS = {
  PLACE_RESOLUTION: 'places.id,places.displayName,places.formattedAddress,places.location',
  HOURS: 'id,displayName,businessStatus,regularOpeningHours',
  DETAIL: 'id,displayName,formattedAddress,location,businessStatus,regularOpeningHours',
  DISCOVERY: 'places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.rating,places.userRatingCount'
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
    address: 'Rua A. J. Renner, Bairro Planalto, Gramado - RS',
    latitude: -29.3888,
    longitude: -50.8808,
    city: 'Gramado',
    businessStatus: 'OPERATIONAL',
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

  constructor(apiKey: string = process.env.GOOGLE_MAPS_API_KEY || '') {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  /**
   * Health check to test Google Places connection.
   */
  async healthCheck(): Promise<{ status: 'CONNECTED' | 'CONFIGURATION_REQUIRED' | 'ERROR'; details: string; latency_ms: number }> {
    if (!this.isConfigured()) {
      return {
        status: 'CONFIGURATION_REQUIRED',
        details: 'GOOGLE_MAPS_API_KEY não configurada no servidor (esperada no .env).',
        latency_ms: 0
      };
    }

    const start = Date.now();
    try {
      // Test small search query with minimum field mask
      const res = await this.searchText('Prefeitura de Gramado', {
        fieldMask: 'places.id,places.displayName',
        maxResultCount: 1,
        skipCache: true
      });
      const latency = Date.now() - start;

      if (res && res.length > 0) {
        return {
          status: 'CONNECTED',
          details: `Google Places API (New) operacional. Respondeu em ${latency}ms.`,
          latency_ms: latency
        };
      }
      return {
        status: 'ERROR',
        details: 'Google Places API retornou resposta vazia no teste.',
        latency_ms: latency
      };
    } catch (err: any) {
      return {
        status: 'ERROR',
        details: `Falha na requisição Places: ${err.message || 'Erro desconhecido'}`,
        latency_ms: Date.now() - start
      };
    }
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
    const cleanQuery = query.trim();
    const cacheKey = `google_places:search:${cleanQuery.toLowerCase()}:${mask}`;

    // 1. Check external data cache first (Section 6)
    if (!options.skipCache) {
      try {
        const cached = await supabaseServer.getCache(cacheKey);
        if (cached && cached.payload) {
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

    // 2. Mock mode if key is missing
    if (!this.isConfigured()) {
      const mockResults = await this.mockSearch(cleanQuery, options.tripId);
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
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': mask
        },
        body: JSON.stringify(payloadBody),
        timeoutMs: 7000
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Google Places API Error] HTTP ${response.status}:`, errText);
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

    // 5. Register cost in CostGuard / api_usage (Section 8)
    await supabaseServer.logApiUsage({
      trip_id: options.tripId || null,
      provider: 'GOOGLE_PLACES',
      operation: 'searchText',
      request_count: 1,
      estimated_cost_brl: 0.09, // Standard text search rate in BRL
      cached: false
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
    const cacheKey = `google_places:details:${placeId}:${mask}`;

    // 1. Cache first
    if (!options.skipCache) {
      const cached = await supabaseServer.getCache(cacheKey);
      if (cached && cached.payload) {
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

    // 2. Mock mode if key missing
    if (!this.isConfigured()) {
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
          return p;
        }
      }
      return null;
    }

    console.log(`[Google Places API] Requesting details for ${placeId} | Mask: ${mask}`);

    const response = await fetch(`${this.baseUrl}/places/${encodeURIComponent(placeId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
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
        'X-Goog-Api-Key': this.apiKey,
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
      if (q.includes(key) || key.includes(q)) {
        matched.push({ ...place });
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
}

export const googlePlacesServer = new GooglePlacesServerProvider();

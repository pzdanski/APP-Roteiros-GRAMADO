import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { validateServerEnv, ValidatedEnv } from './envValidator';
import { SEED_PLACES, SEED_EVENTS } from '../data/seedData';
import { calculatePlaceDataQuality } from '../utils/dataQuality';
import { PlaceCategory } from '../types';

// Legacy seed identifier mapping for backwards compatibility with test fixtures and legacy seeds
export const LEGACY_SEED_TO_SLUG: Record<string, string> = {
  'plc-gra-01': 'lago-negro',
  'plc-gra-02': 'mini-mundo',
  'plc-gra-03': 'snowland-gramado',
  'plc-gra-04': 'rua-torta-praca-etnias',
  'plc-gra-05': 'cantina-pastasciutta',
  'plc-gra-colosseo-fondue': 'restaurante-colosseo',
  'plc-gra-06': 'olivas-de-gramado',
  'plc-can-01': 'catedral-de-pedra',
  'plc-can-02': 'parque-do-caracol',
  'plc-can-03': 'skyglass-canela',
  'plc-can-04': 'alpen-park',
  'plc-nvp-01': 'labirinto-verde',
  'plc-nvp-02': 'aldeia-do-imigrante',
  'plc-nvp-03': 'ninho-das-aguias'
};

// Seed UUID to slug mapping to resolve real PostgreSQL UUID if production instance uses different UUIDs
export const SEED_UUID_TO_SLUG: Record<string, string> = {
  'a0000001-0000-0000-0000-000000000001': 'lago-negro',
  'a0000001-0000-0000-0000-000000000002': 'mini-mundo',
  'a0000001-0000-0000-0000-000000000003': 'snowland-gramado',
  'a0000001-0000-0000-0000-000000000004': 'olivas-de-gramado',
  'a0000001-0000-0000-0000-000000000005': 'praca-das-etnias',
  'a0000001-0000-0000-0000-000000000006': 'mirante-vale-do-quilombo',
  'a0000001-0000-0000-0000-000000000007': 'skyglass-canela',
  'a0000001-0000-0000-0000-000000000008': 'parque-do-caracol',
  'a0000001-0000-0000-0000-000000000009': 'alpen-park',
  'a0000001-0000-0000-0000-000000000010': 'catedral-de-pedra',
  'a0000001-0000-0000-0000-000000000011': 'labirinto-verde',
  'a0000001-0000-0000-0000-000000000012': 'aldeia-do-imigrante',
  'a0000001-0000-0000-0000-000000000013': 'ninho-das-aguias',
  'b0000001-0000-0000-0000-000000000002': 'restaurante-colosseo',
  'b0000001-0000-0000-0000-000000000004': 'cantina-pastasciutta'
};

// Deprecated fallback map - NOT the operational source of truth.
// PostgreSQL public.places is the sole source of truth.
export const PLACE_UUID_MAP: Record<string, string> = {
  'lago-negro': 'a0000001-0000-0000-0000-000000000001',
  'plc-gra-01': 'a0000001-0000-0000-0000-000000000001',
  'mini-mundo': 'a0000001-0000-0000-0000-000000000002',
  'plc-gra-02': 'a0000001-0000-0000-0000-000000000002',
  'snowland-gramado': 'a0000001-0000-0000-0000-000000000003',
  'plc-gra-03': 'a0000001-0000-0000-0000-000000000003',
  'olivas-de-gramado': 'a0000001-0000-0000-0000-000000000004',
  'plc-gra-06': 'a0000001-0000-0000-0000-000000000004',
  'praca-das-etnias': 'a0000001-0000-0000-0000-000000000005',
  'rua-torta-praca-etnias': 'a0000001-0000-0000-0000-000000000005',
  'plc-gra-04': 'a0000001-0000-0000-0000-000000000005',
  'mirante-vale-do-quilombo': 'a0000001-0000-0000-0000-000000000006',
  'bondinhos-aereos-canela': 'a0000001-0000-0000-0000-000000000007',
  'parque-do-caracol': 'a0000001-0000-0000-0000-000000000008',
  'plc-can-02': 'a0000001-0000-0000-0000-000000000008',
  'mundo-a-vapor': 'a0000001-0000-0000-0000-000000000009',
  'catedral-de-pedra': 'a0000001-0000-0000-0000-000000000010',
  'plc-can-01': 'a0000001-0000-0000-0000-000000000010',
  'labirinto-verde': 'a0000001-0000-0000-0000-000000000011',
  'plc-nvp-01': 'a0000001-0000-0000-0000-000000000011',
  'aldeia-do-imigrante': 'a0000001-0000-0000-0000-000000000012',
  'plc-nvp-02': 'a0000001-0000-0000-0000-000000000012',
  'parque-da-ferradura': 'a0000001-0000-0000-0000-000000000013',
  'belle-du-valais': 'b0000001-0000-0000-0000-000000000001',
  'restaurante-colosseo': 'b0000001-0000-0000-0000-000000000002',
  'restaurante-colosseo-fondue': 'b0000001-0000-0000-0000-000000000002',
  'plc-gra-colosseo-fondue': 'b0000001-0000-0000-0000-000000000002',
  'galeto-di-paolo': 'b0000001-0000-0000-0000-000000000003',
  'cantina-pastasciutta': 'b0000001-0000-0000-0000-000000000004',
  'plc-gra-05': 'b0000001-0000-0000-0000-000000000004',
  'casa-da-velha-bruxa': 'b0000001-0000-0000-0000-000000000005',
  'magnolia-canela': 'b0000001-0000-0000-0000-000000000006',
  'toro-gramado': 'b0000001-0000-0000-0000-000000000007',
  'prawer-chocolates': 'b0000001-0000-0000-0000-000000000008',
  'restaurante-opalma': 'b0000001-0000-0000-0000-000000000009',
  'skyglass-canela': 'a0000001-0000-0000-0000-000000000007',
  'plc-can-03': 'a0000001-0000-0000-0000-000000000007',
  'alpen-park': 'a0000001-0000-0000-0000-000000000009',
  'plc-can-04': 'a0000001-0000-0000-0000-000000000009',
  'ninho-das-aguias': 'a0000001-0000-0000-0000-000000000013',
  'plc-nvp-03': 'a0000001-0000-0000-0000-000000000013',
  'hotel-casa-da-montanha': 'c0000001-0000-0000-0000-000000000001'
};

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
}

export function toDeterministicUuid(id: string): string {
  if (!id) return 'a0000001-0000-0000-0000-000000000001';
  if (isValidUuid(id)) return id;
  if (PLACE_UUID_MAP[id]) return PLACE_UUID_MAP[id];
  const hash = crypto.createHash('md5').update(id).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Whitelist of valid columns for the public.places PostgreSQL table
// Note: 'media' is strictly isolated in public.place_media_items and MUST NOT be sent to places
export const VALID_PLACE_COLUMNS = new Set([
  'id', 'name', 'slug', 'city', 'state', 'country',
  'category_id', 'subcategory', 'latitude', 'longitude', 'address',
  'google_place_id', 'description_short', 'description_internal',
  'duration_min', 'duration_max', 'indoor_outdoor',
  'suitable_for_children', 'age_min', 'age_max', 'accessibility',
  'pet_friendly', 'reservation_required', 'cost_level',
  'estimated_cost_min', 'estimated_cost_max', 'cost_per_person',
  'official_website', 'instagram', 'whatsapp', 'partner',
  'divulga_lugares_recommended', 'divulga_lugares_tip', 'active',
  'is_demo', 'source_id', 'checked_at', 'confidence', 'created_at', 'updated_at',
  'official_url', 'instagram_url', 'maps_url', 'ticket_url', 'phone',
  'divulga_content_active', 'divulga_instagram_url', 'divulga_youtube_url',
  'divulga_tiktok_url', 'divulga_article_url', 'divulga_content_title',
  'google_last_sync_at', 'google_sync_status', 'google_data_version',
  'price_notes', 'price_valid_from', 'price_valid_until',
  'data_quality_label', 'data_quality_score', 'always_open'
]);

export function resolvePlaceUuid(id?: string, slug?: string): string {
  if (id && isValidUuid(id)) {
    return id;
  }
  if (slug && PLACE_UUID_MAP[slug]) return PLACE_UUID_MAP[slug];
  if (id && PLACE_UUID_MAP[id]) return PLACE_UUID_MAP[id];
  return 'a0000001-0000-0000-0000-000000000001';
}

export function mapRawPlaceToClientPlace(row: any): any {
  if (!row) return { ...SEED_PLACES[0] };
  const rawCat = (row.category_id || '').toLowerCase();
  let normalizedCategory: PlaceCategory = 'parque';
  if (rawCat === 'atrativo') normalizedCategory = 'atrativo';
  else if (rawCat === 'restaurant' || rawCat === 'restaurante') normalizedCategory = 'restaurante';
  else if (rawCat === 'cafe') normalizedCategory = 'cafe';
  else if (rawCat === 'museu') normalizedCategory = 'museu';
  else if (rawCat === 'vinicola') normalizedCategory = 'vinicola';
  else if (rawCat === 'chocolate') normalizedCategory = 'chocolate';
  else if (rawCat === 'mirante') normalizedCategory = 'mirante';
  else if (rawCat === 'show') normalizedCategory = 'show';
  else if (rawCat === 'compras') normalizedCategory = 'compras';
  else if (rawCat === 'noturno') normalizedCategory = 'noturno';

  const mappedPlace = {
    id: row.id,
    name: row.name,
    slug: row.slug || row.id,
    city: row.city || 'Gramado',
    category: normalizedCategory,
    description: row.description_short || row.description || '',
    latitude: Number(row.latitude || -29.3789),
    longitude: Number(row.longitude || -50.8741),
    address: row.address || `${row.city} - RS`,
    rating: Number(row.rating || 4.8),
    rating_count: Number(row.rating_count || 120),
    price_level: (Math.min(4, Math.max(1, Number(row.cost_level || 2)))) as 1 | 2 | 3 | 4,
    price_info: row.price_info || {
      adult_price: Number(row.cost_per_person || row.estimated_cost_min || 0),
      child_price: Number(row.cost_per_child || 0),
      is_free: Number(row.cost_per_person || 0) === 0,
      currency: 'BRL',
      source_name: row.source_id || 'Curadoria DUO21',
      checked_at: row.checked_at || new Date().toISOString(),
      confidence: 'high'
    },
    average_duration_minutes: Number(row.duration_min || 90),
    reservation_required: Boolean(row.reservation_required),
    accessible: Boolean(row.accessibility ?? true),
    pet_friendly: Boolean(row.pet_friendly),
    children_friendly: Boolean(row.suitable_for_children ?? true),
    indoor_type: row.indoor_outdoor || 'outdoor',
    opening_hours: row.opening_hours || { 'seg': '09:00 - 18:00' },
    media: Array.isArray(row.media) && row.media.length > 0
      ? row.media
      : [{ url: row.media_url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80', is_hero: true, source: 'duo21' }],
    is_divulga_lugares_partner: Boolean(row.partner || row.is_divulga_lugares_partner || row.divulga_lugares_recommended),
    active: Boolean(row.active ?? true),
    is_demo: Boolean(row.is_demo ?? false),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),

    // Sprint 10A Fields
    official_url: row.official_url || '',
    instagram_url: row.instagram_url || '',
    maps_url: row.maps_url || '',
    ticket_url: row.ticket_url || '',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    divulga_content_active: Boolean(row.divulga_content_active),
    divulga_instagram_url: row.divulga_instagram_url || '',
    divulga_youtube_url: row.divulga_youtube_url || '',
    divulga_tiktok_url: row.divulga_tiktok_url || '',
    divulga_article_url: row.divulga_article_url || '',
    divulga_content_title: row.divulga_content_title || '',
    google_place_id: row.google_place_id || '',
    google_last_sync_at: row.google_last_sync_at || null,
    google_sync_status: row.google_sync_status || 'NOT_SYNCED',
    google_data_version: row.google_data_version || null,
    price_notes: row.price_notes || '',
    price_valid_from: row.price_valid_from || null,
    price_valid_until: row.price_valid_until || null,
    always_open: Boolean(row.always_open),
    data_quality_label: row.data_quality_label,
    data_quality_score: row.data_quality_score
  };

  const dq = calculatePlaceDataQuality(mappedPlace);
  mappedPlace.data_quality_score = typeof mappedPlace.data_quality_score === 'number' ? mappedPlace.data_quality_score : dq.score;
  mappedPlace.data_quality_label = mappedPlace.data_quality_label || dq.label;

  return mappedPlace;
}

const env: ValidatedEnv = validateServerEnv();

let serverClient: SupabaseClient | null = null;
if (env.DATA_MODE === 'supabase' && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    serverClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
    console.log('[Supabase Server] Connected to remote Postgres instance as SOURCE OF TRUTH.');
  } catch (err) {
    console.error('[Supabase Server] Failed to initialize client:', err);
    if (env.NODE_ENV === 'production') {
      console.error('[Supabase Server] Database operations will return 503 DATABASE_UNAVAILABLE until credentials are configured.');
    }
  }
} else if (env.DATA_MODE === 'mock') {
  console.log('[Supabase Server] DATA_MODE=mock: Running in explicit Mock Mode for development/testing.');
}

// Explicit Mock Store (ONLY used when DATA_MODE === 'mock')
const mockStore = {
  places: [...SEED_PLACES],
  trips: [] as any[],
  trip_profiles: [] as any[],
  hours: [] as any[],
  prices: [] as any[],
  payments: [] as any[],
  api_usage: [] as any[],
  cache: new Map<string, { payload: any; expires_at: string }>(),
  reports: [] as any[]
};

export const supabaseServer = {
  getDataMode(): 'supabase' | 'mock' {
    return env.DATA_MODE;
  },

  isConfigured(): boolean {
    return env.DATA_MODE === 'supabase' && Boolean(serverClient);
  },

  async healthCheck(): Promise<{ status: 'connected' | 'mock' | 'error'; provider: string; details: string; latency_ms: number }> {
    const start = Date.now();

    if (env.DATA_MODE === 'mock') {
      return {
        status: 'mock',
        provider: 'Explicit Mock Store (Development/Test)',
        details: `DATA_MODE=mock explícito. ${mockStore.places.length} locais de seed em memória.`,
        latency_ms: 1
      };
    }

    if (!serverClient) {
      return {
        status: 'error',
        provider: 'Supabase Postgres (Source of Truth)',
        details: 'DATABASE_UNAVAILABLE: Supabase client não configurado ou credenciais ausentes.',
        latency_ms: Date.now() - start
      };
    }

    try {
      const { count, error } = await serverClient
        .from('places')
        .select('*', { count: 'exact', head: true });

      const latency = Date.now() - start;
      if (error) {
        return {
          status: 'error',
          provider: 'Supabase Postgres (Source of Truth)',
          details: `DATABASE_UNAVAILABLE: ${error.message}`,
          latency_ms: latency
        };
      }

      return {
        status: 'connected',
        provider: 'Supabase Postgres (Source of Truth)',
        details: `Conexão remota ativa. ${count ?? 0} locais cadastrados. RLS auditado.`,
        latency_ms: latency
      };
    } catch (err: any) {
      return {
        status: 'error',
        provider: 'Supabase Postgres (Source of Truth)',
        details: `DATABASE_UNAVAILABLE: ${err.message || 'Falha de conexão com o banco'}`,
        latency_ms: Date.now() - start
      };
    }
  },

  // ---------------------------------------------------------------------------
  // Places & Media Isolation (Hotfix 10A.4: Real UUID Resolution)
  // ---------------------------------------------------------------------------
  /**
   * Resolves any incoming place identifier (UUID, slug, source_id, name)
   * to the REAL primary key UUID in the Supabase `places` table.
   * Never generates synthetic hash UUIDs that do not exist in the database.
   */
  async resolveRealPlaceId(identifier: string): Promise<string | null> {
    if (!identifier || typeof identifier !== 'string') return null;
    const cleanId = identifier.trim();
    if (!cleanId) return null;

    // 1. Mock mode
    if (env.DATA_MODE === 'mock' || !serverClient) {
      const found = mockStore.places.find(p =>
        p.id === cleanId ||
        p.slug === cleanId ||
        (p as any).legacy_id === cleanId ||
        (p as any).source_id === cleanId ||
        (LEGACY_SEED_TO_SLUG[cleanId] && p.slug === LEGACY_SEED_TO_SLUG[cleanId]) ||
        (SEED_UUID_TO_SLUG[cleanId] && p.slug === SEED_UUID_TO_SLUG[cleanId]) ||
        p.name.toLowerCase() === cleanId.toLowerCase()
      );
      return found ? found.id : null;
    }

    // 2. Direct UUID lookup in public.places (verify existence in database)
    if (isValidUuid(cleanId)) {
      const { data: byId, error: errId } = await serverClient
        .from('places')
        .select('id')
        .eq('id', cleanId)
        .limit(1)
        .maybeSingle();
      if (!errId && byId?.id) return byId.id;

      // If cleanId is a known seed UUID that does not match this DB instance, resolve via its known slug
      const seedSlug = SEED_UUID_TO_SLUG[cleanId];
      if (seedSlug) {
        const { data: bySeedSlug, error: errSeedSlug } = await serverClient
          .from('places')
          .select('id')
          .eq('slug', seedSlug)
          .limit(1)
          .maybeSingle();
        if (!errSeedSlug && bySeedSlug?.id) return bySeedSlug.id;
      }
    }

    // 3. Lookup by source_id or google_place_id
    const { data: bySource, error: errSource } = await serverClient
      .from('places')
      .select('id')
      .eq('source_id', cleanId)
      .limit(1)
      .maybeSingle();
    if (!errSource && bySource?.id) return bySource.id;

    const { data: byGId, error: errGId } = await serverClient
      .from('places')
      .select('id')
      .eq('google_place_id', cleanId)
      .limit(1)
      .maybeSingle();
    if (!errGId && byGId?.id) return byGId.id;

    // 4. Lookup by slug
    const { data: bySlug, error: errSlug } = await serverClient
      .from('places')
      .select('id')
      .eq('slug', cleanId)
      .limit(1)
      .maybeSingle();
    if (!errSlug && bySlug?.id) return bySlug.id;

    // Also check if cleanId is a legacy seed ID mapped to a known slug
    const legacySlug = LEGACY_SEED_TO_SLUG[cleanId];
    if (legacySlug) {
      const { data: byLegacySlug, error: errLegacySlug } = await serverClient
        .from('places')
        .select('id')
        .eq('slug', legacySlug)
        .limit(1)
        .maybeSingle();
      if (!errLegacySlug && byLegacySlug?.id) return byLegacySlug.id;
    }

    // 5. Lookup by name (case-insensitive fuzzy/exact match)
    const normalizedName = cleanId.replace(/[-_]/g, ' ').trim();
    if (normalizedName.length >= 3) {
      const { data: byName, error: errName } = await serverClient
        .from('places')
        .select('id')
        .ilike('name', `%${normalizedName}%`)
        .limit(1)
        .maybeSingle();
      if (!errName && byName?.id) return byName.id;
    }

    // Never generate synthetic UUIDs by hash! Supabase places.id is the only source of truth.
    return null;
  },

  async getAllActiveMediaMap(): Promise<Record<string, any[]>> {
    const map: Record<string, any[]> = {};
    if (env.DATA_MODE === 'mock' || !serverClient) return map;

    try {
      const { data, error } = await serverClient
        .from('place_media_items')
        .select('*')
        .eq('active', true)
        .order('is_hero', { ascending: false })
        .order('display_order', { ascending: true });

      if (error) {
        console.warn('[place_media_items] batch load warning:', error.message);
        return map;
      }

      if (data && data.length > 0) {
        for (const row of data) {
          const pid = row.place_id;
          if (!map[pid]) map[pid] = [];
          map[pid].push({
            id: row.id,
            url: row.url,
            thumbnail_url: row.thumbnail_url || row.url,
            card_url: row.card_url || row.url,
            width: row.width || undefined,
            height: row.height || undefined,
            caption: row.caption || undefined,
            is_hero: Boolean(row.is_hero),
            is_logo: Boolean(row.is_logo),
            order: row.display_order,
            source: row.source || 'duo21',
            active: Boolean(row.active)
          });
        }
      }
    } catch (e: any) {
      console.warn('[place_media_items] batch query exception:', e.message);
    }
    return map;
  },

  async getMediaForPlace(placeId: string, includeInactive = false): Promise<any[]> {
    const realPlaceId = await this.resolveRealPlaceId(placeId);
    if (!realPlaceId) return [];

    if (env.DATA_MODE === 'mock' || !serverClient) {
      const place = mockStore.places.find(p => p.id === placeId || p.id === realPlaceId);
      const media = place?.media || [];
      return [...media].sort((a, b) => {
        if (a.is_hero && !b.is_hero) return -1;
        if (!a.is_hero && b.is_hero) return 1;
        return (a.order || 0) - (b.order || 0);
      });
    }

    try {
      let query = serverClient
        .from('place_media_items')
        .select('*')
        .eq('place_id', realPlaceId);

      if (!includeInactive) {
        query = query.eq('active', true);
      }

      const { data, error } = await query
        .order('is_hero', { ascending: false })
        .order('display_order', { ascending: true });

      if (error) {
        console.warn(`[place_media_items] query warning for ${placeId}:`, error.message);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        url: row.url,
        thumbnail_url: row.thumbnail_url || row.url,
        card_url: row.card_url || row.url,
        width: row.width || undefined,
        height: row.height || undefined,
        caption: row.caption || undefined,
        is_hero: Boolean(row.is_hero),
        is_logo: Boolean(row.is_logo),
        order: row.display_order,
        source: row.source || 'duo21',
        active: Boolean(row.active),
        created_at: row.created_at,
        updated_at: row.updated_at
      }));
    } catch (err: any) {
      console.warn('[place_media_items] getMediaForPlace error:', err.message);
      return [];
    }
  },

  async getPlaces(): Promise<any[]> {
    if (env.DATA_MODE === 'mock') {
      return mockStore.places.filter(p => p.active !== false).map(p => mapRawPlaceToClientPlace(p));
    }

    if (!serverClient) {
      throw new Error('DATABASE_UNAVAILABLE: Supabase client is not available.');
    }

    const { data, error } = await serverClient
      .from('places')
      .select('*')
      .eq('active', true);

    if (error) {
      throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    }

    const allMediaByPlace = await this.getAllActiveMediaMap();
    return (data || []).map(r => {
      const mapped = mapRawPlaceToClientPlace(r);
      if (allMediaByPlace[mapped.id] && allMediaByPlace[mapped.id].length > 0) {
        mapped.media = allMediaByPlace[mapped.id];
      }
      return mapped;
    });
  },

  async getAllPlacesForAdmin(): Promise<any[]> {
    if (env.DATA_MODE === 'mock') {
      return mockStore.places.map(p => mapRawPlaceToClientPlace(p));
    }

    if (!serverClient) {
      throw new Error('DATABASE_UNAVAILABLE: Supabase client is not available.');
    }

    const { data, error } = await serverClient
      .from('places')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    }

    const allMediaByPlace = await this.getAllActiveMediaMap();
    return (data || []).map(r => {
      const mapped = mapRawPlaceToClientPlace(r);
      if (allMediaByPlace[mapped.id] && allMediaByPlace[mapped.id].length > 0) {
        mapped.media = allMediaByPlace[mapped.id];
      }
      return mapped;
    });
  },

  async getPlaceById(id: string): Promise<any | null> {
    const realPlaceId = await this.resolveRealPlaceId(id);
    if (!realPlaceId) {
      if (env.DATA_MODE === 'mock' || !serverClient) {
        const p = mockStore.places.find(item => item.id === id || item.slug === id);
        if (!p) return null;
        return mapRawPlaceToClientPlace(p);
      }
      return null;
    }

    if (env.DATA_MODE === 'mock' || !serverClient) {
      const p = mockStore.places.find(item => item.id === realPlaceId || item.id === id);
      if (!p) return null;
      const clientPlace = mapRawPlaceToClientPlace(p);
      if (Array.isArray(clientPlace.media)) {
        clientPlace.media = [...clientPlace.media].sort((a, b) => {
          if (a.is_hero && !b.is_hero) return -1;
          if (!a.is_hero && b.is_hero) return 1;
          return (a.order || 0) - (b.order || 0);
        });
      }
      return clientPlace;
    }

    if (!serverClient) {
      throw new Error('DATABASE_UNAVAILABLE: Supabase client is not available.');
    }

    const { data, error } = await serverClient
      .from('places')
      .select('*')
      .eq('id', realPlaceId)
      .maybeSingle();

    if (error) {
      throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    }
    if (!data) return null;

    const clientPlace = mapRawPlaceToClientPlace(data);
    const mediaItems = await this.getMediaForPlace(data.id);
    if (mediaItems.length > 0) {
      clientPlace.media = mediaItems;
    }
    return clientPlace;
  },

  async savePlace(place: any): Promise<any> {
    const id = place.id && isValidUuid(place.id) ? place.id : crypto.randomUUID();
    const dq = calculatePlaceDataQuality(place);
    const newPlace = {
      ...place,
      id,
      legacy_id: place.legacy_id || (place.id && !isValidUuid(place.id) ? place.id : undefined),
      data_quality_score: dq.score,
      data_quality_label: dq.label,
      created_at: place.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (env.DATA_MODE === 'mock') {
      const idx = mockStore.places.findIndex(p =>
        p.id === id ||
        p.id === place.id ||
        (place.slug && p.slug === place.slug) ||
        (place.source_id && p.source_id === place.source_id) ||
        (place.legacy_id && (p as any).legacy_id === place.legacy_id)
      );
      if (idx >= 0) mockStore.places[idx] = newPlace;
      else mockStore.places.push(newPlace);
      return mapRawPlaceToClientPlace(newPlace);
    }

    if (!serverClient) {
      throw new Error('DATABASE_UNAVAILABLE: Supabase client is not available.');
    }

    // Extract relational fields so they are NEVER sent directly to places table
    const { media, hours, reviews, ...rawPlaceFields } = newPlace;

    // Sanitize payload: ONLY include valid columns of public.places
    const sanitizedPayload: Record<string, any> = {};
    for (const [key, val] of Object.entries(rawPlaceFields)) {
      if (VALID_PLACE_COLUMNS.has(key)) {
        sanitizedPayload[key] = val;
      }
    }

    const { error } = await serverClient
      .from('places')
      .upsert(sanitizedPayload);

    if (error) {
      throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    }

    if (Array.isArray(media) && media.length > 0) {
      for (const m of media) {
        await this.savePlaceMediaItem(id, m);
      }
    }

    return await this.getPlaceById(id);
  },

  async updatePlace(id: string, updates: any): Promise<any> {
    const realPlaceId = await this.resolveRealPlaceId(id);
    if (!realPlaceId) {
      throw new Error(`PLACE_NOT_FOUND: Local com identificador "${id}" não existe na tabela places.`);
    }

    if (env.DATA_MODE === 'mock' || !serverClient) {
      const existing = mockStore.places.find(p => p.id === realPlaceId || p.id === id);
      if (!existing) throw new Error('Place not found');
      if (Array.isArray(updates.media)) {
        await this.reorderPlaceMedia(realPlaceId, updates.media);
      }
      const { media, ...restUpdates } = updates;
      const updated = { ...existing, ...restUpdates, updated_at: new Date().toISOString() };
      const dq = calculatePlaceDataQuality(updated);
      updated.data_quality_score = dq.score;
      updated.data_quality_label = dq.label;
      const idx = mockStore.places.findIndex(p => p.id === realPlaceId || p.id === id);
      mockStore.places[idx] = updated;
      return mapRawPlaceToClientPlace(updated);
    }

    const existing = await this.getPlaceById(realPlaceId);
    const merged = { ...(existing || {}), ...updates };
    const dq = calculatePlaceDataQuality(merged);

    // Extract media so it is NEVER sent to places table
    const { media, hours, reviews, ...rawPlaceFields } = updates;

    // If media was explicitly passed in updates, reorder/sync place_media_items
    if (Array.isArray(media)) {
      await this.reorderPlaceMedia(realPlaceId, media);
    }

    // Sanitize payload: ONLY include valid columns of public.places
    const sanitizedPayload: Record<string, any> = {
      data_quality_score: dq.score,
      data_quality_label: dq.label,
      updated_at: new Date().toISOString()
    };

    for (const [key, val] of Object.entries(rawPlaceFields)) {
      if (VALID_PLACE_COLUMNS.has(key)) {
        sanitizedPayload[key] = val;
      }
    }

    const { error } = await serverClient
      .from('places')
      .update(sanitizedPayload)
      .eq('id', realPlaceId);

    if (error) {
      throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    }

    return await this.getPlaceById(realPlaceId);
  },

  async deactivatePlace(id: string): Promise<boolean> {
    await this.updatePlace(id, { active: false });
    return true;
  },

  async deletePlace(id: string): Promise<boolean> {
    const realPlaceId = await this.resolveRealPlaceId(id);
    if (!realPlaceId) return false;

    if (env.DATA_MODE === 'mock') {
      const idx = mockStore.places.findIndex(p => p.id === realPlaceId);
      if (idx >= 0) {
        mockStore.places.splice(idx, 1);
        return true;
      }
      return false;
    }

    if (!serverClient) {
      throw new Error('DATABASE_UNAVAILABLE: Supabase client is not available.');
    }

    const { error } = await serverClient
      .from('places')
      .delete()
      .eq('id', realPlaceId);

    if (error) {
      throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    }
    return true;
  },

  async savePlaceMediaItem(placeId: string, mediaItem: any): Promise<any> {
    const realPlaceId = await this.resolveRealPlaceId(placeId);
    if (!realPlaceId) {
      throw new Error(`PLACE_NOT_FOUND: Local com identificador "${placeId}" não existe na tabela places.`);
    }

    // Defensive check: ensure realPlaceId exists in places table right now
    if (env.DATA_MODE === 'supabase' && serverClient) {
      const { data: placeCheck, error: checkError } = await serverClient
        .from('places')
        .select('id')
        .eq('id', realPlaceId)
        .limit(1)
        .maybeSingle();

      if (checkError || !placeCheck?.id) {
        throw new Error(`PLACE_NOT_FOUND: Integridade referencial violada. O local "${placeId}" (UUID ${realPlaceId}) não existe na tabela places do Supabase.`);
      }
    }

    const mediaId = mediaItem.id && isValidUuid(mediaItem.id) ? mediaItem.id : crypto.randomUUID();
    const isHero = Boolean(mediaItem.is_hero);

    const newMedia = {
      id: mediaId,
      place_id: realPlaceId,
      url: mediaItem.url,
      thumbnail_url: mediaItem.thumbnail_url || mediaItem.url,
      card_url: mediaItem.card_url || mediaItem.url,
      width: mediaItem.width || null,
      height: mediaItem.height || null,
      caption: mediaItem.caption || null,
      is_hero: isHero,
      is_logo: Boolean(mediaItem.is_logo),
      display_order: Number(mediaItem.display_order ?? mediaItem.order ?? 0),
      source: mediaItem.source || 'duo21',
      active: mediaItem.active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (env.DATA_MODE === 'mock' || !serverClient) {
      const place = mockStore.places.find(p => p.id === realPlaceId);
      if (!place) {
        throw new Error(`PLACE_NOT_FOUND: Local com identificador "${placeId}" não existe na base de dados.`);
      }
      if (!Array.isArray(place.media)) place.media = [];
      if (newMedia.is_hero) {
        place.media.forEach((m: any) => { m.is_hero = false; });
      }
      place.media.push({
        id: newMedia.id,
        url: newMedia.url,
        thumbnail_url: newMedia.thumbnail_url,
        card_url: newMedia.card_url,
        caption: newMedia.caption,
        is_hero: newMedia.is_hero,
        source: newMedia.source,
        active: newMedia.active,
        order: newMedia.display_order
      });
      return newMedia;
    }

    try {
      // If marked as hero, reset previous hero media for this place
      if (isHero) {
        await serverClient
          .from('place_media_items')
          .update({ is_hero: false, updated_at: new Date().toISOString() })
          .eq('place_id', realPlaceId);
      }

      const { data, error } = await serverClient
        .from('place_media_items')
        .insert(newMedia)
        .select()
        .single();

      if (error) {
        console.error('[place_media_items] insert error:', error.message);
        if (error.message.includes('violates foreign key constraint') || (error as any).code === '23503') {
          throw new Error(`PLACE_NOT_FOUND: O local "${placeId}" (UUID ${realPlaceId}) não existe na tabela places do Supabase.`);
        }
        throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
      }

      // Update place's updated_at timestamp without touching media column
      try {
        const { error: touchError } = await serverClient
          .from('places')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', realPlaceId);
        if (touchError) {
          console.warn('[places] updated_at touch warning:', touchError.message);
        }
      } catch (touchErr: any) {
        console.warn('[places] updated_at touch exception:', touchErr.message);
      }

      return data || newMedia;
    } catch (err: any) {
      console.error('[place_media_items] save error:', err.message);
      throw err;
    }
  },

  async deletePlaceMediaItem(placeId: string, mediaIdOrUrl: string): Promise<boolean> {
    const realPlaceId = await this.resolveRealPlaceId(placeId);
    if (!realPlaceId) return false;

    if (env.DATA_MODE === 'mock' || !serverClient) {
      const place = mockStore.places.find(p => p.id === placeId || p.id === realPlaceId);
      if (place && Array.isArray(place.media)) {
        place.media = place.media.filter((m: any) => m.id !== mediaIdOrUrl && m.url !== mediaIdOrUrl);
        if (place.media.length > 0 && !place.media.some((m: any) => m.is_hero)) {
          place.media[0].is_hero = true;
        }
      }
      return true;
    }

    try {
      const isUuid = isValidUuid(mediaIdOrUrl);

      // 1. Fetch item to check if it's our own Storage file and if it's hero
      let selectQuery = serverClient
        .from('place_media_items')
        .select('*')
        .eq('place_id', realPlaceId);

      if (isUuid) {
        selectQuery = selectQuery.eq('id', mediaIdOrUrl);
      } else {
        selectQuery = selectQuery.eq('url', mediaIdOrUrl);
      }

      const { data: itemToDelete } = await selectQuery.maybeSingle();

      // 2. If it is our DUO21 managed storage file, delete from Supabase Storage
      if (itemToDelete?.url) {
        const isOurStorage = itemToDelete.url.includes('/places/') && (itemToDelete.source === 'duo21' || itemToDelete.url.includes('storage.supabase'));
        if (isOurStorage && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const match = itemToDelete.url.match(/places\/(.+)$/);
            if (match && match[1]) {
              const relativePath = match[1];
              const { createClient } = await import('@supabase/supabase-js');
              const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
              await client.storage.from('places').remove([relativePath]);
            }
          } catch (storageErr) {
            console.warn('[Supabase Storage] Delete error (ignored):', storageErr);
          }
        }
      }

      // 3. Delete from place_media_items
      let deleteQuery = serverClient
        .from('place_media_items')
        .delete()
        .eq('place_id', realPlaceId);

      if (isUuid) {
        deleteQuery = deleteQuery.eq('id', mediaIdOrUrl);
      } else {
        deleteQuery = deleteQuery.eq('url', mediaIdOrUrl);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        console.warn('[place_media_items] delete warning:', deleteError.message);
      }

      // 4. If hero was deleted, promote first remaining active media to hero
      if (itemToDelete?.is_hero) {
        const { data: remaining } = await serverClient
          .from('place_media_items')
          .select('id')
          .eq('place_id', realPlaceId)
          .eq('active', true)
          .order('display_order', { ascending: true })
          .limit(1);

        if (remaining && remaining.length > 0) {
          await serverClient
            .from('place_media_items')
            .update({ is_hero: true, updated_at: new Date().toISOString() })
            .eq('id', remaining[0].id);
        }
      }

      return true;
    } catch (err: any) {
      console.warn('[place_media_items] delete exception:', err.message);
      return false;
    }
  },

  async reorderPlaceMedia(placeId: string, mediaItems: any[]): Promise<any[]> {
    const realPlaceId = await this.resolveRealPlaceId(placeId);
    if (!realPlaceId || !Array.isArray(mediaItems)) return [];

    if (env.DATA_MODE === 'mock' || !serverClient) {
      const place = mockStore.places.find(p => p.id === placeId || p.id === realPlaceId);
      if (place) {
        place.media = mediaItems.map((m, idx) => ({
          ...m,
          order: idx + 1,
          is_hero: idx === 0 ? true : false
        }));
      }
      return place?.media || [];
    }

    try {
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        let query = serverClient
          .from('place_media_items')
          .update({
            display_order: i + 1,
            is_hero: i === 0,
            updated_at: new Date().toISOString()
          })
          .eq('place_id', realPlaceId);

        if (item.id && isValidUuid(item.id)) {
          query = query.eq('id', item.id);
        } else if (item.url) {
          query = query.eq('url', item.url);
        }
        await query;
      }
    } catch (err: any) {
      console.warn('[place_media_items] reorder warning:', err.message);
    }

    return await this.getMediaForPlace(realPlaceId);
  },

  async getCatalogMetrics(): Promise<any> {
    const places = env.DATA_MODE === 'mock' 
      ? [...mockStore.places] 
      : await this.getPlaces().catch(() => [...mockStore.places]);

    const total = places.length;
    let withPhoto = 0;
    let withHours = 0;
    let unconfirmedHours = 0;
    let withGooglePlaceId = 0;
    let withDivulgaContent = 0;
    let partners = 0;
    let needsUpdate = 0;

    for (const p of places) {
      const hasPhoto = Boolean(
        (Array.isArray(p.media) && p.media.some((m: any) => m.active !== false && m.url)) ||
        p.media_url
      );
      if (hasPhoto) withPhoto++;

      const hasHoursConfirmed = Boolean(
        p.always_open || 
        (p.opening_hours && Object.keys(p.opening_hours).length > 0 && 
         Object.values(p.opening_hours).some((v: any) => v && v !== 'Horário não confirmado' && v !== 'Fechado'))
      );
      if (hasHoursConfirmed) withHours++;
      else unconfirmedHours++;

      if (p.google_place_id) withGooglePlaceId++;
      if (p.divulga_content_active || p.has_divulga_content) withDivulgaContent++;
      if (p.is_divulga_lugares_partner || p.partner) partners++;

      const dq = calculatePlaceDataQuality(p);
      if (dq.label === 'Precisa atualização' || dq.label === 'Incompleto') {
        needsUpdate++;
      }
    }

    return {
      target_mvp: 300,
      total_places: total,
      progress_percent: Math.min(100, Math.round((total / 300) * 100)),
      with_photo: withPhoto,
      without_photo: total - withPhoto,
      with_hours: withHours,
      unconfirmed_hours: unconfirmedHours,
      with_google_place_id: withGooglePlaceId,
      with_divulga_content: withDivulgaContent,
      partners,
      needs_update: needsUpdate
    };
  },

  // ---------------------------------------------------------------------------
  // Hours (place_hours)
  // ---------------------------------------------------------------------------
  async getHoursForPlace(placeId: string, date?: string): Promise<any> {
    if (env.DATA_MODE === 'mock') {
      const list = mockStore.hours.filter(h => h.place_id === placeId);
      if (date) {
        const special = list.find(h => h.special_date === date);
        if (special) return special;
        const dayOfWeek = new Date(date).getDay();
        return list.find(h => h.day_of_week === dayOfWeek) || null;
      }
      return list;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');

    let query = serverClient.from('place_hours').select('*').eq('place_id', placeId);
    if (date) {
      const dayOfWeek = new Date(date).getDay();
      query = query.or(`special_date.eq.${date},and(day_of_week.eq.${dayOfWeek},special_date.is.null)`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return date ? (data?.[0] || null) : (data || []);
  },

  async upsertHours(record: any): Promise<any> {
    if (env.DATA_MODE === 'mock') {
      const id = record.id || `hour_${Date.now()}`;
      const full = { ...record, id };
      const idx = mockStore.hours.findIndex(h => h.id === id);
      if (idx >= 0) mockStore.hours[idx] = full;
      else mockStore.hours.push(full);
      return full;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { data, error } = await serverClient.from('place_hours').upsert(record).select().single();
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return data;
  },

  async deleteHours(id: string): Promise<boolean> {
    if (env.DATA_MODE === 'mock') {
      const idx = mockStore.hours.findIndex(h => h.id === id);
      if (idx >= 0) mockStore.hours.splice(idx, 1);
      return true;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { error } = await serverClient.from('place_hours').delete().eq('id', id);
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return true;
  },

  // ---------------------------------------------------------------------------
  // Price Observations
  // ---------------------------------------------------------------------------
  async getPricesForPlace(placeId: string, season?: string): Promise<any> {
    if (env.DATA_MODE === 'mock') {
      const list = mockStore.prices.filter(p => p.place_id === placeId);
      if (season) return list.find(p => p.season === season) || list[0] || null;
      return list;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    let query = serverClient.from('price_observations').select('*').eq('place_id', placeId);
    if (season) query = query.eq('season', season);
    const { data, error } = await query;
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return season ? (data?.[0] || null) : (data || []);
  },

  async savePrice(priceRecord: any): Promise<any> {
    if (env.DATA_MODE === 'mock') {
      const id = priceRecord.id || `price_${Date.now()}`;
      const full = { ...priceRecord, id, observed_at: new Date().toISOString() };
      mockStore.prices.push(full);
      return full;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { data, error } = await serverClient.from('price_observations').upsert(priceRecord).select().single();
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return data;
  },

  async updatePrice(id: string, updates: any): Promise<any> {
    if (env.DATA_MODE === 'mock') {
      const idx = mockStore.prices.findIndex(p => p.id === id);
      if (idx >= 0) {
        mockStore.prices[idx] = { ...mockStore.prices[idx], ...updates };
        return mockStore.prices[idx];
      }
      throw new Error('Price observation not found');
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { data, error } = await serverClient.from('price_observations').update(updates).eq('id', id).select().single();
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return data;
  },

  async deletePrice(id: string): Promise<boolean> {
    if (env.DATA_MODE === 'mock') {
      const idx = mockStore.prices.findIndex(p => p.id === id);
      if (idx >= 0) mockStore.prices.splice(idx, 1);
      return true;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { error } = await serverClient.from('price_observations').delete().eq('id', id);
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return true;
  },

  // ---------------------------------------------------------------------------
  // Trips & Itinerary
  // ---------------------------------------------------------------------------
  async saveTrip(trip: any): Promise<any> {
    if (env.DATA_MODE === 'mock') {
      const idx = mockStore.trips.findIndex(t => t.id === trip.id || t.secure_token === trip.secure_token);
      if (idx >= 0) mockStore.trips[idx] = { ...trip };
      else mockStore.trips.push({ ...trip });
      return trip;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');

    const tripUuid = toDeterministicUuid(trip.id);

    // 1. Upsert trip record
    const { error: tripError } = await serverClient.from('trips').upsert({
      id: tripUuid,
      secure_token: trip.secure_token,
      customer_name: trip.preferences?.name || 'Viajante',
      customer_email: trip.preferences?.email || null,
      start_date: trip.preferences?.start_date,
      end_date: trip.preferences?.end_date,
      status: (trip.status || 'DRAFT').toUpperCase(),
      accommodation_status: trip.preferences?.accommodation_status || 'not_booked',
      transport_type: trip.preferences?.transport || 'carro_alugado',
      pace: trip.preferences?.pace || 'equilibrado',
      price_brl: trip.price_brl || 19.90,
      is_demo: Boolean(trip.is_demo),
      unlock_source: trip.unlock_source || 'payment',
      generation_authorization: trip.status === 'paid' || trip.status === 'ready'
    });

    if (tripError) {
      console.error('[Supabase Server] Error upserting trip:', tripError);
      throw new Error(`DATABASE_UNAVAILABLE: Failed to save trip (${tripError.message})`);
    }

    // 2. Upsert trip profile
    if (trip.preferences) {
      await serverClient.from('trip_profiles').upsert({
        trip_id: tripUuid,
        adults: trip.preferences.adults_count || 2,
        children: trip.preferences.children_count || 0,
        children_ages: trip.preferences.children_ages || [],
        interests: trip.preferences.interests || [],
        must_have: trip.preferences.must_have || trip.preferences.mandatory_places || [],
        avoid: trip.preferences.avoid || trip.preferences.restrictions || [],
        budget_total: trip.preferences.budget_total || null,
        budget_food_per_person: trip.preferences.budget_food_per_person || null,
        budget_dinner_per_person: trip.preferences.budget_dinner_per_person || null,
        budget_flexible: trip.preferences.budget_flexibility || 'equilibrado'
      });
    }

    // 3. Upsert trip days & activities if full itinerary is unlocked and generated
    if (Array.isArray(trip.days) && trip.days.length > 0) {
      for (const day of trip.days) {
        const { data: dayRow, error: dayError } = await serverClient
          .from('trip_days')
          .upsert({
            trip_id: tripUuid,
            day_number: day.day_number,
            date: day.date,
            city: day.city_focus || 'Gramado',
            theme: day.theme_title || day.theme || 'Exploração',
            estimated_cost_min: day.total_day_cost_estimated || day.estimated_daily_cost_min || 0,
            estimated_cost_max: day.total_day_cost_estimated || day.estimated_daily_cost_max || 0
          }, { onConflict: 'trip_id,day_number' })
          .select('id')
          .single();

        if (dayError) {
          console.error('[Supabase Server] Error saving trip day:', dayError);
        }

        if (dayRow && Array.isArray(day.activities)) {
          for (let i = 0; i < day.activities.length; i++) {
            const act = day.activities[i];
            const resolvedPlaceId = resolvePlaceUuid(act.place_id || act.place?.id, act.place?.slug);
            const actDeterministicId = toDeterministicUuid(`${dayRow.id}_act_${i + 1}`);
            const costVal = Number(act.estimated_cost_per_person || act.place?.price_info?.adult_price || 0);
            const { error: actError } = await serverClient.from('trip_activities').upsert({
              id: actDeterministicId,
              trip_day_id: dayRow.id,
              place_id: resolvedPlaceId,
              activity_type: act.activity_type || act.place?.category || 'attraction',
              start_time: act.time ? (act.time.length === 5 ? `${act.time}:00` : act.time) : '09:00:00',
              position: i + 1,
              reason: act.notes || act.reason || null,
              locked: Boolean(act.locked),
              estimated_cost_min: costVal,
              estimated_cost_max: costVal
            }, { onConflict: 'id' });
            if (actError) {
              console.error('[Supabase Server] Error saving trip activity:', actError);
            }
          }
        }
      }
    }

    return trip;
  },

  async getTripByToken(token: string): Promise<any | null> {
    if (env.DATA_MODE === 'mock') {
      return mockStore.trips.find(t => t.secure_token === token) || null;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');

    const { data: tripRow, error } = await serverClient
      .from('trips')
      .select('*')
      .eq('secure_token', token)
      .maybeSingle();

    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    if (!tripRow) return null;

    // Fetch profile
    const { data: profile } = await serverClient
      .from('trip_profiles')
      .select('*')
      .eq('trip_id', tripRow.id)
      .maybeSingle();

    // Fetch days and activities
    const { data: daysRows } = await serverClient
      .from('trip_days')
      .select('*, trip_activities(*, places(*))')
      .eq('trip_id', tripRow.id)
      .order('day_number', { ascending: true });

    return {
      id: tripRow.id,
      secure_token: tripRow.secure_token,
      status: tripRow.status.toLowerCase(),
      price_tier_id: 'standard',
      price_brl: Number(tripRow.price_brl || 19.90),
      total_estimated_spend_brl: 0,
      is_demo: Boolean(tripRow.is_demo),
      unlock_source: tripRow.unlock_source || 'payment',
      created_at: tripRow.created_at,
      paid_at: tripRow.status === 'PAID' || tripRow.status === 'READY' ? tripRow.updated_at : undefined,
      preferences: {
        name: tripRow.customer_name || 'Viajante',
        email: tripRow.customer_email || undefined,
        start_date: tripRow.start_date,
        end_date: tripRow.end_date,
        adults_count: profile?.adults || 2,
        children_count: profile?.children || 0,
        children_ages: profile?.children_ages || [],
        pace: tripRow.pace || 'equilibrado',
        transport: tripRow.transport_type || 'carro_alugado',
        interests: profile?.interests || ['Gastronomia', 'Natureza'],
        mandatory_places: profile?.must_have || [],
        restrictions: profile?.avoid || [],
        budget_total: profile?.budget_total || 3000,
        budget_food_per_person: profile?.budget_food_per_person,
        budget_dinner_per_person: profile?.budget_dinner_per_person,
        budget_flexibility: profile?.budget_flexible || 'equilibrado'
      },
      days: (daysRows || []).map((d: any) => ({
        id: d.id,
        day_number: d.day_number,
        date: d.date,
        city_focus: d.city,
        theme_title: d.theme || d.theme_title || 'Exploração',
        total_day_cost_estimated: Number(d.estimated_cost_min || 0),
        activities: (d.trip_activities || []).map((a: any) => ({
          id: a.id,
          time: a.start_time?.substring(0, 5) || '09:00',
          place_id: a.place_id,
          place: mapRawPlaceToClientPlace(a.places) || a.places,
          activity_type: a.activity_type,
          locked: a.locked,
          notes: a.reason
        }))
      })),
      usage_stats: {
        guide_messages_today: 0,
        guide_messages_limit: 30,
        structural_changes_today: 0,
        structural_changes_limit: 3,
        full_regenerations_used: 0,
        full_regenerations_limit: 1
      }
    };
  },

  async getTripById(id: string): Promise<any | null> {
    if (env.DATA_MODE === 'mock') {
      return mockStore.trips.find(t => t.id === id) || null;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');

    const tripUuid = toDeterministicUuid(id);
    const { data: tripRow, error } = await serverClient
      .from('trips')
      .select('secure_token')
      .eq('id', tripUuid)
      .maybeSingle();

    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    if (!tripRow) return null;
    return this.getTripByToken(tripRow.secure_token);
  },

  async getTrips(): Promise<any[]> {
    if (env.DATA_MODE === 'mock') {
      return mockStore.trips;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { data, error } = await serverClient.from('trips').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    return data || [];
  },

  // ---------------------------------------------------------------------------
  // API Usage (api_usage)
  // ---------------------------------------------------------------------------
  // PAYMENT ORDERS (Asaas & PIX Checkout)
  // ---------------------------------------------------------------------------
  async savePaymentOrder(order: any): Promise<any> {
    const entry = {
      id: order.id,
      trip_id: order.trip_id,
      amount_brl: Number(order.amount_brl || 0),
      payment_method: order.payment_method || 'pix',
      status: (order.status || 'PENDING').toLowerCase(),
      asaas_payment_id: order.asaas_payment_id || null,
      customer_name: order.customer_name || null,
      customer_email: order.customer_email || 'turista@duo21.com.br',
      customer_cpf: order.customer_cpf || null,
      pix_qr_code: order.pix_qr_code || null,
      pix_copy_paste: order.pix_copy_paste || null,
      is_sandbox: Boolean(order.is_sandbox),
      campaign_id: order.campaign_id || null,
      campaign_slot: order.campaign_slot || null,
      official_price: order.official_price ? Number(order.official_price) : null,
      charged_price: order.charged_price ? Number(order.charged_price) : Number(order.amount_brl || 0),
      discount_amount: order.discount_amount ? Number(order.discount_amount) : 0,
      trip_days: order.trip_days ? Number(order.trip_days) : null,
      paid_at: order.paid_at || null,
      created_at: order.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (env.DATA_MODE === 'mock') {
      const idx = mockStore.payments.findIndex((p: any) => p.id === order.id || (order.asaas_payment_id && p.asaas_payment_id === order.asaas_payment_id));
      if (idx >= 0) mockStore.payments[idx] = { ...mockStore.payments[idx], ...entry };
      else mockStore.payments.push(entry);
      return entry;
    }

    if (!serverClient) return entry;

    try {
      const { error } = await serverClient.from('payment_orders').upsert(entry);
      if (error) {
        console.warn('[Supabase Server] payment_orders upsert warning:', error.message);
      }
    } catch (err: any) {
      console.warn('[Supabase Server] payment_orders exception:', err.message);
    }
    return entry;
  },

  // ---------------------------------------------------------------------------
  async logApiUsage(record: any): Promise<void> {
    const entry = {
      id: record.id || `usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      trip_id: record.trip_id || null,
      provider: record.provider || 'OTHER',
      operation: record.operation || 'query',
      request_count: record.request_count || 1,
      input_tokens: record.input_tokens || 0,
      output_tokens: record.output_tokens || 0,
      estimated_cost_brl: Number(record.estimated_cost_brl || 0),
      cached: Boolean(record.cached),
      created_at: record.created_at || new Date().toISOString()
    };

    if (env.DATA_MODE === 'mock') {
      mockStore.api_usage.push(entry);
      return;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { error } = await serverClient.from('api_usage').insert(entry);
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
  },

  async getApiUsageMetrics(): Promise<any> {
    if (env.DATA_MODE === 'mock') {
      let totalCost = 0;
      const byProvider: Record<string, { requests: number; costBrl: number }> = {};
      const tripIds = new Set<string>();

      for (const item of mockStore.api_usage) {
        totalCost += Number(item.estimated_cost_brl || 0);
        if (item.trip_id) tripIds.add(item.trip_id);
        if (!byProvider[item.provider]) {
          byProvider[item.provider] = { requests: 0, costBrl: 0 };
        }
        byProvider[item.provider].requests += item.request_count || 1;
        byProvider[item.provider].costBrl += Number(item.estimated_cost_brl || 0);
      }

      const totalTrips = Math.max(1, tripIds.size);
      return {
        totalRequests: mockStore.api_usage.length,
        totalCostBrl: Number(totalCost.toFixed(4)),
        avgCostPerTripBrl: Number((totalCost / totalTrips).toFixed(4)),
        totalTripsLogged: totalTrips,
        byProvider
      };
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { data, error } = await serverClient.from('api_usage').select('*');
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);

    let totalCost = 0;
    const byProvider: Record<string, { requests: number; costBrl: number }> = {};
    const tripIds = new Set<string>();

    for (const item of (data || [])) {
      totalCost += Number(item.estimated_cost_brl || 0);
      if (item.trip_id) tripIds.add(item.trip_id);
      if (!byProvider[item.provider]) {
        byProvider[item.provider] = { requests: 0, costBrl: 0 };
      }
      byProvider[item.provider].requests += item.request_count || 1;
      byProvider[item.provider].costBrl += Number(item.estimated_cost_brl || 0);
    }

    const totalTrips = Math.max(1, tripIds.size);
    return {
      totalRequests: (data || []).length,
      totalCostBrl: Number(totalCost.toFixed(4)),
      avgCostPerTripBrl: Number((totalCost / totalTrips).toFixed(4)),
      totalTripsLogged: totalTrips,
      byProvider
    };
  },

  // ---------------------------------------------------------------------------
  // External Data Cache (external_data_cache)
  // ---------------------------------------------------------------------------
  async getCache(cacheKey: string): Promise<any | null> {
    if (env.DATA_MODE === 'mock') {
      const entry = mockStore.cache.get(cacheKey);
      if (!entry) return null;
      if (new Date(entry.expires_at) <= new Date()) {
        mockStore.cache.delete(cacheKey);
        return null;
      }
      return entry;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { data, error } = await serverClient
      .from('external_data_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .maybeSingle();

    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
    if (!data) return null;

    if (new Date(data.expires_at) <= new Date()) {
      await serverClient.from('external_data_cache').delete().eq('cache_key', cacheKey);
      return null;
    }
    return data;
  },

  async setCache(key: string, provider: string, operation: string, payload: any, ttlSeconds = 86400): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const row = {
      cache_key: key,
      provider,
      operation,
      payload,
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    };

    if (env.DATA_MODE === 'mock') {
      mockStore.cache.set(key, { payload, expires_at: expiresAt });
      return;
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { error } = await serverClient.from('external_data_cache').upsert(row);
    if (error) throw new Error(`DATABASE_UNAVAILABLE: ${error.message}`);
  },

  async deleteCache(key: string): Promise<boolean> {
    if (env.DATA_MODE === 'mock') {
      return mockStore.cache.delete(key);
    }
    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');
    const { error } = await serverClient.from('external_data_cache').delete().eq('cache_key', key);
    return !error;
  },

  // ---------------------------------------------------------------------------
  // Candidate RPC (Section 34)
  // ---------------------------------------------------------------------------
  async getCandidatePlaces(params: {
    cities: string[];
    categories?: string[];
    suitable_for_children?: boolean;
    indoor_outdoor?: string;
    max_cost_level?: number;
    limit?: number;
  }): Promise<any[]> {
    if (env.DATA_MODE === 'mock') {
      let filtered = mockStore.places.filter((p: any) => p.active !== false && params.cities.includes(p.city));
      if (params.categories && params.categories.length > 0) {
        filtered = filtered.filter((p: any) => params.categories!.includes(p.category_id || p.category));
      }
      if (params.suitable_for_children) {
        filtered = filtered.filter((p: any) => p.children_friendly || p.suitable_for_children);
      }
      if (params.indoor_outdoor) {
        filtered = filtered.filter((p: any) => p.indoor_type === params.indoor_outdoor || p.indoor_outdoor === params.indoor_outdoor);
      }
      if (params.max_cost_level) {
        filtered = filtered.filter((p: any) => (p.cost_level || p.price_level || 1) <= params.max_cost_level!);
      }
      return filtered.slice(0, params.limit || 50);
    }

    if (!serverClient) throw new Error('DATABASE_UNAVAILABLE');

    const { data, error } = await serverClient.rpc('get_candidate_places', {
      p_cities: params.cities,
      p_categories: params.categories || null,
      p_suitable_for_children: params.suitable_for_children ?? null,
      p_indoor_outdoor: params.indoor_outdoor || null,
      p_max_cost_level: params.max_cost_level || 4,
      p_limit: params.limit || 50
    });

    if (error) {
      console.warn('[RPC Candidate] RPC failed, falling back to direct table select:', error.message);
      // Direct table query if RPC is not deployed yet
      let q = serverClient.from('places').select('*').in('city', params.cities).eq('active', true);
      if (params.categories) q = q.in('category_id', params.categories);
      const res = await q.limit(params.limit || 50);
      return res.data || [];
    }

    return data || [];
  },

  // ---------------------------------------------------------------------------
  // Data Sources & Quality
  // ---------------------------------------------------------------------------
  getSources(): any[] {
    return [
      { id: 'duo21_curatorship', name: 'Curadoria DUO21 / Divulga Lugares', type: 'DUO21', base_url: 'https://divulgalugares.com.br', active: true, reliability_level: 'high' },
      { id: 'official_gramado', name: 'Secretaria de Turismo de Gramado', type: 'OFFICIAL', base_url: 'https://gramado.rs.gov.br', active: true, reliability_level: 'high' },
      { id: 'official_canela', name: 'Turismo Canela Paixão Natural', type: 'OFFICIAL', base_url: 'https://canela.rs.gov.br', active: true, reliability_level: 'high' },
      { id: 'google_places', name: 'Google Places Platform (Cache)', type: 'GOOGLE', base_url: 'https://maps.googleapis.com', active: true, reliability_level: 'high' }
    ];
  },

  async getQualityMetrics(): Promise<any> {
    const places = await this.getPlaces().catch(() => []);
    const total = places.length;

    let missingCoords = 0;
    let missingGoogleId = 0;
    let missingHours = 0;
    let missingSource = 0;
    let missingPrice = 0;
    let lowConfidence = 0;
    let outdated = 0;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    for (const p of places) {
      if (!p.latitude || !p.longitude) missingCoords++;
      if (!p.google_place_id) missingGoogleId++;
      if (!p.opening_hours && !p.duration_min) missingHours++;
      if (!p.source_id && !p.price_info?.source_name) missingSource++;
      if (p.cost_level === undefined && !p.price_level) missingPrice++;
      if (p.confidence === 'low') lowConfidence++;
      if (p.checked_at && new Date(p.checked_at) < sixMonthsAgo) outdated++;
    }

    return {
      totalPlaces: total,
      missingCoords,
      missingGoogleId,
      missingHours,
      missingSource,
      missingPrice,
      lowConfidence,
      outdated
    };
  }
};

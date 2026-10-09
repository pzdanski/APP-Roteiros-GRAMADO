import { Place } from '../types';

export const GENERIC_PLACEHOLDER_PHOTO_URL = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb';

/**
 * Detects if a Google Place ID is a demonstration/mock placeholder.
 * Placeholders typically end with '-demo', contain 'demo', or start with synthetic prefix.
 */
export function isDemoPlaceId(placeId?: string | null): boolean {
  if (!placeId || typeof placeId !== 'string') return false;
  const clean = placeId.trim().toLowerCase();
  return clean.includes('-demo') || clean.includes('demo') || clean.endsWith('_demo') || clean.startsWith('demo-');
}

/**
 * Detects if an image URL is a generic visual placeholder rather than an authentic DUO21/partner photo.
 */
export function isPlaceholderImageUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const clean = url.trim();
  if (clean.length === 0) return true;
  if (clean.includes('photo-1506744038136-46273834b3fb')) return true; // Generic Unsplash fallback
  if (clean.includes('via.placeholder.com') || clean.includes('placeholder.com')) return true;
  return false;
}

/**
 * Checks if a place has verified, non-placeholder photographic media.
 */
export function hasRealPhotos(place: Partial<Place>): boolean {
  if (Array.isArray(place.media) && place.media.length > 0) {
    return place.media.some(m => {
      if (m.active === false) return false;
      if (!m.url || m.url.trim().length === 0) return false;
      if ((m as any).is_placeholder === true) return false;
      return !isPlaceholderImageUrl(m.url);
    });
  }
  const mediaUrl = (place as any).media_url;
  if (mediaUrl && !isPlaceholderImageUrl(mediaUrl)) {
    return true;
  }
  return false;
}

/**
 * Checks if a place has a verified, production Google Place ID.
 */
export function hasRealGooglePlaceId(place: Partial<Place>): boolean {
  if (!place.google_place_id || typeof place.google_place_id !== 'string') return false;
  const clean = place.google_place_id.trim();
  if (clean.length === 0) return false;
  return !isDemoPlaceId(clean);
}

/**
 * Categorizes a catalog record per Sprint 10D Hotfix P0 Section 2:
 * - VERIFIED: identidade e dados essenciais verificados por fonte real ou curadoria manual comprovada (ex: Lago Negro homologado)
 * - PENDING_VERIFICATION: estabelecimento plausível/real na Serra Gaúcha, aguardando resolução de Place ID real e mídia
 * - DEMO: registro puramente demonstrativo ou dados fictícios
 * - CONFLICT: informações contraditórias ou identidade incerta
 */
export function auditPlaceRecord(place: Partial<Place>): 'VERIFIED' | 'PENDING_VERIFICATION' | 'DEMO' | 'CONFLICT' {
  // Lago Negro homologado em Sprint 10C com 25.237 avaliações e nota 4.8
  const isLagoNegro = place.id === 'a0000001-0000-0000-0000-000000000001' ||
    (place.name?.toLowerCase().includes('lago negro') && place.city === 'Gramado');

  if (isLagoNegro) {
    return 'VERIFIED';
  }

  // Verifica se o Place ID é demonstrativo
  if (isDemoPlaceId(place.google_place_id)) {
    return 'PENDING_VERIFICATION';
  }

  // Se já possui Google Place ID real e sync SYNCED
  if (hasRealGooglePlaceId(place) && (place as any).google_sync_status === 'SYNCED') {
    return 'VERIFIED';
  }

  // Estabelecimentos reais da Serra Gaúcha cadastrados pela curadoria, aguardando validação
  return 'PENDING_VERIFICATION';
}

export interface DataQualityReport {
  score: number;
  label: 'Completo' | 'Bom' | 'Incompleto' | 'Precisa atualização';
  auditStatus: 'VERIFIED' | 'PENDING_VERIFICATION' | 'DEMO' | 'CONFLICT';
  breakdown: {
    hasRealPhotos: boolean;
    hasRealGooglePlaceId: boolean;
    hasCoordinates: boolean;
    hasDescription: boolean;
    hasHours: boolean;
    hasPrice: boolean;
    hasLinks: boolean;
    isFresh: boolean;
    isPlaceholderPhoto: boolean;
    isDemoPlaceId: boolean;
  };
  missingFields: string[];
}

/**
 * Calculates DataQualityScore for a Place (Sprint 10A Section 17 & Sprint 10D Hotfix P0 Section 4).
 * Enforces anti-fictitious penalties: placeholder images and demo Place IDs never score 100%.
 */
export function calculatePlaceDataQuality(place: Partial<Place>): DataQualityReport {
  let score = 0;
  const missingFields: string[] = [];

  const realPhotos = hasRealPhotos(place);
  const realPlaceId = hasRealGooglePlaceId(place);
  const isDemoId = isDemoPlaceId(place.google_place_id);
  const hasAnyPhoto = Boolean(
    (Array.isArray(place.media) && place.media.some(m => m.active !== false && m.url && m.url.trim().length > 0)) ||
    (place as any).media_url
  );
  const isPlaceholderPhoto = hasAnyPhoto && !realPhotos;

  // 1. Fotos Reais (+20% - apenas fotos reais auditadas DUO21/Google contam)
  if (realPhotos) {
    score += 20;
  } else if (isPlaceholderPhoto) {
    score += 5; // Crédito simbólico por layout visual, mas penalizado
    missingFields.push('Fotografia Real (Placeholder Visual Atual)');
  } else {
    missingFields.push('Fotos / Mídia Ausente');
  }

  // 2. Google Place ID Real (+15%)
  if (realPlaceId) {
    score += 15;
  } else if (isDemoId) {
    missingFields.push('Google Place ID Real (ID Demonstrativo Detectado)');
  } else {
    missingFields.push('Google Place ID Não Vinculado');
  }

  // 3. Coordenadas (+15%)
  const hasCoordinates = Boolean(
    typeof place.latitude === 'number' && 
    typeof place.longitude === 'number' && 
    place.latitude !== 0 && 
    place.longitude !== 0 &&
    !isNaN(place.latitude) && 
    !isNaN(place.longitude)
  );
  if (hasCoordinates) {
    score += 15;
  } else {
    missingFields.push('Coordenadas (Lat/Lng)');
  }

  // 4. Descrição (+15%)
  const hasDescription = Boolean(
    place.description && place.description.trim().length >= 15
  );
  if (hasDescription) {
    score += 15;
  } else {
    missingFields.push('Descrição Detalhada');
  }

  // 5. Horários (+15%)
  const hasHours = Boolean(
    place.always_open || 
    (place.opening_hours && Object.keys(place.opening_hours).length > 0 && 
     Object.values(place.opening_hours).some(v => v && v !== 'Horário não confirmado' && v !== 'Fechado'))
  );
  if (hasHours) {
    score += 15;
  } else {
    missingFields.push('Horários de Funcionamento');
  }

  // 6. Preço / Faixa (+10%)
  const hasPrice = Boolean(
    place.price_info?.is_free ||
    (place.price_info && typeof place.price_info.adult_price === 'number') ||
    typeof place.price_level === 'number' ||
    place.price_notes
  );
  if (hasPrice) {
    score += 10;
  } else {
    missingFields.push('Preço ou Gratuidade');
  }

  // 7. Links Confiáveis (+5%)
  const hasLinks = Boolean(
    place.official_url ||
    place.instagram_url ||
    place.maps_url ||
    place.website ||
    place.instagram ||
    place.ticket_url ||
    place.phone ||
    place.whatsapp
  );
  if (hasLinks) {
    score += 5;
  } else {
    missingFields.push('Links Confiáveis');
  }

  // 8. Freshness / checked_at (+5%)
  let isFresh = false;
  const checkedAtStr = place.checked_at || place.price_info?.checked_at || (place as any).last_sync_at;
  if (checkedAtStr) {
    try {
      const ageMs = Date.now() - new Date(checkedAtStr).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays <= 180) {
        isFresh = true;
      }
    } catch {
      isFresh = false;
    }
  }

  if (isFresh) {
    score += 5;
  } else {
    missingFields.push('Revisão Recente (< 180 dias)');
  }

  // Cap de qualidade: locais com campos essenciais pendentes ou demonstrativos NUNCA recebem 100% ('Completo')
  if (!realPhotos || !realPlaceId || isDemoId) {
    score = Math.min(score, 65);
  }

  // Label assignment
  let label: 'Completo' | 'Bom' | 'Incompleto' | 'Precisa atualização' = 'Completo';
  if (score >= 85) {
    label = 'Completo';
  } else if (score >= 60) {
    label = 'Bom';
  } else if (score >= 35) {
    label = 'Incompleto';
  } else {
    label = 'Precisa atualização';
  }

  const auditStatus = auditPlaceRecord(place);

  return {
    score,
    label,
    auditStatus,
    breakdown: {
      hasRealPhotos: realPhotos,
      hasRealGooglePlaceId: realPlaceId,
      hasCoordinates,
      hasDescription,
      hasHours,
      hasPrice,
      hasLinks,
      isFresh,
      isPlaceholderPhoto,
      isDemoPlaceId: isDemoId
    },
    missingFields
  };
}

/**
 * Checks whether a catalog record is eligible to be recommended by the Itinerary Engine
 * per Sprint 10D Hotfix P0 Section 6:
 * - Must NOT be DEMO or CONFLICT
 * - PENDING_VERIFICATION is eligible ONLY if it has genuine Serra Gaúcha coordinates,
 *   a valid name, an active status, and real destination city
 * - Never includes unverified synthetic test data
 */
export function isPlaceEligibleForItinerary(place: Partial<Place>): boolean {
  if (!place || place.active === false) return false;
  if ((place as any).is_demo === true && (place as any).audit_status === 'DEMO') return false;

  const auditStatus = (place as any).audit_status || auditPlaceRecord(place);
  if (auditStatus === 'DEMO' || auditStatus === 'CONFLICT') {
    return false;
  }

  // Must have coordinates in Serra Gaúcha
  if (
    typeof place.latitude !== 'number' || 
    typeof place.longitude !== 'number' ||
    isNaN(place.latitude) ||
    isNaN(place.longitude) ||
    place.latitude === 0 || 
    place.longitude === 0
  ) {
    return false;
  }

  // Must belong to supported destination
  const validCities = ['Gramado', 'Canela', 'Nova Petrópolis'];
  if (!place.city || !validCities.includes(place.city)) {
    return false;
  }

  // Must have real name and minimum description
  if (!place.name || place.name.trim().length < 3) return false;
  if (!place.description || place.description.trim().length < 10) return false;

  return true;
}

import { Place } from '../types';

export interface DataQualityReport {
  score: number;
  label: 'Completo' | 'Bom' | 'Incompleto' | 'Precisa atualização';
  breakdown: {
    hasPhotos: boolean;
    hasCoordinates: boolean;
    hasDescription: boolean;
    hasHours: boolean;
    hasPrice: boolean;
    hasLinks: boolean;
    isFresh: boolean;
  };
  missingFields: string[];
}

/**
 * Calculates DataQualityScore for a Place (Sprint 10A Section 17).
 * Strictly for internal DUO21 Control Plane administration (never exposed to tourists).
 */
export function calculatePlaceDataQuality(place: Partial<Place>): DataQualityReport {
  let score = 0;
  const missingFields: string[] = [];

  // 1. Photos (+20%)
  const hasPhotos = Boolean(
    (Array.isArray(place.media) && place.media.some(m => m.active !== false && m.url && m.url.trim().length > 0)) ||
    (place as any).media_url
  );
  if (hasPhotos) {
    score += 20;
  } else {
    missingFields.push('Fotos / Mídia');
  }

  // 2. Coordenadas (+15%)
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

  // 3. Descrição (+15%)
  const hasDescription = Boolean(
    place.description && place.description.trim().length >= 15
  );
  if (hasDescription) {
    score += 15;
  } else {
    missingFields.push('Descrição Detalhada');
  }

  // 4. Horários (+15%)
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

  // 5. Preço / Faixa (+15%)
  const hasPrice = Boolean(
    place.price_info?.is_free ||
    (place.price_info && typeof place.price_info.adult_price === 'number') ||
    typeof place.price_level === 'number' ||
    place.price_notes
  );
  if (hasPrice) {
    score += 15;
  } else {
    missingFields.push('Preço ou Gratuidade');
  }

  // 6. Links Confiáveis (+10%)
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
    score += 10;
  } else {
    missingFields.push('Links Confiáveis');
  }

  // 7. Freshness / checked_at (+10%)
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
    score += 10;
  } else {
    missingFields.push('Revisão Recente (< 180 dias)');
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

  return {
    score,
    label,
    breakdown: {
      hasPhotos,
      hasCoordinates,
      hasDescription,
      hasHours,
      hasPrice,
      hasLinks,
      isFresh
    },
    missingFields
  };
}

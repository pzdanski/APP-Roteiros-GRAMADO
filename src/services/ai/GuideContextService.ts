import { Place, Trip, TripActivity } from '../../types';
import { SEED_PLACES } from '../../data/seedData';

export interface GuideStructuredLink {
  label: string;
  url: string;
  type: 'official_url' | 'instagram_url' | 'maps_url' | 'booking_url' | 'ticket_url' | 'duo21_content_url';
  actionType: 'details' | 'maps' | 'website';
  placeId?: string;
  placeName?: string;
}

export interface ProcessedGuideResponse {
  replyText: string;
  links: GuideStructuredLink[];
  suggestedAction?: 'indoor_alternative' | 'swap_activity' | 'view_nearby' | null;
  confidenceLevel: 'high' | 'medium';
}

// Regional expressions allowed in moderation (Sprint 9.1 Section 7)
const REGIONAL_TERMS = [
  'bah',
  'tchê',
  'tche',
  'capaz',
  'tri',
  'guri',
  'guria',
  'baita',
  'pila',
  'lagartear',
  'atucanado',
  'afudê',
  'afude',
  'vivente',
  'arrecém',
  'arrecem'
];

/**
 * Enforces strict Sprint 9.1 personality constraints:
 * 1. Maximum of 1 regional expression per response.
 * 2. Never stack expressions (e.g. "Bah + tri + baita + guri").
 * 3. Formats into 2-3 short paragraphs separated by blank lines (\n\n).
 */
export function formatGuideReplyText(rawText: string): string {
  if (!rawText) return 'Bah, qualquer dúvida sobre os teus passeios pela Serra, é só me chamar!';

  let text = rawText.trim();

  // 1. Enforce max 1 regional expression
  let foundTermCount = 0;
  for (const term of REGIONAL_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    text = text.replace(regex, (match) => {
      foundTermCount++;
      if (foundTermCount === 1) {
        return match; // keep the first one
      }
      return ''; // remove secondary stacked regionalisms
    });
  }

  // Clean up any double spaces or punctuation left over
  text = text.replace(/\s{2,}/g, ' ').replace(/\s,\s/g, ', ').replace(/,\s*,/g, ',');

  // 2. Format into clean short paragraphs (Sprint 9.1 Section 8)
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    // Break into sentences and group into 2-3 small paragraphs
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length >= 4) {
      const mid = Math.ceil(sentences.length / 2);
      const p1 = sentences.slice(0, mid).join(' ').trim();
      const p2 = sentences.slice(mid).join(' ').trim();
      return `${p1}\n\n${p2}`;
    }
  }

  return paragraphs.slice(0, 3).join('\n\n');
}

/**
 * Extracts all places currently scheduled in the user's trip itinerary.
 */
export function extractItineraryActivities(tripContext: any): TripActivity[] {
  if (!tripContext) return [];
  if (Array.isArray(tripContext.activities)) return tripContext.activities;
  if (tripContext.trip && Array.isArray(tripContext.trip.days)) {
    return tripContext.trip.days.flatMap((d: any) => d.activities || []);
  }
  if (Array.isArray(tripContext.days)) {
    return tripContext.days.flatMap((d: any) => d.activities || []);
  }
  return [];
}

/**
 * Handles intelligent query resolution with:
 * - Itinerary Exclusion Set: Never recommend an existing place as a new activity.
 * - Explicit inquiry exception: If user specifically asks for that place, acknowledge its presence in itinerary.
 * - Verified links & actions: Never invent URLs.
 */
export function generateSmartGuideResponse(
  userMessage: string,
  tripContext: any
): ProcessedGuideResponse {
  const lower = userMessage.toLowerCase().trim();
  const activities = extractItineraryActivities(tripContext);
  
  // Exclusion set of places already in the user's itinerary
  const scheduledPlaceIds = new Set<string>();
  const scheduledPlaceNames = new Map<string, TripActivity>();

  for (const act of activities) {
    if (act?.place) {
      if (act.place.id) scheduledPlaceIds.add(act.place.id);
      if (act.place.name) scheduledPlaceNames.set(act.place.name.toLowerCase(), act);
      if (act.place.slug) scheduledPlaceNames.set(act.place.slug.toLowerCase(), act);
    }
  }

  // 1. Check if user is asking about hours
  if (lower.includes('horário') || lower.includes('horario') || lower.includes('abre') || lower.includes('fecha')) {
    const matched = SEED_PLACES.filter(p => lower.includes(p.name.toLowerCase()) || lower.includes(p.slug));
    const targetPlaces = matched.length > 0 ? matched : SEED_PLACES.slice(0, 3);

    const hoursLines = targetPlaces.map(p => {
      if (p.always_open) return `${p.name}: Sempre aberto (acesso público contínuo)`;
      const seg = p.opening_hours?.seg || Object.values(p.opening_hours || {})[0];
      return seg ? `${p.name}: ${seg}` : `${p.name}: Horário não confirmado`;
    });

    const reply = formatGuideReplyText(
      `Conferi os horários cadastrados no catálogo para ti:\n\n• ${hoursLines.join('\n• ')}\n\nLembrando que atrações ao ar livre podem variar conforme o clima.`
    );

    const links = buildVerifiedActionLinks(targetPlaces.slice(0, 2));

    return {
      replyText: reply,
      links,
      confidenceLevel: 'high'
    };
  }

  // 2. Check if user is asking about links, website, instagram, tickets
  if (lower.includes('site') || lower.includes('instagram') || lower.includes('link') || lower.includes('ingresso') || lower.includes('ingressos') || lower.includes('vídeo') || lower.includes('video')) {
    const matched = SEED_PLACES.filter(p => lower.includes(p.name.toLowerCase()) || lower.includes(p.slug));
    const targetPlaces = matched.length > 0 ? matched : SEED_PLACES.slice(0, 3);
    const links = buildVerifiedActionLinks(targetPlaces);

    const reply = formatGuideReplyText(
      links.length > 0
        ? `Bah, separei os links oficiais verificados para ti nos botões logo abaixo:\n\nTu podes conferir o site oficial ou o mapa direto daqui.`
        : `Não temos links oficiais verificados cadastrados para este local no momento.\n\nRecomendo consultar a recepção da atração ou o centro de informações de Gramado.`
    );

    return {
      replyText: reply,
      links,
      confidenceLevel: 'high'
    };
  }

  // 3. Rain / Weather inquiry
  if (lower.includes('chuva') || lower.includes('chovendo') || lower.includes('garoa') || lower.includes('neblina') || lower.includes('clima')) {
    const indoorSuggestions = SEED_PLACES.filter(p => p.indoor_type === 'indoor' && !scheduledPlaceIds.has(p.id)).slice(0, 3);
    const names = indoorSuggestions.map(p => p.name).join(', ');

    const reply = formatGuideReplyText(
      `Para momentos de chuva na Serra, recomendo focar em experiências 100% cobertas.\n\nÓtimas alternativas fora da tua programação atual são: ${names || 'Snowland, Mundo de Chocolate e os cafés coloniais'}.\n\nAssim tu aproveitas o dia com conforto!`
    );

    return {
      replyText: reply,
      links: buildVerifiedActionLinks(indoorSuggestions.slice(0, 2)),
      suggestedAction: 'indoor_alternative',
      confidenceLevel: 'high'
    };
  }

  // 4. Fondue / Jantar inquiry (Sprint 9.1 Section 9: Exclusion Set + Conscious Exception)
  if (lower.includes('fondue') || lower.includes('jantar')) {
    // Check if any scheduled activity is fondue
    let scheduledFondueAct: TripActivity | null = null;
    for (const [name, act] of scheduledPlaceNames.entries()) {
      if (name.includes('fondue') || (act.place?.name || '').toLowerCase().includes('colosseo') || (act.place?.description || '').toLowerCase().includes('fondue')) {
        scheduledFondueAct = act;
        break;
      }
    }

    if (scheduledFondueAct) {
      const placeName = scheduledFondueAct.place.name;
      const scheduledTime = scheduledFondueAct.time || '19:30';

      // If user specifically asked about that place, or generic fondue, acknowledge it
      const reply = formatGuideReplyText(
        `O ${placeName} já está programado no teu jantar às ${scheduledTime}.\n\nSe tu quiseres uma opção adicional para outro momento, o Le Chalet de la Fondue e o Belle du Valais são ótimas referências tradicionais na Serra.\n\nQuer que eu procure outra alternativa de gastronomia?`
      );

      // Offer alternative places (excluding the scheduled one)
      const altPlaces = SEED_PLACES.filter(p => 
        p.category === 'restaurante' && 
        p.id !== scheduledFondueAct?.place.id && 
        !scheduledPlaceIds.has(p.id)
      ).slice(0, 2);

      return {
        replyText: reply,
        links: buildVerifiedActionLinks(altPlaces),
        suggestedAction: 'swap_activity',
        confidenceLevel: 'high'
      };
    }

    // No fondue scheduled: recommend from catalog
    const fonduePlaces = SEED_PLACES.filter(p => p.category === 'restaurante' && p.name.toLowerCase().includes('fondue')).slice(0, 2);
    const reply = formatGuideReplyText(
      `A tradicional sequência de fondue (queijo, carnes na pedra e chocolate) é indispensável à noite na Serra.\n\nNo centro de Gramado há opções consagradas a partir de R$ 89 por pessoa, com excelente carta de vinhos locais.`
    );

    return {
      replyText: reply,
      links: buildVerifiedActionLinks(fonduePlaces),
      confidenceLevel: 'high'
    };
  }

  // 5. General recommendation: filter out scheduled places
  const availableRecommendations = SEED_PLACES.filter(p => !scheduledPlaceIds.has(p.id));
  const suggestedPlaces = availableRecommendations.slice(0, 2);

  const reply = formatGuideReplyText(
    `Bah, para aproveitar ao máximo a tua estadia na Serra, separei sugestões que combinam com o teu ritmo e ainda não estão no teu roteiro.\n\nTu podes conferir os detalhes e rotas nos botões abaixo ou me perguntar sobre opções de cafés e mirantes.`
  );

  return {
    replyText: reply,
    links: buildVerifiedActionLinks(suggestedPlaces),
    confidenceLevel: 'medium'
  };
}

/**
 * Builds structured action links from verified place data ONLY (Sprint 9.1 Section 10).
 * Never hallucinates or invents URLs.
 */
export function buildVerifiedActionLinks(places: Place[]): GuideStructuredLink[] {
  const result: GuideStructuredLink[] = [];

  for (const place of places) {
    if (!place) continue;

    // 1. Details action
    result.push({
      label: `Ver detalhes • ${place.name}`,
      url: `#place-${place.id}`,
      type: 'official_url',
      actionType: 'details',
      placeId: place.id,
      placeName: place.name
    });

    // 2. Maps action (using exact coordinates or verified query)
    const mapUrl = (place.latitude && place.longitude)
      ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ', ' + place.city + ' - RS')}`;

    result.push({
      label: `Como chegar • ${place.name}`,
      url: mapUrl,
      type: 'maps_url',
      actionType: 'maps',
      placeId: place.id,
      placeName: place.name
    });

    // 3. Official website if verified HTTPS URL exists
    if (place.website && place.website.startsWith('http')) {
      result.push({
        label: `Site oficial • ${place.name}`,
        url: place.website,
        type: 'official_url',
        actionType: 'website',
        placeId: place.id,
        placeName: place.name
      });
    }

    // 4. Official Instagram if verified HTTPS URL exists
    if (place.instagram && place.instagram.startsWith('http')) {
      result.push({
        label: `Instagram • ${place.name}`,
        url: place.instagram,
        type: 'instagram_url',
        actionType: 'website',
        placeId: place.id,
        placeName: place.name
      });
    }
  }

  // Limit to 4 structured action buttons max to keep UI clean
  return result.slice(0, 4);
}

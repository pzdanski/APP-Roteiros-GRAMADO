/**
 * SMART PLACE RESOLVER — ENTITY RESOLUTION DETERMINÍSTICO PARA O CATÁLOGO DUO21
 * 
 * Princípio Fundamental:
 * Não perguntar apenas "qual resultado o Google colocou primeiro?".
 * Perguntar "qual entidade Google melhor corresponde ao local cadastrado na curadoria DUO21?".
 * 
 * Regras:
 * - Algoritmo 100% determinístico e auditável (sem Gemini / IA generativa em tempo de execução).
 * - Sinais de âncora: Nome, Coordenadas (Lat/Lng), Categoria, Cidade, Endereço, Popularidade.
 * - Score 0-100 ponderado:
 *   - Proximidade Geográfica (Haversine): 40 pontos
 *   - Similaridade do Nome: 25 pontos
 *   - Compatibilidade de Tipo/Categoria: 15 pontos
 *   - Cidade/Endereço: 10 pontos
 *   - Popularidade/Qualidade do Registro: 10 pontos
 * - Classificação:
 *   - HIGH (>= 80): Alta compatibilidade, vínculo direto com confirmação
 *   - MEDIUM (60-79): Média compatibilidade, requer revisão administrativa
 *   - LOW (< 60): Baixa compatibilidade, bloqueia vínculo rápido
 */

export const DEFAULT_RESOLUTION_RADIUS_METERS = 3000; // 3 km raio inicial para resolução local

export interface PlaceMatchBreakdown {
  proximity: number;
  name: number;
  type: number;
  city: number;
  popularity: number;
}

export type PlaceMatchLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PlaceCandidateDTO {
  google_place_id: string;
  name: string;
  address: string;
  category?: string;
  types: string[];
  types_formatted: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  userRatingCount?: number;
  distance_meters: number | null;
  distance_formatted: string;
  match_score: number;
  match_level: PlaceMatchLevel;
  match_breakdown: PlaceMatchBreakdown;
}

/**
 * Mapeamento amigável de tipos Google Places para exibição em Português
 */
export const GOOGLE_TYPE_LABELS: Record<string, string> = {
  park: 'Parque',
  tourist_attraction: 'Atração Turística',
  point_of_interest: 'Ponto de Interesse',
  natural_feature: 'Natureza',
  amusement_park: 'Parque Temático',
  museum: 'Museu',
  restaurant: 'Restaurante',
  food: 'Gastronomia',
  cafe: 'Cafeteria',
  coffee_shop: 'Cafeteria',
  bakery: 'Confeitaria / Padaria',
  bar: 'Bar',
  night_club: 'Vida Noturna',
  lodging: 'Hospedagem',
  hotel: 'Hotel',
  resort_hotel: 'Resort',
  bed_and_breakfast: 'Pousada',
  store: 'Loja',
  shopping_mall: 'Shopping',
  clothing_store: 'Moda e Compras',
  winery: 'Vinícola',
  performing_arts_theater: 'Teatro / Show',
  establishment: 'Estabelecimento'
};

/**
 * Mapeamento de tipos Google primários e secundários por categoria DUO21
 */
export const CATEGORY_PRIMARY_GOOGLE_TYPES: Record<string, string[]> = {
  parque: ['park', 'natural_feature'],
  atrativo: ['tourist_attraction', 'amusement_park'],
  restaurante: ['restaurant', 'food', 'meal_takeaway'],
  cafe: ['cafe', 'coffee_shop', 'bakery'],
  museu: ['museum'],
  vinicola: ['winery'],
  chocolate: ['store', 'bakery'],
  mirante: ['natural_feature', 'park'],
  show: ['performing_arts_theater', 'amusement_park'],
  compras: ['shopping_mall', 'store', 'clothing_store'],
  noturno: ['night_club', 'bar'],
  hotel: ['lodging', 'hotel', 'resort_hotel'],
  pousada: ['lodging', 'hotel', 'bed_and_breakfast'],
  resort: ['resort_hotel', 'lodging'],
  apartamento: ['lodging', 'hotel'],
  cabana: ['lodging', 'hotel']
};

export const CATEGORY_SECONDARY_GOOGLE_TYPES: Record<string, string[]> = {
  parque: ['tourist_attraction'],
  atrativo: ['point_of_interest'],
  restaurante: ['bar', 'cafe'],
  cafe: ['food', 'store'],
  museu: ['tourist_attraction', 'point_of_interest'],
  vinicola: ['food', 'tourist_attraction'],
  chocolate: ['food', 'tourist_attraction'],
  mirante: ['tourist_attraction', 'point_of_interest'],
  show: ['tourist_attraction', 'point_of_interest'],
  compras: ['point_of_interest'],
  noturno: ['food'],
  hotel: ['point_of_interest'],
  pousada: ['point_of_interest'],
  resort: ['tourist_attraction'],
  apartamento: ['point_of_interest'],
  cabana: ['point_of_interest']
};

/**
 * Termos conceituais para construção da query inteligente
 */
export const CATEGORY_QUERY_HINTS: Record<string, string> = {
  parque: 'parque',
  atrativo: 'atração',
  restaurante: 'restaurante',
  cafe: 'café',
  museu: 'museu',
  vinicola: 'vinícola',
  chocolate: 'chocolate',
  mirante: 'mirante',
  show: 'show',
  compras: 'compras',
  noturno: 'bar',
  hotel: 'hotel',
  pousada: 'pousada',
  resort: 'resort',
  apartamento: 'hospedagem',
  cabana: 'cabana'
};

/**
 * Normaliza strings para comparação determinística
 * Remove acentos, pontuação, múltiplos espaços e converte para minúsculas
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')   // remove pontuação
    .replace(/\s+/g, ' ')           // colapsa espaços
    .trim();
}

/**
 * Helper determinístico para construir query de resolução:
 * nome + [categoria se útil] + cidade
 * Ex: "Lago Negro parque Gramado"
 */
export function buildPlaceResolutionQuery(place: {
  name?: string;
  city?: string;
  category?: string;
}): string {
  const name = (place.name || '').trim();
  const city = (place.city || '').trim();
  const category = (place.category || '').toLowerCase().trim();

  const parts: string[] = [];
  if (name) parts.push(name);

  // Inclui dica de categoria somente se a categoria for conhecida e o nome ainda não a contiver
  if (category && CATEGORY_QUERY_HINTS[category]) {
    const hint = CATEGORY_QUERY_HINTS[category];
    const normName = normalizeText(name);
    const normHint = normalizeText(hint);
    if (!normName.includes(normHint)) {
      parts.push(hint);
    }
  }

  if (city) parts.push(city);

  return parts.join(' ').trim();
}

/**
 * Cálculo determinístico da distância Haversine em metros entre dois pontos geográficos
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371000; // Raio médio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Formatação amigável de distância para o painel administrativo
 * Ex: "180 m do ponto cadastrado" ou "4,8 km do ponto cadastrado"
 */
export function formatDistance(distanceMeters: number | null | undefined): string {
  if (distanceMeters === null || distanceMeters === undefined || isNaN(distanceMeters)) {
    return 'Distância não calculada';
  }
  if (distanceMeters < 1000) {
    return `${distanceMeters} m do ponto cadastrado`;
  }
  const km = (distanceMeters / 1000).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  return `${km} km do ponto cadastrado`;
}

/**
 * Formata lista de Google types para exibição amigável
 */
export function formatGoogleTypes(types: string[] = []): string {
  if (!types || types.length === 0) return 'Local / Estabelecimento';
  const labels = types
    .filter(t => t !== 'point_of_interest' && t !== 'establishment')
    .map(t => GOOGLE_TYPE_LABELS[t] || t.replace(/_/g, ' '))
    .slice(0, 2);
  
  if (labels.length === 0) {
    return types[0] ? (GOOGLE_TYPE_LABELS[types[0]] || types[0]) : 'Local';
  }
  return labels.join(' · ');
}

/**
 * Calcula similaridade de nomes (0 a 25 pontos)
 */
export function calculateNameSimilarity(localName: string, candidateName: string): number {
  const norm1 = normalizeText(localName);
  const norm2 = normalizeText(candidateName);

  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 25;

  // Stopwords comuns em nomes de lugares
  const stopwords = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a', 'em', 'no', 'na']);
  const tokens1 = norm1.split(' ').filter(t => t.length > 1 && !stopwords.has(t));
  const tokens2 = norm2.split(' ').filter(t => t.length > 1 && !stopwords.has(t));

  if (tokens1.length === 0 || tokens2.length === 0) {
    return norm1.includes(norm2) || norm2.includes(norm1) ? 18 : 5;
  }

  // Verifica se todos os tokens do nome local estão no candidato (ex: "Lago Negro" em "Parque Lago Negro")
  const allTokens1In2 = tokens1.every(t => tokens2.includes(t));
  if (allTokens1In2) {
    return 23;
  }

  // Jaccard similarity entre conjuntos de tokens
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  let intersection = 0;
  for (const t of set1) {
    if (set2.has(t)) intersection++;
  }
  const union = new Set([...tokens1, ...tokens2]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  if (jaccard >= 0.8) return 22;
  if (jaccard >= 0.5) return 18;
  if (jaccard >= 0.3) return 14;
  if (intersection >= 1) return 10;

  // Substring match simples como fallback
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 16;
  }

  return 3;
}

/**
 * Calcula score de proximidade geográfica (0 a 40 pontos)
 * <= 150m  -> 40 (máximo)
 * <= 500m  -> 35
 * <= 1km   -> 28
 * <= 2km   -> 20
 * <= 3km   -> 14
 * > 3km    -> 4 (baixo)
 * Coordenadas não disponíveis -> 15 (neutro)
 */
export function calculateProximityScore(distanceMeters: number | null | undefined): number {
  if (distanceMeters === null || distanceMeters === undefined || isNaN(distanceMeters)) {
    return 15; // Pontuação neutra proporcional quando não há coordenadas
  }
  if (distanceMeters <= 150) return 40;
  if (distanceMeters <= 500) return 35;
  if (distanceMeters <= 1000) return 28;
  if (distanceMeters <= 2000) return 20;
  if (distanceMeters <= 3000) return 14;
  return 4;
}

/**
 * Calcula score de compatibilidade de tipo/categoria (0 a 15 pontos)
 */
export function calculateCategoryScore(
  localCategory: string | undefined,
  candidateTypes: string[] | undefined
): number {
  if (!localCategory) return 8; // Neutro
  const cat = localCategory.toLowerCase().trim();
  const types = (candidateTypes || []).map(t => t.toLowerCase());

  const primaryExpected = CATEGORY_PRIMARY_GOOGLE_TYPES[cat] || [];
  const secondaryExpected = CATEGORY_SECONDARY_GOOGLE_TYPES[cat] || [];

  // Match primário (ex: 'park' para parque) -> pontuação máxima (15 pts)
  if (primaryExpected.some(t => types.includes(t))) {
    return 15;
  }

  // Match secundário (ex: 'tourist_attraction' para parque) -> 10 pts
  if (secondaryExpected.some(t => types.includes(t))) {
    return 10;
  }

  // Match genérico amplo (point_of_interest, establishment) -> 5 pts
  if (types.includes('point_of_interest') || types.includes('establishment')) {
    return 5;
  }

  return 2;
}

/**
 * Calcula score de cidade / endereço (0 a 10 pontos)
 */
export function calculateCityScore(
  localCity: string | undefined,
  candidateAddress: string | undefined
): number {
  if (!localCity) return 6;
  const normCity = normalizeText(localCity);
  const normAddr = normalizeText(candidateAddress);

  if (normAddr.includes(normCity)) {
    return 10;
  }

  // Região Serra Gaúcha
  if (normAddr.includes('rs') || normAddr.includes('rio grande do sul')) {
    return 6;
  }

  return 1;
}

/**
 * Calcula score de popularidade / avaliações (0 a 10 pontos)
 * Usado exclusivamente como sinal complementar (máximo 10 pts).
 * Nunca supera grandes divergências geográficas.
 */
export function calculatePopularityScore(
  userRatingCount: number | undefined,
  rating: number | undefined
): number {
  const count = typeof userRatingCount === 'number' ? userRatingCount : 0;
  const rat = typeof rating === 'number' ? rating : 0;

  let score = 2;
  if (count >= 5000) {
    score = 10;
  } else if (count >= 1000) {
    score = 8;
  } else if (count >= 200) {
    score = 6;
  } else if (count >= 50) {
    score = 4;
  } else if (count > 0) {
    score = 3;
  }

  // Leve bonificação se tiver nota de qualidade comprovada
  if (rat >= 4.5 && score < 10) {
    score = Math.min(10, score + 1);
  }

  return score;
}

/**
 * Calcula Match Confidence determinístico completo (0 a 100)
 */
export function calculateMatchConfidence(
  localPlace: {
    name?: string;
    city?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  },
  candidate: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    types?: string[];
    rating?: number;
    userRatingCount?: number;
  }
): {
  totalScore: number;
  level: PlaceMatchLevel;
  distanceMeters: number | null;
  breakdown: PlaceMatchBreakdown;
} {
  // 1. Proximidade Geográfica
  let distanceMeters: number | null = null;
  if (
    typeof localPlace.latitude === 'number' && typeof localPlace.longitude === 'number' &&
    typeof candidate.latitude === 'number' && typeof candidate.longitude === 'number'
  ) {
    distanceMeters = calculateHaversineDistanceMeters(
      localPlace.latitude,
      localPlace.longitude,
      candidate.latitude,
      candidate.longitude
    );
  }
  const proximityScore = calculateProximityScore(distanceMeters);

  // 2. Similaridade do Nome
  const nameScore = calculateNameSimilarity(localPlace.name || '', candidate.name || '');

  // 3. Compatibilidade de Categoria
  const typeScore = calculateCategoryScore(localPlace.category, candidate.types);

  // 4. Cidade / Endereço
  const cityScore = calculateCityScore(localPlace.city, candidate.address);

  // 5. Popularidade / Avaliações
  const popularityScore = calculatePopularityScore(candidate.userRatingCount, candidate.rating);

  const totalScore = Math.min(
    100,
    Math.max(0, proximityScore + nameScore + typeScore + cityScore + popularityScore)
  );

  let level: PlaceMatchLevel = 'LOW';
  if (totalScore >= 80) {
    level = 'HIGH';
  } else if (totalScore >= 60) {
    level = 'MEDIUM';
  }

  return {
    totalScore,
    level,
    distanceMeters,
    breakdown: {
      proximity: proximityScore,
      name: nameScore,
      type: typeScore,
      city: cityScore,
      popularity: popularityScore
    }
  };
}

/**
 * Processa e classifica lista de candidatos do Google Places
 * Ordena por match_score decrescente (o mais compatível primeiro)
 */
export function rankAndScoreCandidates(
  localPlace: {
    name?: string;
    city?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  },
  rawCandidates: Array<{
    google_place_id?: string;
    id?: string;
    externalId?: string;
    name: string;
    address?: string;
    formattedAddress?: string;
    types?: string[];
    latitude?: number;
    longitude?: number;
    rating?: number;
    userRatingCount?: number;
  }>
): PlaceCandidateDTO[] {
  const scored = rawCandidates.map(candidate => {
    const id = candidate.google_place_id || candidate.externalId || candidate.id || '';
    const name = candidate.name;
    const address = candidate.address || candidate.formattedAddress || 'Endereço não informado';
    const types = candidate.types || [];
    const lat = candidate.latitude;
    const lng = candidate.longitude;
    const rating = candidate.rating;
    const userRatingCount = candidate.userRatingCount;

    const evaluation = calculateMatchConfidence(localPlace, {
      name,
      address,
      latitude: lat,
      longitude: lng,
      types,
      rating,
      userRatingCount
    });

    const dto: PlaceCandidateDTO = {
      google_place_id: id,
      name,
      address,
      category: localPlace.city ? `Local em ${localPlace.city}` : 'Ponto de interesse',
      types,
      types_formatted: formatGoogleTypes(types),
      latitude: lat,
      longitude: lng,
      rating,
      userRatingCount,
      distance_meters: evaluation.distanceMeters,
      distance_formatted: formatDistance(evaluation.distanceMeters),
      match_score: evaluation.totalScore,
      match_level: evaluation.level,
      match_breakdown: evaluation.breakdown
    };

    return dto;
  });

  // Ordena prioritariamente por match_score decrescente
  scored.sort((a, b) => b.match_score - a.match_score);

  return scored;
}

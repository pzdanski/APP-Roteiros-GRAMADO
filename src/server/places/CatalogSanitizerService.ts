/**
 * SPRINT 10D HOTFIX P0 — CATALOG SANITIZER SERVICE
 * 
 * Responsável por:
 * 1. Auditar individualmente os registros do catálogo (VERIFIED, PENDING_VERIFICATION, DEMO, CONFLICT).
 * 2. Neutralizar Google Place IDs fictícios/demonstrativos (ex: 'ChIJdipaolo-demo') sem inventar dados.
 * 3. Distinguir fotografia real de placeholder visual (ex: Unsplash photo-1506744038136-46273834b3fb).
 * 4. Desativar selo de parceria comercial de registros sem comprovação contratual.
 * 5. Proteger preços e horários não confirmados para não expor dados fictícios ao turista.
 * 6. Proteger o motor de roteiros filtrando registros DEMO e CONFLICT e higienizando PENDING_VERIFICATION.
 * 7. Preservar integralmente o Lago Negro já homologado com Google Places real.
 */

import { Place, City } from '../../types';
import { 
  isDemoPlaceId, 
  isPlaceholderImageUrl, 
  hasRealPhotos, 
  hasRealGooglePlaceId, 
  auditPlaceRecord, 
  isPlaceEligibleForItinerary,
  calculatePlaceDataQuality,
  DataQualityReport
} from '../../utils/dataQuality';

export type AuditStatus = 'VERIFIED' | 'PENDING_VERIFICATION' | 'DEMO' | 'CONFLICT';

export type PriceOrigin = 'CONFIRMED' | 'EDITORIAL_WITH_SOURCE' | 'PENDING' | 'DEMO';

export interface PlaceAuditEntry {
  id: string;
  name: string;
  city: City;
  category: string;
  googlePlaceId?: string;
  isDemoPlaceId: boolean;
  googleSyncStatus: string;
  auditStatus: AuditStatus;
  imagesOrigin: 'REAL_DUO21' | 'REAL_PARTNER' | 'PLACEHOLDER_VISUAL' | 'NONE';
  hasRealPhotos: boolean;
  priceOrigin: PriceOrigin;
  priceConfirmed: boolean;
  hoursConfirmed: boolean;
  isPartnerProven: boolean;
  isEligibleForItinerary: boolean;
  smartResolverCandidate: string;
  qualityScore: number;
  qualityLabel: string;
  notes: string;
}

export interface CatalogAuditSummary {
  totalPlaces: number;
  verifiedCount: number;
  pendingVerificationCount: number;
  demoCount: number;
  conflictCount: number;
  withRealPhotosCount: number;
  withRealGooglePlaceIdCount: number;
  demoPlaceIdsDetected: number;
  provenPartnersCount: number;
  eligibleForItineraryCount: number;
  byCity: {
    Gramado: { total: number; verified: number; pending: number; realPlaceId: number; realPhotos: number };
    Canela: { total: number; verified: number; pending: number; realPlaceId: number; realPhotos: number };
    'Nova Petrópolis': { total: number; verified: number; pending: number; realPlaceId: number; realPhotos: number };
  };
  places: PlaceAuditEntry[];
  auditedAt: string;
}

export class CatalogSanitizerService {
  /**
   * Identifica se um estabelecimento possui parceria comercial formal e comprovada.
   * Por padrão no Hotfix P0: nenhuma parceria foi comprovada documentalmente para os registros iniciais
   * exceto quando explicitamente autenticada por contrato. O selo comercial não deve ser exibido sem comprovação.
   */
  isProvenPartner(place: Partial<Place>): boolean {
    if (!place) return false;
    // Se existir contrato autenticado ou validação jurídica explícita registrada
    if ((place as any).partner_contract_verified === true) {
      return true;
    }
    // Recomendações editoriais do Divulga Lugares NÃO são parcerias comerciais pagas
    return false;
  }

  /**
   * Avalia a origem dos preços cadastrados.
   */
  classifyPriceOrigin(place: Partial<Place>): PriceOrigin {
    if (!place.price_info) return 'PENDING';
    if (place.price_info.is_free) return 'CONFIRMED';
    if (place.price_info.source_name && place.price_info.source_name.toLowerCase().includes('oficial')) {
      return 'EDITORIAL_WITH_SOURCE';
    }
    if (typeof place.price_info.adult_price === 'number' && place.price_info.adult_price > 0) {
      // Preço numérico inserido em seed/migração sem validação ativa em tempo real
      return 'PENDING';
    }
    return 'PENDING';
  }

  /**
   * Audita um único registro do catálogo.
   */
  auditPlace(place: Place): PlaceAuditEntry {
    const isLagoNegro = place.id === 'a0000001-0000-0000-0000-000000000001' ||
      (place.name?.toLowerCase().includes('lago negro') && place.city === 'Gramado');

    const isDemoId = isDemoPlaceId(place.google_place_id);
    const realPlaceId = hasRealGooglePlaceId(place);
    const realPhotos = hasRealPhotos(place);

    // Classificação
    let auditStatus: AuditStatus = 'PENDING_VERIFICATION';
    let notes = '';

    if (isLagoNegro) {
      auditStatus = 'VERIFIED';
      notes = 'Lago Negro homologado com Google Places real (nota 4.8, 25.237 avaliações). Preservado integralmente.';
    } else if (isDemoId) {
      auditStatus = 'PENDING_VERIFICATION';
      notes = `Place ID demonstrativo '${place.google_place_id}'. Nome e cidade preservados para resolução real futura via Smart Resolver.`;
    } else if (realPlaceId && (place as any).google_sync_status === 'SYNCED') {
      auditStatus = 'VERIFIED';
      notes = 'Google Place ID real e sincronizado.';
    } else {
      auditStatus = 'PENDING_VERIFICATION';
      notes = 'Estabelecimento cadastrado pela curadoria aguardando resolução de Place ID real e fotos auditadas.';
    }

    // Imagens
    let imagesOrigin: 'REAL_DUO21' | 'REAL_PARTNER' | 'PLACEHOLDER_VISUAL' | 'NONE' = 'NONE';
    if (realPhotos) {
      imagesOrigin = 'REAL_DUO21';
    } else {
      const hasAny = (Array.isArray(place.media) && place.media.length > 0) || Boolean((place as any).media_url);
      if (hasAny) imagesOrigin = 'PLACEHOLDER_VISUAL';
    }

    const priceOrigin = this.classifyPriceOrigin(place);
    const isPartnerProven = this.isProvenPartner(place);
    const isEligible = isPlaceEligibleForItinerary({ ...place, audit_status: auditStatus });
    const dq = calculatePlaceDataQuality(place);

    const hasConfirmedHours = Boolean(
      place.always_open || 
      (place.opening_hours && Object.keys(place.opening_hours).length > 0 &&
       Object.values(place.opening_hours).some(v => v && v !== 'Horário não confirmado' && v !== 'Fechado'))
    );

    return {
      id: place.id,
      name: place.name,
      city: place.city,
      category: place.category,
      googlePlaceId: place.google_place_id,
      isDemoPlaceId: isDemoId,
      googleSyncStatus: isDemoId ? 'NOT_SYNCED' : (place.google_sync_status || 'NOT_SYNCED'),
      auditStatus,
      imagesOrigin,
      hasRealPhotos: realPhotos,
      priceOrigin,
      priceConfirmed: priceOrigin === 'CONFIRMED',
      hoursConfirmed: hasConfirmedHours,
      isPartnerProven,
      isEligibleForItinerary: isEligible,
      smartResolverCandidate: `${place.name}, ${place.city} - RS`,
      qualityScore: dq.score,
      qualityLabel: dq.label,
      notes
    };
  }

  /**
   * Executa a auditoria completa em um conjunto de locais.
   */
  auditCatalog(places: Place[]): CatalogAuditSummary {
    const auditedList = places.map(p => this.auditPlace(p));

    const summary: CatalogAuditSummary = {
      totalPlaces: places.length,
      verifiedCount: auditedList.filter(a => a.auditStatus === 'VERIFIED').length,
      pendingVerificationCount: auditedList.filter(a => a.auditStatus === 'PENDING_VERIFICATION').length,
      demoCount: auditedList.filter(a => a.auditStatus === 'DEMO').length,
      conflictCount: auditedList.filter(a => a.auditStatus === 'CONFLICT').length,
      withRealPhotosCount: auditedList.filter(a => a.hasRealPhotos).length,
      withRealGooglePlaceIdCount: auditedList.filter(a => !a.isDemoPlaceId && Boolean(a.googlePlaceId)).length,
      demoPlaceIdsDetected: auditedList.filter(a => a.isDemoPlaceId).length,
      provenPartnersCount: auditedList.filter(a => a.isPartnerProven).length,
      eligibleForItineraryCount: auditedList.filter(a => a.isEligibleForItinerary).length,
      byCity: {
        Gramado: { total: 0, verified: 0, pending: 0, realPlaceId: 0, realPhotos: 0 },
        Canela: { total: 0, verified: 0, pending: 0, realPlaceId: 0, realPhotos: 0 },
        'Nova Petrópolis': { total: 0, verified: 0, pending: 0, realPlaceId: 0, realPhotos: 0 }
      },
      places: auditedList,
      auditedAt: new Date().toISOString()
    };

    for (const a of auditedList) {
      const cityKey = a.city as 'Gramado' | 'Canela' | 'Nova Petrópolis';
      if (summary.byCity[cityKey]) {
        summary.byCity[cityKey].total++;
        if (a.auditStatus === 'VERIFIED') summary.byCity[cityKey].verified++;
        if (a.auditStatus === 'PENDING_VERIFICATION') summary.byCity[cityKey].pending++;
        if (!a.isDemoPlaceId && a.googlePlaceId) summary.byCity[cityKey].realPlaceId++;
        if (a.hasRealPhotos) summary.byCity[cityKey].realPhotos++;
      }
    }

    return summary;
  }

  /**
   * Sanitiza um registro individual para uso em tempo de execução e no motor de roteiros:
   * - Não remove o registro
   * - Neutraliza IDs terminados em -demo para não serem considerados validados
   * - Garante que placeholders de mídia sejam identificados como is_placeholder
   * - Desativa selo de parceria não comprovada
   * - Preserva UUID interno e integridade dos dados essenciais
   */
  sanitizePlace(place: Place): Place {
    const audited = this.auditPlace(place);
    const isDemoId = audited.isDemoPlaceId;
    const isLagoNegro = audited.auditStatus === 'VERIFIED' && place.name?.toLowerCase().includes('lago negro');

    // Sanitiza mídias: marca placeholders explicitamente
    const sanitizedMedia = (Array.isArray(place.media) ? place.media : []).map(m => {
      const isPlaceholder = isPlaceholderImageUrl(m.url);
      return {
        ...m,
        is_placeholder: isPlaceholder,
        source: isPlaceholder ? 'fallback' as const : (m.source || 'duo21')
      };
    });

    // Se não tiver mídia nenhuma ou apenas fallback genérico
    if (sanitizedMedia.length === 0 && (place as any).media_url) {
      const isPlaceholder = isPlaceholderImageUrl((place as any).media_url);
      sanitizedMedia.push({
        url: (place as any).media_url,
        is_hero: true,
        is_placeholder: isPlaceholder,
        source: isPlaceholder ? 'fallback' as const : 'duo21'
      });
    }

    // Sanitiza status de sincronização e Place ID
    const sanitizedGoogleSyncStatus = isDemoId
      ? 'NOT_SYNCED'
      : (isLagoNegro ? 'SYNCED' : (place.google_sync_status || 'NOT_SYNCED'));

    // Parceria comercial
    const isPartner = this.isProvenPartner(place);

    // Dicas do Divulga Lugares são mantidas como curadoria editorial (divulga_lugares_tip),
    // mas o selo comercial 'is_divulga_lugares_partner' é desativado se não houver parceria comprovada
    return {
      ...place,
      audit_status: audited.auditStatus,
      is_place_id_verified: !isDemoId && Boolean(place.google_place_id),
      google_sync_status: sanitizedGoogleSyncStatus as any,
      media: sanitizedMedia,
      is_divulga_lugares_partner: isPartner,
      data_quality_score: audited.qualityScore,
      data_quality_label: audited.qualityLabel as any,
      // Se o Place ID for demonstrativo, maps_url não deve usar link direto por place_id demonstrativo
      maps_url: isDemoId
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.city} - RS`)}`
        : (place.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.city} - RS`)}`),
      // Preço: preserva objeto mas indica confiabilidade
      price_info: {
        ...place.price_info,
        source_name: audited.priceConfirmed 
          ? (place.price_info?.source_name || 'Confirmado') 
          : 'Curadoria Editorial (Pendente de Validação)'
      }
    };
  }

  /**
   * Sanitiza a coleção completa de locais.
   */
  sanitizeCatalog(places: Place[]): Place[] {
    return places.map(p => this.sanitizePlace(p));
  }
}

export const catalogSanitizerService = new CatalogSanitizerService();

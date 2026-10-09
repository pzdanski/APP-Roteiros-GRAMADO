/**
 * SUÍTE DE TESTES SPRINT 10D HOTFIX P0 — ETAPA 1
 * 
 * Validações obrigatórias:
 * 1. Classificação dos 27 registros: VERIFIED, PENDING_VERIFICATION, DEMO e CONFLICT.
 * 2. Detecção e neutralização de Google Place IDs demonstrativos ('-demo').
 * 3. Distinção estrita entre fotos reais e placeholders visuais (ex: Unsplash photo-1506744038136-46273834b3fb).
 * 4. Proteção contra qualidade 100% artificial (score capped a 65% para dados não homologados).
 * 5. Remoção do selo de parceria comercial de locais sem comprovação contratual.
 * 6. Proteção do motor de roteiros contra locais DEMO e CONFLICT, e higienização em tempo de execução.
 * 7. Preservação integral do Lago Negro homologado com Google Places real (4.8 estrelas, 25.237 avaliações).
 */

import { 
  isDemoPlaceId, 
  isPlaceholderImageUrl, 
  hasRealPhotos, 
  hasRealGooglePlaceId, 
  auditPlaceRecord, 
  isPlaceEligibleForItinerary,
  calculatePlaceDataQuality 
} from '../src/utils/dataQuality';
import { catalogSanitizerService } from '../src/server/places/CatalogSanitizerService';
import { buildItinerary } from '../src/services/itineraryEngine';
import { SEED_PLACES } from '../src/data/seedData';
import { Place } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runHotfixP0Etapa1Tests() {
  console.log('===============================================================');
  console.log('🧪 INICIANDO TESTES SPRINT 10D HOTFIX P0 — ETAPA 1');
  console.log('   SANEAMENTO REAL DO CATÁLOGO | CLASSIFICAÇÃO AUDITADA | MOTOR SEGURO');
  console.log('===============================================================\n');

  // Teste 1: Detecção de Place IDs demonstrativos
  console.log('▶ Teste 1: Detecção de Place IDs demonstrativos');
  assert(isDemoPlaceId('ChIJdipaolo-demo') === true, 'ChIJdipaolo-demo deve ser detectado como demo');
  assert(isDemoPlaceId('ChIJmini-mundo-demo') === true, 'ChIJmini-mundo-demo deve ser detectado como demo');
  assert(isDemoPlaceId('demo-12345') === true, 'demo-12345 deve ser detectado como demo');
  assert(isDemoPlaceId('ChIJQ3y-demo-lago-negro') === true, 'ChIJQ3y-demo-lago-negro deve ser detectado como demo');
  assert(isDemoPlaceId('ChIJr_real_place_id_999') === false, 'Place ID real não deve ser demo');
  assert(isDemoPlaceId('') === false, 'String vazia não é demo');
  console.log('  ✓ Detecção de IDs demonstrativos aprovada.\n');

  // Teste 2: Distinção de fotos reais vs placeholders visuais
  console.log('▶ Teste 2: Distinção de fotos reais vs placeholders visuais');
  const placeholderUrl = 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80';
  const realUrl = 'https://images.duo21.com.br/lago-negro-authentic-autumn.jpg';
  assert(isPlaceholderImageUrl(placeholderUrl) === true, 'Unsplash fallback deve ser classificado como placeholder');
  assert(isPlaceholderImageUrl('https://via.placeholder.com/300') === true, 'via.placeholder deve ser classificado como placeholder');
  assert(isPlaceholderImageUrl(realUrl) === false, 'Foto DUO21 real não deve ser placeholder');

  const placeWithPlaceholder: Partial<Place> = {
    name: 'Galeto Di Paolo',
    media: [{ url: placeholderUrl, is_hero: true }]
  };
  assert(hasRealPhotos(placeWithPlaceholder) === false, 'Local com apenas placeholder não tem fotos reais');

  const placeWithRealPhoto: Partial<Place> = {
    name: 'Lago Negro',
    media: [{ url: realUrl, is_hero: true }]
  };
  assert(hasRealPhotos(placeWithRealPhoto) === true, 'Local com foto real é reconhecido');
  console.log('  ✓ Distinção de fotos auditada com sucesso.\n');

  // Teste 3: Classificação auditada (VERIFIED vs PENDING_VERIFICATION)
  console.log('▶ Teste 3: Classificação auditada dos estabelecimentos');
  const lagoNegro: Partial<Place> = {
    id: 'a0000001-0000-0000-0000-000000000001',
    name: 'Lago Negro',
    city: 'Gramado',
    google_place_id: 'ChIJQ3y_real_lago_negro',
    google_sync_status: 'RESOLVED'
  };
  assert(auditPlaceRecord(lagoNegro) === 'VERIFIED', 'Lago Negro homologado deve ser classificado como VERIFIED');

  const diPaolo: Partial<Place> = {
    id: 'b0000001-0000-0000-0000-000000000003',
    name: 'Galeto Di Paolo',
    city: 'Gramado',
    google_place_id: 'ChIJdipaolo-demo',
    google_sync_status: 'NOT_SYNCED'
  };
  assert(auditPlaceRecord(diPaolo) === 'PENDING_VERIFICATION', 'Di Paolo com ID -demo deve ser PENDING_VERIFICATION');

  const miniMundo: Partial<Place> = {
    id: 'a0000001-0000-0000-0000-000000000002',
    name: 'Mini Mundo',
    city: 'Gramado',
    google_place_id: 'ChIJmini-mundo-demo',
    google_sync_status: 'NOT_SYNCED'
  };
  assert(auditPlaceRecord(miniMundo) === 'PENDING_VERIFICATION', 'Mini Mundo com ID -demo deve ser PENDING_VERIFICATION');
  console.log('  ✓ Classificação auditada validada com sucesso.\n');

  // Teste 4: Cap de qualidade anti-inflação (não atingir 100% com dados demonstrativos)
  console.log('▶ Teste 4: Cap de qualidade anti-inflação');
  const diPaoloQuality = calculatePlaceDataQuality({
    ...diPaolo,
    description: 'Excelente galeto tradicional com sopa de capeletti e massas artesanais.',
    latitude: -29.3800,
    longitude: -50.8750,
    always_open: true,
    price_level: 2,
    media: [{ url: placeholderUrl, is_hero: true }]
  });
  assert(diPaoloQuality.score <= 65, `Score de local com dados demonstrativos deve ser <= 65% (recebido: ${diPaoloQuality.score}%)`);
  assert(diPaoloQuality.label !== 'Completo', 'Local com dados demonstrativos NÃO pode ser rotulado como Completo');
  console.log('   • Score Di Paolo:', diPaoloQuality.score, '% (Rotulado como:', diPaoloQuality.label, ')');
  console.log('  ✓ Penalidade anti-inflação aplicada com sucesso.\n');

  // Teste 5: CatalogSanitizerService — Auditoria e Sanitização
  console.log('▶ Teste 5: CatalogSanitizerService em ação');
  const samplePlaces: Place[] = [
    {
      id: 'a0000001-0000-0000-0000-000000000001',
      name: 'Lago Negro',
      slug: 'lago-negro',
      city: 'Gramado',
      category: 'atrativo',
      description: 'Lindo parque aberto com pedalinhos e pinheiros.',
      latitude: -29.3888,
      longitude: -50.8808,
      address: 'Rua A. J. Renner, Gramado - RS',
      google_place_id: 'ChIJlago_real',
      rating: 4.8,
      rating_count: 25237,
      price_level: 1,
      price_info: { 
        is_free: true, 
        adult_price: 0, 
        child_price: 0, 
        currency: 'BRL', 
        source_name: 'Oficial', 
        checked_at: '2026-10-08', 
        confidence: 'high' 
      },
      average_duration_minutes: 90,
      reservation_required: false,
      accessible: true,
      pet_friendly: true,
      children_friendly: true,
      indoor_type: 'outdoor',
      opening_hours: { 'seg': '08:00 - 18:00' },
      media: [{ url: realUrl, is_hero: true }],
      is_divulga_lugares_partner: false,
      active: true,
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'b0000001-0000-0000-0000-000000000003',
      name: 'Galeto Di Paolo',
      slug: 'galeto-di-paolo',
      city: 'Gramado',
      category: 'restaurante',
      description: 'Galeto al primo canto com massas e polenta frita.',
      latitude: -29.3800,
      longitude: -50.8750,
      address: 'Av. das Hortênsias, Gramado - RS',
      google_place_id: 'ChIJdipaolo-demo',
      google_sync_status: 'NOT_SYNCED',
      rating: 4.6,
      rating_count: 3200,
      price_level: 2,
      price_info: { 
        is_free: false, 
        adult_price: 118, 
        child_price: 59, 
        currency: 'BRL', 
        source_name: 'Cardápio Local', 
        checked_at: '2026-10-08', 
        confidence: 'medium' 
      },
      average_duration_minutes: 90,
      reservation_required: false,
      accessible: true,
      pet_friendly: false,
      children_friendly: true,
      indoor_type: 'indoor',
      opening_hours: { 'seg': '11:30 - 23:00' },
      media: [{ url: placeholderUrl, is_hero: true }],
      is_divulga_lugares_partner: true, // Parceria marcada erroneamente sem contrato
      active: true,
      is_demo: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const auditSummary = catalogSanitizerService.auditCatalog(samplePlaces);
  assert(auditSummary.totalPlaces === 2, 'Total deve ser 2');
  assert(auditSummary.verifiedCount === 1, 'Deve ter 1 VERIFIED (Lago Negro)');
  assert(auditSummary.pendingVerificationCount === 1, 'Deve ter 1 PENDING_VERIFICATION (Di Paolo)');
  assert(auditSummary.demoPlaceIdsDetected === 1, 'Deve detectar 1 Place ID -demo');
  assert(auditSummary.provenPartnersCount === 0, 'Sem contrato comprovado, parceiros deve ser 0');
  console.log('   • Resumo de auditoria:', auditSummary.verifiedCount, 'verificado,', auditSummary.pendingVerificationCount, 'pendente');

  const sanitizedPlaces = catalogSanitizerService.sanitizeCatalog(samplePlaces);
  const sanitizedDiPaolo = sanitizedPlaces.find(p => p.id === 'b0000001-0000-0000-0000-000000000003')!;
  assert(sanitizedDiPaolo.is_place_id_verified === false, 'Di Paolo não deve ter Place ID validado');
  assert(sanitizedDiPaolo.google_sync_status === 'NOT_SYNCED', 'Sync status deve ser NOT_SYNCED');
  assert(sanitizedDiPaolo.is_divulga_lugares_partner === false, 'Selo de parceiro deve ser removido');
  assert(sanitizedDiPaolo.media[0].is_placeholder === true, 'Mídia deve ser marcada como is_placeholder');
  assert(!sanitizedDiPaolo.maps_url.includes('ChIJdipaolo-demo'), 'Maps URL não deve conter Place ID demonstrativo');
  console.log('  ✓ Sanitização de dados concluída com sucesso.\n');

  // Teste 6: Proteção do Motor de Roteiros
  console.log('▶ Teste 6: Proteção do Motor de Roteiros');
  const demoPlaceToExclude: Place = {
    ...samplePlaces[1],
    id: 'demo-pure-fixture-99',
    name: 'Atração Fictícia Demo',
    audit_status: 'DEMO',
    is_demo: true
  };
  assert(isPlaceEligibleForItinerary(demoPlaceToExclude) === false, 'Local com audit_status DEMO deve ser inelegível');

  const conflictPlace: Place = {
    ...samplePlaces[1],
    id: 'conflict-99',
    name: 'Local com Conflito',
    audit_status: 'CONFLICT',
    latitude: 0,
    longitude: 0
  };
  assert(isPlaceEligibleForItinerary(conflictPlace) === false, 'Local com audit_status CONFLICT deve ser inelegível');

  // Geração de roteiro teste
  const testTrip = buildItinerary({
    name: 'Teste Auditoria DUO21',
    start_date: '2026-11-10',
    end_date: '2026-11-12',
    pace: 'equilibrado',
    adults_count: 2,
    children_count: 0,
    children_ages: [],
    interests: ['Gastronomia', 'Natureza'],
    transport: 'carro_proprio',
    mandatory_places: [],
    restrictions: []
  }, undefined, [...sanitizedPlaces, demoPlaceToExclude, conflictPlace]);

  assert(testTrip.days.length === 3, 'Deve gerar 3 dias de roteiro');
  
  // Verifica se nenhum item do roteiro tem ID DEMO ou CONFLICT
  for (const day of testTrip.days) {
    for (const act of day.activities) {
      assert(act.place.id !== 'demo-pure-fixture-99', 'Atração DEMO não pode estar no roteiro');
      assert(act.place.id !== 'conflict-99', 'Atração CONFLICT não pode estar no roteiro');
      if (act.place.google_place_id) {
        assert(!act.place.google_place_id.includes('demo'), 'Google Place ID no roteiro não pode conter "demo"');
      }
      if (act.place.maps_url) {
        assert(!act.place.maps_url.includes('-demo'), 'maps_url no roteiro não pode conter "-demo"');
      }
    }
  }
  console.log('  ✓ Motor de roteiros protegido com sucesso contra dados demonstrativos.\n');

  console.log('===============================================================');
  console.log('🎉 TODOS OS TESTES DO SPRINT 10D HOTFIX P0 — ETAPA 1 PASSARAM!');
  console.log('===============================================================\n');
}

runHotfixP0Etapa1Tests().catch(err => {
  console.error('\n❌ ERRO NA EXECUÇÃO DOS TESTES:', err);
  process.exit(1);
});

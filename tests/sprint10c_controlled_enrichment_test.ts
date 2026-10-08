import assert from 'assert';
import { supabaseServer } from '../src/server/supabaseServer';
import { GooglePlacesServerProvider, GOOGLE_FIELD_MASKS } from '../src/server/places/GooglePlacesServerProvider';
import { GooglePlaceNormalizer, GoogleApiPlaceRaw } from '../src/services/places/GooglePlaceNormalizer';
import { googlePlacesCostGuard, OFFICIAL_PLACES_PRICING } from '../src/server/costguard/GooglePlacesCostGuard';

/**
 * ==============================================================================
 * SPRINT 10C TEST SUITE: ENRIQUECIMENTO CONTROLADO DO CATÁLOGO (PILOTO LAGO NEGRO)
 * REGRA CENTRAL:
 * GOOGLE SUGERE. DUO21 DECIDE. SUPABASE CONTINUA SENDO A FONTE DE VERDADE.
 * ZERO chamadas reais ao Google; mocks controlados; catálogo real preservado.
 * ==============================================================================
 */

async function runSprint10cTests() {
  console.log('\n===============================================================');
  console.log('🏁 INICIANDO TESTES SPRINT 10C — ENRIQUECIMENTO CONTROLADO');
  console.log('   PILOTO REAL: LAGO NEGRO — GRAMADO/RS');
  console.log('===============================================================\n');

  // Ensure Cost Guard is enabled for test execution
  googlePlacesCostGuard.updateConfig({ enabled: true });

  const provider = new GooglePlacesServerProvider('mock-test-key');

  // ---------------------------------------------------------------------------
  // TEST 1: Busca de candidatos com Text Search (New) e FieldMask cirúrgico
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 1: Busca de candidatos para Lago Negro com FieldMask cirúrgico');
  const lagoNegroId = 'a0000001-0000-0000-0000-000000000001';
  const initialPlace = await supabaseServer.getPlaceById(lagoNegroId);
  assert(initialPlace, 'Lago Negro deve existir no catálogo');
  assert.strictEqual(initialPlace.name, 'Lago Negro', 'Nome local deve ser Lago Negro');

  // Verify FieldMask never contains wildcard "*"
  assert(!GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL.includes('*'), 'FieldMask de busca não pode conter wildcard "*"');
  assert.strictEqual(
    GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
    'places.id,places.displayName,places.formattedAddress,places.location,places.types',
    'FieldMask de resolução inicial deve ser cirúrgico'
  );

  const searchRes = await provider.searchCandidates('lago negro', {
    localPlaceId: lagoNegroId,
    maxResults: 5
  });

  assert.strictEqual(searchRes.status, 'READY', 'Busca mock de candidatos deve retornar READY');
  assert(Array.isArray(searchRes.candidates) && searchRes.candidates.length > 0, 'Deve retornar ao menos 1 candidato');
  const candidate = searchRes.candidates[0];
  assert(candidate.google_place_id, 'Candidato deve conter google_place_id');
  assert(candidate.name, 'Candidato deve conter nome');
  assert(candidate.address, 'Candidato deve conter endereço');
  assert(candidate.latitude !== undefined, 'Candidato deve conter latitude');
  assert(candidate.longitude !== undefined, 'Candidato deve conter longitude');
  assert(Array.isArray(candidate.types), 'Candidato deve conter array de types');
  console.log('  ✓ Candidato retornado:', candidate.name, '| ID:', candidate.google_place_id);

  // ---------------------------------------------------------------------------
  // TEST 2: Vinculação de Google Place ID (salva SOMENTE google_place_id e preserva UUID)
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 2: Vinculação explícita de Google Place ID');
  const originalUuid = initialPlace.id;
  const originalMedia = JSON.stringify(initialPlace.media);
  const originalDescription = initialPlace.description;

  const linkedPlace = await provider.linkGooglePlaceId(lagoNegroId, candidate.google_place_id);
  assert.strictEqual(linkedPlace.id, originalUuid, 'UUID interno do Supabase NUNCA deve ser alterado');
  assert.strictEqual(linkedPlace.google_place_id, candidate.google_place_id, 'google_place_id deve ser salvo');
  assert.strictEqual(linkedPlace.google_sync_status, 'LINKED', 'google_sync_status deve ser LINKED');
  assert.strictEqual(JSON.stringify(linkedPlace.media), originalMedia, 'Mídia manual não deve ser alterada na vinculação');
  assert.strictEqual(linkedPlace.description, originalDescription, 'Descrição DUO21 não deve ser alterada na vinculação');
  console.log('  ✓ UUID mantido intacto:', linkedPlace.id);
  console.log('  ✓ google_place_id vinculado:', linkedPlace.google_place_id);

  // ---------------------------------------------------------------------------
  // TEST 3: Place Details (New) com FieldMask cirúrgico e auditoria de SKU/Custo
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 3: Auditoria de SKU, Custo e FieldMask do Place Details (New)');
  const detailMask = GOOGLE_FIELD_MASKS.DETAIL;
  assert(!detailMask.includes('*'), 'FieldMask de detalhes não pode conter "*"');
  const expectedFields = [
    'id', 'displayName', 'formattedAddress', 'location', 'types',
    'regularOpeningHours', 'rating', 'userRatingCount',
    'websiteUri', 'googleMapsUri', 'nationalPhoneNumber'
  ];
  for (const f of expectedFields) {
    assert(detailMask.includes(f), `FieldMask deve conter o campo cirúrgico ${f}`);
  }

  const { sku, costBrl } = googlePlacesCostGuard.estimateOperationCost('getPlaceDetails', detailMask);
  assert.strictEqual(sku, 'PlaceDetails_Atmosphere_Contact', 'SKU auditado deve ser PlaceDetails_Atmosphere_Contact');
  assert.strictEqual(costBrl, 0.12, 'Custo estimado deve ser R$ 0,12');
  console.log('  ✓ SKU auditado:', sku, '| Custo estimado:', `R$ ${costBrl.toFixed(2)}`);

  // ---------------------------------------------------------------------------
  // TEST 4: Normalização de regularOpeningHours (Seg-Dom, 24h, Fechado, Múltiplos, Ausência)
  // REGRA CRÍTICA: AUSÊNCIA DE HORÁRIO ≠ FECHADO
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 4: Normalização de regularOpeningHours e Regra Crítica');

  // Case A: Ausência de informação
  const emptyNorm = GooglePlaceNormalizer.normalizeOpeningHours(undefined);
  assert.strictEqual(emptyNorm, undefined, 'Ausência de regularOpeningHours DEVE retornar undefined, NUNCA Fechado');

  const emptyPeriodsNorm = GooglePlaceNormalizer.normalizeOpeningHours({ periods: [], weekdayDescriptions: [] });
  assert.strictEqual(emptyPeriodsNorm, undefined, 'Periods vazios sem descriptions DEVE retornar undefined');

  // Case B: Aberto 24 horas
  const open24hNorm = GooglePlaceNormalizer.normalizeOpeningHours({
    weekdayDescriptions: [
      'segunda-feira: Aberto 24 horas',
      'terça-feira: Aberto 24 horas',
      'quarta-feira: Aberto 24 horas',
      'quinta-feira: Aberto 24 horas',
      'sexta-feira: Aberto 24 horas',
      'sábado: Aberto 24 horas',
      'domingo: Aberto 24 horas'
    ]
  });
  assert(open24hNorm, 'Deve normalizar 24h');
  assert.strictEqual(open24hNorm['seg'], 'Aberto 24 horas', 'Segunda-feira deve ser Aberto 24 horas');
  assert.strictEqual(open24hNorm['dom'], 'Aberto 24 horas', 'Domingo deve ser Aberto 24 horas');

  // Case C: Fechado em dia específico
  const closedDayNorm = GooglePlaceNormalizer.normalizeOpeningHours({
    periods: [
      { open: { day: 1, hour: 9, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } }
    ],
    weekdayDescriptions: [
      'segunda-feira: 09:00 - 18:00',
      'terça-feira: Fechado',
      'quarta-feira: Fechado',
      'quinta-feira: Fechado',
      'sexta-feira: Fechado',
      'sábado: Fechado',
      'domingo: Fechado'
    ]
  });
  assert(closedDayNorm, 'Deve normalizar dias fechados');
  assert.strictEqual(closedDayNorm['seg'], '09:00 - 18:00');
  assert.strictEqual(closedDayNorm['ter'], 'Fechado');

  // Case D: Múltiplos períodos no mesmo dia
  const multiPeriodNorm = GooglePlaceNormalizer.normalizeOpeningHours({
    periods: [
      { open: { day: 1, hour: 11, minute: 30 }, close: { day: 1, hour: 15, minute: 0 } },
      { open: { day: 1, hour: 19, minute: 0 }, close: { day: 1, hour: 23, minute: 0 } }
    ]
  });
  assert(multiPeriodNorm, 'Deve normalizar múltiplos períodos');
  assert.strictEqual(multiPeriodNorm['seg'], '11:30 - 15:00, 19:00 - 23:00', 'Deve concatenar períodos do mesmo dia');
  console.log('  ✓ Normalizador de horários validado para todos os casos e ausência de informação');

  // ---------------------------------------------------------------------------
  // TEST 5: getControlledPlaceDetails com Diff dos 10 campos
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 5: getControlledPlaceDetails e geração da tabela de DIFF');
  const detailsResult = await provider.getControlledPlaceDetails(lagoNegroId, { forceRefresh: true });
  assert.strictEqual(detailsResult.status, 'READY', 'Status do details deve ser READY');
  assert(detailsResult.diff, 'Deve conter objeto diff');
  const diffKeys = Object.keys(detailsResult.diff);
  const expectedDiffKeys = ['name', 'address', 'latitude', 'longitude', 'hours', 'rating', 'ratingCount', 'website', 'mapsUrl', 'phone'];
  for (const k of expectedDiffKeys) {
    assert(diffKeys.includes(k), `Diff deve conter o campo ${k}`);
  }
  console.log('  ✓ Todos os 10 campos comparados na tabela de DIFF:', expectedDiffKeys.join(', '));

  // ---------------------------------------------------------------------------
  // TEST 6: Proteção Especial do Lago Negro (TESTE ESPECÍFICO OBRIGATÓRIO)
  // "Enriquecer Lago Negro preserva integralmente mídia manual existente."
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 6: "Enriquecer Lago Negro preserva integralmente mídia manual existente."');
  
  // Capture initial state before enrichment
  const preEnrichment = await supabaseServer.getPlaceById(lagoNegroId);
  const preMedia = JSON.parse(JSON.stringify(preEnrichment.media));
  const preDescription = preEnrichment.description;
  const prePriceInfo = JSON.parse(JSON.stringify(preEnrichment.price_info));
  const preDuration = preEnrichment.average_duration_minutes;
  const preDivulgaPartner = preEnrichment.is_divulga_lugares_partner;
  const preDivulgaTip = JSON.parse(JSON.stringify(preEnrichment.divulga_lugares_tip || {}));
  const preInstagram = preEnrichment.instagram;

  // Apply controlled enrichment choosing hours, rating, mapsUrl (and NOT name, NOT address)
  const enriched = await provider.applyControlledEnrichment(lagoNegroId, {
    selectedFields: {
      hours: true,
      rating: true,
      ratingCount: true,
      mapsUrl: true,
      name: false,
      address: false,
      latitude: false,
      longitude: false,
      website: false,
      phone: false
    },
    googleData: detailsResult.googleData
  });

  // Verify that approved fields WERE updated
  assert.strictEqual(enriched.hours_source, 'google_places', 'hours_source deve ser google_places');
  assert(enriched.hours_last_checked_at, 'hours_last_checked_at deve ter timestamp');
  assert.strictEqual(enriched.rating_source, 'google_places', 'rating_source deve ser google_places');
  assert(enriched.rating_last_checked_at, 'rating_last_checked_at deve ter timestamp');
  assert.strictEqual(enriched.google_sync_status, 'ENRICHED', 'google_sync_status deve ser ENRICHED');

  // VERIFY THAT PROTECTED FIELDS REMAINED 100% INTACT
  assert.deepStrictEqual(enriched.media, preMedia, 'MÍDIA MANUAL DO LAGO NEGRO DEVE SER 100% INTACTA');
  assert.strictEqual(enriched.description, preDescription, 'DESCRIÇÃO EDITORIAL DUO21 DEVE SER 100% INTACTA');
  assert.deepStrictEqual(enriched.price_info, prePriceInfo, 'TABELA DE PREÇOS DEVE SER 100% INTACTA');
  assert.strictEqual(enriched.average_duration_minutes, preDuration, 'DURAÇÃO ESTIMADA DEVE SER 100% INTACTA');
  assert.strictEqual(enriched.is_divulga_lugares_partner, preDivulgaPartner, 'STATUS PARCEIRO DIVULGA DEVE SER 100% INTACTO');
  assert.deepStrictEqual(enriched.divulga_lugares_tip, preDivulgaTip, 'DICA DIVULGA LUGARES DEVE SER 100% INTACTA');
  assert.strictEqual(enriched.instagram, preInstagram, 'INSTAGRAM EDITORIAL DEVE SER 100% INTACTO');
  console.log('  ✓ Teste específico PASSED: "Enriquecer Lago Negro preserva integralmente mídia manual existente."');

  // ---------------------------------------------------------------------------
  // TEST 7: Cache-First — Segunda consulta deve usar dados em cache
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 7: Cache-First — Reutilização de dados em cache');
  const cachedDetails = await provider.getControlledPlaceDetails(lagoNegroId, { forceRefresh: false });
  assert.strictEqual(cachedDetails.fromCache, true, 'Segunda consulta sem forceRefresh DEVE vir do cache');
  assert(cachedDetails.cachedAt, 'Deve informar data e hora da consulta em cache');
  console.log('  ✓ Dados em cache retornados com timestamp:', cachedDetails.cachedAt);

  // ---------------------------------------------------------------------------
  // TEST 8: Sincronização da tabela relacional place_hours
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 8: Reutilização e sincronização da tabela relacional place_hours');
  const storedHours = await supabaseServer.getHoursForPlace(lagoNegroId);
  assert(Array.isArray(storedHours), 'Deve retornar lista de place_hours');
  assert(storedHours.length > 0, 'Deve ter registros em place_hours para os 7 dias');
  const sunday = storedHours.find(h => h.day_of_week === 0);
  assert(sunday, 'Deve conter registro para domingo (day_of_week = 0)');
  assert.strictEqual(sunday.closed, false, 'Lago Negro não deve estar fechado aos domingos');
  console.log('  ✓ place_hours sincronizado perfeitamente sem duplicar estruturas');

  // ---------------------------------------------------------------------------
  // TEST 9: Bloqueio estrito quando GOOGLE_PLACES_ENABLED = false
  // ---------------------------------------------------------------------------
  console.log('\n▶ Teste 9: Bloqueio estrito quando GOOGLE_PLACES_ENABLED = false');
  googlePlacesCostGuard.updateConfig({ enabled: false });

  const blockedSearch = await provider.searchCandidates('lago negro');
  assert.strictEqual(blockedSearch.status, 'DISABLED', 'Busca deve ser bloqueada quando Cost Guard desativado');

  const blockedDetails = await provider.getControlledPlaceDetails(lagoNegroId, { forceRefresh: true });
  assert.strictEqual(blockedDetails.status, 'DISABLED', 'Details deve ser bloqueado quando Cost Guard desativado');
  console.log('  ✓ Cost Guard bloqueia qualquer tentativa de chamada quando desativado');

  // Restore Cost Guard config
  googlePlacesCostGuard.updateConfig({ enabled: true });

  console.log('\n===============================================================');
  console.log('🎉 TODOS OS TESTES DA SPRINT 10C PASSARAM COM SUCESSO!');
  console.log('===============================================================\n');
}

runSprint10cTests().catch(err => {
  console.error('\n❌ FALHA NO TESTE SPRINT 10C:', err);
  process.exit(1);
});

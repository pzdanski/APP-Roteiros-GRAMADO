import assert from 'assert';
import { supabaseServer } from '../src/server/supabaseServer';
import { GooglePlacesServerProvider, GOOGLE_FIELD_MASKS } from '../src/server/places/GooglePlacesServerProvider';
import { googlePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';
import {
  buildPlaceResolutionQuery,
  calculateHaversineDistanceMeters,
  formatDistance,
  normalizeText,
  calculateNameSimilarity,
  calculateProximityScore,
  calculateCategoryScore,
  calculateCityScore,
  calculatePopularityScore,
  calculateMatchConfidence,
  rankAndScoreCandidates,
  DEFAULT_RESOLUTION_RADIUS_METERS
} from '../src/services/places/SmartPlaceResolver';

/**
 * ==============================================================================
 * HOTFIX P1 TEST SUITE: SMART PLACE RESOLVER
 * RESOLUÇÃO INTELIGENTE DE ENTIDADES GOOGLE PLACES (CASO REAL: LAGO NEGRO)
 * ==============================================================================
 */

async function runHotfixP1Tests() {
  console.log('\n===============================================================');
  console.log('🏁 INICIANDO TESTES HOTFIX P1 — SMART PLACE RESOLVER');
  console.log('   RESOLUÇÃO DETERMINÍSTICA DE ENTIDADES (PILOTO LAGO NEGRO)');
  console.log('===============================================================\n');

  // Habilitar Cost Guard para os testes
  googlePlacesCostGuard.updateConfig({ enabled: true });
  const provider = new GooglePlacesServerProvider('mock-test-key');

  // ---------------------------------------------------------------------------
  // TESTE 1: Helper determinístico buildPlaceResolutionQuery
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 1: Validação do buildPlaceResolutionQuery determinístico');
  
  // Caso 1: Lago Negro (Parque em Gramado)
  const qLago = buildPlaceResolutionQuery({
    name: 'Lago Negro',
    category: 'parque',
    city: 'Gramado'
  });
  assert.strictEqual(qLago, 'Lago Negro parque Gramado', 'Query do Lago Negro deve incluir nome, dica de parque e cidade');

  // Caso 2: Nome já contém a categoria (não duplica termo)
  const qParque = buildPlaceResolutionQuery({
    name: 'Parque de Lavanda',
    category: 'parque',
    city: 'Gramado'
  });
  assert.strictEqual(qParque, 'Parque de Lavanda Gramado', 'Não deve duplicar a categoria se o nome já contiver');

  // Caso 3: Restaurante em Canela
  const qRest = buildPlaceResolutionQuery({
    name: 'Empório Canela',
    category: 'restaurante',
    city: 'Canela'
  });
  assert.strictEqual(qRest, 'Empório Canela restaurante Canela');
  console.log('  ✓ buildPlaceResolutionQuery determinístico validado com sucesso.');

  // ---------------------------------------------------------------------------
  // TESTE 2: Distância Haversine e Formatação Amigável (Server-Side)
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 2: Cálculo geográfico Haversine e formatação de distância');
  
  // Coordenadas aproximadas Lago Negro DUO21: (-29.3888, -50.8808)
  // Ponto A (120m de distância): (-29.3898, -50.8808)
  const dist120m = calculateHaversineDistanceMeters(-29.3888, -50.8808, -29.3899, -50.8808);
  assert(dist120m > 100 && dist120m < 150, `Distância calculada deve ser ~122m (obtido: ${dist120m}m)`);
  assert(formatDistance(dist120m).includes('m do ponto cadastrado'), 'Deve formatar em metros quando < 1000m');

  // Ponto B (3,2 km de distância - Casa Grande): (-29.3650, -50.8950)
  const dist3km = calculateHaversineDistanceMeters(-29.3888, -50.8808, -29.3650, -50.8950);
  assert(dist3km > 2800 && dist3km < 3500, `Distância calculada deve ser ~3km (obtido: ${dist3km}m)`);
  assert(formatDistance(dist3km).includes('km do ponto cadastrado'), 'Deve formatar em km quando >= 1000m');

  assert.strictEqual(formatDistance(120), '120 m do ponto cadastrado');
  assert.strictEqual(formatDistance(850), '850 m do ponto cadastrado');
  assert.strictEqual(formatDistance(4800), '4,8 km do ponto cadastrado');
  console.log('  ✓ Haversine e formatação (120m, 850m, 4,8 km) validados com precisão.');

  // ---------------------------------------------------------------------------
  // TESTE 3: Regras de Pontuação por Proximidade Geográfica (0 a 40 pts)
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 3: Faixas de proximidade geográfica determinísticas');
  assert.strictEqual(calculateProximityScore(100), 40, '<= 150m deve ser pontuação máxima (40)');
  assert.strictEqual(calculateProximityScore(400), 35, '<= 500m deve ser muito alta (35)');
  assert.strictEqual(calculateProximityScore(900), 28, '<= 1000m deve ser alta (28)');
  assert.strictEqual(calculateProximityScore(1500), 20, '<= 2000m deve ser média (20)');
  assert.strictEqual(calculateProximityScore(2500), 14, '<= 3000m deve ser média/baixa (14)');
  assert.strictEqual(calculateProximityScore(4500), 4, '> 3000m deve ser baixa (4)');
  assert.strictEqual(calculateProximityScore(null), 15, 'Sem coordenadas deve ser neutra (15)');
  console.log('  ✓ Proximidade: 40 pts (<=150m) até 5 pts (>3km) verificados.');

  // ---------------------------------------------------------------------------
  // TESTE 4: Similaridade de Nome Normalizada (0 a 25 pts)
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 4: Normalização e similaridade de nomes');
  assert.strictEqual(normalizeText('Lago Negro — Gramado!'), 'lago negro gramado');
  assert.strictEqual(calculateNameSimilarity('Lago Negro', 'Lago Negro'), 25, 'Nomes idênticos devem receber 25 pts');
  assert(calculateNameSimilarity('Lago Negro', 'Parque Lago Negro') >= 22, 'Tokens contidos devem receber pontuação alta');
  assert(calculateNameSimilarity('Lago Negro', 'Restaurante Casa da Velha Bruxa') <= 5, 'Nomes diferentes devem pontuar baixo');
  console.log('  ✓ Similaridade de nome determinística validada.');

  // ---------------------------------------------------------------------------
  // TESTE 5: CASO REAL HOMOLOGAÇÃO LAGO NEGRO — Resolução Entidade Primária vs Secundária
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 5: CASO LAGO NEGRO — Desempate determinístico da entidade correta');
  
  const duo21LagoNegro = {
    name: 'Lago Negro',
    category: 'parque',
    city: 'Gramado',
    latitude: -29.3888,
    longitude: -50.8808,
    address: 'R. A. J. Renner, Bairro Planalto, Gramado - RS'
  };

  // Candidato 1: Entidade Turística Principal (A que queremos representar)
  const candidatePrincipal = {
    google_place_id: 'ChIJQ3y-demo-lago-negro',
    name: 'Lago Negro',
    address: 'R. A. J. Renner, Bairro Planalto, Gramado - RS, 95670-000',
    latitude: -29.3888,
    longitude: -50.8808,
    types: ['tourist_attraction', 'park', 'point_of_interest'],
    rating: 4.8,
    userRatingCount: 28450
  };

  // Candidato 2: Entidade Secundária (Casa Grande - O caso que causou a falha reportada)
  const candidateSecundario = {
    google_place_id: 'ChIJ-lago-negro-casa-grande',
    name: 'Lago Negro',
    address: 'R. Vinte e Cinco de Julho, 439 - Casa Grande, Gramado - RS',
    latitude: -29.3520,
    longitude: -50.8880,
    types: ['point_of_interest', 'establishment'],
    rating: 4.8,
    userRatingCount: 104
  };

  const evalPrincipal = calculateMatchConfidence(duo21LagoNegro, candidatePrincipal);
  const evalSecundario = calculateMatchConfidence(duo21LagoNegro, candidateSecundario);

  console.log(`    • Candidato Principal (Planalto / 28k reviews): Score ${evalPrincipal.totalScore}% (${evalPrincipal.level})`);
  console.log(`    • Candidato Secundário (Casa Grande / 104 reviews): Score ${evalSecundario.totalScore}% (${evalSecundario.level})`);

  // Assertivas do caso Lago Negro
  assert.strictEqual(evalPrincipal.level, 'HIGH', 'Entidade turística principal DEVE ser classificada como HIGH');
  assert(evalPrincipal.totalScore >= 90, `Score da entidade principal deve ser >= 90% (obtido: ${evalPrincipal.totalScore}%)`);
  
  assert.strictEqual(evalSecundario.level, 'LOW', 'Entidade secundária no Casa Grande DEVE ser classificada como LOW');
  assert(evalSecundario.totalScore < 60, `Score da entidade secundária deve ser < 60% (obtido: ${evalSecundario.totalScore}%)`);

  // Ranking: ao passar os dois candidatos, o principal DEVE ficar em 1º lugar
  const ranked = rankAndScoreCandidates(duo21LagoNegro, [candidateSecundario, candidatePrincipal]);
  assert.strictEqual(ranked[0].google_place_id, candidatePrincipal.google_place_id, 'O primeiro colocado visual DEVE ser o local principal');
  assert.strictEqual(ranked[1].google_place_id, candidateSecundario.google_place_id, 'O segundo colocado DEVE ser a entidade secundária');
  assert.strictEqual(ranked[0].match_level, 'HIGH');
  assert.strictEqual(ranked[1].match_level, 'LOW');
  console.log('  ✓ Resolução do caso Lago Negro aprovada: Entidade principal em 1º lugar (HIGH), secundária em 2º (LOW).');

  // ---------------------------------------------------------------------------
  // TESTE 6: Busca de candidatos via Provider com Location Bias e FieldMask
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 6: searchCandidates no GooglePlacesServerProvider com sinais locais');
  
  const lagoLocal = await supabaseServer.getPlaceById('a0000001-0000-0000-0000-000000000001');
  assert(lagoLocal, 'Lago Negro deve existir no Supabase');

  const res = await provider.searchCandidates('Lago Negro', {
    localPlaceId: lagoLocal.id,
    maxResults: 5
  });

  assert.strictEqual(res.status, 'READY');
  assert(res.candidates.length >= 2, 'Deve retornar ao menos os dois candidatos mock para Lago Negro');

  const topCandidate = res.candidates[0];
  assert.strictEqual(topCandidate.name, 'Lago Negro');
  assert.strictEqual(topCandidate.match_level, 'HIGH');
  assert(topCandidate.distance_meters !== null && topCandidate.distance_meters <= 250, `Distância do topo deve ser próxima do ponto (~189m, obtido: ${topCandidate.distance_meters}m)`);
  assert(topCandidate.userRatingCount && topCandidate.userRatingCount > 10000, 'Entidade principal tem alto volume de avaliações');
  assert(topCandidate.distance_formatted.includes('m do ponto cadastrado'));
  console.log('  ✓ searchCandidates integrou âncora, locationBias e ordenou corretamente.');

  // ---------------------------------------------------------------------------
  // TESTE 7: Proteção Invariante do Place Details (Seção 15)
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 7: Proteção do Place Details (returnedPlace.id === requestedGooglePlaceId)');
  
  // Vincula explicitamente o candidato principal encontrado
  await provider.linkGooglePlaceId(lagoLocal.id, topCandidate.google_place_id);
  
  // Consulta de detalhes com ID válido
  const validDetails = await provider.getControlledPlaceDetails(lagoLocal.id, { forceRefresh: false });
  assert.strictEqual(validDetails.status, 'READY');
  assert.strictEqual(validDetails.googlePlaceId, topCandidate.google_place_id);
  console.log('  ✓ Place Details preservado e validado com sucesso.');

  // ---------------------------------------------------------------------------
  // TESTE 8: Auditoria de SKU e Cost Guard para Text Search Enriquecido
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 8: Auditoria de FieldMask e SKU do Text Search');
  assert(GOOGLE_FIELD_MASKS.SMART_RESOLUTION.includes('places.rating'), 'FieldMask deve incluir places.rating');
  assert(GOOGLE_FIELD_MASKS.SMART_RESOLUTION.includes('places.userRatingCount'), 'FieldMask deve incluir places.userRatingCount');
  assert(!GOOGLE_FIELD_MASKS.SMART_RESOLUTION.includes('*'), 'FieldMask nunca pode conter wildcard "*"');
  
  const costEstimate = googlePlacesCostGuard.estimateOperationCost('searchText', GOOGLE_FIELD_MASKS.SMART_RESOLUTION);
  assert(costEstimate.costBrl !== null, 'Custo estimado deve estar configurado no Cost Guard');
  assert.strictEqual(costEstimate.sku, 'TextSearch_New');
  console.log(`  ✓ SKU auditada: ${costEstimate.sku} | Custo estimado: R$ ${costEstimate.costBrl?.toFixed(2)} | FieldMask cirúrgico sem "*"`);

  console.log('\n===============================================================');
  console.log('🎉 TODOS OS TESTES DO HOTFIX P1 PASSARAM COM 100% DE SUCESSO!');
  console.log('===============================================================\n');
}

runHotfixP1Tests().catch(err => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES DO HOTFIX P1:', err);
  process.exit(1);
});

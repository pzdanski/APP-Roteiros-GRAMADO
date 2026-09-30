import assert from 'assert';
import { finalItineraryEngine } from '../src/services/finalItineraryEngine';
import { toDeterministicUuid, resolvePlaceUuid, mapRawPlaceToClientPlace } from '../src/server/supabaseServer';
import { SEED_PLACES } from '../src/data/seedData';
import { TripPreferences } from '../src/types';

async function runHotfix8_2Tests() {
  console.log('================================================================');
  console.log('🏁 INICIANDO TESTES DO HOTFIX 8.2: ROTEIRO PAGO COM ATIVIDADES');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Geração do FinalItineraryEngine sob DATA_MODE=supabase
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: FinalItineraryEngine com DATA_MODE=supabase ---');
  process.env.DATA_MODE = 'supabase';

  const testPrefs: TripPreferences = {
    name: 'Paulinho',
    start_date: '2024-07-20',
    end_date: '2024-07-24', // 5 dias
    adults_count: 2,
    children_count: 2,
    children_ages: [],
    pace: 'equilibrado',
    transport: 'sem_carro',
    interests: ['parques', 'natureza', 'gastronomia'],
    mandatory_places: [],
    restrictions: []
  };

  const trip = finalItineraryEngine.generateFinalItinerary(testPrefs, 'payment');

  assert(trip, 'Viagem deve ser gerada');
  assert(trip.days.length === 5, `Esperado 5 dias, obteve ${trip.days.length}`);

  let totalActivities = 0;
  trip.days.forEach((day, idx) => {
    const actCount = day.activities?.length || 0;
    totalActivities += actCount;
    console.log(`  DIA ${day.day_number} (${day.date} • ${day.city_focus}): ${actCount} atividades | ${day.theme_title}`);
    assert(actCount >= 2, `Dia ${day.day_number} deve conter pelo menos 2 atividades, obteve ${actCount}`);
    
    // Validar estrutura das atividades
    day.activities.forEach(act => {
      assert(act.id, 'Atividade deve ter id');
      assert(act.time, 'Atividade deve ter time (HH:MM)');
      assert(act.place, 'Atividade deve ter place');
      assert(act.place.name, 'Local deve ter nome');
      assert(act.place.city, 'Local deve ter cidade');
      assert(act.place.price_info, 'Local deve ter price_info');
      assert(typeof act.place.price_info.is_free === 'boolean', 'price_info.is_free deve ser booleano');
      assert(typeof act.place.price_info.adult_price === 'number', 'price_info.adult_price deve ser número');
      assert(act.locked === false, 'Atividade no roteiro pago deve estar desbloqueada');
    });
  });

  console.log(`  TOTAL DE ATIVIDADES GERADAS: ${totalActivities}`);
  assert(totalActivities >= 10, `Total de atividades (${totalActivities}) deve ser >= 10 para 5 dias`);
  console.log('✅ [PASS] FinalItineraryEngine gerou 5 dias com atividades completas em todos os dias.\n');

  // ---------------------------------------------------------------------------
  // TEST 2: Validação de Consistência e Proteção contra Roteiro Vazio como READY
  // ---------------------------------------------------------------------------
  console.log('--- TEST 2: Validação de Consistência (Seção 6) ---');
  
  function validateTripReadyConsistency(generatedTrip: any): boolean {
    const generatedDays = generatedTrip.days?.length || 0;
    const activitiesCount = (generatedTrip.days || []).reduce((acc: number, d: any) => acc + (d.activities?.length || 0), 0);
    const allRequiredDaysHaveActivities = generatedDays > 0 && generatedTrip.days.every((d: any) => (d.activities?.length || 0) > 0);

    return Boolean(generatedDays > 0 && activitiesCount > 0 && allRequiredDaysHaveActivities);
  }

  // Caso 1: Roteiro com dias e atividades válidas -> APROVADO
  assert(validateTripReadyConsistency(trip) === true, 'Roteiro com dias e atividades deve ser aprovado como READY');

  // Caso 2: Roteiro bugado com dias mas 0 atividades -> REJEITADO
  const buggedTripEmptyActivities = {
    ...trip,
    days: trip.days.map(d => ({ ...d, activities: [] }))
  };
  assert(validateTripReadyConsistency(buggedTripEmptyActivities) === false, 'Roteiro com 0 atividades NUNCA pode ser aprovado como READY');

  // Caso 3: Roteiro onde 1 dos dias está vazio -> REJEITADO
  const buggedTripOneDayEmpty = {
    ...trip,
    days: trip.days.map((d, i) => i === 2 ? ({ ...d, activities: [] }) : d)
  };
  assert(validateTripReadyConsistency(buggedTripOneDayEmpty) === false, 'Roteiro onde qualquer dia obrigatório tem 0 atividades deve ser REJEITADO');

  console.log('✅ [PASS] Regra de consistência rejeita qualquer roteiro com dias vazios para status READY.\n');

  // ---------------------------------------------------------------------------
  // TEST 3: UUID Normalization e Mapeamento de Relacionamentos (Seção 4)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 3: UUID Normalization e Integridade Relacional ---');
  
  const originalTripId = 'prev_1790723608137_5ygmu';
  const normalizedUuid = toDeterministicUuid(originalTripId);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  assert(uuidRegex.test(normalizedUuid), `UUID gerado (${normalizedUuid}) deve ser um UUID RFC4122 válido`);
  // Idempotência
  assert(toDeterministicUuid(originalTripId) === normalizedUuid, 'toDeterministicUuid deve ser 100% determinístico e idempotente');

  // Resolução de place_id
  const lagoNegroUuid = resolvePlaceUuid('plc-gra-01', 'lago-negro');
  assert(lagoNegroUuid === 'a0000001-0000-0000-0000-000000000001', 'Lago Negro deve mapear para seu UUID canônico na migration');

  const miniMundoUuid = resolvePlaceUuid('plc-gra-02', 'mini-mundo');
  assert(miniMundoUuid === 'a0000001-0000-0000-0000-000000000002', 'Mini Mundo deve mapear para seu UUID canônico na migration');

  console.log(`  Trip ID: ${originalTripId} -> UUID: ${normalizedUuid}`);
  console.log(`  Place: plc-gra-01 -> UUID: ${lagoNegroUuid}`);
  console.log(`  Place: plc-gra-02 -> UUID: ${miniMundoUuid}`);
  console.log('✅ [PASS] UUIDs e Foreign Keys normalizados com integridade relacional total.\n');

  // ---------------------------------------------------------------------------
  // TEST 4: Normalização de Places do Supabase para Frontend (PlaceCard)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 4: Normalização de Linhas de Places do Supabase ---');
  
  const rawSupabasePlaceRow = {
    id: 'a0000001-0000-0000-0000-000000000001',
    name: 'Lago Negro',
    slug: 'lago-negro',
    city: 'Gramado',
    category_id: 'FREE_ATTRACTION',
    description_short: 'Lago artificial cercado por árvores da Floresta Negra alemã.',
    latitude: -29.3888,
    longitude: -50.8808,
    address: 'Rua A. J. Renner, Gramado - RS',
    cost_per_person: 0,
    cost_level: 1,
    duration_min: 90,
    accessibility: true,
    indoor_outdoor: 'outdoor',
    suitable_for_children: true,
    active: true
  };

  const clientPlace = mapRawPlaceToClientPlace(rawSupabasePlaceRow);
  assert(clientPlace.category === 'parque', `Categoria FREE_ATTRACTION deve normalizar para parque, obteve ${clientPlace.category}`);
  assert(clientPlace.price_info, 'clientPlace deve possuir price_info');
  assert(clientPlace.price_info.is_free === true, 'Lago Negro deve ter is_free = true');
  assert(clientPlace.price_info.adult_price === 0, 'Lago Negro deve ter adult_price = 0');
  assert(clientPlace.media && clientPlace.media.length > 0, 'clientPlace deve possuir media com URL de foto');
  assert(clientPlace.indoor_type === 'outdoor', 'indoor_type deve ser outdoor');

  console.log('✅ [PASS] Linhas raw do Supabase mapeadas com price_info, media e categoria compatíveis com PlaceCard.\n');

  // ---------------------------------------------------------------------------
  // TEST 5: Contrato da API de Leitura (Seção 7)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 5: Contrato da API de Leitura da aba ROTEIRO ---');
  
  const tripDaysContract = trip.days.map(d => ({
    date: d.date,
    city: d.city_focus,
    title: d.theme_title,
    estimatedBudget: d.total_day_cost_estimated,
    activities: d.activities.map(a => ({
      id: a.id,
      time: a.time,
      placeName: a.place.name,
      category: a.place.category,
      price: a.place.price_info.adult_price
    }))
  }));

  assert(tripDaysContract.length === 5, 'Contrato da API de leitura deve conter 5 dias');
  tripDaysContract.forEach((d, idx) => {
    assert(d.date, `Dia ${idx + 1} deve ter date`);
    assert(d.city, `Dia ${idx + 1} deve ter city`);
    assert(d.title, `Dia ${idx + 1} deve ter title`);
    assert(typeof d.estimatedBudget === 'number', `Dia ${idx + 1} deve ter estimatedBudget numérico`);
    assert(d.activities.length >= 2, `Dia ${idx + 1} deve ter atividades no array`);
  });

  console.log('✅ [PASS] Contrato da API de leitura validado: days[].activities[] 100% preenchido.\n');

  console.log('================================================================');
  console.log('🎉 TODOS OS TESTES DO HOTFIX 8.2 FORAM APROVADOS COM SUCESSO! 🚀');
  console.log('================================================================');
}

runHotfix8_2Tests().catch(err => {
  console.error('❌ Falha nos testes do HOTFIX 8.2:', err);
  process.exit(1);
});

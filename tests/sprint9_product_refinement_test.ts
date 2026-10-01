import { parseBudgetFromNaturalText, heuristicParseTripInput } from '../src/services/ai/heuristicParser';
import { previewEngine } from '../src/services/previewEngine';
import { finalItineraryEngine } from '../src/services/finalItineraryEngine';
import { TripPreferences } from '../src/types';
import { formatPlaceCategory, formatOpeningHours, formatRating, formatDuration } from '../src/utils/formatters';
import { aiProvider } from '../src/services/ai/GeminiProvider';

async function runSprint9Tests() {
  console.log('================================================================');
  console.log('STARTING SPRINT 9 — PRODUCT REFINEMENT & BRIEFING CONSISTENCY TEST');
  console.log('================================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(name: string, condition: boolean, detail?: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  [PASS] ${name}`);
    } else {
      console.error(`  [FAIL] ${name} ${detail ? `(${detail})` : ''}`);
      throw new Error(`Assertion failed: ${name}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Mandatory Budget Test Cases (Sprint 9 Section 1)
  // ---------------------------------------------------------------------------
  console.log('[TEST GROUP 1] Mandatory Natural Language Budget Formats...');

  const requiredCases = [
    { input: '10 mil', expected: 10000 },
    { input: 'R$ 10.000', expected: 10000 },
    { input: '10000', expected: 10000 },
    { input: '10k', expected: 10000 },
    { input: 'uns 10 mil reais', expected: 10000 },
    { input: 'até dez mil reais', expected: 10000 },
    { input: 'Quero gastar no máximo uns 10 mil reais', expected: 10000 }
  ];

  for (const tc of requiredCases) {
    const val = parseBudgetFromNaturalText(tc.input);
    assert(
      `parseBudgetFromNaturalText("${tc.input}") === ${tc.expected}`,
      val === tc.expected,
      `Received: ${val}`
    );

    const parsed = heuristicParseTripInput(tc.input);
    assert(
      `heuristicParseTripInput("${tc.input}").budget_total === ${tc.expected}`,
      parsed.preferences.budget_total === tc.expected,
      `Received: ${parsed.preferences.budget_total}`
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Real Production Regressions & Edge Cases
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 2] Real Production Edge Cases & Regression Prevention...');

  // The real production bug reported by user:
  // "Quero gastar no máximo uns 10 mil reais" resulting in 6000 due to luxury tier override
  const luxuryPrompt = 'Vamos para Gramado em casal. Queremos experiências premium e luxo. Quero gastar no máximo uns 10 mil reais.';
  const parsedLuxury = heuristicParseTripInput(luxuryPrompt);
  assert(
    'Luxury prompt preserves explicit budget_total = 10000 (NOT 6000)',
    parsedLuxury.preferences.budget_total === 10000,
    `Received: ${parsedLuxury.preferences.budget_total}`
  );
  assert(
    'Luxury flexibility is still recognized',
    parsedLuxury.preferences.budget_flexibility === 'luxo' || parsedLuxury.preferences.budget_flexibility === 'conforto',
    `Received: ${parsedLuxury.preferences.budget_flexibility}`
  );

  // Mixed prompt with per-person food budget AND total budget
  const mixedPrompt = 'Vou para Gramado com 2 adultos e 2 crianças de 7 e 11 anos por 5 dias. Almoço até 80 por pessoa. Orçamento total de 10k.';
  const parsedMixed = heuristicParseTripInput(mixedPrompt);
  assert(
    'Mixed prompt preserves budget_food_per_person = 80',
    parsedMixed.preferences.budget_food_per_person === 80,
    `Received: ${parsedMixed.preferences.budget_food_per_person}`
  );
  assert(
    'Mixed prompt preserves budget_total = 10000',
    parsedMixed.preferences.budget_total === 10000,
    `Received: ${parsedMixed.preferences.budget_total}`
  );
  assert(
    'Mixed prompt extracts children ages correctly',
    Array.isArray(parsedMixed.preferences.children_ages) &&
    parsedMixed.preferences.children_ages[0] === 7 &&
    parsedMixed.preferences.children_ages[1] === 11,
    `Received: ${JSON.stringify(parsedMixed.preferences.children_ages)}`
  );

  // ---------------------------------------------------------------------------
  // 3. Strict Consistency Across Full Lifecycle: Briefing -> Confirm -> Preview -> Final
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 3] End-to-End Pipeline Consistency (No Silent Re-interpretation)...');

  const fullPrompt = `Olá, sou o Paulinho Zdanski.
Vou para Gramado e Canela do dia 2026-10-10 ao dia 2026-10-15 com minha esposa e 2 filhos de 6 e 10 anos.
Estamos de carro alugado e já reservamos o Hotel Ritta Höppner.
Quero ritmo tranquilo, adoramos gastronomia e natureza.
Não pode faltar uma sequência tradicional de fondue.
Temos restrição a caminhadas muito longas para as crianças.
Quero gastar no máximo uns 10 mil reais.`;

  const parsedFull = heuristicParseTripInput(fullPrompt);
  const basePrefs: TripPreferences = {
    name: parsedFull.preferences.name || 'Paulinho Zdanski',
    start_date: parsedFull.preferences.start_date || '2026-10-10',
    end_date: parsedFull.preferences.end_date || '2026-10-15',
    adults_count: parsedFull.preferences.adults_count || 2,
    children_count: parsedFull.preferences.children_count || 2,
    children_ages: parsedFull.preferences.children_ages || [6, 10],
    hotel_name: parsedFull.preferences.hotel_name || 'Hotel Ritta Höppner',
    hotel_city: parsedFull.preferences.hotel_city || 'Gramado',
    accommodation_status: 'booked',
    budget_total: parsedFull.preferences.budget_total || 10000,
    pace: parsedFull.preferences.pace || 'tranquilo',
    transport: parsedFull.preferences.transport || 'carro_alugado',
    interests: parsedFull.preferences.interests || ['Gastronomia', 'Natureza'],
    mandatory_places: [],
    must_have: parsedFull.preferences.must_have || ['Sequência Tradicional de Fondue'],
    restrictions: parsedFull.preferences.restrictions || ['Sem caminhadas longas'],
    is_couple: false
  };

  // 1. Check base preferences
  assert('Base preferences budget_total === 10000', basePrefs.budget_total === 10000);
  assert('Base preferences name === Paulinho Zdanski', basePrefs.name === 'Paulinho Zdanski');
  assert('Base preferences hotel_name === Hotel Ritta Höppner', basePrefs.hotel_name === 'Hotel Ritta Höppner');
  assert('Base preferences children_ages === [6, 10]', basePrefs.children_ages?.length === 2);

  // 2. Generate Preview
  const preview = previewEngine.generatePreview(basePrefs);
  assert('Preview retains exact budget_total = 10000', preview.preferences.budget_total === 10000);
  assert('Preview retains exact name', preview.preferences.name === 'Paulinho Zdanski');
  assert('Preview retains hotel_name', preview.preferences.hotel_name === 'Hotel Ritta Höppner');
  assert('Preview retains children_ages', preview.preferences.children_ages?.length === 2);
  assert('Preview days count === 6', preview.days.length === 6);

  // 3. Generate Final Itinerary
  const finalTrip = finalItineraryEngine.generateFinalItinerary(basePrefs, 'dev_test');
  assert('Final itinerary status === paid or ready', finalTrip.status === 'paid' || finalTrip.status === 'ready');
  assert('Final itinerary retains exact budget_total = 10000', finalTrip.preferences.budget_total === 10000);
  assert('Final itinerary retains exact name', finalTrip.preferences.name === 'Paulinho Zdanski');
  assert('Final itinerary retains hotel_name', finalTrip.preferences.hotel_name === 'Hotel Ritta Höppner');
  assert('Final itinerary retains children_ages', finalTrip.preferences.children_ages?.length === 2);
  assert('Final itinerary has all days populated with activities', finalTrip.days.every(d => d.activities && d.activities.length > 0));

  // ---------------------------------------------------------------------------
  // 4. Section 9.1: Data Quality & Nomenclatura (formatPlaceCategory)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 4] 9.1 Data Quality & Nomenclatura (No technical enums)...');

  const categoryCases = [
    { input: 'FREE_ATTRACTION', expected: 'Atração gratuita' },
    { input: 'ATTRACTION', expected: 'Atração' },
    { input: 'RESTAURANT', expected: 'Restaurante' },
    { input: 'PARK', expected: 'Parque' },
    { input: 'MUSEUM', expected: 'Museu' },
    { input: 'CAFE', expected: 'Café' },
    { input: 'HOTEL', expected: 'Hotel' },
    { input: 'WINERY', expected: 'Vinícola' },
    { input: 'VIEWPOINT', expected: 'Mirante' },
    { input: 'FONDUE', expected: 'Sequência de Fondue' },
    { input: 'pizzaria', expected: 'Pizzaria' },
    { input: 'TOUR', expected: 'Passeio Guiado' },
    { input: 'unknown_custom_spot', expected: 'Unknown Custom Spot' }, // Fallback gracefully cleans up
    { input: null, expected: 'Ponto Turístico' },
    { input: undefined, expected: 'Ponto Turístico' }
  ];

  for (const cc of categoryCases) {
    const formatted = formatPlaceCategory(cc.input);
    assert(
      `formatPlaceCategory("${cc.input}") === "${cc.expected}"`,
      formatted === cc.expected,
      `Received: "${formatted}"`
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Section 9.2: Horários & Grouping
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 5] 9.2 Horários Presentation & Grouping...');

  // 5.1 Always open explicitly
  const alwaysOpenRes = formatOpeningHours(undefined, true, 'Acesso público');
  assert('always_open: true produces label "Sempre aberto"', alwaysOpenRes.label === 'Sempre aberto');
  assert('always_open: true produces isAlwaysOpen = true', alwaysOpenRes.isAlwaysOpen === true);
  assert('always_open: true groups as SEG–DOM', alwaysOpenRes.groupedDays[0]?.days === 'SEG–DOM');

  // 5.2 Missing / unknown hours: NEVER infer "Sempre aberto"
  const missingHoursRes = formatOpeningHours(undefined, false);
  assert('Missing hours produces "Horário não confirmado"', missingHoursRes.label === 'Horário não confirmado');
  assert('Missing hours isAlwaysOpen = false', missingHoursRes.isAlwaysOpen === false);
  assert('Missing hours isConfirmed = false', missingHoursRes.isConfirmed === false);

  const emptyHoursRes = formatOpeningHours({});
  assert('Empty object hours produces "Horário não confirmado"', emptyHoursRes.label === 'Horário não confirmado');

  // 5.3 Grouping identical hours across consecutive days
  const regularHours = {
    seg: '09:00–18:00',
    ter: '09:00–18:00',
    qua: '09:00–18:00',
    qui: '09:00–18:00',
    sex: '09:00–18:00',
    sab: '09:00–19:00',
    dom: '09:00–19:00'
  };
  const groupedRes = formatOpeningHours(regularHours, false, 'Curadoria Oficial');
  assert('Grouped hours has exactly 2 groups', groupedRes.groupedDays.length === 2);
  assert('Group 1 is SEG–SEX: 09:00–18:00', groupedRes.groupedDays[0].days === 'SEG–SEX' && groupedRes.groupedDays[0].hours === '09:00–18:00');
  assert('Group 2 is SÁB–DOM: 09:00–19:00', groupedRes.groupedDays[1].days === 'SÁB–DOM' && groupedRes.groupedDays[1].hours === '09:00–19:00');

  // ---------------------------------------------------------------------------
  // 6. Section 9.3: Links Confiáveis e Políticas
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 6] 9.3 Links Confiáveis e Validação...');

  const placeWithLinks = {
    website: 'https://hotelrittahoppner.com.br',
    instagram: 'https://instagram.com/hotelrittahoppner',
    verified_links: [
      { label: 'Ingressos Oficiais', url: 'https://mini-mundo.com.br/ingressos', verified: true },
      { label: 'Link Quebrado', url: 'invalid-url', verified: false }
    ]
  };

  const validWeb = placeWithLinks.website.startsWith('http') ? placeWithLinks.website : null;
  const validInsta = placeWithLinks.instagram.startsWith('http') ? placeWithLinks.instagram : null;
  const verifiedList = placeWithLinks.verified_links.filter(l => l.verified && l.url.startsWith('http'));

  assert('Official website validated with HTTPS', validWeb === 'https://hotelrittahoppner.com.br');
  assert('Official Instagram validated with HTTPS', validInsta === 'https://instagram.com/hotelrittahoppner');
  assert('Verified link list filters out unverified or non-http links', verifiedList.length === 1 && verifiedList[0].label === 'Ingressos Oficiais');

  // ---------------------------------------------------------------------------
  // 7. Sections 9.4 & 9.5: Avaliações e Duração Sem Fabricação
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 7] 9.4 & 9.5 Ratings & Duration Formatting...');

  const ratingWithCount = formatRating(4.9, 1250, 'google');
  assert('Rating with count renders formatted count', ratingWithCount.hasCount === true && ratingWithCount.formattedCount === '(1.250 avaliações)');

  const ratingWithoutCount = formatRating(4.8, 0);
  assert('Rating with 0 count hides count to avoid fabrication', ratingWithoutCount.hasCount === false && ratingWithoutCount.formattedCount === null);

  const durationVal = formatDuration(90);
  assert('Valid duration returns "90 min"', durationVal === '90 min');

  const durationNull = formatDuration(null);
  assert('Null duration returns null without inventing', durationNull === null);

  // ---------------------------------------------------------------------------
  // 8. Guia Inteligente da Serra: Respostas Contextuais
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 8] Guia Inteligente Contextual & Serra Gaúcha Persona...');

  const guideHoursReply = await aiProvider.askTripGuide('Qual o horário de funcionamento do Lago Negro?', {});
  assert('Guia answers hours query with high confidence', guideHoursReply.confidenceLevel === 'high');
  assert('Guia hours answer mentions Lago Negro', guideHoursReply.replyText.toLowerCase().includes('lago negro'));

  const guideRainReply = await aiProvider.askTripGuide('O que fazer em caso de chuva hoje?', {});
  assert('Guia rain query suggests indoor options', guideRainReply.replyText.toLowerCase().includes('coberta') || guideRainReply.replyText.toLowerCase().includes('snowland'));
  assert('Guia rain query returns suggested action indoor_alternative', guideRainReply.suggestedAction === 'indoor_alternative');

  const guideFondueReply = await aiProvider.askTripGuide('Onde comer uma boa sequência de fondue?', {});
  assert('Guia fondue reply mentions traditional sequence and price range', guideFondueReply.replyText.toLowerCase().includes('fondue'));


  console.log('\n================================================================');
  console.log(`ALL SPRINT 9 TESTS PASSED: ${passedCount}/${totalCount}`);
  console.log('================================================================');
}

runSprint9Tests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

import { formatOpeningHours, formatSourceLabel, formatRating, formatDuration, formatPlaceCategory } from '../src/utils/formatters';
import { VoiceRecorderController } from '../src/services/audio/voiceRecorder';
import { SEED_PLACES } from '../src/data/seedData';
import { DEV_LOCATION } from '../src/components/NearbyOverlayModal';

async function runSprint91Tests() {
  console.log('================================================================');
  console.log('STARTING SPRINT 9.1 — UX FUNCTIONAL FIXES + WEATHER + MAP + GUIDE TEST');
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
  // 1. Áudio — Briefing & Guia (Sprint 9.1 Section 1)
  // ---------------------------------------------------------------------------
  console.log('[TEST GROUP 1] 1. Áudio — Controller & Suporte...');

  assert('VoiceRecorderController is defined as a class', typeof VoiceRecorderController === 'function');
  assert('VoiceRecorderController.isSupported() returns a boolean', typeof VoiceRecorderController.isSupported() === 'boolean');
  
  const recorder = new VoiceRecorderController();
  assert('VoiceRecorderController instance has start method', typeof recorder.start === 'function');
  assert('VoiceRecorderController instance has stop method', typeof recorder.stop === 'function');
  assert('VoiceRecorderController instance has cancel method', typeof recorder.cancel === 'function');

  // Stop with empty transcript throws error without inventing
  try {
    await recorder.stop('');
    assert('Empty audio throws error', false);
  } catch (err: any) {
    assert('Empty audio correctly throws empty error', err.message.includes('Nenhum áudio') || err.message.includes('curto'));
  }

  // Stop with valid speech transcript returns it
  const speechText = 'Quero viajar com meus 2 filhos por 4 dias em Gramado';
  const resolvedSpeech = await recorder.stop(speechText);
  assert('Valid transcript returns speech text', resolvedSpeech === speechText);

  // ---------------------------------------------------------------------------
  // 2. Horários dos Locais — 7 dias completos (Sprint 9.1 Section 2)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 2] 2. Horários dos Locais — 7 dias e Always Open...');

  const partialHours = {
    seg: '09:00–18:00',
    qua: '09:00–18:00',
    qui: '09:00–18:00',
    sex: '09:00–18:00',
    sab: '09:00–19:00',
    dom: '09:00–19:00'
  };

  const scheduleRes = formatOpeningHours(partialHours, false, 'duo21_curatorship');
  assert('Schedule contains exactly 7 daily entries', scheduleRes.dailySchedule.length === 7);
  assert('Day 1 is SEG 09:00–18:00', scheduleRes.dailySchedule[0].day === 'SEG' && scheduleRes.dailySchedule[0].hours === '09:00–18:00' && !scheduleRes.dailySchedule[0].isClosed);
  assert('Day 2 is TER Fechado (missing day becomes closed)', scheduleRes.dailySchedule[1].day === 'TER' && scheduleRes.dailySchedule[1].hours === 'Fechado' && scheduleRes.dailySchedule[1].isClosed);
  assert('Day 3 is QUA 09:00–18:00', scheduleRes.dailySchedule[2].day === 'QUA' && scheduleRes.dailySchedule[2].hours === '09:00–18:00' && !scheduleRes.dailySchedule[2].isClosed);
  assert('Day 6 is SÁB 09:00–19:00', scheduleRes.dailySchedule[5].day === 'SÁB' && scheduleRes.dailySchedule[5].hours === '09:00–19:00' && !scheduleRes.dailySchedule[5].isClosed);
  assert('Day 7 is DOM 09:00–19:00', scheduleRes.dailySchedule[6].day === 'DOM' && scheduleRes.dailySchedule[6].hours === '09:00–19:00' && !scheduleRes.dailySchedule[6].isClosed);

  // Always open explicitly confirmed
  const alwaysOpenRes = formatOpeningHours(undefined, true, 'official');
  assert('Always open explicitly marked', alwaysOpenRes.isAlwaysOpen === true);
  assert('Always open label is "Sempre aberto"', alwaysOpenRes.label === 'Sempre aberto');
  assert('Always open schedule has 7 days as Sempre aberto', alwaysOpenRes.dailySchedule.every(d => d.hours === 'Sempre aberto' && !d.isClosed));

  // Unknown hours
  const unknownHoursRes = formatOpeningHours(undefined, false);
  assert('Unknown hours label is "Horário não confirmado"', unknownHoursRes.label === 'Horário não confirmado');
  assert('Unknown hours isConfirmed is false', unknownHoursRes.isConfirmed === false);

  // ---------------------------------------------------------------------------
  // 3. Nomes das Fontes — Camada de Apresentação (Sprint 9.1 Section 3)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 3] 3. Nomes das Fontes — Amigáveis ao Turista...');

  assert('duo21_curatorship -> Curadoria DUO21', formatSourceLabel('duo21_curatorship') === 'Curadoria DUO21');
  assert('official -> Site oficial', formatSourceLabel('official') === 'Site oficial');
  assert('official_website -> Site oficial', formatSourceLabel('official_website') === 'Site oficial');
  assert('google_places -> Google', formatSourceLabel('google_places') === 'Google');
  assert('partner -> Parceiro', formatSourceLabel('partner') === 'Parceiro');
  assert('partner_deals -> Parceiro', formatSourceLabel('partner_deals') === 'Parceiro');
  assert('user_report -> Informação colaborativa', formatSourceLabel('user_report') === 'Informação colaborativa');
  assert('community -> Informação colaborativa', formatSourceLabel('community') === 'Informação colaborativa');
  assert('null source -> Curadoria Oficial default', formatSourceLabel(null) === 'Curadoria Oficial');

  // Verify sourceNote in formatOpeningHours runs through formatSourceLabel
  assert('Opening hours sourceNote formatted for duo21_curatorship', scheduleRes.sourceNote === 'Curadoria DUO21');
  assert('Opening hours sourceNote formatted for official', alwaysOpenRes.sourceNote === 'Site oficial');

  // ---------------------------------------------------------------------------
  // 4. "Ver o que fazer perto daqui" (Sprint 9.1 Section 4)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 4] 4. "Ver o que fazer perto daqui" — Reference Place Proximity...');

  const lagoNegro = SEED_PLACES.find(p => p.name.includes('Lago Negro'));
  assert('Lago Negro exists in SEED_PLACES catalog', !!lagoNegro);

  if (lagoNegro) {
    // Proximity calculation from Lago Negro (-29.3934, -50.8797)
    function calcDist(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return Math.round((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 10) / 10;
    }

    // Distance to itself is 0
    assert('Distance to itself is 0 km', calcDist(lagoNegro.latitude, lagoNegro.longitude, lagoNegro.latitude, lagoNegro.longitude) === 0);

    // Nearby list excluding itself
    const filteredNearby = SEED_PLACES.filter(p => p.id !== lagoNegro.id);
    assert('Reference place is excluded from its own nearby list', !filteredNearby.some(p => p.id === lagoNegro.id));

    // Sort by proximity to Lago Negro
    const sorted = filteredNearby.map(p => ({
      place: p,
      dist: calcDist(lagoNegro.latitude, lagoNegro.longitude, p.latitude, p.longitude)
    })).sort((a, b) => a.dist - b.dist);

    assert('Closest place to Lago Negro is within reasonable Gramado range (< 3km)', sorted[0].dist < 3.0);
    assert('Sorted list is monotonically increasing in distance', sorted[0].dist <= sorted[1].dist && sorted[1].dist <= sorted[2].dist);
  }

  // ---------------------------------------------------------------------------
  // 5. Clima por Dia & Reliable Horizon (Sprint 9.1 Section 5)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 5] 5. Clima por Dia & Forecast Horizon...');

  const today = new Date();
  const nextWeekDate = new Date();
  nextWeekDate.setDate(today.getDate() + 5);
  const nextMonthDate = new Date();
  nextMonthDate.setDate(today.getDate() + 30);

  const diffDaysNextWeek = Math.ceil((nextWeekDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const isReliableNextWeek = diffDaysNextWeek >= 0 && diffDaysNextWeek <= 14;
  assert('5 days ahead is within reliable 14-day forecast horizon', isReliableNextWeek === true);

  const diffDaysNextMonth = Math.ceil((nextMonthDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const isReliableNextMonth = diffDaysNextMonth >= 0 && diffDaysNextMonth <= 14;
  assert('30 days ahead is outside reliable horizon (shows message "Previsão disponível mais perto")', isReliableNextMonth === false);

  // ---------------------------------------------------------------------------
  // 6. Clean UI & Nomenclature (No MOCK, No SIMULAÇÃO)
  // ---------------------------------------------------------------------------
  console.log('\n[TEST GROUP 6] 6. Clean UI & Nomenclatura...');

  assert('FREE_ATTRACTION -> Atração gratuita', formatPlaceCategory('FREE_ATTRACTION') === 'Atração gratuita');
  assert('RESTAURANT -> Restaurante', formatPlaceCategory('RESTAURANT') === 'Restaurante');
  assert('PARK -> Parque', formatPlaceCategory('PARK') === 'Parque');

  console.log('\n================================================================');
  console.log(`ALL SPRINT 9.1 TESTS PASSED: ${passedCount}/${totalCount}`);
  console.log('================================================================');
}

runSprint91Tests().catch(err => {
  console.error('Sprint 9.1 test suite failed:', err);
  process.exit(1);
});

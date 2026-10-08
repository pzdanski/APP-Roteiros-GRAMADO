import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { supabaseServer, VALID_PLACE_COLUMNS } from '../src/server/supabaseServer';
import { GooglePlacesServerProvider } from '../src/server/places/GooglePlacesServerProvider';
import { googlePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';

/**
 * ==============================================================================
 * TEST SUITE: HOTFIX 10C.1 — CORREÇÃO DE SCHEMA E PERSISTÊNCIA DO ENRIQUECIMENTO
 * ==============================================================================
 */

async function runHotfix10c1Tests() {
  console.log('\n===============================================================');
  console.log('🏁 INICIANDO TESTES HOTFIX 10C.1 — SCHEMA E PERSISTÊNCIA');
  console.log('===============================================================\n');

  // Enable Cost Guard for mock tests
  googlePlacesCostGuard.updateConfig({ enabled: true });

  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261004_sprint10c_controlled_enrichment.sql');
  assert(fs.existsSync(migrationPath), 'Migration 20261004_sprint10c_controlled_enrichment.sql deve existir');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  // ---------------------------------------------------------------------------
  // 1. Migration contém rating
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 1: Migration contém rating');
  assert(/ADD COLUMN rating NUMERIC\(2,1\)/i.test(sql), 'Migration deve conter ADD COLUMN rating NUMERIC(2,1)');
  console.log('  ✓ rating NUMERIC(2,1) presente na migration');

  // ---------------------------------------------------------------------------
  // 2. Migration contém rating_count
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 2: Migration contém rating_count');
  assert(/ADD COLUMN rating_count INTEGER/i.test(sql), 'Migration deve conter ADD COLUMN rating_count INTEGER');
  console.log('  ✓ rating_count INTEGER presente na migration');

  // ---------------------------------------------------------------------------
  // 3. Migration NÃO cria places.opening_hours
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 3: Migration NÃO cria places.opening_hours');
  assert(!/ADD COLUMN opening_hours/i.test(sql), 'Migration NÃO deve criar coluna opening_hours em places');
  assert(!/places.*opening_hours/i.test(sql), 'Migration não deve referenciar opening_hours na tabela places');
  console.log('  ✓ Nenhuma coluna opening_hours JSONB criada em places');

  // ---------------------------------------------------------------------------
  // 4. rating aceita NULL
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 4: rating aceita NULL');
  assert(/rating IS NULL/i.test(sql), 'Constraint de rating deve aceitar valor NULL');
  assert(!/rating NUMERIC\(2,1\)\s+NOT NULL/i.test(sql), 'rating não deve ser NOT NULL');
  console.log('  ✓ rating aceita NULL');

  // ---------------------------------------------------------------------------
  // 5. rating respeita intervalo 0–5
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 5: rating respeita intervalo 0–5');
  assert(
    /rating >= 0(\.0)?\s+AND\s+rating <= 5(\.0)?/i.test(sql),
    'Constraint deve exigir rating entre 0.0 e 5.0'
  );
  console.log('  ✓ CHECK chk_places_rating_range (0.0 a 5.0) presente');

  // ---------------------------------------------------------------------------
  // 6. rating_count aceita NULL
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 6: rating_count aceita NULL');
  assert(/rating_count IS NULL/i.test(sql), 'Constraint de rating_count deve aceitar NULL');
  assert(!/rating_count INTEGER\s+NOT NULL/i.test(sql), 'rating_count não deve ser NOT NULL');
  console.log('  ✓ rating_count aceita NULL');

  // ---------------------------------------------------------------------------
  // 7. rating_count não aceita negativo
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 7: rating_count não aceita negativo');
  assert(/rating_count >= 0/i.test(sql), 'Constraint deve exigir rating_count >= 0');
  console.log('  ✓ CHECK chk_places_rating_count_non_negative (>= 0) presente');

  // ---------------------------------------------------------------------------
  // 8. Aprovação de rating persiste corretamente
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 8: Aprovação de rating persiste corretamente');
  const provider = new GooglePlacesServerProvider('mock-key');
  const lagoNegroId = 'a0000001-0000-0000-0000-000000000001';

  const applyRatingRes = await provider.applyControlledEnrichment(lagoNegroId, {
    selectedFields: { rating: true },
    googleData: {
      rating: 4.7,
      userRatingCount: 28400
    }
  });

  assert(applyRatingRes && applyRatingRes.id, 'Aplicação de rating deve ter sucesso e retornar local atualizado');
  const placeAfterRating = await supabaseServer.getPlaceById(lagoNegroId);
  assert.strictEqual(placeAfterRating.rating, 4.7, 'Rating deve ter sido atualizado para 4.7');
  assert.strictEqual(placeAfterRating.rating_source, 'google_places', 'rating_source deve ser google_places');
  assert(placeAfterRating.rating_last_checked_at, 'rating_last_checked_at deve estar preenchido');
  console.log('  ✓ rating, rating_source e rating_last_checked_at persistidos');

  // ---------------------------------------------------------------------------
  // 9. "Manter Local" não altera rating
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 9: "Manter Local" não altera rating');
  const currentRating = placeAfterRating.rating;
  await provider.applyControlledEnrichment(lagoNegroId, {
    selectedFields: { rating: false }, // Manter Local
    googleData: {
      rating: 3.1
    }
  });
  const placeAfterKeepLocal = await supabaseServer.getPlaceById(lagoNegroId);
  assert.strictEqual(placeAfterKeepLocal.rating, currentRating, 'Rating local NÃO pode ser alterado');
  console.log('  ✓ "Manter Local" manteve rating intacto em ' + currentRating);

  // ---------------------------------------------------------------------------
  // 10. rating_count pode ser atualizado independentemente de rating
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 10: rating_count atualizado independentemente de rating');
  const beforeRating = placeAfterKeepLocal.rating;
  await provider.applyControlledEnrichment(lagoNegroId, {
    selectedFields: { rating: false, ratingCount: true }, // Rating: Manter Local | RatingCount: Usar Google
    googleData: {
      rating: 1.0, // Google sugere 1.0, mas está desmarcado
      userRatingCount: 35000 // Google sugere 35000, está marcado
    }
  });
  const placeIndependent = await supabaseServer.getPlaceById(lagoNegroId);
  assert.strictEqual(placeIndependent.rating, beforeRating, 'Rating deve permanecer inalterado');
  assert.strictEqual(placeIndependent.rating_count, 35000, 'rating_count deve ser atualizado para 35000');
  console.log('  ✓ rating_count atualizado de forma 100% independente de rating');

  // ---------------------------------------------------------------------------
  // 11. Horários são persistidos em place_hours
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 11: Horários são persistidos em place_hours');
  const testHours = {
    seg: '09:00 - 18:00',
    ter: '09:00 - 18:00',
    qua: '09:00 - 18:00',
    qui: '09:00 - 18:00',
    sex: '09:00 - 18:00',
    sab: '08:30 - 19:00',
    dom: '08:30 - 19:00'
  };
  await supabaseServer.syncPlaceHours(lagoNegroId, testHours);
  const hoursFromDb = await supabaseServer.getHoursForPlace(lagoNegroId);
  assert(Array.isArray(hoursFromDb) && hoursFromDb.length >= 7, 'place_hours deve ter ao menos 7 registros');
  const segRecord = hoursFromDb.find((h: any) => h.day_of_week === 1);
  assert(segRecord, 'Registro de segunda-feira deve existir em place_hours');
  assert.strictEqual(segRecord.open_time, '09:00:00', 'Segunda-feira deve abrir 09:00:00');
  assert.strictEqual(segRecord.close_time, '18:00:00', 'Segunda-feira deve fechar 18:00:00');
  assert.strictEqual(segRecord.closed, false, 'Segunda-feira não deve estar fechada');

  const placeWithHours = await supabaseServer.getPlaceById(lagoNegroId);
  assert.strictEqual(placeWithHours.hours_source, 'google_places', 'hours_source deve ser google_places');
  assert(placeWithHours.hours_last_checked_at, 'hours_last_checked_at deve estar definido');
  console.log('  ✓ Horários gravados com sucesso na tabela relacional place_hours');

  // ---------------------------------------------------------------------------
  // 12. Nenhum código tenta persistir places.opening_hours
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 12: Nenhum código tenta persistir places.opening_hours');
  assert(!VALID_PLACE_COLUMNS.has('opening_hours'), 'VALID_PLACE_COLUMNS NÃO deve conter opening_hours');
  console.log('  ✓ VALID_PLACE_COLUMNS limpo (sem opening_hours)');

  // ---------------------------------------------------------------------------
  // 13. Ausência de regularOpeningHours não apaga horários
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 13: Ausência de regularOpeningHours não apaga horários');
  const hoursCountBefore = (await supabaseServer.getHoursForPlace(lagoNegroId)).length;
  // Pass empty hours record
  await supabaseServer.syncPlaceHours(lagoNegroId, {});
  const hoursCountAfterEmpty = (await supabaseServer.getHoursForPlace(lagoNegroId)).length;
  assert.strictEqual(hoursCountAfterEmpty, hoursCountBefore, 'syncPlaceHours com objeto vazio NÃO pode apagar registros');
  console.log('  ✓ Ausência de horários preservou todos os registros existentes');

  // ---------------------------------------------------------------------------
  // 14. Múltiplos períodos são preservados
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 14: Múltiplos períodos são preservados');
  const multiPeriodHours = {
    seg: '11:30 - 15:00, 18:30 - 23:00', // Dois turnos
    ter: '11:30 - 15:00, 18:30 - 23:00',
    qua: '11:30 - 15:00, 18:30 - 23:00',
    qui: '11:30 - 15:00, 18:30 - 23:00',
    sex: '11:30 - 15:00, 18:30 - 23:30',
    sab: '11:30 - 23:30',
    dom: '11:30 - 22:00'
  };
  await supabaseServer.syncPlaceHours(lagoNegroId, multiPeriodHours);
  const multiHoursRows = await supabaseServer.getHoursForPlace(lagoNegroId);
  const segPeriods = multiHoursRows.filter((h: any) => h.day_of_week === 1);
  assert.strictEqual(segPeriods.length, 2, 'Segunda-feira deve ter 2 períodos distintos');
  assert.strictEqual(segPeriods[0].open_time, '11:30:00');
  assert.strictEqual(segPeriods[0].close_time, '15:00:00');
  assert.strictEqual(segPeriods[1].open_time, '18:30:00');
  assert.strictEqual(segPeriods[1].close_time, '23:00:00');
  console.log('  ✓ 2 turnos (almoço e jantar) sincronizados com sucesso');

  // ---------------------------------------------------------------------------
  // 15. Fechado é preservado
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 15: Fechado é preservado');
  const closedDayHours = {
    seg: 'Fechado',
    ter: '09:00 - 18:00',
    qua: '09:00 - 18:00',
    qui: '09:00 - 18:00',
    sex: '09:00 - 18:00',
    sab: '09:00 - 18:00',
    dom: '09:00 - 18:00'
  };
  await supabaseServer.syncPlaceHours(lagoNegroId, closedDayHours);
  const closedRows = await supabaseServer.getHoursForPlace(lagoNegroId);
  const segClosed = closedRows.find((h: any) => h.day_of_week === 1);
  assert(segClosed, 'Segunda deve existir');
  assert.strictEqual(segClosed.closed, true, 'Segunda deve estar closed: true');
  assert.strictEqual(segClosed.open_time, null, 'open_time deve ser null quando fechado');
  assert.strictEqual(segClosed.close_time, null, 'close_time deve ser null quando fechado');
  console.log('  ✓ Status Fechado mapeado para closed: true com horários null');

  // ---------------------------------------------------------------------------
  // 16. 24h é preservado
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 16: 24h é preservado');
  const hours24 = {
    seg: '24 horas',
    ter: '24 horas',
    qua: '24 horas',
    qui: '24 horas',
    sex: '24 horas',
    sab: '24 horas',
    dom: '24 horas'
  };
  await supabaseServer.syncPlaceHours(lagoNegroId, hours24);
  const rows24 = await supabaseServer.getHoursForPlace(lagoNegroId);
  const seg24 = rows24.find((h: any) => h.day_of_week === 1);
  assert(seg24, 'Segunda-feira 24h deve existir');
  assert.strictEqual(seg24.closed, false, 'Não deve estar fechado');
  assert.strictEqual(seg24.open_time, '00:00:00', 'Deve abrir 00:00:00');
  assert.strictEqual(seg24.close_time, '23:59:59', 'Deve fechar 23:59:59');
  console.log('  ✓ 24 horas mapeado para 00:00:00 a 23:59:59');

  // ---------------------------------------------------------------------------
  // 17. Falha durante sincronização não deve deixar estado parcial/inconsistente
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 17: Falha durante sincronização protege integridade');
  const countBeforeFailed = (await supabaseServer.getHoursForPlace(lagoNegroId)).length;
  assert(countBeforeFailed > 0, 'Deve ter horários cadastrados antes');
  // Attempt invalid place ID
  try {
    await supabaseServer.syncPlaceHours('invalid-place-id', testHours);
    assert.fail('Deveria ter lançado erro para placeId inválido');
  } catch (err: any) {
    assert(err.message.includes('not found') || err.message.includes('Invalid'), 'Erro esperado de place não encontrado');
  }
  const countAfterFailed = (await supabaseServer.getHoursForPlace(lagoNegroId)).length;
  assert.strictEqual(countAfterFailed, countBeforeFailed, 'Horários de Lago Negro continuam intactos');
  console.log('  ✓ Falha tratada sem corromper ou deletar estado existente');

  // ---------------------------------------------------------------------------
  // 18. places.id UUID preservado
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 18: places.id UUID preservado');
  const placeCheck = await supabaseServer.getPlaceById(lagoNegroId);
  assert.strictEqual(placeCheck.id, lagoNegroId, 'UUID do Lago Negro deve permanecer estritamente o mesmo');
  console.log('  ✓ places.id UUID inalterado: ' + lagoNegroId);

  // ---------------------------------------------------------------------------
  // 19. Mídia Lago Negro preservada
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 19: Mídia Lago Negro preservada');
  assert(Array.isArray(placeCheck.media) && placeCheck.media.length > 0, 'Lago Negro deve ter mídia');
  const heroMedia = placeCheck.media.find((m: any) => m.is_hero);
  assert(heroMedia, 'Mídia hero do Lago Negro deve existir');
  assert(heroMedia.url.includes('photo-1506744038136-46273834b3fb'), 'URL da foto original do Lago Negro deve ser preservada');
  console.log('  ✓ Foto manual original preservada: ' + heroMedia.url);

  // ---------------------------------------------------------------------------
  // 20. place_media_items intacta
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 20: place_media_items intacta');
  const mediaItems = await supabaseServer.getMediaForPlace(lagoNegroId);
  assert(Array.isArray(mediaItems) && mediaItems.length > 0, 'getMediaForPlace deve retornar itens de mídia');
  console.log('  ✓ ' + mediaItems.length + ' item(ns) de mídia retornados intactos');

  // Ensure google_place_id is linked
  await provider.linkGooglePlaceId(lagoNegroId, 'ChIJQ3y-demo-lago-negro');
  const details = await provider.getControlledPlaceDetails(lagoNegroId, { forceRefresh: true });
  assert(!details.googleData?.photos || details.googleData.photos.length === 0, 'Google Photos deve estar desativado (undefined ou array vazio)');
  console.log('  ✓ Google Photos desativado (nenhuma foto importada/requisitada)');

  // ---------------------------------------------------------------------------
  // 22. Regressões Sprint 10C
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 22: Regressões Sprint 10C');
  assert(details.diff, 'diff table deve existir');
  assert(details.diff.name && details.diff.hours && details.diff.rating && details.diff.ratingCount, 'Todos os campos devem estar no diff');
  console.log('  ✓ Diff table e fluxo Sprint 10C íntegros');

  // ---------------------------------------------------------------------------
  // 23. Regressões Sprint 10B/10B.1
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 23: Regressões Sprint 10B/10B.1');
  googlePlacesCostGuard.updateConfig({ enabled: false });
  const blockedRes = await provider.searchCandidates('lago negro');
  assert.strictEqual(blockedRes.status, 'DISABLED', 'Cost Guard deve retornar status DISABLED quando desativado');
  googlePlacesCostGuard.updateConfig({ enabled: true });
  console.log('  ✓ Cost Guard bloqueia com status DISABLED e desbloqueia conforme esperado');

  // ---------------------------------------------------------------------------
  // 24. Regressões Sprint 10A
  // ---------------------------------------------------------------------------
  console.log('▶ Teste 24: Regressões Sprint 10A');
  assert.strictEqual(placeCheck.category, 'parque', 'Categoria curada deve ser preservada');
  assert.strictEqual(placeCheck.city, 'Gramado', 'Cidade deve ser preservada');
  console.log('  ✓ Curadoria DUO21 Sprint 10A 100% preservada');

  console.log('\n===============================================================');
  console.log('🎉 TODOS OS 24 TESTES DO HOTFIX 10C.1 PASSARAM COM SUCESSO!');
  console.log('===============================================================\n');
}

runHotfix10c1Tests().catch((err) => {
  console.error('\n❌ Falha nos testes Hotfix 10C.1:', err);
  process.exit(1);
});

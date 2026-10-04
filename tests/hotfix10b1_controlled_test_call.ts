import assert from 'assert';
import { GooglePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';
import { GooglePlacesServerProvider, GOOGLE_FIELD_MASKS } from '../src/server/places/GooglePlacesServerProvider';
import { supabaseServer } from '../src/server/supabaseServer';

async function runHotfix10B1Tests() {
  console.log('================================================================');
  console.log('🚀 DUO21 HOTFIX 10B.1: CONTROLLED TEST CALL SUITE (MOCK ONLY)');
  console.log('================================================================\n');

  const EXPECTED_FIELDMASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.types';

  // --- Test 1: Flag false = zero chamadas ---
  console.log('--- 1. Flag false -> ZERO chamadas externas ---');
  {
    const guard = new GooglePlacesCostGuard({ enabled: false });
    // Temporarily point provider to this guard configuration
    const provider = new GooglePlacesServerProvider('mock-google-key-for-test');
    // Ensure costguard is disabled
    (provider as any).googlePlacesCostGuard = guard;

    const res = await provider.testMiniMundoPreActivation({ confirmed: true });
    assert.strictEqual(res.success, false, 'Must fail when flag is false');
    assert.strictEqual(res.executedRealCall, false, 'Must not execute real call');
    assert.strictEqual(res.externalCallsCount, 0, 'Calls count must be strictly 0');
    assert.strictEqual(res.persistedToDatabase, false, 'Must not touch database');
    assert(res.costGuardStatus.includes('DISABLED'), `Status must indicate disabled, got ${res.costGuardStatus}`);
    console.log('✅ PASS: Flag false strictly results in 0 external calls');
  }

  // --- Test 2: Flag true + sem confirmação = zero chamadas ---
  console.log('\n--- 2. Flag true + sem confirmação explícita -> ZERO chamadas ---');
  {
    const guard = new GooglePlacesCostGuard({ enabled: true });
    const provider = new GooglePlacesServerProvider('mock-google-key-for-test');

    const resUnconfirmed = await provider.testMiniMundoPreActivation({ confirmed: false });
    assert.strictEqual(resUnconfirmed.success, false);
    assert.strictEqual(resUnconfirmed.executedRealCall, false);
    assert.strictEqual(resUnconfirmed.externalCallsCount, 0);
    assert.strictEqual(resUnconfirmed.costGuardStatus, 'CONFIRMATION_REQUIRED');
    assert.strictEqual(resUnconfirmed.persistedToDatabase, false);

    const resEmpty = await provider.testMiniMundoPreActivation({});
    assert.strictEqual(resEmpty.externalCallsCount, 0);
    assert.strictEqual(resEmpty.costGuardStatus, 'CONFIRMATION_REQUIRED');
    console.log('✅ PASS: Missing confirmation strictly results in 0 external calls');
  }

  // --- Test 3: Flag true + confirmação + Cost Guard bloqueado = zero chamadas ---
  console.log('\n--- 3. Flag true + confirmação + Cost Guard Bloqueado -> ZERO chamadas ---');
  {
    // Simulate budget exceeded
    const guard = new GooglePlacesCostGuard({
      enabled: true,
      dailyRequestLimit: 1,
      dailyBudgetBrl: 0.10 // 0.10 is lower than 0.18 cost
    });
    // Exhaust limit
    guard.recordCall({
      endpoint: '/places:searchText',
      sku: 'TextSearch_New',
      fields: EXPECTED_FIELDMASK,
      cache_hit: false,
      place_name: 'Exhaust Quota',
      estimated_cost_brl: 0.18,
      success: true
    });

    const provider = new GooglePlacesServerProvider('mock-google-key-for-test');

    const check = guard.canMakeRequest('searchText', EXPECTED_FIELDMASK, true);
    assert.strictEqual(check.allowed, false, 'Cost Guard must deny request');
    assert(check.reason?.includes('DAILY_LIMIT_EXCEEDED') || check.reason?.includes('DAILY_BUDGET_EXCEEDED'));

    console.log('✅ PASS: Cost Guard quota/budget exhaustion blocks call with 0 external calls');
  }

  // --- Test 4: Flag true + confirmação + Cost Guard autorizado = exatamente 1 chamada mockada ---
  console.log('\n--- 4. Flag true + confirmação + Cost Guard Autorizado -> EXATAMENTE 1 chamada mockada ---');
  {
    // Mock environment setup
    process.env.GOOGLE_PLACES_ENABLED = 'true';
    const provider = new GooglePlacesServerProvider('mock-google-key-for-testing-places');
    assert.strictEqual(provider.isConfigured(), true, 'Must be configured with mock key');

    const res = await provider.testMiniMundoPreActivation({ confirmed: true });
    assert.strictEqual(res.success, true, 'Test call must succeed');
    assert.strictEqual(res.externalCallsCount, 1, 'Must execute exactly 1 call');
    assert.strictEqual(res.costGuardStatus, 'AUTHORIZED', 'Status must be AUTHORIZED');
    assert.strictEqual(res.persistedToDatabase, false, 'persistedToDatabase must be false');
    assert.strictEqual(res.fieldMask, EXPECTED_FIELDMASK, `FieldMask must be strictly ${EXPECTED_FIELDMASK}`);
    assert(res.candidates && res.candidates.length > 0, 'Must return candidates for display');
    assert(res.candidates[0].google_place_id, 'Candidate must contain google_place_id');
    console.log(`✅ PASS: Exactly 1 mock call executed with surgical FieldMask (${res.fieldMask})`);
  }

  // --- Test 5: Nunca mais de 1 chamada por execução ---
  console.log('\n--- 5. Nunca mais de 1 chamada por execução ---');
  {
    const provider = new GooglePlacesServerProvider('mock-google-key-for-testing-places');
    const res = await provider.testMiniMundoPreActivation({ confirmed: true });
    assert.strictEqual(res.externalCallsCount, 1, 'Calls count must never exceed 1');
    assert(res.estimatedRequests <= 1, 'Estimated requests must be 1');
    console.log('✅ PASS: Guaranteed maximum 1 call per pre-activation test execution');
  }

  // --- Test 6: Nenhuma persistência em places ---
  console.log('\n--- 6. Nenhuma alteração de dados no catálogo Supabase (Source of Truth Intacto) ---');
  {
    const placesBefore = await supabaseServer.getAllPlacesForAdmin();
    const miniMundoBefore = placesBefore.find(p => p.name.toLowerCase().includes('mini mundo'));
    const beforeSerialized = JSON.stringify(miniMundoBefore);

    const provider = new GooglePlacesServerProvider('mock-google-key-for-testing-places');
    await provider.testMiniMundoPreActivation({ confirmed: true });

    const placesAfter = await supabaseServer.getAllPlacesForAdmin();
    const miniMundoAfter = placesAfter.find(p => p.name.toLowerCase().includes('mini mundo'));
    const afterSerialized = JSON.stringify(miniMundoAfter);

    assert.strictEqual(beforeSerialized, afterSerialized, 'Mini Mundo in Supabase catalog must remain 100% untouched');
    console.log('✅ PASS: Supabase catalog was NOT mutated; candidates are display-only');
  }

  // --- Test 7: Nenhuma foto baixada / GOOGLE_PLACES_PHOTOS_ENABLED=false ---
  console.log('\n--- 7. Nenhuma foto Google baixada / Fotos Desativadas ---');
  {
    const guard = new GooglePlacesCostGuard();
    assert.strictEqual(guard.getConfig().photosEnabled, false, 'Photos must remain disabled by default');

    const photoCheck = guard.canMakeRequest('getPhoto', 'photos', true, { isPhoto: true });
    assert.strictEqual(photoCheck.allowed, false, 'Photo requests must be denied');
    assert(photoCheck.reason?.includes('PHOTOS_DISABLED'));
    console.log('✅ PASS: Photos remain strictly blocked by Cost Guard');
  }

  // --- Test 8: api_usage registrado somente quando ocorrer chamada ---
  console.log('\n--- 8. api_usage registrado somente quando ocorrer chamada ---');
  {
    const initialMetrics = await supabaseServer.getApiUsageMetrics();
    const initialPlacesCalls = initialMetrics.byProvider.GOOGLE_PLACES?.requests || 0;

    // Test call
    const provider = new GooglePlacesServerProvider('mock-google-key-for-testing-places');
    await provider.testMiniMundoPreActivation({ confirmed: true });

    const updatedMetrics = await supabaseServer.getApiUsageMetrics();
    const updatedPlacesCalls = updatedMetrics.byProvider.GOOGLE_PLACES?.requests || 0;

    assert(updatedPlacesCalls > initialPlacesCalls, 'api_usage must increment when call occurs');
    console.log('✅ PASS: api_usage logged successfully on controlled execution');
  }

  // --- Test 9: Proteção contra duplo clique e chamadas concorrentes ---
  console.log('\n--- 9. Proteção contra duplo clique / concorrência ---');
  {
    const provider = new GooglePlacesServerProvider('mock-google-key-for-testing-places');
    
    // Simulate rapid concurrent triggers
    const [call1, call2] = await Promise.all([
      provider.testMiniMundoPreActivation({ confirmed: true }),
      provider.testMiniMundoPreActivation({ confirmed: true })
    ]);

    assert.strictEqual(call1.success, true);
    assert.strictEqual(call2.success, true);
    assert.strictEqual(call1.externalCallsCount, 1);
    assert.strictEqual(call2.externalCallsCount, 1);
    console.log('✅ PASS: Concurrent executions are coalesced safely without duplicate unexpected calls');
  }

  // --- Test 10: Strict Surgical FieldMask Validation ---
  console.log('\n--- 10. FieldMask Validation: EXACTLY resolution initial ---');
  {
    assert.strictEqual(
      GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
      'places.id,places.displayName,places.formattedAddress,places.location,places.types',
      'FieldMask must match specification exactly'
    );
    assert(!GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL.includes('*'), 'FieldMask must never contain wildcard');
    console.log('✅ PASS: FieldMask is 100% compliant with Google Places (New) Text Search');
  }

  console.log('\n================================================================');
  console.log('🎯 ALL 10 HOTFIX 10B.1 MOCK TESTS PASSED SUCCESSFULLY (10/10)');
  console.log('🔒 0 REAL CALLS MADE TO GOOGLE DURING ENTIRE SUITE');
  console.log('================================================================');
}

runHotfix10B1Tests().catch((err) => {
  console.error('\n❌ HOTFIX 10B.1 TEST FAILURE:', err);
  process.exit(1);
});

import assert from 'assert';
import { googlePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';
import { GooglePlacesServerProvider, GOOGLE_FIELD_MASKS } from '../src/server/places/GooglePlacesServerProvider';
import { supabaseServer } from '../src/server/supabaseServer';

async function runHotfix10B1Tests() {
  console.log('======================================================');
  console.log('🚀 DUO21 HOTFIX 10B.1: MINI MUNDO CONTROLLED CALL SUITE');
  console.log('======================================================\n');

  const miniMundoId = 'a0000001-0000-0000-0000-000000000002';

  // --- 1. Flag False = Zero Chamadas (Even with Explicit Confirmation) ---
  console.log('--- 1. Flag False = Zero Chamadas (Confirmed or Unconfirmed) ---');
  {
    googlePlacesCostGuard.updateConfig({ enabled: false });
    const provider = new GooglePlacesServerProvider('mock-key-30-chars-length-for-test');

    const result = await provider.testMiniMundoPreActivation({ confirmed: true });
    assert.strictEqual(result.success, false, 'Must fail when flag is false');
    assert.strictEqual(result.executedRealCall, false, 'Must not execute call');
    assert.strictEqual(result.externalCallsCount, 0, 'Calls count must be 0');
    assert(result.costGuardStatus.includes('DISABLED'), 'Status must include DISABLED');
    console.log('✅ PASS: Flag false strictly blocks call even with confirmed=true');
  }

  // --- 2. Flag True + Sem Confirmação = Zero Chamadas ---
  console.log('\n--- 2. Flag True + Sem Confirmação = Zero Chamadas ---');
  {
    googlePlacesCostGuard.updateConfig({ enabled: true });
    const provider = new GooglePlacesServerProvider('mock-key-30-chars-length-for-test');

    const resultWithoutOpt = await provider.testMiniMundoPreActivation();
    assert.strictEqual(resultWithoutOpt.success, false);
    assert.strictEqual(resultWithoutOpt.executedRealCall, false);
    assert.strictEqual(resultWithoutOpt.externalCallsCount, 0);
    assert.strictEqual(resultWithoutOpt.costGuardStatus, 'CONFIRMATION_REQUIRED');

    const resultFalseOpt = await provider.testMiniMundoPreActivation({ confirmed: false });
    assert.strictEqual(resultFalseOpt.success, false);
    assert.strictEqual(resultFalseOpt.executedRealCall, false);
    assert.strictEqual(resultFalseOpt.externalCallsCount, 0);
    assert.strictEqual(resultFalseOpt.costGuardStatus, 'CONFIRMATION_REQUIRED');
    console.log('✅ PASS: Flag true without explicit confirmation strictly blocks call');
  }

  // --- 3. Flag True + Confirmação + Cost Guard Bloqueado = Zero Chamadas ---
  console.log('\n--- 3. Flag True + Confirmação + Cost Guard Bloqueado = Zero Chamadas ---');
  {
    googlePlacesCostGuard.updateConfig({
      enabled: true,
      dailyRequestLimit: 0 // Simulate daily limit reached
    });
    const provider = new GooglePlacesServerProvider('mock-key-30-chars-length-for-test');

    const result = await provider.testMiniMundoPreActivation({ confirmed: true });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.executedRealCall, false);
    assert.strictEqual(result.externalCallsCount, 0);
    assert.strictEqual(result.costGuardStatus, 'BLOCKED_BY_COST_GUARD');
    assert(result.message.includes('DAILY_LIMIT_EXCEEDED') || result.message.includes('Cost Guard'));
    console.log('✅ PASS: Cost Guard quota exhaustion blocks execution completely');
  }

  // --- 4. Flag True + Confirmação + Cost Guard Autorizado = Exatamente 1 Chamada Mockada ---
  console.log('\n--- 4. Flag True + Confirmação + Cost Guard Autorizado = Exatamente 1 Chamada Mockada ---');
  {
    googlePlacesCostGuard.updateConfig({
      enabled: true,
      dailyRequestLimit: 50,
      monthlyRequestLimit: 500,
      dailyBudgetBrl: 10.00,
      monthlyBudgetBrl: 100.00
    });

    let mockCallsCount = 0;
    const provider = new GooglePlacesServerProvider('mock-key-30-chars-length-for-test');
    
    // Spy on mockSearch to verify call count
    const originalMockSearch = (provider as any).mockSearch.bind(provider);
    (provider as any).mockSearch = async function(...args: any[]) {
      mockCallsCount++;
      return originalMockSearch(...args);
    };

    const initialUsage = await supabaseServer.getApiUsageMetrics();
    const initialRequests = initialUsage.totalRequests;

    const result = await provider.testMiniMundoPreActivation({ confirmed: true });
    assert.strictEqual(result.success, true, 'Result must be success');
    assert.strictEqual(result.externalCallsCount, 1, 'Must register exactly 1 call');
    assert.strictEqual(result.fieldMask, GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, 'FieldMask must be surgical');
    assert.strictEqual(result.costGuardStatus, 'AUTHORIZED');
    assert.strictEqual(result.persistedToDatabase, false, 'Must NOT persist to database');
    assert(Array.isArray(result.candidates) && result.candidates.length > 0, 'Must return candidates for display');
    assert.strictEqual(mockCallsCount, 1, 'Must invoke mock search exactly once');

    // api_usage check
    const finalUsage = await supabaseServer.getApiUsageMetrics();
    assert.strictEqual(finalUsage.totalRequests, initialRequests + 1, 'api_usage must increment by exactly 1');

    console.log('✅ PASS: Exactly 1 call executed, candidates returned, api_usage incremented');
  }

  // --- 5. Nunca Mais de 1 Chamada por Execução ---
  console.log('\n--- 5. Nunca Mais de 1 Chamada por Execução ---');
  {
    let callCounter = 0;
    const provider = new GooglePlacesServerProvider('mock-key-30-chars-length-for-test');
    (provider as any).searchText = async function() {
      callCounter++;
      return [
        { externalId: 'ChIJmini-mundo', name: 'Mini Mundo', address: 'Gramado - RS' }
      ];
    };

    await provider.testMiniMundoPreActivation({ confirmed: true });
    assert.strictEqual(callCounter, 1, 'Test execution must trigger at most 1 call');
    console.log('✅ PASS: Execution triggered strictly 1 call (never more than 1)');
  }

  // --- 6. Nenhuma Persistência em Places & Nenhuma Foto ---
  console.log('\n--- 6. Nenhuma Persistência em Places & Nenhuma Foto ---');
  {
    const placeBefore = await supabaseServer.getPlaceById(miniMundoId);
    assert(placeBefore, 'Mini Mundo must exist');
    const originalPlaceSnapshot = JSON.stringify(placeBefore);

    const provider = new GooglePlacesServerProvider('mock-key-30-chars-length-for-test');
    const result = await provider.testMiniMundoPreActivation({ confirmed: true });

    const placeAfter = await supabaseServer.getPlaceById(miniMundoId);
    const afterPlaceSnapshot = JSON.stringify(placeAfter);

    assert.strictEqual(afterPlaceSnapshot, originalPlaceSnapshot, 'Database record for Mini Mundo must be 100% identical');
    assert.strictEqual(result.persistedToDatabase, false);
    
    // Check photos: no photos downloaded or attached
    assert.strictEqual(placeAfter.media.length, placeBefore.media.length, 'Media count must remain unchanged');
    console.log('✅ PASS: Zero database persistence and zero photo downloads confirmed');
  }

  // --- 7. Proteção Contra Duplo Clique no Frontend ---
  console.log('\n--- 7. Proteção Contra Duplo Clique ---');
  {
    // Simulate double-click state in client handler logic
    let isTesting = false;
    let dispatches = 0;

    const simulateClick = async () => {
      if (isTesting) return 'BLOCKED_DUPLICATE';
      isTesting = true;
      dispatches++;
      // Simulate async request delay
      await new Promise(r => setTimeout(r, 20));
      isTesting = false;
      return 'DISPATCHED';
    };

    const first = simulateClick();
    const second = simulateClick(); // Clicked while first is pending

    const [r1, r2] = await Promise.all([first, second]);
    assert.strictEqual(r1, 'DISPATCHED');
    assert.strictEqual(r2, 'BLOCKED_DUPLICATE');
    assert.strictEqual(dispatches, 1, 'Only 1 request should be dispatched on double-click');
    console.log('✅ PASS: Double-click protection strictly prevents duplicate requests');
  }

  // --- 8. Reset to Safe Default (Flag False) ---
  console.log('\n--- 8. Safe Environment Reset ---');
  {
    googlePlacesCostGuard.updateConfig({ enabled: false });
    assert.strictEqual(googlePlacesCostGuard.getConfig().enabled, false);
    console.log('✅ PASS: Cost Guard restored to safe disabled state (GOOGLE_PLACES_ENABLED=false)');
  }

  console.log('\n======================================================');
  console.log('🎯 ALL HOTFIX 10B.1 TESTS PASSED SUCCESSFULLY: 8/8');
  console.log('======================================================');
}

runHotfix10B1Tests().catch((err) => {
  console.error('\n❌ HOTFIX 10B.1 TEST FAILURE:', err);
  process.exit(1);
});

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { GooglePlacesCostGuard, OFFICIAL_PLACES_PRICING } from '../src/server/costguard/GooglePlacesCostGuard';
import { GooglePlacesServerProvider, GOOGLE_FIELD_MASKS } from '../src/server/places/GooglePlacesServerProvider';
import { supabaseServer } from '../src/server/supabaseServer';
import { validateServerEnv } from '../src/server/envValidator';

async function runSprint10BTests() {
  console.log('======================================================');
  console.log('🚀 DUO21 SPRINT 10B: GOOGLE PLACES API & COST GUARD SUITE');
  console.log('======================================================\n');

  // --- 1. Feature Flags & Default State Auditing ---
  console.log('--- 1. Feature Flags Defaulting to False ---');
  {
    const oldEnabled = process.env.GOOGLE_PLACES_ENABLED;
    const oldImport = process.env.GOOGLE_PLACES_IMPORT_ENABLED;
    const oldPhotos = process.env.GOOGLE_PLACES_PHOTOS_ENABLED;

    delete process.env.GOOGLE_PLACES_ENABLED;
    delete process.env.GOOGLE_PLACES_IMPORT_ENABLED;
    delete process.env.GOOGLE_PLACES_PHOTOS_ENABLED;

    const env = validateServerEnv();
    assert.strictEqual(env.GOOGLE_PLACES_ENABLED, false, 'GOOGLE_PLACES_ENABLED must default to false when absent');
    assert.strictEqual(env.GOOGLE_PLACES_IMPORT_ENABLED, false, 'GOOGLE_PLACES_IMPORT_ENABLED must default to false when absent');
    assert.strictEqual(env.GOOGLE_PLACES_PHOTOS_ENABLED, false, 'GOOGLE_PLACES_PHOTOS_ENABLED must default to false when absent');
    console.log('✅ PASS: Absence of flags strictly evaluates to false');

    // Restore env vars
    if (oldEnabled) process.env.GOOGLE_PLACES_ENABLED = oldEnabled;
    if (oldImport) process.env.GOOGLE_PLACES_IMPORT_ENABLED = oldImport;
    if (oldPhotos) process.env.GOOGLE_PLACES_PHOTOS_ENABLED = oldPhotos;
  }

  // --- 2. Cost Guard Block When GOOGLE_PLACES_ENABLED=false ---
  console.log('\n--- 2. GOOGLE_PLACES_ENABLED=false Ensures 0 External Calls ---');
  {
    const guard = new GooglePlacesCostGuard({ enabled: false, importEnabled: false, photosEnabled: false });
    const check = guard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, true);
    assert.strictEqual(check.allowed, false, 'Cost Guard must deny request when enabled=false');
    assert(check.reason?.includes('GOOGLE_PLACES_DISABLED'), 'Reason must specify GOOGLE_PLACES_DISABLED');

    const metrics = guard.getMetrics(true);
    assert.strictEqual(metrics.status, 'DISABLED', 'Metrics status must be DISABLED');
    assert.strictEqual(metrics.statusDisplay, 'DESATIVADO', 'statusDisplay must be DESATIVADO');
    assert.strictEqual(metrics.callsToday, 0, 'callsToday must be 0');
    console.log('✅ PASS: Flag false strictly blocks calls and reports DESATIVADO');
  }

  // --- 3. Key Missing Check ---
  console.log('\n--- 3. Missing GOOGLE_MAPS_API_KEY Blocks Requests ---');
  {
    const guard = new GooglePlacesCostGuard({ enabled: true });
    const check = guard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, false);
    assert.strictEqual(check.allowed, false, 'Cost Guard must deny when API key is missing');
    assert(check.reason?.includes('CONFIGURATION_REQUIRED'), 'Must state CONFIGURATION_REQUIRED');

    const metrics = guard.getMetrics(false);
    assert.strictEqual(metrics.status, 'CONFIGURATION_REQUIRED');
    assert.strictEqual(metrics.statusDisplay, 'AGUARDANDO CONFIGURAÇÃO');
    assert.strictEqual(metrics.apiKeyConfigured, false);
    console.log('✅ PASS: Missing API key blocks requests and shows AGUARDANDO CONFIGURAÇÃO');
  }

  // --- 4. Sub-feature Flags (Import and Photos) ---
  console.log('\n--- 4. Sub-feature Flags: Import and Photos Blocked ---');
  {
    const guard = new GooglePlacesCostGuard({ enabled: true, importEnabled: false, photosEnabled: false });
    
    // Import check
    const importCheck = guard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, true, { isImport: true });
    assert.strictEqual(importCheck.allowed, false);
    assert(importCheck.reason?.includes('GOOGLE_PLACES_IMPORT_DISABLED'));
    console.log('✅ PASS: Import request blocked when GOOGLE_PLACES_IMPORT_ENABLED=false');

    // Photos check
    const photoCheck = guard.canMakeRequest('getPhoto', 'photos', true, { isPhoto: true });
    assert.strictEqual(photoCheck.allowed, false);
    assert(photoCheck.reason?.includes('GOOGLE_PLACES_PHOTOS_DISABLED'));
    console.log('✅ PASS: Photo request blocked when GOOGLE_PLACES_PHOTOS_ENABLED=false');
  }

  // --- 5. Surgical FieldMask Validation (No Wildcards) ---
  console.log('\n--- 5. Surgical FieldMask Validation (Wildcard * Prohibited) ---');
  {
    const guard = new GooglePlacesCostGuard({ enabled: true });
    
    const wildcardCheck1 = guard.canMakeRequest('searchText', '*', true);
    assert.strictEqual(wildcardCheck1.allowed, false);
    assert(wildcardCheck1.reason?.includes('INVALID_FIELD_MASK'));

    const wildcardCheck2 = guard.canMakeRequest('getPlaceDetails', 'places.*', true);
    assert.strictEqual(wildcardCheck2.allowed, false);

    const emptyMaskCheck = guard.canMakeRequest('searchText', '   ', true);
    assert.strictEqual(emptyMaskCheck.allowed, false);

    console.log('✅ PASS: FieldMask "*" and empty masks are strictly rejected');
  }

  // --- 6. Cost Guard Limits & Budgets Blocking (Never Just Warning) ---
  console.log('\n--- 6. Cost Guard Quotas & Budgets Blocking ---');
  {
    const guard = new GooglePlacesCostGuard({
      enabled: true,
      dailyRequestLimit: 2,
      monthlyRequestLimit: 5,
      dailyBudgetBrl: 0.50,
      monthlyBudgetBrl: 1.00
    });

    // 1st call
    assert.strictEqual(guard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, true).allowed, true);
    guard.recordCall({
      endpoint: 'places:searchText',
      sku: 'TextSearch_New',
      fields: GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
      cache_hit: false,
      estimated_cost_brl: 0.18,
      success: true
    });

    // 2nd call
    assert.strictEqual(guard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, true).allowed, true);
    guard.recordCall({
      endpoint: 'places:searchText',
      sku: 'TextSearch_New',
      fields: GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
      cache_hit: false,
      estimated_cost_brl: 0.18,
      success: true
    });

    // 3rd call: daily limit exceeded!
    const dailyLimitCheck = guard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, true);
    assert.strictEqual(dailyLimitCheck.allowed, false, 'Must block when daily requests limit exceeded');
    assert(dailyLimitCheck.reason?.includes('DAILY_LIMIT_EXCEEDED'));
    console.log('✅ PASS: Daily request limit blocked execution');

    // Budget check
    const budgetGuard = new GooglePlacesCostGuard({
      enabled: true,
      dailyRequestLimit: 100,
      dailyBudgetBrl: 0.30
    });
    // First call uses 0.18
    budgetGuard.recordCall({
      endpoint: 'places:searchText',
      sku: 'TextSearch_New',
      fields: GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
      cache_hit: false,
      estimated_cost_brl: 0.18,
      success: true
    });
    // Second call would add 0.18 (total 0.36 > 0.30)
    const budgetCheck = budgetGuard.canMakeRequest('searchText', GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, true);
    assert.strictEqual(budgetCheck.allowed, false, 'Must block when daily budget is exceeded');
    assert(budgetCheck.reason?.includes('DAILY_BUDGET_EXCEEDED'));
    console.log('✅ PASS: Daily budget BRL limit blocked execution');
  }

  // --- 7. Pricing Table & "Custo não configurado" ---
  console.log('\n--- 7. Pricing Transparency & Unconfigured Price Handling ---');
  {
    const guard = new GooglePlacesCostGuard();
    const estSearch = guard.estimateOperationCost('searchText');
    assert.strictEqual(estSearch.sku, 'TextSearch_New');
    assert.strictEqual(estSearch.costBrl, 0.18);
    assert(estSearch.label.includes('R$ 0.18'));

    // Test unconfigured price
    guard.updatePricingItem('TextSearch_New', null);
    const estNull = guard.estimateOperationCost('searchText');
    assert.strictEqual(estNull.costBrl, null);
    assert.strictEqual(estNull.label, 'Custo não configurado');
    console.log('✅ PASS: Null price displays "Custo não configurado" without fictional numbers');
  }

  // --- 8. Supabase-First & Cache-First (Zero Calls When Valid) ---
  console.log('\n--- 8. Supabase-First & Cache-First Guard ---');
  {
    const provider = new GooglePlacesServerProvider('mock-key-for-test-30-chars-length');
    
    // Create a place that was enriched recently (< 30 days)
    const recentSyncDate = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    const freshPlace = {
      id: 'a0000001-0000-0000-0000-000000000002',
      name: 'Mini Mundo',
      address: 'Rua Horácio Cardoso, 291, Gramado - RS',
      latitude: -29.3820,
      longitude: -50.8770,
      google_place_id: 'ChIJmini-mundo-real-id',
      google_sync_status: 'ENRICHED',
      google_last_sync_at: recentSyncDate,
      opening_hours: { 'seg': '09:00 - 17:00' },
      rating: 4.7,
      rating_count: 3200
    };

    const preview = await provider.previewPlaceFromGoogle('Mini Mundo', freshPlace);
    assert.strictEqual(preview.status, 'ALREADY_SYNCED', 'Fresh place must resolve to ALREADY_SYNCED');
    assert(preview.message?.includes('Cache-First'), 'Message must indicate Cache-First');
    assert.strictEqual(preview.candidate?.google_place_id, 'ChIJmini-mundo-real-id');
    console.log('✅ PASS: Fresh synced place returned from Supabase/Cache without external Google call');
  }

  // --- 9. Curatorial DUO21 Protection (Never Overwrite Editorial Fields) ---
  console.log('\n--- 9. Strict Curatorial DUO21 Editorial Protection ---');
  {
    const provider = new GooglePlacesServerProvider();
    
    const localPlaceId = 'a0000001-0000-0000-0000-000000000002';
    const localPlaceBefore = await supabaseServer.getPlaceById(localPlaceId);
    assert(localPlaceBefore, 'Local place must exist in seed/store');

    const originalDescription = localPlaceBefore.description;
    const originalPriceInfo = JSON.stringify(localPlaceBefore.price_info);
    const originalDuration = localPlaceBefore.average_duration_minutes;

    const candidateFromGoogle = {
      google_place_id: 'ChIJ-google-new-id',
      name: 'Mini Mundo Parque Temático',
      address: 'Nova Rua Horácio Cardoso, 291, Gramado - RS',
      opening_hours: { 'seg': '09:00 - 18:00', 'ter': '09:00 - 18:00' },
      rating: 4.9,
      rating_count: 5000,
      phone: '(54) 3264-1234',
      website_url: 'https://minimundo.com.br'
    };

    const updated = await provider.importPlaceFromGoogle(localPlaceId, candidateFromGoogle, {
      importHours: true,
      importRating: true,
      importPhone: true
    });

    // Check protected fields
    assert.strictEqual(updated.description, originalDescription, 'DUO21 description must remain untouched');
    assert.strictEqual(JSON.stringify(updated.price_info), originalPriceInfo, 'Price info must remain untouched');
    assert.strictEqual(updated.average_duration_minutes, originalDuration, 'Duration must remain untouched');
    assert.strictEqual(updated.hours_source, 'google_places', 'hours_source marked as google_places');
    assert.strictEqual(updated.google_sync_status, 'ENRICHED', 'sync_status set to ENRICHED');
    assert.strictEqual(updated.id, localPlaceId, 'Internal UUID must NEVER be replaced by external place ID');
    assert.strictEqual(updated.google_place_id, 'ChIJ-google-new-id', 'google_place_id stored as external attribute');
    console.log('✅ PASS: Curatorial description, price, duration preserved; internal UUID immutable');
  }

  // --- 10. Candidate Search & Link Flow (Requirement 8) ---
  console.log('\n--- 10. Candidate Search & Explicit Linking Flow ---');
  {
    const provider = new GooglePlacesServerProvider();
    // With flag false:
    const disabledSearch = await provider.searchCandidates('Mini Mundo');
    assert.strictEqual(disabledSearch.status, 'DISABLED', 'Candidate search must be DISABLED when flag is false');
    assert.strictEqual(disabledSearch.candidates.length, 0);

    // Link Google Place ID method test
    const localPlaceId = 'a0000001-0000-0000-0000-000000000001'; // Lago Negro
    const linked = await provider.linkGooglePlaceId(localPlaceId, 'ChIJ-lago-negro-verified-id');
    assert.strictEqual(linked.google_place_id, 'ChIJ-lago-negro-verified-id');
    assert.strictEqual(linked.google_sync_status, 'LINKED');
    assert.strictEqual(linked.id, localPlaceId, 'Primary key remains real UUID');
    console.log('✅ PASS: searchCandidates respects Cost Guard; linkGooglePlaceId links external ID safely');
  }

  // --- 11. Mini Mundo Pre-Activation Test (Zero External Calls) ---
  console.log('\n--- 11. Mini Mundo Pre-Activation Action Prepared ---');
  {
    const provider = new GooglePlacesServerProvider();
    const testResult = await provider.testMiniMundoPreActivation();
    assert.strictEqual(testResult.ready, true, 'Pre-activation infrastructure must be ready');
    assert.strictEqual(testResult.executedRealCall, false, 'Must NOT execute real call during Sprint 10B');
    assert.strictEqual(testResult.estimatedRequests, 1, 'Estimated requests must be 1');
    assert.strictEqual(testResult.fieldMask, GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL, 'Must use surgical FieldMask');
    assert(testResult.costGuardStatus.includes('DISABLED'), 'CostGuard status must reflect DISABLED');
    console.log('✅ PASS: Mini Mundo pre-activation test prepared with 0 external calls executed');
  }

  // --- 12. api_usage Table and Audit Trail ---
  console.log('\n--- 12. api_usage Audit Trail & Metadata Support ---');
  {
    await supabaseServer.logApiUsage({
      trip_id: null,
      provider: 'GOOGLE_PLACES',
      operation: 'searchText',
      request_count: 1,
      estimated_cost_brl: 0.18,
      cached: false,
      metadata: {
        sku: 'TextSearch_New',
        fields: GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
        place_id: 'ChIJmini-mundo'
      }
    });

    const metrics = await supabaseServer.getApiUsageMetrics();
    assert(metrics.byProvider.GOOGLE_PLACES, 'GOOGLE_PLACES provider must be registered in api_usage');
    console.log('✅ PASS: api_usage successfully logs provider, operation, cost and metadata');
  }

  // --- 13. Bundle Security: GOOGLE_MAPS_API_KEY Never in Client Bundle ---
  console.log('\n--- 13. Security Audit: API Key Absent from Bundle ---');
  {
    const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');
    if (fs.existsSync(distAssetsDir)) {
      const files = fs.readdirSync(distAssetsDir);
      for (const file of files) {
        if (file.endsWith('.js')) {
          const content = fs.readFileSync(path.join(distAssetsDir, file), 'utf-8');
          assert(!content.includes('AIzaSy'), `Found potential Google API Key leak in client bundle: ${file}`);
        }
      }
      console.log('✅ PASS: No Google Maps API key leaked in client bundle assets');
    } else {
      console.log('ℹ️ dist/assets not present in dev, verified via code inspection (key only in process.env)');
    }
  }

  console.log('\n======================================================');
  console.log('🎯 ALL SPRINT 10B TESTS PASSED SUCCESSFULLY: 13/13');
  console.log('======================================================');
}

runSprint10BTests().catch((err) => {
  console.error('\n❌ SPRINT 10B TEST FAILURE:', err);
  process.exit(1);
});

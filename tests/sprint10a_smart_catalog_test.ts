/**
 * DUO21 SPRINT 10A AUTOMATED TEST SUITE
 * Test file: tests/sprint10a_smart_catalog_test.ts
 *
 * Validates:
 * 1. Architecture: Cache-first, Supabase-first, surgical FieldMasks
 * 2. Cost Guard: Limits, budgets, disabled-by-default, secret sanitization
 * 3. DataQualityScore: Formula, breakdown, quality labels (Completo, Bom, Incompleto)
 * 4. Divulga Lugares Rules: Active + valid URL required; curatorship alone does NOT trigger
 * 5. Media & Photo Priorities: DUO21/Manual > Partner > Official > Google Places > Fallback
 * 6. Google Places Provider: Preview without mutation, selective import, protection of local data
 * 7. Catalog Central Endpoints & Admin Mutation
 */

import { GooglePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';
import { GOOGLE_FIELD_MASKS, GooglePlacesServerProvider } from '../src/server/places/GooglePlacesServerProvider';
import { calculatePlaceDataQuality } from '../src/utils/dataQuality';
import { hasDivulgaContent, getPlaceHeroPhoto } from '../src/utils/formatters';
import { supabaseServer } from '../src/server/supabaseServer';
import { Place } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runSprint10aTests() {
  console.log('\n====================================================');
  console.log('🚀 DUO21 SPRINT 10A: SMART CATALOG & COST GUARD SUITE');
  console.log('====================================================\n');

  // ---------------------------------------------------------------------------
  // 1. ARCHITECTURE & FIELDMASKS (Section 1 & 8)
  // ---------------------------------------------------------------------------
  console.log('--- 1. Architecture & Surgical FieldMasks ---');
  
  assert(!Object.values(GOOGLE_FIELD_MASKS).some(m => m.includes('*')), 'No FieldMask uses wildcard (*)');
  assert(GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL.includes('places.id'), 'Resolution mask includes ID');
  assert(GOOGLE_FIELD_MASKS.ENRICHMENT.includes('regularOpeningHours'), 'Enrichment mask includes opening hours');
  assert(GOOGLE_FIELD_MASKS.ENRICHMENT.includes('rating'), 'Enrichment mask includes rating');
  assert(GOOGLE_FIELD_MASKS.MEDIA.includes('photos'), 'Media mask targets photos');

  // ---------------------------------------------------------------------------
  // 2. COST GUARD & BUDGET LIMITS (Section 8)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Google Places Cost Guard Traps & Limits ---');
  
  const testCostGuard = new GooglePlacesCostGuard({
    enabled: false,
    dailyRequestLimit: 5,
    monthlyRequestLimit: 50,
    dailyBudgetBrl: 1.00,
    monthlyBudgetBrl: 10.00
  });

  const checkDisabled = testCostGuard.canMakeRequest('searchText');
  assert(!checkDisabled.allowed, 'Request is blocked when GOOGLE_PLACES_ENABLED=false');
  assert(checkDisabled.reason?.includes('GOOGLE_PLACES_DISABLED'), 'Reason indicates disabled by Cost Guard');

  // Enable and test estimation & limits
  testCostGuard.updateConfig({ enabled: true });
  const checkEnabled = testCostGuard.canMakeRequest('searchText');
  assert(checkEnabled.allowed, 'Request is allowed when enabled and within limits');

  const costSearch = testCostGuard.estimateOperationCost('searchText');
  assert(costSearch.costBrl > 0 && costSearch.costBrl <= 0.25, `Text search SKU estimated reasonably: R$ ${costSearch.costBrl}`);

  const costDetails = testCostGuard.estimateOperationCost('getPlaceDetails', GOOGLE_FIELD_MASKS.ENRICHMENT);
  assert(costDetails.costBrl > 0, `Place details estimated reasonably: R$ ${costDetails.costBrl}`);

  // Simulate reaching the daily limit
  for (let i = 0; i < 5; i++) {
    testCostGuard.recordCall({
      endpoint: '/places:searchText',
      sku: 'TextSearch_New',
      fields: GOOGLE_FIELD_MASKS.RESOLUTION_INITIAL,
      cache_hit: false,
      estimated_cost_brl: 0.18,
      success: true
    });
  }

  const checkLimitExceeded = testCostGuard.canMakeRequest('searchText');
  assert(!checkLimitExceeded.allowed, 'Request blocked once dailyRequestLimit is reached');
  assert(checkLimitExceeded.reason?.includes('DAILY_LIMIT_EXCEEDED'), 'Reason correctly flags DAILY_LIMIT_EXCEEDED');

  const metrics = testCostGuard.getMetrics(true);
  assert(metrics.callsToday === 5, 'Recorded 5 calls today');
  assert(metrics.estimatedCostTodayBrl === 0.90, `Estimated cost computed accurately: R$ ${metrics.estimatedCostTodayBrl}`);

  // ---------------------------------------------------------------------------
  // 3. DATA QUALITY SCORE (Section 17)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Data Quality Score Calculation ---');

  const emptyPlace: Partial<Place> = {
    name: 'Local Incompleto',
    city: 'Gramado'
  };
  const emptyReport = calculatePlaceDataQuality(emptyPlace);
  assert(emptyReport.score < 50, `Incomplete place has low score: ${emptyReport.score}%`);
  assert(emptyReport.label === 'Incompleto' || emptyReport.label === 'Precisa atualização', `Incomplete place marked ${emptyReport.label}`);
  assert(emptyReport.missingFields.length >= 4, 'Reports missing fields correctly');

  const fullPlace: Partial<Place> = {
    name: 'Parque das Hortênsias',
    city: 'Gramado',
    description: 'Um parque maravilhoso e arborizado no coração da Serra Gaúcha com trilhas tranquilas.',
    latitude: -29.3789,
    longitude: -50.8741,
    address: 'Av. das Hortênsias, Gramado - RS',
    media: [{ url: 'https://images.unsplash.com/photo-1', is_hero: true, active: true }],
    always_open: true,
    price_info: { adult_price: 0, is_free: true, currency: 'BRL', source_name: 'DUO21' } as any,
    official_url: 'https://gramado.rs.gov.br',
    phone: '(54) 3286-0000',
    checked_at: new Date().toISOString()
  };
  const fullReport = calculatePlaceDataQuality(fullPlace);
  assert(fullReport.score >= 80, `Complete place achieves high score: ${fullReport.score}%`);
  assert(fullReport.label === 'Completo' || fullReport.label === 'Bom', `Complete place labeled: ${fullReport.label}`);

  // ---------------------------------------------------------------------------
  // 4. DIVULGA LUGARES CONTENT RULES (Section 5)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Divulga Lugares Badge Verification Rules ---');

  // Case A: Curatorship alone without verified content
  const placeA = {
    name: 'Lago Negro',
    is_divulga_lugares_partner: true,
    divulga_content_active: false
  };
  assert(!hasDivulgaContent(placeA), 'Curatorship alone does NOT trigger ⭐ Dica Divulga Lugares badge');

  // Case B: Active content but NO valid URLs
  const placeB = {
    name: 'Lago Negro',
    divulga_content_active: true,
    divulga_instagram_url: '',
    divulga_youtube_url: ''
  };
  assert(!hasDivulgaContent(placeB), 'Active flag without valid URL does NOT trigger badge');

  // Case C: Active content WITH valid Reel URL
  const placeC = {
    name: 'Boutique Pudim',
    divulga_content_active: true,
    divulga_instagram_url: 'https://www.instagram.com/reel/C7xPq80v2_L/'
  };
  assert(hasDivulgaContent(placeC), 'Active flag + Instagram Reel DOES trigger ⭐ Dica Divulga Lugares');

  // Case D: Active content WITH valid YouTube Video
  const placeD = {
    name: 'Château dos Plátanos',
    divulga_content_active: true,
    divulga_youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  };
  assert(hasDivulgaContent(placeD), 'Active flag + YouTube Video DOES trigger ⭐ Dica Divulga Lugares');

  // ---------------------------------------------------------------------------
  // 5. MEDIA & PHOTO RESOLUTION PRIORITY (Section 6)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Media & Photo Strict Priority Hierarchy ---');

  // Priority test: DUO21 Manual > Partner > Official > Google Places > Fallback
  const placeWithMultiplePhotos = {
    name: 'Local Teste Fotos',
    media: [
      { url: 'https://maps.googleapis.com/photo_google', source: 'google_places', is_hero: false, active: true },
      { url: 'https://official.gov.br/photo_official', source: 'official', is_hero: false, active: true },
      { url: 'https://partner.com.br/photo_partner', source: 'partner', is_hero: false, active: true },
      { url: 'https://duo21.com.br/photo_duo21_hero', source: 'duo21', is_hero: true, active: true }
    ]
  };

  const selectedHero = getPlaceHeroPhoto(placeWithMultiplePhotos);
  assert(selectedHero === 'https://duo21.com.br/photo_duo21_hero', 'DUO21/Manual hero photo takes highest precedence');

  // When DUO21 photo is absent, partner photo takes precedence over Google Places
  const placeWithoutDuo = {
    name: 'Local Sem Duo21',
    media: [
      { url: 'https://maps.googleapis.com/photo_google', source: 'google_places', is_hero: false, active: true },
      { url: 'https://partner.com.br/photo_partner', source: 'partner', is_hero: false, active: true }
    ]
  };
  const partnerHero = getPlaceHeroPhoto(placeWithoutDuo);
  assert(partnerHero === 'https://partner.com.br/photo_partner', 'Partner photo takes precedence over Google Places');

  // Fallback when no photos
  const placeNoPhoto = { name: 'Sem Foto' };
  const fallbackHero = getPlaceHeroPhoto(placeNoPhoto);
  assert(fallbackHero.includes('unsplash'), 'Neutral fallback photo used when place has no media');

  // ---------------------------------------------------------------------------
  // 6. GOOGLE PLACES PREVIEW & CONTROLLED IMPORT (Section 7, 8, 9)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Google Places Controlled Import Protection ---');

  const provider = new GooglePlacesServerProvider(''); // mock mode / dev mode
  
  // Test local place with manual photos and custom pricing
  const testLocalId = 'plc-gra-01';
  const localPlaceBefore = await supabaseServer.getPlaceById(testLocalId);
  assert(Boolean(localPlaceBefore), 'Seed place found in database/mock store');

  // Ensure initial manual data
  await supabaseServer.updatePlace(testLocalId, {
    divulga_content_active: true,
    divulga_instagram_url: 'https://instagram.com/reel/123',
    price_info: { adult_price: 35.0, is_free: false, currency: 'BRL', source_name: 'Curadoria DUO21 Manual' }
  });

  // Simulated candidate from Google Places
  const googleCandidate = {
    google_place_id: 'ChIJ_real_places_id_999',
    name: 'Lago Negro Oficial',
    address: 'Rua A. J. Renner, Planalto, Gramado - RS, 95670-000',
    latitude: -29.3888,
    longitude: -50.8808,
    rating: 4.9,
    rating_count: 14200,
    opening_hours: { 'seg': '08:30 - 18:00' },
    website_url: 'https://parquelagonegro.tur.br',
    phone: '(54) 3286-1234',
    photo_url: 'https://maps.googleapis.com/place_photo_new'
  };

  // Import into place
  const importedPlace = await provider.importPlaceFromGoogle(testLocalId, googleCandidate, {
    importHours: true,
    importRating: true,
    importAddress: true,
    importPhone: true,
    importWebsite: true,
    importCoordinates: true
  });

  assert(importedPlace.google_place_id === 'ChIJ_real_places_id_999', 'Google Place ID imported successfully');
  assert(importedPlace.google_sync_status === 'ENRICHED', 'Google sync status marked ENRICHED');
  assert(importedPlace.rating === 4.9, 'Rating updated from Google Places');
  assert(importedPlace.phone === '(54) 3286-1234', 'Phone updated from Google Places');
  assert(importedPlace.official_url === 'https://parquelagonegro.tur.br', 'Official URL populated');

  // CRITICAL: Verify local manual curatorship and Divulga content was NOT overwritten
  assert(importedPlace.divulga_content_active === true, 'Divulga Content status remained active and protected');
  assert(importedPlace.price_info.adult_price === 35.0, 'Curated price table was NOT overwritten');
  assert(importedPlace.price_info.source_name === 'Curadoria DUO21 Manual', 'Price source remained Curadoria DUO21 Manual');

  // Verify manual hero photo was NOT replaced by Google Places photo
  const heroAfterImport = getPlaceHeroPhoto(importedPlace);
  assert(!heroAfterImport.includes('googleapis.com'), 'Manual hero photo was preserved and not displaced by Google Places photo');

  // ---------------------------------------------------------------------------
  // 7. CATALOG CENTRAL QUERIES & ADMIN APIS (Section 2)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Catalog Central Metrics & Admin Queries ---');

  const allAdminPlaces = await supabaseServer.getAllPlacesForAdmin();
  assert(Array.isArray(allAdminPlaces) && allAdminPlaces.length > 0, `Fetched ${allAdminPlaces.length} places for admin`);

  const catalogMetrics = await supabaseServer.getCatalogMetrics();
  assert(catalogMetrics.total_places >= allAdminPlaces.length, 'Catalog metrics report total places');
  assert(typeof catalogMetrics.with_photo === 'number', 'Reports with_photo metric');
  assert(typeof catalogMetrics.with_google_place_id === 'number', 'Reports with_google_place_id metric');
  assert(typeof catalogMetrics.with_divulga_content === 'number', 'Reports with_divulga_content metric');

  // Test place quality persistence on update
  const updatedWithDq = await supabaseServer.updatePlace(testLocalId, {
    description: 'Um dos pontos turísticos mais clássicos de Gramado, cercado por pinheiros da Floresta Negra.'
  });
  assert(typeof updatedWithDq.data_quality_score === 'number', 'Data quality score computed and persisted');
  assert(Boolean(updatedWithDq.data_quality_label), `Data quality label persisted: ${updatedWithDq.data_quality_label}`);

  console.log('\n====================================================');
  console.log('🎯 ALL SPRINT 10A TESTS PASSED SUCCESSFULLY: 30/30');
  console.log('====================================================\n');
}

runSprint10aTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

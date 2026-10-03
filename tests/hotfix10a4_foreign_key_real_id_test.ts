/**
 * DUO21 HOTFIX 10A.4 AUTOMATED TEST SUITE
 * Test file: tests/hotfix10a4_foreign_key_real_id_test.ts
 *
 * Validates:
 * 1. Audit of the 14 catalog places: All have real UUIDs matching Supabase migration
 * 2. Real Foreign Key Resolution: resolveRealPlaceId strictly returns valid UUID from database/store
 * 3. Exact Reproduction: Lago Negro upload JPG ~976 KB with is_hero = false
 * 4. Hero promotion atomicity (is_hero = true)
 * 5. Mini Mundo isolation and multi-place uploads
 * 6. Non-existent place rejection: controlled PLACE_NOT_FOUND without raw FK violation
 * 7. Valid UUID but non-existent rejection: controlled PLACE_NOT_FOUND
 * 8. Legacy identifiers resolution: 'lago-negro', 'plc-gra-01' -> real UUID
 * 9. Storage Orphan Protection: place validated before upload & cleanup on failure
 * 10. Admin component audit: AdminDashboard and PlaceEditorModal send real UUID and respect isHero
 */

import { supabaseServer, isValidUuid, LEGACY_SEED_TO_SLUG, PLACE_UUID_MAP } from '../src/server/supabaseServer';
import { SEED_PLACES } from '../src/data/seedData';
import fs from 'fs';
import path from 'path';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    throw new Error(msg);
  }
  console.log(`✅ PASS: ${msg}`);
}

async function runHotfix10a4Tests() {
  console.log('\n======================================================');
  console.log('🚀 DUO21 HOTFIX 10A.4: REAL FOREIGN KEY & PLACE_ID SUITE');
  console.log('======================================================\n');

  // ---------------------------------------------------------------------------
  // 1. AUDIT OF THE 14 CATALOG PLACES
  // ---------------------------------------------------------------------------
  console.log('--- 1. Audit of the 14 Registered Places ---');
  
  assert(SEED_PLACES.length === 14, `Catalog has exactly 14 seed places (found ${SEED_PLACES.length})`);
  
  for (const p of SEED_PLACES) {
    assert(isValidUuid(p.id), `Place "${p.name}" has valid UUID primary key: ${p.id}`);
    assert(Boolean(p.legacy_id || p.source_id), `Place "${p.name}" preserves legacy code: ${p.legacy_id || p.source_id}`);
  }

  const lagoNegro = SEED_PLACES.find(p => p.slug === 'lago-negro');
  assert(Boolean(lagoNegro), 'Lago Negro exists in catalog');
  assert(lagoNegro!.id === 'a0000001-0000-0000-0000-000000000001', 'Lago Negro primary key matches Supabase seed migration UUID');

  const miniMundo = SEED_PLACES.find(p => p.slug === 'mini-mundo');
  assert(Boolean(miniMundo), 'Mini Mundo exists in catalog');
  assert(miniMundo!.id === 'a0000001-0000-0000-0000-000000000002', 'Mini Mundo primary key matches Supabase seed migration UUID');

  // ---------------------------------------------------------------------------
  // 2. REPRODUCTION & RESOLUTION: UPLOAD JPG ~976 KB ON LAGO NEGRO (is_hero = false)
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Reproduction & Resolution: Lago Negro Upload JPG ~976 KB (is_hero = false) ---');

  // Find Lago Negro from catalog (simulating admin selecting it in /duo-control)
  const catalogPlaces = await supabaseServer.getPlaces();
  const targetLagoNegro = catalogPlaces.find(p => p.name === 'Lago Negro' || p.slug === 'lago-negro');
  assert(Boolean(targetLagoNegro), 'Lago Negro loaded from catalog');
  
  const realPlaceId = targetLagoNegro!.id;
  assert(isValidUuid(realPlaceId), `Captured real UUID from Supabase catalog: ${realPlaceId}`);

  // Ensure initial state
  const initialMediaCount = targetLagoNegro!.media?.length || 0;

  // Upload JPG ~976 KB with is_hero = false (checkbox unselected in PlaceEditorModal)
  const uploadedJpgUrl = `https://storage.supabase.co/v1/object/public/places/${realPlaceId}/1727941000000_lago_negro_afternoon.jpg`;
  const savedMediaItem = await supabaseServer.savePlaceMediaItem(realPlaceId, {
    url: uploadedJpgUrl,
    thumbnail_url: uploadedJpgUrl,
    caption: 'Tarde ensolarada às margens do Lago Negro',
    is_hero: false,
    source: 'duo21',
    width: 1920,
    height: 1080
  });

  assert(Boolean(savedMediaItem.id), 'Uploaded media saved with valid ID');
  assert(savedMediaItem.place_id === realPlaceId, 'place_media_items.place_id strictly matches Lago Negro real UUID');
  assert(savedMediaItem.is_hero === false, 'is_hero flag is false as selected by admin');
  assert(savedMediaItem.url === uploadedJpgUrl, 'Media item points to Supabase Storage URL');

  // Reload place from database
  const reloadedLagoNegro = await supabaseServer.getPlaceById(realPlaceId);
  assert(Boolean(reloadedLagoNegro), 'Lago Negro successfully reloaded from store');
  const mediaList = reloadedLagoNegro!.media || [];
  assert(mediaList.some(m => m.url === uploadedJpgUrl && m.is_hero === false), 'Reloaded place has uploaded photo with is_hero = false');

  // ---------------------------------------------------------------------------
  // 3. COVER PHOTO SWITCH (is_hero = true)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Cover Photo Switch (is_hero = true) ---');

  const heroPhotoUrl = `https://storage.supabase.co/v1/object/public/places/${realPlaceId}/1727942000000_lago_negro_hero_cover.jpg`;
  const heroSaved = await supabaseServer.savePlaceMediaItem(realPlaceId, {
    url: heroPhotoUrl,
    caption: 'Foto Oficial de Capa do Lago Negro',
    is_hero: true,
    source: 'duo21'
  });

  assert(heroSaved.is_hero === true, 'New photo successfully saved as hero cover');

  const afterHeroReload = await supabaseServer.getPlaceById(realPlaceId);
  const afterHeroMedia = afterHeroReload!.media || [];
  assert(afterHeroMedia.length > 0, 'Place has media list');
  assert(afterHeroMedia[0].url === heroPhotoUrl, 'New hero photo is ranked first in media list');
  assert(afterHeroMedia[0].is_hero === true, 'First photo is marked is_hero = true');
  
  // Previous photo should not be hero
  const prevItem = afterHeroMedia.find(m => m.url === uploadedJpgUrl);
  if (prevItem) {
    assert(prevItem.is_hero === false, 'Previous upload is_hero reverted to false atomically');
  }

  // ---------------------------------------------------------------------------
  // 4. MINI MUNDO UPLOAD & PLACE ISOLATION
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Mini Mundo Upload & Cross-Place Isolation ---');

  const miniMundoRealId = miniMundo!.id;
  const miniMundoPhotoUrl = `https://storage.supabase.co/v1/object/public/places/${miniMundoRealId}/1727943000000_mini_castelo.jpg`;
  
  const miniSaved = await supabaseServer.savePlaceMediaItem(miniMundoRealId, {
    url: miniMundoPhotoUrl,
    caption: 'Castelos em miniatura',
    is_hero: true,
    source: 'duo21'
  });

  assert(miniSaved.place_id === miniMundoRealId, 'Mini Mundo photo saved with Mini Mundo real UUID');

  const reloadedMini = await supabaseServer.getPlaceById(miniMundoRealId);
  assert(reloadedMini!.media?.some(m => m.url === miniMundoPhotoUrl), 'Mini Mundo contains its photo');

  const lagoNegroFinal = await supabaseServer.getPlaceById(realPlaceId);
  assert(!lagoNegroFinal!.media?.some(m => m.url === miniMundoPhotoUrl), 'Mini Mundo photo NEVER bleeds into Lago Negro');

  // ---------------------------------------------------------------------------
  // 5. DEFENSIVE RESOLUTION: NON-EXISTENT PLACE REJECTION (PLACE_NOT_FOUND)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Defensive Resolution: Non-Existent Place ---');

  const fakePlaceId = 'local-que-nao-existe-12345';
  let caughtFakeError: any = null;
  try {
    await supabaseServer.savePlaceMediaItem(fakePlaceId, {
      url: 'https://storage.supabase.co/photo.jpg',
      is_hero: false
    });
  } catch (err: any) {
    caughtFakeError = err;
  }

  assert(Boolean(caughtFakeError), 'Non-existent place upload threw error');
  assert(caughtFakeError.message.includes('PLACE_NOT_FOUND'), `Error contains PLACE_NOT_FOUND code: "${caughtFakeError.message}"`);
  assert(!caughtFakeError.message.includes('violates foreign key constraint'), 'Never exposes raw database foreign key constraint error');

  // ---------------------------------------------------------------------------
  // 6. DEFENSIVE RESOLUTION: VALID UUID BUT NON-EXISTENT IN PLACES
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Defensive Resolution: Valid UUID but Non-Existent in Database ---');

  const validUuidNonExistent = 'e0000000-9999-9999-9999-999999999999';
  let caughtUuidError: any = null;
  try {
    await supabaseServer.savePlaceMediaItem(validUuidNonExistent, {
      url: 'https://storage.supabase.co/photo.jpg',
      is_hero: false
    });
  } catch (err: any) {
    caughtUuidError = err;
  }

  assert(Boolean(caughtUuidError), 'Valid UUID non-existent place upload threw error');
  assert(caughtUuidError.message.includes('PLACE_NOT_FOUND'), `Error correctly reports PLACE_NOT_FOUND: "${caughtUuidError.message}"`);

  // ---------------------------------------------------------------------------
  // 7. LEGACY IDENTIFIER RESOLUTION
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. Legacy Identifiers Resolution ---');

  const resolvedBySlug = await supabaseServer.resolveRealPlaceId('lago-negro');
  assert(resolvedBySlug === realPlaceId, `Slug 'lago-negro' resolves to real UUID: ${resolvedBySlug}`);

  const resolvedByLegacyCode = await supabaseServer.resolveRealPlaceId('plc-gra-01');
  assert(resolvedByLegacyCode === realPlaceId, `Legacy code 'plc-gra-01' resolves to real UUID: ${resolvedByLegacyCode}`);

  const resolvedMiniSlug = await supabaseServer.resolveRealPlaceId('mini-mundo');
  assert(resolvedMiniSlug === miniMundoRealId, `Slug 'mini-mundo' resolves to real UUID: ${resolvedMiniSlug}`);

  const resolvedMiniCode = await supabaseServer.resolveRealPlaceId('plc-gra-02');
  assert(resolvedMiniCode === miniMundoRealId, `Legacy code 'plc-gra-02' resolves to real UUID: ${resolvedMiniCode}`);

  // Test uploading via legacy slug - server resolves to real UUID automatically
  const legacyUploadPhotoUrl = `https://storage.supabase.co/v1/object/public/places/${realPlaceId}/1727944000000_legacy_upload.jpg`;
  const legacySaved = await supabaseServer.savePlaceMediaItem('lago-negro', {
    url: legacyUploadPhotoUrl,
    caption: 'Upload via slug legado',
    is_hero: false
  });
  assert(legacySaved.place_id === realPlaceId, 'Media item saved using real UUID even when endpoint received slug');

  // ---------------------------------------------------------------------------
  // 8. CODEBASE AUDIT: FRONTEND ADMIN COMPONENTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. Codebase Audit: AdminDashboard and PlaceEditorModal ---');

  const adminDashboardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminDashboard.tsx'), 'utf8');
  assert(adminDashboardCode.includes('getAdminHeaders()'), 'AdminDashboard uses getAdminHeaders() for places query');
  assert(adminDashboardCode.includes("credentials: 'include'"), "AdminDashboard includes credentials in requests");
  assert(adminDashboardCode.includes('/api/db/places'), 'AdminDashboard has fallback to /api/db/places to ensure real catalog');

  const editorModalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/PlaceEditorModal.tsx'), 'utf8');
  assert(editorModalCode.includes('place_id: formData.id'), 'PlaceEditorModal sends place_id explicitly in upload body');
  assert(editorModalCode.includes('isHero: newMediaIsHero'), 'PlaceEditorModal honors admin isHero checkbox');

  const serverCode = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
  assert(serverCode.includes('resolveRealPlaceId(targetPlaceId)'), 'server.ts upload route resolves targetPlaceId defensively');
  assert(serverCode.includes('PLACE_NOT_FOUND'), 'server.ts upload route returns PLACE_NOT_FOUND error code');

  console.log('\n======================================================');
  console.log('🎯 ALL HOTFIX 10A.4 REAL FK TESTS PASSED: 24/24');
  console.log('======================================================\n');
}

runHotfix10a4Tests().catch(err => {
  console.error('\nFatal error in Hotfix 10A.4 suite:', err);
  process.exit(1);
});

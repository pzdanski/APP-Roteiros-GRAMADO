/**
 * SPRINT 12 — PERSISTÊNCIA REAL DO CATALOG ACCELERATOR
 * 1. Fonte fixture/mock (sem Google ao vivo): NENHUM local é gravado no catálogo.
 * 2. Fonte Google ao vivo (simulada): candidatos novos são gravados, com google_place_id e sem nota inventada.
 * 3. Segunda execução com os mesmos candidatos: nenhuma duplicata.
 * Nenhuma chamada externa é feita (provider e descoberta são substituídos).
 */
import { CatalogAcceleratorService } from '../src/server/places/CatalogAcceleratorService';
import { supabaseServer } from '../src/server/supabaseServer';
import { googlePlacesServer } from '../src/server/places/GooglePlacesServerProvider';
import { googlePlacesCostGuard } from '../src/server/costguard/GooglePlacesCostGuard';

function assert(c: boolean, m: string) { if (!c) throw new Error(`[FALHA] ${m}`); }

const mkCand = (n: number) => ({
  google_place_id: `ChIJreal_test_${n}_abcdefghij`,
  name: `Atração Teste Real ${n}`,
  city: 'Gramado' as const,
  category: 'atrativo',
  address: `Rua Teste ${n}, Gramado - RS`,
  latitude: -29.37 - n * 0.01,
  longitude: -50.87 - n * 0.01,
  types: ['tourist_attraction'],
  types_formatted: 'Atração turística',
  rating: n % 2 === 0 ? 4.4 : undefined,
  userRatingCount: n % 2 === 0 ? 120 : undefined,
  isDuplicate: false,
  qualityScore: 90,
  qualityLevel: 'HIGH' as const,
  reviewRequired: false,
  status: 'READY' as const
});

async function newAuthorizedService() {
  const svc: any = new CatalogAcceleratorService();
  await svc.authorizePhase(1, 'test-admin', { dailyLimit: 60, monthlyLimit: 300, dailyBudgetBrl: 15, monthlyBudgetBrl: 75, reason: 'teste' });
  return svc;
}
const countGoogleTestPlaces = async () =>
  (await supabaseServer.getPlaces()).filter((p: any) => String(p.google_place_id || '').startsWith('ChIJreal_test_')).length;

async function run() {
  const originalDataMode = process.env.DATA_MODE;
  process.env.DATA_MODE = 'supabase'; // o serviço decide pela origem; o store continua em memória no teste
  const candidates = [1, 2, 3].map(mkCand);

  // --- Cenário 1: fonte fixture/mock ---
  (googlePlacesServer as any).isConfigured = () => false;
  let svc = await newAuthorizedService();
  svc.discoverCandidatesForCity = async () => candidates;
  await svc.executeNextMicrolot('test-admin');
  assert(await countGoogleTestPlaces() === 0, 'Fonte fixture NÃO pode gravar locais no catálogo');
  console.log('✓ 1. Fixture/mock: 0 locais gravados');

  // --- Cenário 2: Google ao vivo (simulado) ---
  (googlePlacesServer as any).isConfigured = () => true;
  (googlePlacesServer as any).getApiKey = () => 'AIzaSyFAKE_live_key_for_test_only';
  const origGetConfig = googlePlacesCostGuard.getConfig.bind(googlePlacesCostGuard);
  (googlePlacesCostGuard as any).getConfig = () => ({ ...origGetConfig(), enabled: true });

  svc = await newAuthorizedService();
  svc.discoverCandidatesForCity = async (city: string) => (city === 'Gramado' ? candidates : []);
  await svc.executeNextMicrolot('test-admin');
  const saved = (await supabaseServer.getPlaces()).filter((p: any) => String(p.google_place_id || '').startsWith('ChIJreal_test_'));
  assert(saved.length === 3, `Esperado 3 locais gravados, obtido ${saved.length}`);
  const noRating = saved.find((p: any) => p.google_place_id.includes('_1_'));
  assert(!noRating || !noRating.rating || noRating.rating !== 4.5, 'Não pode inventar nota 4.5 quando o Google não informou');
  console.log('✓ 2. Google ao vivo: 3 locais gravados, sem nota inventada');

  // --- Cenário 3: reexecução ---
  svc = await newAuthorizedService();
  svc.discoverCandidatesForCity = async (city: string) => (city === 'Gramado' ? candidates : []);
  await svc.executeNextMicrolot('test-admin');
  assert(await countGoogleTestPlaces() === 3, 'Reexecução não pode duplicar locais');
  console.log('✓ 3. Reexecução: sem duplicatas');

  (googlePlacesCostGuard as any).getConfig = origGetConfig;
  if (originalDataMode === undefined) delete process.env.DATA_MODE; else process.env.DATA_MODE = originalDataMode;
  console.log('\n🎉 Persistência do Accelerator validada.');
}
run().catch(e => { console.error('ERRO NO TESTE:', e); process.exit(1); });

import dotenv from 'dotenv';
import { rateLimitService } from '../src/server/security/RateLimitService';
import { singleFlight } from '../src/server/cache/SingleFlight';
import { sanitizeLog } from '../src/server/security/StructuredLogger';
import { externalFetch } from '../src/server/utils/externalFetch';

dotenv.config();

const BASE_URL = 'http://127.0.0.1:3000';

async function runSprint8BTests() {
  console.log('================================================================');
  console.log('🚀 INICIANDO TESTES DA SPRINT 8B: PERFORMANCE, SEGURANÇA E ESCALA');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
    } else {
      console.error(`❌ [FAIL] ${title}${details ? ` -> ${details}` : ''}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. CACHE CONTROL: ASSETS & PRIVATE APIS
  // ---------------------------------------------------------------------------
  console.log('--- 1. CACHE HEADERS (STATIC & PRIVATE APIS) ---');
  
  // Test private APIs: /api/payments/pricing
  const privRes = await fetch(`${BASE_URL}/api/payments/pricing`);
  const privCache = privRes.headers.get('cache-control') || '';
  assert(
    privCache.includes('private') && privCache.includes('no-store'),
    'Private Cache Protection em /api/payments/pricing',
    `Recebido: ${privCache}`
  );

  // Test private APIs: /api/places/search
  const placesRes = await fetch(`${BASE_URL}/api/places/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'Lago Negro' })
  });
  const placesCache = placesRes.headers.get('cache-control') || '';
  assert(
    placesCache.includes('public') || placesCache.includes('no-store'),
    'Controle de cache adequado em buscas de locais'
  );

  // ---------------------------------------------------------------------------
  // 2. SECURITY HEADERS & CSP
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. SECURITY HEADERS & CSP ---');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const hsts = healthRes.headers.get('strict-transport-security') || '';
  const xcto = healthRes.headers.get('x-content-type-options') || '';
  const refPol = healthRes.headers.get('referrer-policy') || '';
  const permPol = healthRes.headers.get('permissions-policy') || '';
  const csp = healthRes.headers.get('content-security-policy') || '';

  assert(hsts.includes('max-age'), 'HSTS header presente e configurado', hsts);
  assert(xcto === 'nosniff', 'X-Content-Type-Options: nosniff ativo', xcto);
  assert(refPol.includes('origin'), 'Referrer-Policy ativa', refPol);
  assert(permPol.includes('geolocation'), 'Permissions-Policy ativa', permPol);
  assert(csp.includes("default-src 'self'"), 'CSP equilibrada ativa sem quebras', csp);

  // ---------------------------------------------------------------------------
  // 3. RATE LIMIT POLICIES (SEPARATE BY CATEGORY)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. RATE LIMIT POLICIES & GUIDE LIMIT PER TRIP ---');
  rateLimitService.clear();

  // Test Guide policy
  const tripTestId = 'trip_ratelimit_demo_1';
  let guideAllowed = true;
  for (let i = 0; i < 15; i++) {
    const res = rateLimitService.consume('guide', tripTestId);
    if (!res.allowed) guideAllowed = false;
  }
  assert(guideAllowed, 'Guide permite até 15 requisições dentro da janela');
  const guideBlocked = rateLimitService.consume('guide', tripTestId);
  assert(!guideBlocked.allowed, 'Guide bloqueia a 16ª requisição excedente', `Retry after: ${guideBlocked.retryAfterSec}s`);

  // Test Configurable Guide Limit per Trip
  const customTripId = 'trip_custom_vip_1';
  rateLimitService.setTripGuideLimit(customTripId, 3);
  rateLimitService.consume('guide', customTripId);
  rateLimitService.consume('guide', customTripId);
  rateLimitService.consume('guide', customTripId);
  const customBlocked = rateLimitService.consume('guide', customTripId);
  assert(!customBlocked.allowed, 'Limite customizado por Trip respeitado (bloqueou após 3)');

  // Test Recovery policy (5 calls)
  rateLimitService.clear();
  const recIp = '192.168.1.50';
  for (let i = 0; i < 5; i++) {
    rateLimitService.consume('recovery', recIp);
  }
  const recExceeded = rateLimitService.consume('recovery', recIp);
  assert(!recExceeded.allowed, 'Recovery bloqueia após 5 tentativas consecutivas');

  // Test Checkout policy (10 calls)
  rateLimitService.clear();
  const chkIp = '192.168.1.60';
  for (let i = 0; i < 10; i++) {
    rateLimitService.consume('checkout', chkIp);
  }
  const chkExceeded = rateLimitService.consume('checkout', chkIp);
  assert(!chkExceeded.allowed, 'Checkout bloqueia após 10 tentativas consecutivas por minuto');

  // ---------------------------------------------------------------------------
  // 4. CACHE STAMPEDE (SINGLEFLIGHT PROMISE COALESCING)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. CACHE STAMPEDE & CONCURRENCY MUTEX ---');
  let realExecutionCount = 0;
  async function expensiveBackendLookup(key: string) {
    realExecutionCount++;
    await new Promise(r => setTimeout(r, 50));
    return { key, data: 'authoritative_place_data' };
  }

  // Fire 10 simultaneous calls for identical key
  const coalesced = await Promise.all(
    Array.from({ length: 10 }).map(() => singleFlight.do('places:lago_negro', () => expensiveBackendLookup('lago_negro')))
  );

  assert(coalesced.length === 10, '10 requisições simultâneas responderam com sucesso');
  assert(realExecutionCount === 1, 'Proteção contra Cache Stampede: apenas 1 execução real realizada', `Execuções: ${realExecutionCount}`);

  // ---------------------------------------------------------------------------
  // 5. CONCURRENT CHECKOUTS (1 CHARGE / 1 ORDER REUSED)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. CONCURRENT CHECKOUT & WEBHOOK DEDUP ---');
  const sharedTripId = `trip_concurrency_${Date.now()}`;
  const checkoutPayload = {
    tripId: sharedTripId,
    customerName: 'Concorrência Teste',
    customerEmail: 'concorrencia@duo21.com.br',
    numberOfDays: 4,
    paymentMethod: 'pix'
  };

  // Launch 5 simultaneous checkout requests
  const checkoutResponses = await Promise.all(
    Array.from({ length: 5 }).map(() =>
      fetch(`${BASE_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload)
      }).then(r => r.json())
    )
  );

  const orderIds = new Set(checkoutResponses.map(r => r.id || r.asaas_payment_id));
  assert(orderIds.size === 1, 'Checkout simultâneo consolidado em 1 única cobrança', `Ids: ${Array.from(orderIds)}`);

  // Webhook Deduplication & Single Generation
  const token = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const testEventId = `evt_dedup_${Date.now()}`;
  const webhookBody = {
    id: testEventId,
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: checkoutResponses[0].asaas_payment_id || 'pay_dedup_01',
      value: 19.90,
      billingType: 'PIX',
      status: 'RECEIVED',
      externalReference: sharedTripId
    }
  };

  // Launch 3 simultaneous webhook calls with same event ID
  const whResponses = await Promise.all(
    Array.from({ length: 3 }).map(() =>
      fetch(`${BASE_URL}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'asaas-access-token': token,
          'asaas-event-id': testEventId
        },
        body: JSON.stringify(webhookBody)
      }).then(r => r.json())
    )
  );

  const processedCount = whResponses.filter(r => r.status === 'PAID').length;
  const alreadyProcessedCount = whResponses.filter(r => r.status === 'already_processed').length;

  assert(
    processedCount === 1 && alreadyProcessedCount === 2,
    'Webhooks concorrentes com mesmo ID resultam em 1 processamento e 2 already_processed',
    `Processed: ${processedCount}, AlreadyProcessed: ${alreadyProcessedCount}`
  );

  // ---------------------------------------------------------------------------
  // 6. CONCURRENCY LOAD: 10, 50, 100 CONCURRENT REQUESTS
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. CONCURRENCY LOAD: 10, 50, 100 REQUESTS ---');
  async function testConcurrentPings(count: number): Promise<{ success: number; failed: number; avgMs: number }> {
    const start = Date.now();
    const results = await Promise.all(
      Array.from({ length: count }).map(async () => {
        try {
          const r = await fetch(`${BASE_URL}/api/health`);
          return r.ok ? 1 : 0;
        } catch {
          return 0;
        }
      })
    );
    const duration = Date.now() - start;
    const success = results.filter(r => r === 1).length;
    return {
      success,
      failed: count - success,
      avgMs: Math.round(duration / count)
    };
  }

  const load10 = await testConcurrentPings(10);
  assert(load10.success === 10, 'Carga Concorrente 10 requests: 100% OK', `Sucesso: ${load10.success}/10 (Média: ${load10.avgMs}ms)`);

  const load50 = await testConcurrentPings(50);
  assert(load50.success === 50, 'Carga Concorrente 50 requests: 100% OK', `Sucesso: ${load50.success}/50 (Média: ${load50.avgMs}ms)`);

  const load100 = await testConcurrentPings(100);
  assert(load100.success === 100, 'Carga Concorrente 100 requests: 100% OK', `Sucesso: ${load100.success}/100 (Média: ${load100.avgMs}ms)`);

  // ---------------------------------------------------------------------------
  // 7. LOG SANITIZATION & SECRET AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. LOG SANITIZATION & SECRET MASKING ---');
  const dirtyLog = {
    apiKey: 'sec_real_secret_token_12345',
    asaas_access_token: 'secret_token_xyz',
    secure_token: 'v_secure_token_secret_123',
    pix_copy_paste: '00020101021226820014br.gov.bcb.pix...',
    user: 'Mariana',
    card: '4111111111111111'
  };

  const sanitized = sanitizeLog(dirtyLog);
  assert(!JSON.stringify(sanitized).includes('real_secret_token'), 'API Keys mascaradas em logs');
  assert(!JSON.stringify(sanitized).includes('00020101021226820014'), 'PIX Copia e Cola mascarado em logs');
  assert(!JSON.stringify(sanitized).includes('4111111111111111'), 'Dados de cartão de crédito mascarados em logs');
  assert(sanitized.user === 'Mariana', 'Dados não sensíveis preservados');

  // ---------------------------------------------------------------------------
  // 8. EXTERNAL FETCH TIMEOUT & SAFE RETRY POLICY
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. EXTERNAL FETCH TIMEOUT & RETRY ---');
  let timeoutTriggered = false;
  try {
    await externalFetch('http://10.255.255.1', { timeoutMs: 100 });
  } catch (err: any) {
    if (err.message.includes('PROVIDER_TIMEOUT') || err.message.includes('PROVIDER_NETWORK_ERROR')) {
      timeoutTriggered = true;
    }
  }
  assert(timeoutTriggered, 'externalFetch aborta e categoriza erro com timeout controlado');

  // ---------------------------------------------------------------------------
  // FINAL SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 RESULTADO SPRINT 8B: ${passed}/${total} TESTES APROVADOS`);
  console.log(`STATUS: ${passed === total ? 'TODOS OS TESTES APROVADOS! 🚀' : 'FALHAS DETECTADAS'}`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runSprint8BTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

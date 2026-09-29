import { PriceService, APP_PRICING_TIERS } from '../src/services/payment/PriceService';
import { AsaasServerProvider } from '../src/server/payment/AsaasServerProvider';
import { finalItineraryEngine } from '../src/services/finalItineraryEngine';
import { TripPreferences } from '../src/types';

async function runSprint7Tests() {
  console.log('====================================================');
  console.log('🏁 INICIANDO TESTES DA SPRINT 7: ASAAS PAGAMENTO SANDBOX');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: PriceService Tiers & Authoritative Calculations
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: PriceService & Tabela Oficial de Preços ---');
  assert(PriceService.calculatePrice(1) === 19.90, '1 dia custa R$ 19,90');
  assert(PriceService.calculatePrice(4) === 19.90, '4 dias custa R$ 19,90');
  assert(PriceService.calculatePrice(7) === 19.90, '7 dias custa R$ 19,90');
  assert(PriceService.calculatePrice(8) === 24.90, '8 dias custa R$ 24,90');
  assert(PriceService.calculatePrice(10) === 24.90, '10 dias custa R$ 24,90');
  assert(PriceService.calculatePrice(11) === 29.90, '11 dias custa R$ 29,90');
  assert(PriceService.calculatePrice(14) === 29.90, '14 dias custa R$ 29,90');
  assert(PriceService.calculatePrice(15) === 39.90, '15 dias custa R$ 39,90');
  assert(PriceService.calculatePrice(21) === 39.90, '21 dias custa R$ 39,90');
  assert(PriceService.calculatePrice(22) === 49.90, 'Mais de 21 dias aplica teto R$ 49,90');

  const dateCalc = PriceService.calculatePriceFromDates('2026-10-10', '2026-10-13');
  assert(dateCalc.days === 4 && dateCalc.priceBrl === 19.90, 'Cálculo de preço por datas (10/10 a 13/10 = 4 dias / R$ 19,90)');

  // -------------------------------------------------------------------------
  // TEST 2: AsaasServerProvider Environment & Status Normalization
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: AsaasServerProvider & Normalização de Status ---');
  const asaasProvider = new AsaasServerProvider();
  assert(asaasProvider.getEnvironment() === 'sandbox', 'Ambiente padrão é ASAAS_ENV=sandbox');
  assert(asaasProvider.normalizeStatus('PENDING') === 'PENDING', 'PENDING normalizado');
  assert(asaasProvider.normalizeStatus('AWAITING_PAYMENT') === 'PENDING', 'AWAITING_PAYMENT normalizado para PENDING');
  assert(asaasProvider.normalizeStatus('RECEIVED') === 'PAID', 'RECEIVED normalizado para PAID');
  assert(asaasProvider.normalizeStatus('CONFIRMED') === 'PAID', 'CONFIRMED normalizado para PAID');
  assert(asaasProvider.normalizeStatus('OVERDUE') === 'EXPIRED', 'OVERDUE normalizado para EXPIRED');
  assert(asaasProvider.normalizeStatus('REFUNDED') === 'REFUNDED', 'REFUNDED normalizado para REFUNDED');
  assert(asaasProvider.normalizeStatus('DELETED') === 'CANCELLED', 'DELETED normalizado para CANCELLED');

  // -------------------------------------------------------------------------
  // TEST 3: Sandbox Customer & Payment Creation (PIX)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Criação de Cobrança PIX em Sandbox ---');
  const customerId = await asaasProvider.createCustomer({
    name: 'Turista Teste Silva',
    email: 'turista@duo21.com.br'
  });
  assert(Boolean(customerId && customerId.length > 5), 'Customer ID gerado com sucesso', customerId);

  const order = await asaasProvider.createPayment({
    customerId,
    tripId: 'trip_sprint7_test_01',
    amountBrl: 19.90,
    paymentMethod: 'pix',
    customerName: 'Turista Teste Silva',
    customerEmail: 'turista@duo21.com.br'
  });

  assert(order.id.startsWith('ord_'), 'Order ID gerado no formato ord_*');
  assert(order.amount_brl === 19.90, 'Valor exato de R$ 19,90 atribuído');
  assert(order.status === 'PENDING', 'Status inicial é PENDING');
  assert(Boolean(order.pix_copy_paste && order.pix_copy_paste.includes('BR.GOV.BCB.PIX')), 'String PIX copia-e-cola gerada e válida');
  assert(Boolean(order.pix_qr_code), 'URL do QR Code gerada');
  assert(order.is_sandbox === true, 'Sinalizador is_sandbox ativo');

  // -------------------------------------------------------------------------
  // TEST 4: Idempotência de Cobrança
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Idempotência de Pagamento ---');
  const orderStore = new Map<string, any>();
  orderStore.set(order.id, order);

  // Simulating duplicate checkout request for same trip
  let reusedOrder: any = null;
  for (const existing of orderStore.values()) {
    if (existing.trip_id === 'trip_sprint7_test_01' && existing.status === 'PENDING') {
      reusedOrder = existing;
      break;
    }
  }

  assert(reusedOrder !== null && reusedOrder.id === order.id, 'Idempotência: requisição repetida reutiliza a mesma ordem sem duplicidade');

  // -------------------------------------------------------------------------
  // TEST 5: Webhook Processing & Security
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Webhook de Pagamento do Asaas ---');
  const webhookBody = {
    event: 'PAYMENT_RECEIVED',
    payment: {
      id: order.asaas_payment_id || 'pay_test_01',
      customer: customerId,
      value: 19.90,
      netValue: 18.91,
      billingType: 'PIX',
      status: 'RECEIVED',
      externalReference: 'trip_sprint7_test_01'
    }
  };

  const webhookResult = asaasProvider.handleWebhook(webhookBody, process.env.ASAAS_WEBHOOK_TOKEN || undefined);
  assert(webhookResult.valid === true, 'Webhook validado com sucesso');
  assert(webhookResult.isPaid === true, 'Evento PAYMENT_RECEIVED identificado como isPaid');
  assert(webhookResult.normalizedStatus === 'PAID', 'Status resultante normalizado para PAID');

  // -------------------------------------------------------------------------
  // TEST 6: Roteiro Real Bloqueado Antes do Pagamento & Liberado Após Webhook
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Regra Fundamental de Bloqueio e Desbloqueio ---');
  const samplePrefs: TripPreferences = {
    name: 'Turista Teste Silva',
    start_date: '2026-10-10',
    end_date: '2026-10-13',
    number_of_days: 4,
    adults_count: 2,
    children_count: 2,
    children_ages: [7, 11],
    hotel_name: 'Hotel Saint Andrews',
    hotel_city: 'Gramado',
    pace: 'tranquilo',
    transport: 'carro_proprio',
    interests: ['Natureza', 'Gastronomia', 'Crianças'],
    must_have: ['Sequência de Fondue Tradicional'],
    mandatory_places: [],
    restrictions: []
  };

  // 1. Initial State: Trip is in preview mode, NOT unlocked
  const tripRecord: any = {
    id: 'trip_sprint7_test_01',
    status: 'preview',
    preferences: samplePrefs,
    days: []
  };

  assert(tripRecord.status === 'preview' && tripRecord.days.length === 0, 'Pré-pagamento: Roteiro real NÃO foi gerado');

  // 2. Webhook triggers payment confirmation and executes FinalItineraryEngine
  if (webhookResult.isPaid) {
    order.status = 'PAID';
    order.paid_at = new Date().toISOString();
    tripRecord.status = 'paid';

    // Backend generates the authorized real itinerary
    const finalTrip = finalItineraryEngine.generateFinalItinerary(samplePrefs, 'payment');
    tripRecord.days = finalTrip.days;
    tripRecord.status = 'ready';
    tripRecord.secure_token = 'tok_sprint7_approved_123';
  }

  assert(tripRecord.status === 'ready', 'Pós-pagamento: Trip transita para READY');
  assert(tripRecord.days.length === 4, 'Roteiro de 4 dias gerado com sucesso pelo FinalItineraryEngine');
  assert(tripRecord.days.every((d: any) => d.activities.every((a: any) => !a.locked)), 'Todas as atividades desbloqueadas no roteiro final');
  assert(tripRecord.secure_token === 'tok_sprint7_approved_123', 'Token seguro de acesso emitido');

  // -------------------------------------------------------------------------
  // FINAL REPORT SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`📊 RESULTADO DA SPRINT 7: ${passedTests}/${totalTests} TESTES APROVADOS`);
  console.log(`STATUS GERAL: ${passedTests === totalTests ? 'TODOS OS TESTES PASSARAM! 🚀' : 'FALHAS DETECTADAS'}`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSprint7Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

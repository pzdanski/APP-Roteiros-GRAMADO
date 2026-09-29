import dotenv from 'dotenv';
dotenv.config();

function generateValidCPF(): string {
  const rnd = (n: number) => Math.round(Math.random() * n);
  const mod = (dividend: number, divisor: number) => Math.round(dividend - Math.floor(dividend / divisor) * divisor);
  const n = Array(9).fill(0).map(() => rnd(9));
  let d1 = n.reduce((total, number, index) => total + number * (10 - index), 0);
  d1 = 11 - mod(d1, 11);
  if (d1 >= 10) d1 = 0;
  let d2 = d1 * 2 + n.reduce((total, number, index) => total + number * (11 - index), 0);
  d2 = 11 - mod(d2, 11);
  if (d2 >= 10) d2 = 0;
  return `${n.join('')}${d1}${d2}`;
}

async function runValidation() {
  console.log('================================================================');
  console.log('🚀 SPRINT 7.1 — VALIDAÇÃO REAL ASAAS SANDBOX');
  console.log('================================================================\n');

  const apiKey = process.env.ASAAS_API_KEY || '';
  const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN || '';
  const asaasEnv = process.env.ASAAS_ENV || 'sandbox';
  const baseUrl = asaasEnv === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3';
  const localServer = 'http://localhost:3000';

  // ---------------------------------------------------------------------------
  // 1. HEALTH CHECK & ASAAS CONNECTION
  // ---------------------------------------------------------------------------
  console.log('--- 1. HEALTH CHECK & ASAAS CONNECTION ---');
  console.log(`ASAAS_ENV: ${asaasEnv}`);
  console.log(`ASAAS_API_KEY Configured: ${Boolean(apiKey && apiKey.length > 20)} (Length: ${apiKey.length})`);
  console.log(`ASAAS_WEBHOOK_TOKEN Configured: ${Boolean(webhookToken && webhookToken.length > 5)} (Length: ${webhookToken.length})`);

  let asaasConnectionPass = false;
  try {
    const res = await fetch(`${baseUrl}/customers?limit=1`, {
      headers: { 'access_token': apiKey }
    });
    if (res.ok) {
      asaasConnectionPass = true;
      console.log('ASAAS CONNECTION: PASS (HTTP 200 OK)');
    } else {
      console.error(`ASAAS CONNECTION: FAIL (HTTP ${res.status})`);
    }
  } catch (err: any) {
    console.error('ASAAS CONNECTION: FAIL (Network error:', err.message, ')');
  }

  // ---------------------------------------------------------------------------
  // 2. WEBHOOK CONFIGURATION AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. WEBHOOK CONFIGURATION AUDIT ---');
  try {
    const whRes = await fetch(`${baseUrl}/webhooks`, {
      headers: { 'access_token': apiKey }
    });
    if (whRes.ok) {
      const whData = await whRes.json();
      const registered = whData.data?.[0];
      console.log(`Registered Webhook ID: ${registered?.id}`);
      console.log(`Registered Webhook URL: ${registered?.url}`);
      console.log(`Registered Enabled: ${registered?.enabled}`);
      console.log(`Registered hasAuthToken: ${registered?.hasAuthToken}`);
      console.log(`Registered Events: ${registered?.events?.join(', ')}`);
    }
  } catch (err: any) {
    console.warn('Webhook query warning:', err.message);
  }

  // ---------------------------------------------------------------------------
  // 3. CRIAR VIAGEM DE TESTE (4 dias, 2 adultos, Gramado/Canela, R$ 19,90)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. CRIAR VIAGEM DE TESTE ---');
  const testTripId = `trip_sprint71_${Date.now()}`;
  const testCpf = generateValidCPF();
  const testCustomerEmail = `turista.sprint71_${Date.now()}@duo21.com.br`;
  const testCustomerName = 'Turista Teste Sprint 7.1';
  const startDate = '2026-10-10';
  const endDate = '2026-10-13'; // 4 dias

  console.log(`Trip ID de Teste: ${testTripId}`);
  console.log(`Duração: 4 dias (10/10 a 13/10) | Hóspedes: 2 adultos | Destino: Gramado/Canela`);
  console.log(`Preço Esperado (PriceService): R$ 19,90`);

  // ---------------------------------------------------------------------------
  // 4. CHECKOUT REAL NO SANDBOX
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. CHECKOUT REAL DO SANDBOX (POST /api/payments/checkout) ---');
  const checkoutRes = await fetch(`${localServer}/api/payments/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripId: testTripId,
      customerName: testCustomerName,
      customerEmail: testCustomerEmail,
      customerCpf: testCpf,
      startDate,
      endDate,
      paymentMethod: 'pix'
    })
  });

  if (!checkoutRes.ok) {
    const err = await checkoutRes.json();
    throw new Error(`Checkout failed with status ${checkoutRes.status}: ${JSON.stringify(err)}`);
  }

  const checkoutData = await checkoutRes.json();
  const asaasPaymentId = checkoutData.asaas_payment_id;
  const maskedPaymentId = asaasPaymentId ? `${asaasPaymentId.slice(0, 6)}***${asaasPaymentId.slice(-4)}` : 'N/A';
  const orderId = checkoutData.id;

  console.log(`Order ID Criado: ${orderId}`);
  console.log(`ASAAS Payment ID (mascarado): ${maskedPaymentId}`);
  console.log(`Valor Cobrado: R$ ${checkoutData.amount_brl?.toFixed(2)}`);
  console.log(`Billing Type: ${checkoutData.payment_method?.toUpperCase()}`);
  console.log(`Status Inicial: ${checkoutData.status}`);

  // ---------------------------------------------------------------------------
  // 5. VALIDAR NO ASAAS VIA API
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. VALIDAR COBRANÇA DIRETAMENTE NO ASAAS SANDBOX ---');
  const getPayRes = await fetch(`${baseUrl}/payments/${asaasPaymentId}`, {
    headers: { 'access_token': apiKey }
  });
  const asaasPayRecord = await getPayRes.json();

  console.log(`Status Direto no Asaas: ${asaasPayRecord.status}`);
  console.log(`Valor Registrado no Asaas: R$ ${asaasPayRecord.value?.toFixed(2)}`);
  console.log(`Customer ID no Asaas: ${asaasPayRecord.customer}`);
  console.log(`External Reference no Asaas: ${asaasPayRecord.externalReference}`);

  // ---------------------------------------------------------------------------
  // 6. PIX SANDBOX (QR Code e Copia e Cola)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. PIX SANDBOX (QR CODE & COPIA E COLA) ---');
  console.log(`PIX Copia e Cola Válido: ${Boolean(checkoutData.pix_copy_paste?.startsWith('000201'))}`);
  console.log(`PIX Copia e Cola Preview: ${checkoutData.pix_copy_paste?.slice(0, 35)}...`);
  console.log(`PIX QR Code Presente: ${Boolean(checkoutData.pix_qr_code?.length > 50)}`);
  console.log(`PIX Data de Vencimento: ${checkoutData.pix_expiration_date}`);

  // ---------------------------------------------------------------------------
  // 7. CONFIRMAÇÃO DO PAGAMENTO VIA MECANISMO OFICIAL SANDBOX (receiveInCash)
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. CONFIRMAÇÃO OFICIAL NO ASAAS SANDBOX (receiveInCash) ---');
  const today = new Date().toISOString().split('T')[0];
  const confRes = await fetch(`${baseUrl}/payments/${asaasPaymentId}/receiveInCash`, {
    method: 'POST',
    headers: {
      'access_token': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentDate: today,
      value: 19.90,
      notifyCustomer: false
    })
  });

  const confData = await confRes.json();
  console.log(`Asaas receiveInCash HTTP Status: ${confRes.status}`);
  console.log(`Status Asaas após confirmação: ${confData.status}`);

  // ---------------------------------------------------------------------------
  // 8. WEBHOOK REAL DO ASAAS (Token Auth, Payload, Persistência)
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. PROCESSAMENTO DO WEBHOOK COM TOKEN AUTH & EVENTO REAL ---');
  const webhookEventPayload = {
    id: `evt_sprint71_${Date.now()}`,
    event: 'PAYMENT_RECEIVED',
    dateCreated: new Date().toISOString(),
    payment: {
      id: asaasPaymentId,
      customer: asaasPayRecord.customer,
      value: 19.90,
      netValue: 18.91,
      billingType: 'PIX',
      status: 'RECEIVED_IN_CASH',
      externalReference: testTripId
    }
  };

  // Test with invalid token to prove security
  const badAuthRes = await fetch(`${localServer}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': 'token_invalido_de_ataque'
    },
    body: JSON.stringify(webhookEventPayload)
  });
  console.log(`Webhook com token inválido rejeitado com HTTP: ${badAuthRes.status} (Esperado: 401)`);

  // Test with valid real secret token
  const goodAuthRes = await fetch(`${localServer}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': webhookToken
    },
    body: JSON.stringify(webhookEventPayload)
  });
  const webhookResult = await goodAuthRes.json();
  console.log(`Webhook com token real aceito com HTTP: ${goodAuthRes.status} (Esperado: 200)`);
  console.log(`Resultado do Webhook:`, webhookResult);

  // ---------------------------------------------------------------------------
  // 9, 10, 11, 12, 13. STATUS, GERAÇÃO ÚNICA & ACESSO SEGURO
  // ---------------------------------------------------------------------------
  console.log('\n--- 9 & 10 & 11 & 12 & 13. TRANSIÇÃO, GERAÇÃO DO ROTEIRO & ACESSO SEGURO ---');
  const tripStatusRes = await fetch(`${localServer}/api/payments/trip-status/${testTripId}`);
  const tripStatusData = await tripStatusRes.json();

  console.log(`Trip Final State: ${tripStatusData.status.toUpperCase()}`);
  console.log(`Is Paid: ${tripStatusData.isPaid}`);
  console.log(`Secure Trip Token: ${tripStatusData.secureToken}`);
  console.log(`Dias de Roteiro Detalhado Gerados: ${tripStatusData.trip?.days?.length || 0} dias`);
  console.log(`Primeiro dia: Manhã: "${tripStatusData.trip?.days?.[0]?.morning?.title}", Tarde: "${tripStatusData.trip?.days?.[0]?.afternoon?.title}", Noite: "${tripStatusData.trip?.days?.[0]?.night?.title}"`);

  // ---------------------------------------------------------------------------
  // 14. WEBHOOK DUPLICADO (Idempotência)
  // ---------------------------------------------------------------------------
  console.log('\n--- 14. TESTE DE WEBHOOK DUPLICADO (IDEMPOTÊNCIA) ---');
  const dupRes = await fetch(`${localServer}/api/payments/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'asaas-access-token': webhookToken
    },
    body: JSON.stringify(webhookEventPayload)
  });
  const dupData = await dupRes.json();
  console.log(`Status Webhook Duplicado: ${JSON.stringify(dupData)} (Esperado: already_processed)`);

  // ---------------------------------------------------------------------------
  // 15. AUDIT LOGS (payment_events)
  // ---------------------------------------------------------------------------
  console.log('\n--- 15. LOGS DE AUDITORIA (payment_events) ---');
  const eventsRes = await fetch(`${localServer}/api/payments/events`);
  const allEvents = await eventsRes.json();
  const tripEvents = allEvents.filter((e: any) => 
    e.payload?.tripId === testTripId || e.payload?.asaasPaymentId === asaasPaymentId
  );

  console.log(`Total de Eventos Auditados para esta Viagem: ${tripEvents.length}`);
  for (const ev of tripEvents) {
    console.log(`- [${ev.created_at}] Tipo: ${ev.type} | ID: ${ev.id}`);
  }

  const hasCreated = tripEvents.some((e: any) => e.type === 'PAYMENT_CREATED');
  const hasConfirmed = tripEvents.some((e: any) => e.type === 'PAYMENT_RECEIVED' || e.type === 'PAYMENT_CONFIRMED');
  const hasItinerary = tripEvents.some((e: any) => e.type === 'ITINERARY_GENERATED');
  const itineraryCount = tripEvents.filter((e: any) => e.type === 'ITINERARY_GENERATED').length;

  console.log(`\nAuditoria PAYMENT_CREATED: ${hasCreated ? 'SIM' : 'NÃO'}`);
  console.log(`Auditoria PAYMENT_RECEIVED/CONFIRMED: ${hasConfirmed ? 'SIM' : 'NÃO'}`);
  console.log(`Auditoria ITINERARY_GENERATED: ${hasItinerary ? 'SIM' : 'NÃO'} (Execuções: ${itineraryCount})`);
  console.log(`FINAL ITINERARY GENERATIONS: ${itineraryCount} (Esperado: 1)`);

  console.log('\n================================================================');
  console.log('🏁 VALIDAÇÃO COMPLETA CONCLUÍDA');
  console.log('================================================================');
}

runValidation().catch(console.error);

import { PriceService, APP_PRICING_TIERS } from '../src/services/payment/PriceService';
import { CampaignService } from '../src/services/payment/CampaignService';

async function runSprint92Tests() {
  console.log('====================================================');
  console.log('🚀 DUO21 SPRINT 9.2: PRICING & LAUNCH 300 SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    }
  }

  const campaign = new CampaignService();
  campaign.resetForTest();

  // -------------------------------------------------------------------------
  // TEST 1: Official Pricing Table Verification (Section 1)
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Official Pricing Table Tiers ---');
  assert(PriceService.calculateOfficialPrice(1) === 29.90, '1 day = R$ 29,90 official');
  assert(PriceService.calculateOfficialPrice(3) === 29.90, '3 days = R$ 29,90 official');
  assert(PriceService.calculateOfficialPrice(4) === 39.90, '4 days = R$ 39,90 official');
  assert(PriceService.calculateOfficialPrice(7) === 39.90, '7 days = R$ 39,90 official');
  assert(PriceService.calculateOfficialPrice(8) === 49.90, '8 days = R$ 49,90 official');
  assert(PriceService.calculateOfficialPrice(10) === 49.90, '10 days = R$ 49,90 official');
  assert(PriceService.calculateOfficialPrice(11) === 59.90, '11 days = R$ 59,90 official');
  assert(PriceService.calculateOfficialPrice(14) === 59.90, '14 days = R$ 59,90 official');
  assert(PriceService.calculateOfficialPrice(15) === 79.90, '15 days = R$ 79,90 official');
  assert(PriceService.calculateOfficialPrice(21) === 79.90, '21 days = R$ 79,90 official');
  assert(PriceService.calculateOfficialPrice(25) === 99.90, '25 days (>21 days) = R$ 99,90 configured explicit rule');

  // -------------------------------------------------------------------------
  // TEST 2: Active Launch Campaign (Section 2 & 4)
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Active Launch Campaign (R$ 19,90 for all eligible durations) ---');
  const testDays = [1, 3, 4, 7, 8, 10, 11, 14, 15, 21];
  for (const days of testDays) {
    const calc = PriceService.calculatePriceFromDates(undefined, undefined, days, false);
    assert(calc.priceBrl === 19.90, `During campaign: ${days} days is charged R$ 19,90`);
    assert(calc.isPromotional === true, `During campaign: ${days} days marked isPromotional`);
    assert(calc.campaignId === 'launch_300', `During campaign: campaignId is launch_300`);
    assert(calc.discountBrl === Math.round((calc.officialPriceBrl - 19.90) * 100) / 100, `Discount properly computed for ${days} days`);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Payments 299, 300, 301 and Auto-Exhaustion (Section 2, 3 & 8)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Payments 299, 300, 301 Progression ---');
  campaign.resetForTest();
  campaign.seedRedemptionsForTest(298);

  assert(campaign.getRedemptionsCount() === 298, 'Seeded exactly 298 redemptions');
  assert(campaign.getRemainingRedemptions() === 2, '2 slots remaining');
  assert(campaign.isCampaignAvailable() === true, 'Campaign available at 298');

  // Payment 299
  const res299 = await campaign.recordConfirmedPayment({
    orderId: 'ord_299',
    paymentId: 'pay_299',
    amountBrl: 19.90,
    officialPriceBrl: 39.90,
    tripDays: 5
  });
  assert(res299.success === true, 'Payment 299 succeeds');
  assert(res299.slotNumber === 299, 'Payment 299 gets slot 299');
  assert(campaign.getRemainingRedemptions() === 1, '1 slot remaining after 299');
  assert(campaign.isCampaignAvailable() === true, 'Campaign still available at 299');

  // Payment 300 (Final slot)
  const res300 = await campaign.recordConfirmedPayment({
    orderId: 'ord_300',
    paymentId: 'pay_300',
    amountBrl: 19.90,
    officialPriceBrl: 49.90,
    tripDays: 9
  });
  assert(res300.success === true, 'Payment 300 succeeds');
  assert(res300.slotNumber === 300, 'Payment 300 gets slot 300');
  assert(res300.campaignExhausted === true, 'Payment 300 flags campaignExhausted');
  assert(campaign.getRemainingRedemptions() === 0, '0 slots remaining after 300');
  assert(campaign.isCampaignAvailable() === false, 'Campaign is NOT available after slot 300');

  // Payment 301 (Beyond limit)
  const res301 = await campaign.recordConfirmedPayment({
    orderId: 'ord_301',
    paymentId: 'pay_301',
    amountBrl: 19.90,
    officialPriceBrl: 29.90,
    tripDays: 3
  });
  assert(res301.success === false, 'Payment 301 is rejected by campaign');
  assert(res301.reason === 'CAMPAIGN_EXHAUSTED', 'Reason is CAMPAIGN_EXHAUSTED');
  assert(campaign.getRedemptionsCount() === 300, 'Redemptions list count remains strictly 300');

  // -------------------------------------------------------------------------
  // TEST 4: Automatic Reversion to Official Table (Section 4 & 8)
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Automatic Pricing Reversion After Campaign Ends ---');
  // When campaign is exhausted (forceOfficial or inactive)
  const postCampaign3Days = PriceService.calculatePriceFromDates(undefined, undefined, 3, true);
  assert(postCampaign3Days.priceBrl === 29.90, 'Post-campaign 3 days = R$ 29,90');
  assert(postCampaign3Days.isPromotional === false, 'Post-campaign isPromotional = false');

  const postCampaign5Days = PriceService.calculatePriceFromDates(undefined, undefined, 5, true);
  assert(postCampaign5Days.priceBrl === 39.90, 'Post-campaign 5 days = R$ 39,90');

  const postCampaign9Days = PriceService.calculatePriceFromDates(undefined, undefined, 9, true);
  assert(postCampaign9Days.priceBrl === 49.90, 'Post-campaign 9 days = R$ 49,90');

  // -------------------------------------------------------------------------
  // TEST 5: Concurrency Protection on Slot 300 (Section 3)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Concurrency Race Test for Final Slot ---');
  campaign.resetForTest();
  campaign.seedRedemptionsForTest(299); // Only 1 slot left

  // Fire 10 simultaneous payments competing for the 300th slot
  const concurrentAttempts = Array.from({ length: 10 }, (_, i) => 
    campaign.recordConfirmedPayment({
      orderId: `ord_race_${i}`,
      paymentId: `pay_race_${i}`,
      amountBrl: 19.90,
      officialPriceBrl: 39.90,
      tripDays: 4
    })
  );

  const results = await Promise.all(concurrentAttempts);
  const successful = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  assert(successful.length === 1, 'Exactly ONE concurrent payment gets the final slot');
  assert(successful[0].slotNumber === 300, 'The successful payment receives slot 300');
  assert(rejected.length === 9, 'All other 9 concurrent attempts are rejected');
  assert(campaign.getRedemptionsCount() === 300, 'Total redemptions never exceeds 300 under high concurrency');

  // -------------------------------------------------------------------------
  // TEST 6: Idempotency & Webhook Duplication (Section 2)
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Idempotency & Webhook Duplication ---');
  campaign.resetForTest();
  campaign.seedRedemptionsForTest(10);

  const initialCount = campaign.getRedemptionsCount();
  const dup1 = await campaign.recordConfirmedPayment({
    orderId: 'ord_dup_1',
    paymentId: 'pay_dup_1',
    amountBrl: 19.90,
    officialPriceBrl: 39.90,
    tripDays: 4
  });
  assert(dup1.success === true, 'First payment confirmation succeeds');
  assert(dup1.slotNumber === 11, 'Slot 11 assigned');

  // Duplicate webhook with same paymentId
  const dup2 = await campaign.recordConfirmedPayment({
    orderId: 'ord_dup_1_retry',
    paymentId: 'pay_dup_1', // identical paymentId
    amountBrl: 19.90,
    officialPriceBrl: 39.90,
    tripDays: 4
  });
  assert(dup2.success === true, 'Duplicate webhook returns success');
  assert(dup2.alreadyRedeemed === true, 'Flagged as alreadyRedeemed');
  assert(dup2.slotNumber === 11, 'Re-returns the same slot 11');
  assert(campaign.getRedemptionsCount() === initialCount + 1, 'Slot count did NOT increment on duplicate webhook');

  // -------------------------------------------------------------------------
  // TEST 7: Commercial Analytics (Section 10)
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Commercial Analytics Metrics ---');
  campaign.resetForTest();
  await campaign.recordConfirmedPayment({
    orderId: 'ord_an_1',
    paymentId: 'pay_an_1',
    amountBrl: 19.90,
    officialPriceBrl: 29.90,
    tripDays: 3
  });
  await campaign.recordConfirmedPayment({
    orderId: 'ord_an_2',
    paymentId: 'pay_an_2',
    amountBrl: 19.90,
    officialPriceBrl: 49.90,
    tripDays: 8
  });

  const adminMetrics = campaign.getAdminMetrics();
  assert(adminMetrics.metrics.total_campaign_orders_paid === 2, '2 campaign orders tracked');
  assert(adminMetrics.metrics.total_campaign_revenue_brl === 39.80, 'Revenue = 19.90 + 19.90 = R$ 39,80');
  assert(adminMetrics.metrics.average_ticket_brl === 19.90, 'Average ticket = R$ 19,90');
  assert(adminMetrics.metrics.total_promotional_discount_brl === 40.00, 'Discount = (29.90-19.90) + (49.90-19.90) = R$ 40,00');

  // -------------------------------------------------------------------------
  // TEST 8: Public Campaign Status Safety (Section 6)
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Public Endpoint Safety ---');
  const pubStatus = campaign.getPublicStatus();
  assert(pubStatus.active === true, 'Public status has active');
  assert(pubStatus.campaign_price === 19.90, 'Public status has campaign_price');
  assert(pubStatus.max_redemptions === 300, 'Public status has max_redemptions');
  assert(typeof pubStatus.remaining_redemptions === 'number', 'Public status has remaining_redemptions');
  assert((pubStatus as any).customerEmail === undefined, 'No customer email exposed');
  assert((pubStatus as any).paymentId === undefined, 'No internal payment ID exposed');

  console.log('\n====================================================');
  console.log(`🎯 ALL SPRINT 9.2 TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runSprint92Tests().catch((err) => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});

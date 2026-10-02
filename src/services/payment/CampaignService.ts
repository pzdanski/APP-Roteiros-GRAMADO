/**
 * Commercial Campaign Service (Sprint 9.2)
 * Manages the launch campaign "Lançamento — Primeiros 300 Roteiros" (launch_300).
 * Enforces transactional concurrency, idempotency, and automatic expiration upon 300 confirmed redemptions.
 */

export interface CommercialCampaignConfig {
  id: string;
  name: string;
  priceBrl: number;
  maxRedemptions: number;
  active: boolean;
  startDate: string;
  endDate?: string | null;
  description?: string;
  officialStartingPrice: number;
}

export interface CampaignPublicStatus {
  active: boolean;
  campaign_id: string;
  campaign_name: string;
  campaign_price: number;
  official_starting_price: number;
  max_redemptions: number;
  remaining_redemptions: number;
  is_available: boolean;
}

export interface CampaignAdminMetrics {
  campaign: CommercialCampaignConfig & {
    redemptions_count: number;
    remaining_redemptions: number;
    status: 'ACTIVE' | 'EXHAUSTED' | 'INACTIVE';
  };
  metrics: {
    total_campaign_orders_paid: number;
    total_campaign_revenue_brl: number;
    average_ticket_brl: number;
    total_promotional_discount_brl: number;
  };
}

export interface RedemptionRecord {
  orderId: string;
  paymentId: string;
  slotNumber: number;
  amountBrl: number;
  officialPriceBrl: number;
  discountAmountBrl: number;
  tripDays: number;
  confirmedAt: string;
}

export class CampaignService {
  private config: CommercialCampaignConfig = {
    id: 'launch_300',
    name: 'Lançamento — Primeiros 300 Roteiros',
    priceBrl: 19.90,
    maxRedemptions: 300,
    active: true,
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: null,
    description: 'R$19,90 para os primeiros 300 roteiros pagos',
    officialStartingPrice: 29.90
  };

  // Tracking confirmed paid redemptions
  private redemptionsByPaymentId = new Map<string, RedemptionRecord>();
  private redemptionsByOrderId = new Map<string, RedemptionRecord>();
  private redemptionsList: RedemptionRecord[] = [];

  // Lock to serialize slot assignments and avoid race conditions (Section 3: Concurrency)
  private isProcessingLock = false;
  private queue: Array<() => void> = [];

  private async acquireLock(): Promise<void> {
    if (!this.isProcessingLock) {
      this.isProcessingLock = true;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  private releaseLock(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    } else {
      this.isProcessingLock = false;
    }
  }

  getConfig(): CommercialCampaignConfig {
    return { ...this.config };
  }

  getRedemptionsCount(): number {
    return this.redemptionsList.length;
  }

  getRemainingRedemptions(): number {
    return Math.max(0, this.config.maxRedemptions - this.redemptionsList.length);
  }

  isCampaignAvailable(): boolean {
    return (
      this.config.active &&
      this.redemptionsList.length < this.config.maxRedemptions
    );
  }

  getPublicStatus(): CampaignPublicStatus {
    const count = this.redemptionsList.length;
    const remaining = Math.max(0, this.config.maxRedemptions - count);
    const isAvailable = this.config.active && remaining > 0;

    return {
      active: this.config.active,
      campaign_id: this.config.id,
      campaign_name: this.config.name,
      campaign_price: this.config.priceBrl,
      official_starting_price: this.config.officialStartingPrice,
      max_redemptions: this.config.maxRedemptions,
      remaining_redemptions: remaining,
      is_available: isAvailable
    };
  }

  getAdminMetrics(): CampaignAdminMetrics {
    const count = this.redemptionsList.length;
    const remaining = Math.max(0, this.config.maxRedemptions - count);
    let status: 'ACTIVE' | 'EXHAUSTED' | 'INACTIVE' = 'ACTIVE';

    if (!this.config.active) {
      status = 'INACTIVE';
    } else if (remaining === 0) {
      status = 'EXHAUSTED';
    }

    const totalRevenue = this.redemptionsList.reduce((acc, r) => acc + r.amountBrl, 0);
    const totalDiscount = this.redemptionsList.reduce((acc, r) => acc + r.discountAmountBrl, 0);
    const avgTicket = count > 0 ? Math.round((totalRevenue / count) * 100) / 100 : this.config.priceBrl;

    return {
      campaign: {
        ...this.config,
        redemptions_count: count,
        remaining_redemptions: remaining,
        status
      },
      metrics: {
        total_campaign_orders_paid: count,
        total_campaign_revenue_brl: Math.round(totalRevenue * 100) / 100,
        average_ticket_brl: avgTicket,
        total_promotional_discount_brl: Math.round(totalDiscount * 100) / 100
      }
    };
  }

  /**
   * Atomically records a confirmed paid redemption.
   * Concurrency-safe, idempotent, and stops at exactly maxRedemptions (300).
   */
  async recordConfirmedPayment(params: {
    orderId: string;
    paymentId: string;
    amountBrl: number;
    officialPriceBrl: number;
    tripDays: number;
  }): Promise<{
    success: boolean;
    slotNumber?: number;
    alreadyRedeemed?: boolean;
    reason?: string;
    campaignExhausted?: boolean;
  }> {
    await this.acquireLock();
    try {
      const cleanPaymentId = (params.paymentId || '').trim();
      const cleanOrderId = (params.orderId || '').trim();

      // 1. Idempotency Check: Same payment or order already redeemed
      if (cleanPaymentId && this.redemptionsByPaymentId.has(cleanPaymentId)) {
        const existing = this.redemptionsByPaymentId.get(cleanPaymentId)!;
        return {
          success: true,
          slotNumber: existing.slotNumber,
          alreadyRedeemed: true
        };
      }

      if (cleanOrderId && this.redemptionsByOrderId.has(cleanOrderId)) {
        const existing = this.redemptionsByOrderId.get(cleanOrderId)!;
        return {
          success: true,
          slotNumber: existing.slotNumber,
          alreadyRedeemed: true
        };
      }

      // 2. Capacity Check
      if (this.redemptionsList.length >= this.config.maxRedemptions) {
        // Automatically deactivate if not already done
        this.config.active = false;
        return {
          success: false,
          reason: 'CAMPAIGN_EXHAUSTED',
          campaignExhausted: true
        };
      }

      if (!this.config.active) {
        return {
          success: false,
          reason: 'CAMPAIGN_INACTIVE'
        };
      }

      // 3. Allocate slot atomically
      const slotNumber = this.redemptionsList.length + 1;
      const discount = Math.max(0, Math.round((params.officialPriceBrl - params.amountBrl) * 100) / 100);

      const record: RedemptionRecord = {
        orderId: cleanOrderId,
        paymentId: cleanPaymentId,
        slotNumber,
        amountBrl: params.amountBrl,
        officialPriceBrl: params.officialPriceBrl,
        discountAmountBrl: discount,
        tripDays: params.tripDays || 4,
        confirmedAt: new Date().toISOString()
      };

      this.redemptionsList.push(record);
      if (cleanPaymentId) this.redemptionsByPaymentId.set(cleanPaymentId, record);
      if (cleanOrderId) this.redemptionsByOrderId.set(cleanOrderId, record);

      // 4. Check if slot 300 reached -> auto-deactivate campaign
      let campaignExhausted = false;
      if (slotNumber >= this.config.maxRedemptions) {
        this.config.active = false;
        campaignExhausted = true;
        console.log(`[CampaignService] Slot ${slotNumber}/${this.config.maxRedemptions} reached! Campaign launch_300 is now exhausted and deactivated.`);
      }

      return {
        success: true,
        slotNumber,
        campaignExhausted
      };
    } finally {
      this.releaseLock();
    }
  }

  updateCampaign(updates: Partial<CommercialCampaignConfig>): CommercialCampaignConfig {
    if (typeof updates.active === 'boolean') {
      this.config.active = updates.active;
    }
    if (typeof updates.maxRedemptions === 'number' && updates.maxRedemptions > 0) {
      this.config.maxRedemptions = updates.maxRedemptions;
      if (this.redemptionsList.length < this.config.maxRedemptions) {
        this.config.active = true;
      }
    }
    if (typeof updates.priceBrl === 'number' && updates.priceBrl > 0) {
      this.config.priceBrl = updates.priceBrl;
    }
    if (updates.name) {
      this.config.name = updates.name;
    }
    return { ...this.config };
  }

  /**
   * Test helper to seed redemption counts for simulation (e.g. testing payment 299, 300, 301).
   */
  seedRedemptionsForTest(count: number): void {
    this.redemptionsByPaymentId.clear();
    this.redemptionsByOrderId.clear();
    this.redemptionsList = [];
    this.config.active = true;

    for (let i = 1; i <= count; i++) {
      const rec: RedemptionRecord = {
        orderId: `test_ord_${i}`,
        paymentId: `test_pay_${i}`,
        slotNumber: i,
        amountBrl: 19.90,
        officialPriceBrl: 39.90,
        discountAmountBrl: 20.00,
        tripDays: 4,
        confirmedAt: new Date().toISOString()
      };
      this.redemptionsList.push(rec);
      this.redemptionsByPaymentId.set(rec.paymentId, rec);
      this.redemptionsByOrderId.set(rec.orderId, rec);
    }

    if (count >= this.config.maxRedemptions) {
      this.config.active = false;
    }
  }

  resetForTest(): void {
    this.seedRedemptionsForTest(0);
    this.config.active = true;
    this.config.maxRedemptions = 300;
    this.config.priceBrl = 19.90;
  }
}

export const campaignService = new CampaignService();

import { campaignService } from './CampaignService';

export interface PriceTier {
  minDays: number;
  maxDays: number;
  priceBrl: number;
  label: string;
}

/**
 * Official Pricing Tiers (Sprint 9.2 Section 1)
 * “A partir de R$29,90”
 */
export const APP_PRICING_TIERS: PriceTier[] = [
  { minDays: 1, maxDays: 3, priceBrl: 29.90, label: '1 a 3 dias' },
  { minDays: 4, maxDays: 7, priceBrl: 39.90, label: '4 a 7 dias' },
  { minDays: 8, maxDays: 10, priceBrl: 49.90, label: '8 a 10 dias' },
  { minDays: 11, maxDays: 14, priceBrl: 59.90, label: '11 a 14 dias' },
  { minDays: 15, maxDays: 21, priceBrl: 79.90, label: '15 a 21 dias' },
  { minDays: 22, maxDays: 365, priceBrl: 99.90, label: 'Mais de 21 dias' }
];

export interface DetailedPriceCalculation {
  days: number;
  officialPriceBrl: number;
  priceBrl: number;
  tierLabel: string;
  isPromotional: boolean;
  campaignId: string | null;
  campaignName: string | null;
  discountBrl: number;
}

export class PriceService {
  static getPricingTiers(): PriceTier[] {
    return [...APP_PRICING_TIERS];
  }

  static calculateDaysBetween(startDateStr: string, endDateStr: string): number {
    try {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 4;
      }
      const diffMs = end.getTime() - start.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
      return Math.max(1, days);
    } catch {
      return 4;
    }
  }

  /**
   * Calculates the official catalogue price according to duration tiers (Section 1).
   */
  static calculateOfficialPrice(days: number): number {
    const validDays = Math.max(1, Math.round(days));
    const tier = APP_PRICING_TIERS.find(t => validDays >= t.minDays && validDays <= t.maxDays);
    if (tier) {
      return tier.priceBrl;
    }
    if (validDays > 21) {
      return 99.90;
    }
    return 29.90;
  }

  /**
   * Calculates the final authorized price to charge.
   * If the launch campaign is active and has remaining slots, applies R$ 19,90.
   * When campaign is exhausted, applies official table.
   */
  static calculatePrice(days: number, forceOfficial: boolean = false): number {
    const officialPrice = PriceService.calculateOfficialPrice(days);
    if (!forceOfficial && campaignService.isCampaignAvailable()) {
      return campaignService.getConfig().priceBrl;
    }
    return officialPrice;
  }

  /**
   * Detailed breakdown for Checkout and Orders.
   */
  static calculatePriceFromDates(
    startDate?: string, 
    endDate?: string, 
    fallbackDays?: number,
    forceOfficial: boolean = false
  ): DetailedPriceCalculation {
    let days = fallbackDays && fallbackDays >= 1 ? fallbackDays : 4;
    if (startDate && endDate) {
      days = PriceService.calculateDaysBetween(startDate, endDate);
    }

    const officialPrice = PriceService.calculateOfficialPrice(days);
    const tier = APP_PRICING_TIERS.find(t => days >= t.minDays && days <= t.maxDays);
    const tierLabel = tier ? tier.label : (days > 21 ? 'Mais de 21 dias' : '1 a 3 dias');

    const isEligibleForCampaign = !forceOfficial && campaignService.isCampaignAvailable();
    const finalPrice = isEligibleForCampaign ? campaignService.getConfig().priceBrl : officialPrice;
    const discount = Math.max(0, Math.round((officialPrice - finalPrice) * 100) / 100);

    return {
      days,
      officialPriceBrl: officialPrice,
      priceBrl: finalPrice,
      tierLabel,
      isPromotional: isEligibleForCampaign,
      campaignId: isEligibleForCampaign ? campaignService.getConfig().id : null,
      campaignName: isEligibleForCampaign ? campaignService.getConfig().name : null,
      discountBrl: discount
    };
  }
}

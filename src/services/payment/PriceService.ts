export interface PriceTier {
  minDays: number;
  maxDays: number;
  priceBrl: number;
  label: string;
}

export const APP_PRICING_TIERS: PriceTier[] = [
  { minDays: 1, maxDays: 7, priceBrl: 19.90, label: '1 a 7 dias' },
  { minDays: 8, maxDays: 10, priceBrl: 24.90, label: '8 a 10 dias' },
  { minDays: 11, maxDays: 14, priceBrl: 29.90, label: '11 a 14 dias' },
  { minDays: 15, maxDays: 21, priceBrl: 39.90, label: '15 a 21 dias' },
  { minDays: 22, maxDays: 365, priceBrl: 49.90, label: 'Mais de 21 dias' }
];

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

  static calculatePrice(days: number): number {
    const validDays = Math.max(1, Math.round(days));
    const tier = APP_PRICING_TIERS.find(t => validDays >= t.minDays && validDays <= t.maxDays);
    if (tier) {
      return tier.priceBrl;
    }
    if (validDays > 21) {
      return 49.90;
    }
    return 19.90;
  }

  static calculatePriceFromDates(startDate?: string, endDate?: string, fallbackDays?: number): {
    days: number;
    priceBrl: number;
    tierLabel: string;
  } {
    let days = fallbackDays && fallbackDays >= 1 ? fallbackDays : 4;
    if (startDate && endDate) {
      days = PriceService.calculateDaysBetween(startDate, endDate);
    }
    const price = PriceService.calculatePrice(days);
    const tier = APP_PRICING_TIERS.find(t => days >= t.minDays && days <= t.maxDays);
    return {
      days,
      priceBrl: price,
      tierLabel: tier ? tier.label : (days > 21 ? 'Mais de 21 dias' : '1 a 7 dias')
    };
  }
}

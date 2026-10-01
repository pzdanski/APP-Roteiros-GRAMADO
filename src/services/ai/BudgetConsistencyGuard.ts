/**
 * BudgetConsistencyGuard (Sprint 9 Section 19)
 * Guarantees that parsed budget is strictly typed with scope, value, confidence
 * and never silently overwritten or downgraded between views.
 */

export type BudgetScope = 'total_trip' | 'per_day' | 'per_person' | 'per_person_per_day' | 'undefined';

export interface BudgetParseResult {
  raw_budget_text: string;
  parsed_budget_value: number;
  budget_scope: BudgetScope;
  confidence: number; // 0.0 to 1.0
  is_explicit: boolean;
}

const WORD_MAP: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30,
  quarenta: 40, cinquenta: 50
};

export class BudgetConsistencyGuard {
  /**
   * Parses natural language budget, accurately identifying scope and value.
   */
  static parseBudget(rawText: string | undefined | null): BudgetParseResult {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return {
        raw_budget_text: '',
        parsed_budget_value: 3000,
        budget_scope: 'undefined',
        confidence: 0.2,
        is_explicit: false
      };
    }

    const t = rawText.toLowerCase().trim();

    // Check "sem orçamento definido", "sem limite", "livre"
    if (t.includes('sem orçamento') || t.includes('sem orcamento') || t.includes('sem limite') || t.includes('não tenho orçamento') || t.includes('livre')) {
      return {
        raw_budget_text: rawText,
        parsed_budget_value: 0,
        budget_scope: 'undefined',
        confidence: 0.95,
        is_explicit: true
      };
    }

    // 1. Check per_person_per_day e.g. "200 por pessoa por dia"
    const perPersonPerDayMatch = t.match(/(?:r\$\s*)?(\d+)[^\d\n]*(?:por pessoa por dia|ao dia por pessoa|por dia por pessoa)/);
    if (perPersonPerDayMatch) {
      return {
        raw_budget_text: rawText,
        parsed_budget_value: parseInt(perPersonPerDayMatch[1], 10),
        budget_scope: 'per_person_per_day',
        confidence: 0.95,
        is_explicit: true
      };
    }

    // 2. Check per_person e.g. "até 800 por pessoa", "R$ 80 por pessoa"
    const perPersonMatch = t.match(/(?:até|uns|maximo|máximo|de|teto)?\s*(?:r\$\s*)?(\d+)\s*(?:reais)?\s*(?:por pessoa|cada)/);
    if (perPersonMatch) {
      return {
        raw_budget_text: rawText,
        parsed_budget_value: parseInt(perPersonMatch[1], 10),
        budget_scope: 'per_person',
        confidence: 0.95,
        is_explicit: true
      };
    }

    // 3. Check per_day e.g. "500 por dia", "500 ao dia", "diária de 500"
    const perDayMatch = t.match(/(?:até|uns|maximo|máximo|de|teto)?\s*(?:r\$\s*)?(\d+)\s*(?:reais)?\s*(?:por dia|ao dia|diária|diaria)/);
    if (perDayMatch) {
      return {
        raw_budget_text: rawText,
        parsed_budget_value: parseInt(perDayMatch[1], 10),
        budget_scope: 'per_day',
        confidence: 0.95,
        is_explicit: true
      };
    }

    // 4. Check word + mil (e.g. "dez mil", "uns dez mil reais", "até dez mil reais")
    for (const [word, val] of Object.entries(WORD_MAP)) {
      const wordMilRegex = new RegExp(`(?:\\b)${word}\\s+mil(?:\\s+reais)?(?:\\b)`, 'i');
      if (wordMilRegex.test(t)) {
        return {
          raw_budget_text: rawText,
          parsed_budget_value: val * 1000,
          budget_scope: 'total_trip',
          confidence: 0.98,
          is_explicit: true
        };
      }
    }

    // 5. Check number + mil (e.g. "10 mil", "10mil", "uns 10 mil reais", "R$ 3 mil")
    const numMilMatch = t.match(/\b(\d+)\s*mil(?:\s*reais)?\b/);
    if (numMilMatch) {
      return {
        raw_budget_text: rawText,
        parsed_budget_value: parseInt(numMilMatch[1], 10) * 1000,
        budget_scope: 'total_trip',
        confidence: 0.98,
        is_explicit: true
      };
    }

    // 6. Check number + k (e.g. "10k", "R$10k", "10 k")
    const kMatch = t.match(/\b(\d+)\s*k\b/);
    if (kMatch) {
      return {
        raw_budget_text: rawText,
        parsed_budget_value: parseInt(kMatch[1], 10) * 1000,
        budget_scope: 'total_trip',
        confidence: 0.98,
        is_explicit: true
      };
    }

    // 7. Check currency format or 4+ digits (e.g. "R$ 10.000", "R$ 3.000", "10000")
    const currencyMatches = Array.from(t.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d{4,7})(?:,\d{2})?(?:\s*reais)?/g));
    for (const m of currencyMatches) {
      const rawVal = parseInt(m[1].replace(/\./g, ''), 10);
      const after = t.slice((m.index || 0) + m[0].length, (m.index || 0) + m[0].length + 20);
      if (!after.includes('por pessoa') && !after.includes('por dia') && rawVal >= 500) {
        return {
          raw_budget_text: rawText,
          parsed_budget_value: rawVal,
          budget_scope: 'total_trip',
          confidence: 0.95,
          is_explicit: true
        };
      }
    }

    // Default unconfirmed fallback
    return {
      raw_budget_text: rawText,
      parsed_budget_value: 3000,
      budget_scope: 'undefined',
      confidence: 0.4,
      is_explicit: false
    };
  }

  /**
   * Converts a scoped budget to an estimated total trip budget if needed.
   */
  static resolveTotalTripBudget(
    result: BudgetParseResult,
    days: number = 4,
    adults: number = 2,
    children: number = 0
  ): number {
    if (result.budget_scope === 'total_trip') {
      return result.parsed_budget_value;
    }
    if (result.budget_scope === 'per_day') {
      return result.parsed_budget_value * Math.max(1, days);
    }
    if (result.budget_scope === 'per_person') {
      const effectiveTravelers = adults + (children * 0.5);
      return Math.round(result.parsed_budget_value * effectiveTravelers);
    }
    if (result.budget_scope === 'per_person_per_day') {
      const effectiveTravelers = adults + (children * 0.5);
      return Math.round(result.parsed_budget_value * effectiveTravelers * Math.max(1, days));
    }
    // undefined
    return result.parsed_budget_value || 3000;
  }
}

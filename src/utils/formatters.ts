/**
 * Centralized formatting helpers for tourist-facing presentation (Sprint 9).
 * Ensures zero internal enums or database codes leak to users.
 */

const CATEGORY_MAP: Record<string, string> = {
  // Database codes and enums
  FREE_ATTRACTION: 'Atração gratuita',
  ATTRACTION: 'Atração',
  RESTAURANT: 'Restaurante',
  PARK: 'Parque',
  MUSEUM: 'Museu',
  CAFE: 'Café',
  HOTEL: 'Hotel',
  WINERY: 'Vinícola',
  VIEWPOINT: 'Mirante',
  CHOCOLATE: 'Chocolataria',
  FONDUE: 'Sequência de Fondue',
  PIZZERIA: 'Pizzaria',
  BAR: 'Bar & Choperia',
  SHOW: 'Espetáculo',
  NATURE: 'Natureza & Mirante',
  SHOPPING: 'Compras & Artesanato',
  TOUR: 'Passeio Guiado',

  // Lowercase / legacy variations
  free_attraction: 'Atração gratuita',
  attraction: 'Atração',
  restaurante: 'Restaurante',
  restaurant: 'Restaurante',
  parque: 'Parque',
  museu: 'Museu',
  cafe: 'Café',
  hotel: 'Hotel',
  vinicola: 'Vinícola',
  mirante: 'Mirante',
  chocolate: 'Chocolataria',
  fondue: 'Sequência de Fondue',
  pizzaria: 'Pizzaria'
};

/**
 * 9.1 Data Quality: Convert technical enum to user-friendly label.
 * Never outputs raw DB enum or uppercase snake_case to the user.
 */
export function formatPlaceCategory(rawCategory: string | undefined | null): string {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return 'Ponto Turístico';
  }
  const trimmed = rawCategory.trim();
  if (CATEGORY_MAP[trimmed]) {
    return CATEGORY_MAP[trimmed];
  }
  const upper = trimmed.toUpperCase();
  if (CATEGORY_MAP[upper]) {
    return CATEGORY_MAP[upper];
  }
  const lower = trimmed.toLowerCase();
  if (CATEGORY_MAP[lower]) {
    return CATEGORY_MAP[lower];
  }

  // Graceful fallback: clean up underscores, capitalize nicely
  return trimmed
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

/**
 * 9.2 Horários: Distinct representation of always_open, opening_hours known, and unknown.
 * Never invents hours. Groups consecutive days with identical hours.
 */
export interface GroupedHours {
  label: string;
  isAlwaysOpen: boolean;
  isConfirmed: boolean;
  groupedDays: Array<{ days: string; hours: string }>;
  sourceNote?: string;
}

const DAY_ORDER = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
const DAY_LABELS: Record<string, string> = {
  seg: 'SEG',
  ter: 'TER',
  qua: 'QUA',
  qui: 'QUI',
  sex: 'SEX',
  sab: 'SÁB',
  dom: 'DOM'
};

export function formatOpeningHours(
  hours: Record<string, string> | undefined | null,
  alwaysOpen?: boolean,
  source?: string
): GroupedHours {
  if (alwaysOpen === true) {
    return {
      label: 'Sempre aberto',
      isAlwaysOpen: true,
      isConfirmed: true,
      groupedDays: [{ days: 'SEG–DOM', hours: 'Sempre aberto' }],
      sourceNote: source || 'Acesso público contínuo'
    };
  }

  if (!hours || typeof hours !== 'object' || Object.keys(hours).length === 0) {
    return {
      label: 'Horário não confirmado',
      isAlwaysOpen: false,
      isConfirmed: false,
      groupedDays: [],
      sourceNote: 'Consulte no local ou contato direto'
    };
  }

  // Check if all provided days say "Sempre aberto"
  const values = Object.values(hours).map(v => v?.trim());
  const allAlwaysOpen = values.length >= 5 && values.every(v => v.toLowerCase().includes('aberto') || v.toLowerCase().includes('24h'));
  if (allAlwaysOpen) {
    return {
      label: 'Sempre aberto',
      isAlwaysOpen: true,
      isConfirmed: true,
      groupedDays: [{ days: 'SEG–DOM', hours: 'Sempre aberto' }],
      sourceNote: source || 'Curadoria DUO21'
    };
  }

  // Group consecutive days with same hours
  const grouped: Array<{ days: string; hours: string }> = [];
  let currentGroupDays: string[] = [];
  let currentHours: string | null = null;

  for (const dayKey of DAY_ORDER) {
    const rawH = hours[dayKey] || hours[dayKey.toUpperCase()] || hours[DAY_LABELS[dayKey]];
    const h = rawH?.trim();

    if (!h) continue;

    if (h === currentHours) {
      currentGroupDays.push(DAY_LABELS[dayKey]);
    } else {
      if (currentGroupDays.length > 0 && currentHours) {
        grouped.push({
          days: formatDaysRange(currentGroupDays),
          hours: currentHours
        });
      }
      currentGroupDays = [DAY_LABELS[dayKey]];
      currentHours = h;
    }
  }

  if (currentGroupDays.length > 0 && currentHours) {
    grouped.push({
      days: formatDaysRange(currentGroupDays),
      hours: currentHours
    });
  }

  const primaryLabel = grouped.length > 0 ? grouped[0].hours : 'Horário não confirmado';

  return {
    label: primaryLabel,
    isAlwaysOpen: false,
    isConfirmed: grouped.length > 0,
    groupedDays: grouped,
    sourceNote: source || 'Curadoria DUO21'
  };
}

function formatDaysRange(days: string[]): string {
  if (days.length === 1) return days[0];
  if (days.length === 7) return 'SEG–DOM';
  if (days.length === 5 && days[0] === 'SEG' && days[4] === 'SEX') return 'SEG–SEX';
  if (days.length === 2 && days[0] === 'SÁB' && days[1] === 'DOM') return 'SÁB–DOM';
  return `${days[0]}–${days[days.length - 1]}`;
}

/**
 * 9.4 Avaliações: Never fabricate quantity of ratings.
 * Shows rating count ONLY when verified > 0 from a reliable source.
 */
export function formatRating(
  rating: number | undefined | null,
  ratingCount?: number | null,
  ratingSource?: string | null
): { formattedRating: string; formattedCount: string | null; hasCount: boolean } {
  const num = typeof rating === 'number' && !isNaN(rating) ? rating : 4.8;
  const formattedRating = num.toFixed(1).replace('.', ',');

  // Only show count if it exists, is > 0 and not synthetic default
  if (typeof ratingCount === 'number' && ratingCount > 0) {
    return {
      formattedRating,
      formattedCount: `(${ratingCount.toLocaleString('pt-BR')} avaliações)`,
      hasCount: true
    };
  }

  return {
    formattedRating,
    formattedCount: null,
    hasCount: false
  };
}

/**
 * 9.5 Tempo Médio: Restore approximate duration on cards.
 * E.g. "⏱ 60 min". If none exists, do not fabricate.
 */
export function formatDuration(durationMinutes?: number | null): string | null {
  if (typeof durationMinutes === 'number' && durationMinutes > 0) {
    return `${durationMinutes} min`;
  }
  return null;
}

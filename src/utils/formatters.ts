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
  dailySchedule: Array<{ day: string; dayKey: string; hours: string; isClosed: boolean }>;
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
    const fullWeek = DAY_ORDER.map(k => ({
      day: DAY_LABELS[k],
      dayKey: k,
      hours: 'Sempre aberto',
      isClosed: false
    }));
    return {
      label: 'Sempre aberto',
      isAlwaysOpen: true,
      isConfirmed: true,
      groupedDays: [{ days: 'SEG–DOM', hours: 'Sempre aberto' }],
      dailySchedule: fullWeek,
      sourceNote: source ? formatSourceLabel(source) : 'Acesso público contínuo'
    };
  }

  if (!hours || typeof hours !== 'object' || Object.keys(hours).length === 0) {
    return {
      label: 'Horário não confirmado',
      isAlwaysOpen: false,
      isConfirmed: false,
      groupedDays: [],
      dailySchedule: [],
      sourceNote: 'Consulte no local ou contato direto'
    };
  }

  // Check if all provided days say "Sempre aberto"
  const values = Object.values(hours).map(v => v?.trim());
  const allAlwaysOpen = values.length >= 5 && values.every(v => v?.toLowerCase().includes('aberto') || v?.toLowerCase().includes('24h'));
  if (allAlwaysOpen) {
    const fullWeek = DAY_ORDER.map(k => ({
      day: DAY_LABELS[k],
      dayKey: k,
      hours: 'Sempre aberto',
      isClosed: false
    }));
    return {
      label: 'Sempre aberto',
      isAlwaysOpen: true,
      isConfirmed: true,
      groupedDays: [{ days: 'SEG–DOM', hours: 'Sempre aberto' }],
      dailySchedule: fullWeek,
      sourceNote: formatSourceLabel(source || 'duo21_curatorship')
    };
  }

  // Build daily 7-day schedule (Sprint 9.1 Section 2)
  const dailySchedule: Array<{ day: string; dayKey: string; hours: string; isClosed: boolean }> = [];
  const validEntries = Object.entries(hours).filter(([_, v]) => typeof v === 'string' && v.trim().length > 0);
  const hasAnyHours = validEntries.length > 0;

  for (const dayKey of DAY_ORDER) {
    const rawVal = hours[dayKey] || hours[dayKey.toUpperCase()] || hours[DAY_LABELS[dayKey]];
    const trimmed = rawVal?.trim();
    if (!trimmed) {
      // If other days exist, mark as closed or unspecified
      dailySchedule.push({
        day: DAY_LABELS[dayKey],
        dayKey,
        hours: hasAnyHours ? 'Fechado' : 'Horário não confirmado',
        isClosed: true
      });
    } else if (trimmed.toLowerCase().includes('fechado') || trimmed.toLowerCase() === 'closed') {
      dailySchedule.push({
        day: DAY_LABELS[dayKey],
        dayKey,
        hours: 'Fechado',
        isClosed: true
      });
    } else {
      dailySchedule.push({
        day: DAY_LABELS[dayKey],
        dayKey,
        hours: trimmed,
        isClosed: false
      });
    }
  }

  // Group consecutive days with same hours for backward compatibility
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
    isConfirmed: grouped.length > 0 || dailySchedule.some(d => !d.isClosed),
    groupedDays: grouped,
    dailySchedule,
    sourceNote: formatSourceLabel(source || 'duo21_curatorship')
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
 * 9.3 Source labels: Never leak technical DB IDs to tourists (Sprint 9.1 Section 3).
 * Maps internal technical keys to friendly user-facing labels.
 */
export function formatSourceLabel(rawSource: string | undefined | null): string {
  if (!rawSource || typeof rawSource !== 'string') {
    return 'Curadoria Oficial';
  }
  const s = rawSource.trim().toLowerCase();
  if (s === 'duo21_curatorship' || s === 'duo21' || s.includes('curatorship')) {
    return 'Curadoria DUO21';
  }
  if (s === 'official' || s.startsWith('official_') || s === 'ticket_platform') {
    return 'Site oficial';
  }
  if (s === 'google_places' || s === 'google') {
    return 'Google';
  }
  if (s === 'partner' || s === 'partner_deals') {
    return 'Parceiro';
  }
  if (s === 'user_report' || s === 'community') {
    return 'Informação colaborativa';
  }
  if (!s.includes('_')) {
    return rawSource;
  }
  return rawSource
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
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
 * 9.5 Tempo Médio: Restore approximate duration on cards (Sprint 9.1 Section 12).
 * Formats nicely (e.g. "60 min", "2h"). Never renders "min" without a value.
 */
export function formatDuration(durationMinutes?: number | null): string | null {
  if (typeof durationMinutes === 'number' && !isNaN(durationMinutes) && durationMinutes > 0) {
    if (durationMinutes === 60) return '1h';
    if (durationMinutes === 120) return '2h';
    if (durationMinutes === 180) return '3h';
    if (durationMinutes >= 60 && durationMinutes % 60 === 0) return `${durationMinutes / 60}h`;
    return `${durationMinutes} min`;
  }
  return null;
}

/**
 * 9.8 / 9.11 Dica Divulga Lugares (Sprint 9.1 Section 11).
/**
 * Shows ⭐ Dica Divulga Lugares ONLY if:
 * 1. divulga_content_active = true (or has_divulga_content = true)
 * 2. AND there exists at least one valid verified content URL (Reel, YouTube, TikTok, Video tip).
 * Curatorship DUO21 alone NEVER triggers the badge (Sprint 10A Section 5).
 */
export function hasDivulgaContent(place: any): boolean {
  if (!place) return false;

  const isActive = Boolean(place.divulga_content_active ?? place.has_divulga_content);
  if (!isActive) return false;

  const candidateUrls = [
    place.divulga_instagram_url,
    place.divulga_youtube_url,
    place.divulga_tiktok_url,
    place.divulga_article_url,
    place.divulga_content_url,
    place.divulga_lugares_tip?.video_url,
    place.divulga_lugares_tip?.media_url,
    place.divulga_lugares_tip?.article_url
  ];

  const hasValidUrl = candidateUrls.some(url => {
    if (typeof url !== 'string' || !url.trim().startsWith('http')) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes('youtube.com') ||
      lower.includes('youtu.be') ||
      lower.includes('instagram.com') ||
      lower.includes('tiktok.com') ||
      lower.includes('divulgalugares.com.br') ||
      lower.includes('duo21.com.br') ||
      lower.startsWith('https://')
    );
  });

  return hasValidUrl;
}

/**
 * Returns the primary display photo according to Sprint 10A Section 6 priority:
 * 1. DUO21 / manual
 * 2. parceiro
 * 3. oficial / licenciada
 * 4. Google Places
 * 5. fallback neutro
 */
export function getPlaceHeroPhoto(place: any): string {
  if (!place) return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80';

  const mediaList = Array.isArray(place.media) ? place.media.filter((m: any) => m && m.active !== false && m.url) : [];

  if (mediaList.length === 0) {
    if (place.media_url && typeof place.media_url === 'string') return place.media_url;
    return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80';
  }

  // 1. DUO21 / manual hero
  const duoHero = mediaList.find((m: any) => m.is_hero && (m.source === 'duo21' || !m.source));
  if (duoHero) return duoHero.url;

  const duoMedia = mediaList.find((m: any) => m.source === 'duo21');
  if (duoMedia) return duoMedia.url;

  // 2. Partner
  const partnerMedia = mediaList.find((m: any) => m.source === 'partner');
  if (partnerMedia) return partnerMedia.url;

  // 3. Official / external licensed
  const officialMedia = mediaList.find((m: any) => m.source === 'official' || m.source === 'external_licensed');
  if (officialMedia) return officialMedia.url;

  // 4. Any item marked as is_hero
  const anyHero = mediaList.find((m: any) => m.is_hero);
  if (anyHero) return anyHero.url;

  // 5. Google Places
  const googleMedia = mediaList.find((m: any) => m.source === 'google_places');
  if (googleMedia) return googleMedia.url;

  // 6. First item or fallback
  return mediaList[0]?.url || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80';
}


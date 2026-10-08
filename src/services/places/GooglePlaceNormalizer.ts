import { City } from '../../types';

export interface GoogleApiPlaceRaw {
  id?: string;
  name?: string; // Resource name format: "places/ChIJ..."
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' | string;
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }>;
    weekdayDescriptions?: string[];
  };
  types?: string[];
}

export interface ResolvedPlace {
  externalId: string; // Google Place ID (e.g. "ChIJ...")
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  city: City;
  businessStatus: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  openingHours?: Record<string, string>;
  weekdayDescriptions?: string[];
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  googleMapsUri?: string;
  nationalPhoneNumber?: string;
  provider: 'GOOGLE_PLACES' | 'SUPABASE' | 'CACHE' | 'MOCK';
  cached: boolean;
  resolvedAt: string;
}

export class GooglePlaceNormalizer {
  /**
   * Detects which Serra Gaúcha municipality the place belongs to based on address / coordinates.
   */
  static detectCity(address: string = '', lat?: number, lng?: number): City {
    const addr = address.toLowerCase();
    if (addr.includes('canela')) return 'Canela';
    if (addr.includes('nova petrópolis') || addr.includes('nova petropolis')) return 'Nova Petrópolis';
    if (addr.includes('gramado')) return 'Gramado';

    // Coordinate heuristics for Serra Gaúcha
    if (lat && lng) {
      // Canela is generally further east (longitude > -50.84)
      if (lng > -50.84) return 'Canela';
      // Nova Petrópolis is further west (longitude < -50.89)
      if (lng < -50.89) return 'Nova Petrópolis';
    }

    return 'Gramado'; // Default Serra anchor
  }

  /**
   * Sprint 10C Requirement 5: Normalizes regularOpeningHours to the internal catalog format.
   * Supports:
   * - segunda a domingo ('seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom')
   * - fechado ('Fechado')
   * - aberto 24h ('Aberto 24 horas')
   * - múltiplos períodos (ex: '11:30 - 15:00, 19:00 - 23:00')
   * - ausência de informação: returns undefined (CRITICAL RULE: AUSÊNCIA DE HORÁRIO ≠ FECHADO)
   */
  static normalizeOpeningHours(
    regularOpeningHours?: GoogleApiPlaceRaw['regularOpeningHours']
  ): Record<string, string> | undefined {
    if (!regularOpeningHours) return undefined;

    const periods = regularOpeningHours.periods;
    const weekdayDescriptions = regularOpeningHours.weekdayDescriptions;

    const hasPeriods = Array.isArray(periods) && periods.length > 0;
    const hasDescriptions = Array.isArray(weekdayDescriptions) && weekdayDescriptions.length > 0;

    if (!hasPeriods && !hasDescriptions) {
      return undefined;
    }

    // Google Places days: 0 = dom, 1 = seg, 2 = ter, 3 = qua, 4 = qui, 5 = sex, 6 = sab
    const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const result: Record<string, string> = {};

    // 1. Check if place is open 24/7
    const isOpen24HoursAllDays = (
      (hasPeriods && periods.length === 1 && periods[0].open?.day === 0 && periods[0].open?.hour === 0 && periods[0].open?.minute === 0 && !periods[0].close) ||
      (hasDescriptions && weekdayDescriptions.length >= 7 && weekdayDescriptions.every(d => /24 horas|24 hours/i.test(d)))
    );

    if (isOpen24HoursAllDays) {
      for (const k of DAY_KEYS) {
        result[k] = 'Aberto 24 horas';
      }
      return result;
    }

    // 2. Structured periods parsing
    if (hasPeriods) {
      const periodsByDay: Record<number, Array<{ openStr: string; closeStr: string; is24h: boolean }>> = {
        0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
      };

      for (const p of periods) {
        const day = typeof p.open?.day === 'number' ? p.open.day : 0;
        if (!periodsByDay[day]) periodsByDay[day] = [];

        if (!p.close) {
          periodsByDay[day].push({ openStr: '00:00', closeStr: '23:59', is24h: true });
        } else {
          const openH = String(p.open?.hour ?? 0).padStart(2, '0');
          const openM = String(p.open?.minute ?? 0).padStart(2, '0');
          const closeH = String(p.close?.hour ?? 0).padStart(2, '0');
          const closeM = String(p.close?.minute ?? 0).padStart(2, '0');
          periodsByDay[day].push({
            openStr: `${openH}:${openM}`,
            closeStr: `${closeH}:${closeM}`,
            is24h: false
          });
        }
      }

      const totalPeriodsCount = Object.values(periodsByDay).reduce((acc, arr) => acc + arr.length, 0);

      if (totalPeriodsCount > 0) {
        for (let i = 0; i < 7; i++) {
          const key = DAY_KEYS[i];
          const dayPeriods = periodsByDay[i];
          if (dayPeriods.length === 0) {
            result[key] = 'Fechado';
          } else if (dayPeriods.some(dp => dp.is24h)) {
            result[key] = 'Aberto 24 horas';
          } else {
            result[key] = dayPeriods.map(dp => `${dp.openStr} - ${dp.closeStr}`).join(', ');
          }
        }
        return result;
      }
    }

    // 3. Fallback or complement from weekdayDescriptions
    if (hasDescriptions) {
      const dayAliases: Record<string, string> = {
        'segunda': 'seg',
        'monday': 'seg',
        'terça': 'ter',
        'terca': 'ter',
        'tuesday': 'ter',
        'quarta': 'qua',
        'wednesday': 'qua',
        'quinta': 'qui',
        'thursday': 'qui',
        'sexta': 'sex',
        'friday': 'sex',
        'sábado': 'sab',
        'sabado': 'sab',
        'saturday': 'sab',
        'domingo': 'dom',
        'sunday': 'dom'
      };

      for (const line of weekdayDescriptions) {
        const lower = line.toLowerCase();
        for (const [alias, shortKey] of Object.entries(dayAliases)) {
          if (lower.includes(alias)) {
            const parts = line.split(':');
            if (parts.length > 1) {
              const rawVal = parts.slice(1).join(':').trim();
              if (/fechado|closed/i.test(rawVal)) {
                result[shortKey] = 'Fechado';
              } else if (/24 horas|24 hours/i.test(rawVal)) {
                result[shortKey] = 'Aberto 24 horas';
              } else {
                result[shortKey] = rawVal.replace(/\s*[–—]\s*/g, ' - ');
              }
            }
            break;
          }
        }
      }

      if (Object.keys(result).length > 0) {
        return result;
      }
    }

    // When absence of information, return undefined (AUSÊNCIA DE HORÁRIO ≠ FECHADO)
    return undefined;
  }

  /**
   * Normalizes raw response from Google Places API (New) into standard ResolvedPlace.
   */
  static normalize(
    raw: GoogleApiPlaceRaw,
    provider: 'GOOGLE_PLACES' | 'CACHE' | 'MOCK' = 'GOOGLE_PLACES',
    cached = false
  ): ResolvedPlace {
    // In Places API (New), id is either in `id` or parsed from `places/{placeId}` in `name`
    let placeId = raw.id || '';
    if (!placeId && raw.name && raw.name.startsWith('places/')) {
      placeId = raw.name.replace('places/', '');
    }

    const name = raw.displayName?.text || raw.name || 'Local Não Identificado';
    const address = raw.formattedAddress || 'Endereço não informado';
    const lat = Number(raw.location?.latitude || -29.3789);
    const lng = Number(raw.location?.longitude || -50.8741);
    const city = this.detectCity(address, lat, lng);

    let status: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY' = 'OPERATIONAL';
    if (raw.businessStatus === 'CLOSED_PERMANENTLY') {
      status = 'CLOSED_PERMANENTLY';
    } else if (raw.businessStatus === 'CLOSED_TEMPORARILY') {
      status = 'CLOSED_TEMPORARILY';
    }

    const openingHours = this.normalizeOpeningHours(raw.regularOpeningHours);
    const descriptions = raw.regularOpeningHours?.weekdayDescriptions || [];

    return {
      externalId: placeId,
      name,
      address,
      latitude: lat,
      longitude: lng,
      city,
      businessStatus: status,
      openingHours,
      weekdayDescriptions: descriptions.length > 0 ? descriptions : undefined,
      types: raw.types || [],
      rating: raw.rating,
      userRatingCount: raw.userRatingCount,
      websiteUri: raw.websiteUri,
      googleMapsUri: raw.googleMapsUri,
      nationalPhoneNumber: raw.nationalPhoneNumber || raw.internationalPhoneNumber,
      provider,
      cached,
      resolvedAt: new Date().toISOString()
    };
  }
}

import {
  TripPreferences,
  Trip,
  TripDay,
  TripActivity,
  Place,
  City,
  SerraEvent,
  NormalizedWeatherForecast,
  RouteSegment
} from '../../types';
import { placeRepository } from '../repositories/RepositoryFactory';
import { routeProvider } from '../routes/RouteProvider';
import { weatherProvider } from '../weather/WeatherProvider';
import { itineraryValidator } from './ItineraryValidator';
import { placeResolutionService } from '../places/PlaceResolutionService';
import { SEED_EVENTS } from '../../data/seedData';

export interface LogisticsPlanningContext {
  preferences: TripPreferences;
  places: Place[];
  events: SerraEvent[];
  forecastsByDate: Map<string, NormalizedWeatherForecast>;
}

export class LogisticsEngine {
  private readonly TRAVEL_BUFFER_PERCENT = 0.20; // 20% margin for parking, slow tourist traffic

  /**
   * Plans a realistic, executable itinerary considering hotel anchor, city clustering,
   * opening hours, realistic travel times, weather conditions, fatigue and children.
   */
  async planItinerary(preferences: TripPreferences, existingPlaces?: Place[]): Promise<Trip> {
    const placesCatalog = existingPlaces && existingPlaces.length > 0
      ? existingPlaces
      : await placeRepository.getAllPlaces();

    const totalDays = this.calculateDays(preferences.start_date, preferences.end_date);
    const primaryCity: City = preferences.hotel_city || 'Gramado';

    // 1. Establish Logistics Anchor (Section 10 & 11)
    let anchor = preferences.logistics_anchor;
    if (!anchor) {
      if (preferences.accommodation_status === 'booked' && preferences.hotel_name) {
        const resolved = await placeResolutionService.resolveAccommodation(preferences.hotel_name, primaryCity);
        if (resolved.place) {
          anchor = {
            latitude: resolved.place.latitude,
            longitude: resolved.place.longitude,
            label: resolved.place.name,
            city: (resolved.place.city as City) || primaryCity
          };
        }
      }
      if (!anchor) {
        const prov = placeResolutionService.getProvisionalLogisticsBase(primaryCity);
        anchor = {
          latitude: prov.latitude,
          longitude: prov.longitude,
          label: `Centro de ${prov.city} (Base Provisória)`,
          city: prov.city
        };
      }
      preferences.logistics_anchor = anchor;
    }

    // 2. Fetch weather forecasts for trip days (Section 22: Cache por cidade + data)
    const forecastsByDate = new Map<string, NormalizedWeatherForecast>();
    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const dateStr = this.calculateDateForDay(preferences.start_date, dayIdx);
      const dayCity = this.assignCityForDay(dayIdx, totalDays, primaryCity, preferences);
      const forecast = await weatherProvider.getNormalizedForecast(dayCity, dateStr);
      forecastsByDate.set(dateStr, forecast);
    }

    // 3. Determine City Clustering schedule (Section 12)
    const citySchedule: City[] = [];
    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      citySchedule.push(this.assignCityForDay(dayIdx, totalDays, primaryCity, preferences));
    }

    // 4. Build Days with geographic routing and meal windows
    const usedPlaceIds = new Set<string>();
    const days: TripDay[] = [];

    // Check must-have fondue request (Section 20)
    const wantsFondue = preferences.must_have?.some(m => m.toLowerCase().includes('fondue')) ||
      preferences.interests.some(i => i.toLowerCase().includes('fondue') || i.toLowerCase().includes('gastronomia'));

    let fondueScheduled = false;

    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateStr = this.calculateDateForDay(preferences.start_date, dayNum - 1);
      const dayCity = citySchedule[dayNum - 1];
      const forecast = forecastsByDate.get(dateStr);
      const isRainyDay = forecast?.condition === 'HEAVY_RAIN' || forecast?.condition === 'STORM' || (forecast?.rain_probability ?? 0) >= 80;

      // Select activities for this day
      const dayActivities = await this.planDayActivities({
        dayNumber: dayNum,
        date: dateStr,
        city: dayCity,
        preferences,
        placesCatalog,
        usedPlaceIds,
        anchor,
        isRainyDay,
        wantsFondue: wantsFondue && !fondueScheduled,
        onFondueScheduled: () => { fondueScheduled = true; }
      });

      // Calculate cost range for day (Section 37)
      const dayCostMin = dayActivities.reduce((acc, act) => acc + (act.estimated_cost_per_person * 0.85), 0) * preferences.adults_count;
      const dayCostMax = dayActivities.reduce((acc, act) => acc + (act.estimated_cost_per_person * 1.25), 0) * preferences.adults_count;

      days.push({
        day_number: dayNum,
        date: dateStr,
        city_focus: dayCity,
        theme_title: this.generateDayTheme(dayNum, dayCity, preferences, isRainyDay),
        activities: dayActivities,
        total_day_cost_estimated: Math.round(dayActivities.reduce((acc, a) => acc + a.estimated_cost_per_person, 0)),
        estimated_daily_cost_min: Math.round(dayCostMin),
        estimated_daily_cost_max: Math.round(dayCostMax),
        weather_forecast: forecast
      });
    }

    // 5. Total trip budget range (Section 37 & 38: Não somar hotel se lodgingIncluded = false)
    const totalMin = days.reduce((sum, d) => sum + (d.estimated_daily_cost_min || 0), 0);
    const totalMax = days.reduce((sum, d) => sum + (d.estimated_daily_cost_max || 0), 0);
    const totalSpend = days.reduce((sum, d) => sum + d.total_day_cost_estimated, 0) * preferences.adults_count;

    const baseTrip: Trip = {
      id: `trip_${Date.now()}`,
      secure_token: `v_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
      status: 'paid',
      preferences,
      days,
      price_tier_id: 'standard',
      price_brl: 19.90,
      total_estimated_spend_brl: Math.round(totalSpend),
      estimated_trip_cost_min: Math.round(totalMin),
      estimated_trip_cost_max: Math.round(totalMax),
      logistics_base: {
        status: preferences.accommodation_status === 'booked' ? 'confirmed' : 'provisional',
        name: anchor.label,
        city: anchor.city,
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        is_provisional: preferences.accommodation_status !== 'booked',
        notes: `Base de partida: ${anchor.label}. Deslocamentos calculados a partir deste ponto.`
      },
      created_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      usage_stats: {
        guide_messages_today: 0,
        guide_messages_limit: 30,
        structural_changes_today: 0,
        structural_changes_limit: 3,
        full_regenerations_used: 0,
        full_regenerations_limit: 1
      },
      is_demo: false,
      unlock_source: 'payment',
      unlockSource: 'payment'
    };

    // 6. Post-generation Constraint Validation & Auto-Correction (Section 32, 41)
    const validated = itineraryValidator.autoCorrectTimeline(baseTrip);
    return validated;
  }

  private async planDayActivities(ctx: {
    dayNumber: number;
    date: string;
    city: City;
    preferences: TripPreferences;
    placesCatalog: Place[];
    usedPlaceIds: Set<string>;
    anchor: { latitude: number; longitude: number; label: string; city: City };
    isRainyDay: boolean;
    wantsFondue: boolean;
    onFondueScheduled: () => void;
  }): Promise<TripActivity[]> {
    const { dayNumber, city, preferences, placesCatalog, usedPlaceIds, anchor, isRainyDay, wantsFondue, onFondueScheduled } = ctx;

    const isFamilyWithKids = preferences.children_count > 0;
    const isRelaxed = preferences.pace === 'tranquilo';

    // Daily fatigue limits (Section 35, 36)
    // Tranquilo: 2 attractions + 1 lunch (+ optional dinner)
    // Equilibrado: 3 attractions + lunch + dinner
    const maxMainAttractions = isRelaxed ? 2 : 3;

    // Filter candidate places in this city
    const availableCityPlaces = placesCatalog.filter(p => {
      if (usedPlaceIds.has(p.id)) return false;
      if (!p.active) return false;
      if (p.city !== city && p.city !== 'Gramado') return false; // Stay inside cluster
      if (isRainyDay && p.indoor_type === 'outdoor') return false; // Shelter from rain
      return true;
    });

    const activities: TripActivity[] = [];
    let currentCoords = { lat: anchor.latitude, lng: anchor.longitude, name: anchor.label };
    let currentMinute = 570; // 09:30 AM

    // 1. Morning Attraction (09:30)
    const morningPlace = this.pickBestAttraction(availableCityPlaces, preferences, isFamilyWithKids, currentCoords, 'parque', usedPlaceIds);
    if (morningPlace) {
      usedPlaceIds.add(morningPlace.id);
      const routeToPlace = await routeProvider.calculateRoute(currentCoords, {
        lat: morningPlace.latitude,
        lng: morningPlace.longitude,
        name: morningPlace.name
      }, { bufferPercent: this.TRAVEL_BUFFER_PERCENT });

      const travelTime = routeToPlace.durationMinutes;
      const duration = morningPlace.average_duration_minutes || 90;

      activities.push({
        id: `act_d${dayNumber}_a1`,
        time: this.minutesToTime(currentMinute),
        place: morningPlace,
        duration_minutes: duration,
        travel_time_from_prev_minutes: travelTime,
        travel_buffer_minutes: Math.round(travelTime * this.TRAVEL_BUFFER_PERCENT),
        distance_km_from_prev: routeToPlace.distanceKm,
        estimated_cost_per_person: this.extractCost(morningPlace),
        weather_status: isRainyDay ? 'indoor_safe' : 'ideal',
        notes: this.generateRecommendationReason(morningPlace, preferences, anchor.label, routeToPlace.distanceKm)
      });

      currentMinute += duration + travelTime + Math.round(travelTime * this.TRAVEL_BUFFER_PERCENT);
      currentCoords = { lat: morningPlace.latitude, lng: morningPlace.longitude, name: morningPlace.name };
    }

    // 2. Lunch Window (12:00 - 13:30) (Section 18, 19: Restaurante próximo da atração da manhã)
    const lunchBudgetPerPerson = preferences.budget_food_per_person || 80;
    const lunchPlace = this.pickBestRestaurant(
      placesCatalog,
      city,
      currentCoords,
      lunchBudgetPerPerson,
      usedPlaceIds,
      false // not fondue for lunch
    );

    if (lunchPlace) {
      usedPlaceIds.add(lunchPlace.id);
      const routeToLunch = await routeProvider.calculateRoute(currentCoords, {
        lat: lunchPlace.latitude,
        lng: lunchPlace.longitude,
        name: lunchPlace.name
      }, { bufferPercent: this.TRAVEL_BUFFER_PERCENT });

      // Align lunch to standard lunch window: 12:00
      const lunchTime = Math.max(720, currentMinute + routeToLunch.durationWithBufferMinutes);
      const lunchDuration = 75; // 1h15 for relaxed meal

      activities.push({
        id: `act_d${dayNumber}_lunch`,
        time: this.minutesToTime(lunchTime),
        place: lunchPlace,
        duration_minutes: lunchDuration,
        travel_time_from_prev_minutes: routeToLunch.durationMinutes,
        travel_buffer_minutes: Math.round(routeToLunch.durationMinutes * this.TRAVEL_BUFFER_PERCENT),
        distance_km_from_prev: routeToLunch.distanceKm,
        estimated_cost_per_person: Math.min(lunchBudgetPerPerson, this.extractCost(lunchPlace)),
        weather_status: 'indoor_safe',
        notes: `Almoço gastronômico selecionado a ${routeToLunch.distanceKm}km da atração da manhã (dentro do limite de R$ ${lunchBudgetPerPerson}/pessoa).`
      });

      currentMinute = lunchTime + lunchDuration;
      currentCoords = { lat: lunchPlace.latitude, lng: lunchPlace.longitude, name: lunchPlace.name };
    }

    // 3. Afternoon Attraction (14:30 / 15:00)
    if (maxMainAttractions >= 2) {
      const afternoonPlace = this.pickBestAttraction(availableCityPlaces, preferences, isFamilyWithKids, currentCoords, 'museu', usedPlaceIds);
      if (afternoonPlace) {
        usedPlaceIds.add(afternoonPlace.id);
        const routeToAfternoon = await routeProvider.calculateRoute(currentCoords, {
          lat: afternoonPlace.latitude,
          lng: afternoonPlace.longitude,
          name: afternoonPlace.name
        }, { bufferPercent: this.TRAVEL_BUFFER_PERCENT });

        const afterTime = Math.max(870, currentMinute + routeToAfternoon.durationWithBufferMinutes); // 14:30
        const duration = afternoonPlace.average_duration_minutes || 75;

        activities.push({
          id: `act_d${dayNumber}_a2`,
          time: this.minutesToTime(afterTime),
          place: afternoonPlace,
          duration_minutes: duration,
          travel_time_from_prev_minutes: routeToAfternoon.durationMinutes,
          travel_buffer_minutes: Math.round(routeToAfternoon.durationMinutes * this.TRAVEL_BUFFER_PERCENT),
          distance_km_from_prev: routeToAfternoon.distanceKm,
          estimated_cost_per_person: this.extractCost(afternoonPlace),
          weather_status: isRainyDay ? 'indoor_safe' : 'ideal',
          notes: this.generateRecommendationReason(afternoonPlace, preferences, anchor.label, routeToAfternoon.distanceKm)
        });

        currentMinute = afterTime + duration;
        currentCoords = { lat: afternoonPlace.latitude, lng: afternoonPlace.longitude, name: afternoonPlace.name };
      }
    }

    // 4. Dinner Window (19:30) (Section 18, 20: Fondue se solicitado)
    if (wantsFondue) {
      const fonduePlace = placesCatalog.find(p => 
        p.category === 'restaurante' &&
        (p.tags?.includes('fondue') || p.name.toLowerCase().includes('fondue') || p.slug.includes('fondue')) &&
        p.active &&
        !usedPlaceIds.has(p.id)
      );

      if (fonduePlace) {
        usedPlaceIds.add(fonduePlace.id);
        onFondueScheduled();

        const routeToFondue = await routeProvider.calculateRoute(currentCoords, {
          lat: fonduePlace.latitude,
          lng: fonduePlace.longitude,
          name: fonduePlace.name
        }, { bufferPercent: this.TRAVEL_BUFFER_PERCENT });

        activities.push({
          id: `act_d${dayNumber}_dinner`,
          time: '19:30',
          place: fonduePlace,
          duration_minutes: 105,
          travel_time_from_prev_minutes: routeToFondue.durationMinutes,
          travel_buffer_minutes: Math.round(routeToFondue.durationMinutes * this.TRAVEL_BUFFER_PERCENT),
          distance_km_from_prev: routeToFondue.distanceKm,
          estimated_cost_per_person: 110,
          weather_status: 'indoor_safe',
          notes: `[Must-Have Atendido] Sequência de Fondue tradicional suíço na Serra Gaúcha.`
        });
      }
    }

    return activities;
  }

  private pickBestAttraction(
    candidates: Place[],
    preferences: TripPreferences,
    isFamily: boolean,
    currentCoords: { lat: number; lng: number },
    fallbackCategory: string,
    usedIds: Set<string>,
    premiumCount: number = 0
  ): Place | undefined {
    const available = candidates.filter(p => p.category !== 'restaurante' && !usedIds.has(p.id));
    if (available.length === 0) return undefined;

    const avoids = (preferences.avoid || []).concat(preferences.restrictions || []);
    const isEconomic = preferences.budget_flexibility === 'economico';
    const isCouple = preferences.is_couple && preferences.children_count === 0;
    const isSenior = preferences.has_elderly;

    // Score candidates by proximity to current location + preferences match
    const scored = available
      .filter(p => {
        // 1. Avoid filter (Section 25: Não quero parques temáticos)
        const isMustHave = preferences.must_have?.some(m => p.name.toLowerCase().includes(m.toLowerCase()));
        if (!isMustHave && avoids.length > 0) {
          const matchedAvoid = avoids.some(av => {
            const avLower = av.toLowerCase();
            if (avLower.includes('parque') && p.category === 'parque') return true;
            if (p.tags?.some(t => avLower.includes(t.toLowerCase()))) return true;
            return false;
          });
          if (matchedAvoid) return false;
        }

        // 2. Premium experience limitation (Section 16: Permitir 1 premium se perfil autorizar)
        if (p.price_level && p.price_level >= 4) {
          if (isEconomic) return false; // Economic cuts premium
          if (premiumCount >= 1) return false; // Max 1 premium
        }

        return true;
      })
      .map(p => {
        let score = 50;

        // Proximity bonus (Haversine km)
        const dLat = (p.latitude - currentCoords.lat) * 111.0;
        const dLng = (p.longitude - currentCoords.lng) * 96.5;
        const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
        score += Math.max(0, 30 - distKm * 3); // closer is better

        // Must-have boost
        if (preferences.must_have?.some(m => p.name.toLowerCase().includes(m.toLowerCase()))) {
          score += 150;
        }

        // Free experience boost (Section 17 & 25)
        if (p.cost_band === 'FREE' || p.price_level === 1 || p.tags?.includes('gratis') || p.tags?.includes('publico')) {
          score += 20;
          if (isEconomic) score += 30;
        }

        // Family suitability bonus (Section 18)
        if (isFamily) {
          if (p.children_friendly || p.tags?.includes('criancas') || p.tags?.includes('familia') || p.suitable_for?.includes('criancas')) {
            score += 25;
          }
        }

        // Couple / Romantic bonus (Section 27)
        if (isCouple) {
          if (p.tags?.includes('romantico') || p.tags?.includes('vinho') || p.tags?.includes('mirante') || p.tags?.includes('casal')) {
            score += 30;
          }
          if (p.tags?.includes('criancas') && !p.tags?.includes('natureza')) {
            score -= 20;
          }
        }

        // Senior / Accessibility bonus (Section 28)
        if (isSenior) {
          if (p.senior_friendly || p.walking_intensity === 'LOW' || p.tags?.includes('acessivel')) {
            score += 35;
          } else if (p.walking_intensity === 'HIGH') {
            score -= 30;
          }
        }

        // Interests match bonus (Natureza, etc.)
        for (const interest of preferences.interests) {
          if (p.tags?.some(t => t.toLowerCase().includes(interest.toLowerCase()))) {
            score += 20;
          }
        }

        return { place: p, score };
      })
      .sort((a, b) => b.score - a.score);

    return scored[0]?.place;
  }

  private pickBestRestaurant(
    catalog: Place[],
    city: City,
    nearCoords: { lat: number; lng: number },
    maxBudgetPerPerson: number,
    usedIds: Set<string>,
    isFondue: boolean
  ): Place | undefined {
    const restaurants = catalog.filter(p => p.category === 'restaurante' && p.active && !usedIds.has(p.id));

    const matching = restaurants.map(p => {
      let score = 50;

      if (p.city === city) score += 20;

      // Proximity score
      const dLat = (p.latitude - nearCoords.lat) * 111.0;
      const dLng = (p.longitude - nearCoords.lng) * 96.5;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      score += Math.max(0, 40 - dist * 5); // very high priority to close restaurant

      // Budget check
      const cost = this.extractCost(p);
      if (cost <= maxBudgetPerPerson) score += 20;

      if (isFondue && (p.tags?.includes('fondue') || p.name.toLowerCase().includes('fondue'))) {
        score += 50;
      }

      return { place: p, score };
    }).sort((a, b) => b.score - a.score);

    return matching[0]?.place;
  }

  private extractCost(place: Place): number {
    if (place.price_level === 1) return 45;
    if (place.price_level === 2) return 75;
    if (place.price_level === 3) return 120;
    if (place.price_level === 4) return 190;
    return 60;
  }

  private assignCityForDay(dayIndex: number, totalDays: number, primaryCity: City, prefs: TripPreferences): City {
    if (totalDays === 1) return primaryCity;
    if (dayIndex === 0) return primaryCity; // Day 1: City where hotel is
    if (dayIndex === 1) return primaryCity === 'Gramado' ? 'Canela' : 'Gramado'; // Day 2: Sister city
    if (dayIndex === 2) {
      return totalDays >= 4 && prefs.interests.includes('Natureza') ? 'Nova Petrópolis' : 'Gramado';
    }
    return dayIndex % 2 === 1 ? 'Canela' : 'Gramado';
  }

  private generateDayTheme(dayNum: number, city: City, prefs: TripPreferences, isRainy: boolean): string {
    if (isRainy) {
      return `Dia ${dayNum} em ${city} — Rota Coberta, Chocolaterias & Aconchego`;
    }
    if (dayNum === 1) {
      return `Dia 1 em ${city} — Boas-vindas, Parques Clássicos & Gastronomia`;
    }
    if (dayNum === 2) {
      return `Dia 2 em ${city} — Mirantes, Natureza & Encantos da Serra`;
    }
    if (dayNum === 3) {
      return `Dia 3 em ${city} — Tradição Colonial, Sabores & Experiências`;
    }
    return `Dia ${dayNum} em ${city} — Despedida Especial nos Melhores Cantinhos`;
  }

  private calculateDays(start: string, end: string): number {
    try {
      const s = new Date(start);
      const e = new Date(end);
      const diff = Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return isNaN(diff) || diff < 1 ? 4 : Math.min(10, diff);
    } catch {
      return 4;
    }
  }

  private calculateDateForDay(startDateStr: string, offsetDays: number): string {
    try {
      const d = new Date(startDateStr);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
    } catch {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
    }
  }

  private generateRecommendationReason(place: Place, prefs: TripPreferences, anchorName: string, distKm: number): string {
    const isFamily = prefs.children_count > 0;
    const isCouple = prefs.is_couple && prefs.children_count === 0;
    const isSenior = prefs.has_elderly;
    const isFree = place.cost_band === 'FREE' || place.price_level === 1 || place.tags?.includes('gratis') || place.tags?.includes('publico');
    const isPremium = place.price_level && place.price_level >= 4;

    if (prefs.must_have?.some(m => place.name.toLowerCase().includes(m.toLowerCase()))) {
      return `[Must-Have] Escolhemos ${place.name} para atender seu pedido prioritário com rota otimizada.`;
    }
    if (isPremium) {
      return `Experiência especial selecionada para o grupo, combinando destaque turístico e vivência marcante.`;
    }
    if (isFree) {
      return `Passeio gratuito e agradável, perfeito para curtir a serra sem pressa e economizar no dia.`;
    }
    if (isFamily) {
      return `Escolhemos esse passeio para a manhã porque fica perto da sua hospedagem e combina com o perfil das crianças.`;
    }
    if (isCouple) {
      return `Local romântico e charmoso com belas paisagens, ideal para momentos especiais a dois.`;
    }
    if (isSenior) {
      return `Atração de caminhada leve e ritmo tranquilo, acessível e confortável para todas as idades.`;
    }
    return `Local estratégico a ${distKm}km, evitando zigue-zague e aproveitando o melhor de ${place.city}.`;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

export const logisticsEngine = new LogisticsEngine();

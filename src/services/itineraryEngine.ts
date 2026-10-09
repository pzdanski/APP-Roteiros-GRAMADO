import { 
  City, 
  Place, 
  SerraEvent, 
  TripPreferences, 
  TripDay, 
  TripActivity, 
  Trip,
  LogisticsBase,
  AccommodationDetails
} from '../types';
import { SEED_PLACES, SEED_EVENTS, calculateTripPrice } from '../data/seedData';
import { isPlaceEligibleForItinerary, isDemoPlaceId, isPlaceholderImageUrl } from '../utils/dataQuality';

export interface EngineWeights {
  compatibilityInterests: number; // 25
  logisticsDistance: number;      // 20
  budget: number;                 // 20
  weather: number;                // 15
  qualityRating: number;          // 10
  dataReliability: number;        // 5
  curatorshipDivulgaLugares: number; // 5
}

export const DEFAULT_WEIGHTS: EngineWeights = {
  compatibilityInterests: 25,
  logisticsDistance: 20,
  budget: 20,
  weather: 15,
  qualityRating: 10,
  dataReliability: 5,
  curatorshipDivulgaLugares: 5
};

// Distance matrix approximation between centers (in km)
export const CITY_DISTANCES_KM: Record<string, Record<string, number>> = {
  'Gramado': { 'Gramado': 2, 'Canela': 8, 'Nova Petrópolis': 34 },
  'Canela': { 'Gramado': 8, 'Canela': 2, 'Nova Petrópolis': 42 },
  'Nova Petrópolis': { 'Gramado': 34, 'Canela': 42, 'Nova Petrópolis': 3 }
};

export function estimateTravelTimeMinutes(fromCity: City, toCity: City): number {
  if (fromCity === toCity) return 15;
  if ((fromCity === 'Gramado' && toCity === 'Canela') || (fromCity === 'Canela' && toCity === 'Gramado')) {
    return 25; // 8km with traffic on Av. das Hortênsias
  }
  return 45; // Gramado/Canela to Nova Petrópolis via RS-235
}

function parseDateDays(startDateStr: string, endDateStr: string): number {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, isNaN(diffDays) ? 3 : diffDays);
  } catch {
    return 3;
  }
}

function addDaysToDate(dateStr: string, daysToAdd: number): string {
  try {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + daysToAdd);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

export function buildItinerary(
  preferences: TripPreferences, 
  weights: EngineWeights = DEFAULT_WEIGHTS,
  existingPlaces: Place[] = SEED_PLACES,
  existingEvents: SerraEvent[] = SEED_EVENTS
): Trip {
  const placesPool = (Array.isArray(existingPlaces) && existingPlaces.length > 0) ? existingPlaces : SEED_PLACES;
  const totalDays = parseDateDays(preferences.start_date, preferences.end_date);
  const days: TripDay[] = [];
  const usedPlaceIds = new Set<string>();

  // Determine logistics base
  const isHotelConfirmed = 
    preferences.accommodation_status === 'booked' || 
    (!!preferences.hotel_name && preferences.accommodation_status !== 'not_booked' && preferences.accommodation_status !== 'undecided');

  const primaryCity: City = preferences.hotel_city || preferences.accommodation?.city || 'Gramado';

  const centerCoords: Record<City, { lat: number; lng: number }> = {
    'Gramado': { lat: -29.3789, lng: -50.8741 },
    'Canela': { lat: -29.3644, lng: -50.8144 },
    'Nova Petrópolis': { lat: -29.3758, lng: -51.1153 }
  };

  const logisticsBase: LogisticsBase = isHotelConfirmed
    ? {
        status: 'confirmed',
        name: preferences.hotel_name || preferences.accommodation?.name || 'Hospedagem Confirmada',
        city: primaryCity,
        address: preferences.hotel_address || preferences.accommodation?.address,
        latitude: preferences.accommodation?.latitude || centerCoords[primaryCity].lat,
        longitude: preferences.accommodation?.longitude || centerCoords[primaryCity].lng,
        is_provisional: false,
        notes: 'Ponto de referência oficial para cálculo dos deslocamentos diários.'
      }
    : {
        status: 'provisional',
        name: `Base Provisória (${primaryCity} Centro)`,
        city: primaryCity,
        address: `Região central de ${primaryCity}`,
        latitude: centerCoords[primaryCity].lat,
        longitude: centerCoords[primaryCity].lng,
        is_provisional: true,
        notes: `Base provisória no centro de ${primaryCity}. Quando você definir onde vai ficar, recalculamos os trajetos para você.`
      };

  // Determine daily slots based on pace
  // Tranquilo: 2 activities (1 morning/afternoon, 1 dinner/evening)
  // Equilibrado: 3 activities (1 morning, 1 afternoon, 1 evening)
  // Aproveitar Bastante: 4 activities (morning 1, morning 2, afternoon, evening)
  const maxActivitiesPerDay = preferences.pace === 'tranquilo' ? 2 : preferences.pace === 'aproveitar_bastante' ? 4 : 3;

  // Cluster assignment for cities:
  // e.g. Day 1: Gramado, Day 2: Canela, Day 3: Gramado/Nova Petrópolis, Day 4+: Canela/Gramado
  const citySchedule: City[] = [];
  for (let i = 0; i < totalDays; i++) {
    if (totalDays === 1) {
      citySchedule.push(preferences.hotel_city || 'Gramado');
    } else if (totalDays === 2) {
      citySchedule.push('Gramado', 'Canela');
    } else if (totalDays >= 3) {
      // Nova Petrópolis as dedicated day
      if (i === 0) citySchedule.push('Gramado');
      else if (i === 1) citySchedule.push('Canela');
      else if (i === 2) citySchedule.push('Nova Petrópolis');
      else if (i % 2 === 1) citySchedule.push('Gramado');
      else citySchedule.push('Canela');
    }
  }

  // Active anchor events during dates
  const matchingEvents = existingEvents.filter(evt => {
    return evt.start_date <= preferences.end_date && evt.end_date >= preferences.start_date;
  });

  let totalEstimatedSpend = 0;

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const currentDate = addDaysToDate(preferences.start_date, dayIndex);
    const dayCity = citySchedule[dayIndex] || 'Gramado';
    const activities: TripActivity[] = [];

    // SPRINT 10D Hotfix P0: Proteção do motor de roteiros contra registros DEMO, CONFLICT e fictícios
    let candidatePlaces = placesPool.filter(p => p.city === dayCity && isPlaceEligibleForItinerary(p));
    if (candidatePlaces.length === 0) {
      candidatePlaces = placesPool.filter(p => isPlaceEligibleForItinerary(p));
    }
    if (candidatePlaces.length === 0) {
      candidatePlaces = SEED_PLACES.filter(p => p.city === dayCity && isPlaceEligibleForItinerary(p));
    }
    if (candidatePlaces.length === 0) {
      candidatePlaces = SEED_PLACES.filter(p => isPlaceEligibleForItinerary(p));
    }

    // Sort candidate places by score
    const scoredPlaces = candidatePlaces.map(p => {
      let score = 50; // base
      
      // Interest match
      const interestMatches = preferences.interests.some(int => 
        p.category.toLowerCase().includes(int.toLowerCase()) || 
        p.description.toLowerCase().includes(int.toLowerCase())
      );
      if (interestMatches) score += weights.compatibilityInterests;

      // Divulga Lugares curatorship bonus (somente parceiros comprovados e não-demo)
      if (p.is_divulga_lugares_partner && !isDemoPlaceId(p.google_place_id)) {
        score += weights.curatorshipDivulgaLugares;
      }

      // Rating bonus
      score += (p.rating / 5) * weights.qualityRating;

      // Children friendly if kids present
      if (preferences.children_count > 0 && p.children_friendly) {
        score += 15;
      }

      // Avoid repeats
      if (usedPlaceIds.has(p.id)) {
        score -= 100;
      }

      return { place: p, score };
    }).sort((a, b) => b.score - a.score);

    // Morning, Afternoon, Evening time schedule
    const timeSlots = preferences.pace === 'tranquilo' 
      ? ['10:00', '19:30'] 
      : preferences.pace === 'aproveitar_bastante' 
      ? ['09:00', '11:30', '15:00', '19:30'] 
      : ['09:30', '14:30', '19:30'];

    let prevPlace: Place | null = null;

    for (let slotIndex = 0; slotIndex < timeSlots.length; slotIndex++) {
      const timeStr = timeSlots[slotIndex];
      const isEvening = timeStr >= '18:00';

      // Check if there is an anchor event for this evening
      let anchorForSlot: SerraEvent | undefined = undefined;
      if (isEvening && matchingEvents.length > 0) {
        anchorForSlot = matchingEvents.find(e => e.city === dayCity || e.is_anchor_event);
      }

      // Find best candidate
      let chosenPlace: Place | null = null;

      if (isEvening) {
        // Prefer restaurants or shows
        const diningOrShow = scoredPlaces.find(sp => 
          !usedPlaceIds.has(sp.place.id) && 
          (sp.place.category === 'restaurante' || sp.place.category === 'show' || sp.place.category === 'mirante')
        );
        if (diningOrShow) chosenPlace = diningOrShow.place;
      }

      if (!chosenPlace) {
        const nextAvailable = scoredPlaces.find(sp => !usedPlaceIds.has(sp.place.id));
        if (nextAvailable) {
          chosenPlace = nextAvailable.place;
        } else if (scoredPlaces.length > 0) {
          // Fallback if small catalog
          chosenPlace = scoredPlaces[0].place;
        } else if (placesPool.length > 0) {
          chosenPlace = placesPool[slotIndex % placesPool.length];
        }
      }

      if (chosenPlace) {
        usedPlaceIds.add(chosenPlace.id);

        const travelTime = prevPlace 
          ? estimateTravelTimeMinutes(prevPlace.city, chosenPlace.city) 
          : estimateTravelTimeMinutes(logisticsBase.city, chosenPlace.city);
        
        const distKm = prevPlace && CITY_DISTANCES_KM[prevPlace.city]?.[chosenPlace.city] 
          ? CITY_DISTANCES_KM[prevPlace.city][chosenPlace.city] 
          : (CITY_DISTANCES_KM[logisticsBase.city]?.[chosenPlace.city] || 3.5);

        const costPerPerson = chosenPlace.price_info.is_free ? 0 : chosenPlace.price_info.adult_price;
        const totalActivityCost = costPerPerson * (preferences.adults_count + preferences.children_count * 0.5);
        totalEstimatedSpend += totalActivityCost;

        const isDemoId = isDemoPlaceId(chosenPlace.google_place_id);
        const sanitizedChosenPlace: Place = {
          ...chosenPlace,
          // Não vaza ID demonstrativo para o cliente
          google_place_id: isDemoId ? undefined : chosenPlace.google_place_id,
          maps_url: isDemoId
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${chosenPlace.name}, ${chosenPlace.city} - RS`)}`
            : chosenPlace.maps_url,
          media: (Array.isArray(chosenPlace.media) ? chosenPlace.media : []).map(m => ({
            ...m,
            is_placeholder: Boolean(m.is_placeholder || isPlaceholderImageUrl(m.url))
          }))
        };

        activities.push({
          id: `act-${dayIndex + 1}-${slotIndex + 1}`,
          time: timeStr,
          place: sanitizedChosenPlace,
          duration_minutes: chosenPlace.average_duration_minutes || 90,
          travel_time_from_prev_minutes: travelTime,
          distance_km_from_prev: distKm,
          estimated_cost_per_person: costPerPerson,
          is_anchor_event: !!anchorForSlot,
          event_details: anchorForSlot,
          locked: dayIndex > 0 && slotIndex > 0, // Paywall simulation: Day 1 first items unlocked, others locked
          weather_status: chosenPlace.indoor_type === 'outdoor' ? 'ideal' : 'indoor_safe',
          notes: anchorForSlot ? `✨ Atenção ao horário do evento: ${anchorForSlot.name}` : undefined
        });

        prevPlace = chosenPlace;
      }
    }

    const dayCost = activities.reduce((sum, act) => sum + act.estimated_cost_per_person * preferences.adults_count, 0);

    // Weather forecast mock
    const weatherList = [
      { summary: 'Ensolarado com brisa amena da serra', temp_min: 14, temp_max: 23, rain_probability: 10, icon: 'sun' },
      { summary: 'Parcialmente nublado, ideal para fotos', temp_min: 13, temp_max: 21, rain_probability: 20, icon: 'cloud-sun' },
      { summary: 'Possibilidade de garoa leve no final da tarde', temp_min: 12, temp_max: 19, rain_probability: 45, icon: 'cloud-rain' }
    ];

    days.push({
      day_number: dayIndex + 1,
      date: currentDate,
      city_focus: dayCity,
      theme_title: dayIndex === 0 
        ? `Boas-vindas a ${dayCity}: Clássicos imperdíveis` 
        : dayCity === 'Canela' 
        ? 'Natureza, vistas panorâmicas e aconchego em Canela' 
        : dayCity === 'Nova Petrópolis' 
        ? 'Tradição germânica, flores e mirantes em Nova Petrópolis' 
        : `Encantos e sabores da Serra Gaúcha`,
      activities,
      total_day_cost_estimated: dayCost,
      weather_forecast: weatherList[dayIndex % weatherList.length]
    });
  }

  const tripPrice = calculateTripPrice(totalDays);

  return {
    id: `trip-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    secure_token: `v_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`,
    status: 'preview',
    preferences,
    days,
    price_tier_id: `tier-${totalDays}d`,
    price_brl: tripPrice,
    total_estimated_spend_brl: totalEstimatedSpend,
    logistics_base: logisticsBase,
    created_at: new Date().toISOString(),
    usage_stats: {
      guide_messages_today: 0,
      guide_messages_limit: 30,
      structural_changes_today: 0,
      structural_changes_limit: 3,
      full_regenerations_used: 0,
      full_regenerations_limit: 1
    },
    is_demo: false
  };
}

/**
 * Partial itinerary swap (Rule: Freeze prev and next, only swap the selected activity slot)
 */
export function swapSingleActivity(
  trip: Trip, 
  dayNumber: number, 
  activityId: string, 
  newPlace: Place
): Trip {
  const updatedDays = trip.days.map(day => {
    if (day.day_number !== dayNumber) return day;

    const updatedActivities = day.activities.map(act => {
      if (act.id !== activityId) return act;

      const prevAct = day.activities.find(a => a.id === activityId);
      const costPerPerson = newPlace.price_info.is_free ? 0 : newPlace.price_info.adult_price;

      return {
        ...act,
        place: newPlace,
        duration_minutes: newPlace.average_duration_minutes || 90,
        estimated_cost_per_person: costPerPerson,
        weather_status: (newPlace.indoor_type === 'outdoor' ? 'ideal' : 'indoor_safe') as 'ideal' | 'indoor_safe' | 'alert',
        travel_time_from_prev_minutes: prevAct?.travel_time_from_prev_minutes || 15
      };
    });

    const dayCost = updatedActivities.reduce((sum, a) => sum + a.estimated_cost_per_person * trip.preferences.adults_count, 0);

    return {
      ...day,
      activities: updatedActivities,
      total_day_cost_estimated: dayCost
    };
  });

  return {
    ...trip,
    days: updatedDays,
    usage_stats: {
      ...trip.usage_stats,
      structural_changes_today: trip.usage_stats.structural_changes_today + 1
    }
  };
}

export const generateItinerary = buildItinerary;

/**
 * Update trip accommodation and recalculate logistics without consuming structural change limit
 */
export function updateTripAccommodation(
  trip: Trip,
  accommodation: { name: string; city: City; address?: string; latitude?: number; longitude?: number }
): Trip {
  const updatedBase: LogisticsBase = {
    status: 'confirmed',
    name: accommodation.name,
    city: accommodation.city,
    address: accommodation.address,
    latitude: accommodation.latitude || -29.3789,
    longitude: accommodation.longitude || -50.8741,
    is_provisional: false,
    notes: 'Ponto de referência oficial atualizado.'
  };

  const updatedPrefs: TripPreferences = {
    ...trip.preferences,
    hotel_name: accommodation.name,
    hotel_city: accommodation.city,
    hotel_address: accommodation.address,
    accommodation_status: 'booked',
    accommodation: {
      ...trip.preferences.accommodation,
      name: accommodation.name,
      city: accommodation.city,
      address: accommodation.address,
      latitude: accommodation.latitude,
      longitude: accommodation.longitude
    }
  };

  const updatedDays = trip.days.map(day => {
    const activities = [...day.activities];
    if (activities.length > 0) {
      const firstAct = activities[0];
      const recalculatedTravelTime = estimateTravelTimeMinutes(accommodation.city, firstAct.place.city);
      activities[0] = {
        ...firstAct,
        travel_time_from_prev_minutes: recalculatedTravelTime,
        notes: `Partida de ${accommodation.name}`
      };
    }
    return {
      ...day,
      activities
    };
  });

  return {
    ...trip,
    preferences: updatedPrefs,
    logistics_base: updatedBase,
    days: updatedDays
  };
}

export const itineraryEngine = {
  buildItinerary,
  generateItinerary,
  swapSingleActivity,
  updateTripAccommodation
};

import { Place, City, PlaceCategory } from '../../types';
import { placeRepository, PlaceRepository } from '../repositories/PlaceRepository';

export interface PlaceQueryParams {
  city?: City;
  category?: PlaceCategory | PlaceCategory[];
  tags?: string[];
  maxCostPerPerson?: number;
  costLevel?: 1 | 2 | 3 | 4;
  indoorOutdoor?: 'indoor' | 'outdoor' | 'mixed' | 'rain_ok';
  forChildren?: boolean;
  nearCoords?: { latitude: number; longitude: number; maxDistanceKm?: number };
  queryText?: string;
  mustBeOpenDayOfWeek?: number; // 0-6
}

/**
 * Calculates geographic distance using Haversine formula (in kilometers).
 * Requirement 30: Used for fast pre-filtering and proximity scoring before calling any Routes API.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export class PlaceQueryService {
  constructor(private repo: PlaceRepository = placeRepository) {}

  /**
   * Executes structured queries using local database rules, tags, and categories.
   * Requirement 26 & 32: Gemini is NEVER used to search for places in the database.
   */
  async queryPlaces(params: PlaceQueryParams): Promise<Place[]> {
    let places = await this.repo.getAllPlaces();

    // 1. Filter active
    places = places.filter(p => p.active);

    // 2. City filter
    if (params.city) {
      places = places.filter(p => p.city === params.city);
    }

    // 3. Category filter
    if (params.category) {
      const cats = Array.isArray(params.category) ? params.category : [params.category];
      places = places.filter(p => cats.includes(p.category));
    }

    // 4. Budget filter (Requirement 27: "Almoço até R$80")
    if (params.maxCostPerPerson !== undefined && params.maxCostPerPerson > 0) {
      places = places.filter(p => {
        const price = p.price_info.adult_price || 0;
        return price === 0 || price <= params.maxCostPerPerson!;
      });
    }

    if (params.costLevel) {
      places = places.filter(p => p.price_level <= params.costLevel!);
    }

    // 5. Indoor / Weather filter
    if (params.indoorOutdoor) {
      if (params.indoorOutdoor === 'indoor' || params.indoorOutdoor === 'rain_ok') {
        places = places.filter(p => p.indoor_type === 'indoor' || p.indoor_type === 'mixed' || p.indoor_type === 'rain_ok');
      } else if (params.indoorOutdoor === 'outdoor') {
        places = places.filter(p => p.indoor_type === 'outdoor' || p.indoor_type === 'mixed');
      }
    }

    // 6. Suitable for children
    if (params.forChildren) {
      places = places.filter(p => p.children_friendly);
    }

    // 7. Structured text search (Requirement 27: "fondue", "natureza", "churrasco")
    if (params.queryText) {
      const q = params.queryText.toLowerCase();
      places = places.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
      );
    }

    // 8. Distance sorting and pre-filtering (Requirement 30: Haversine)
    if (params.nearCoords) {
      const { latitude, longitude, maxDistanceKm } = params.nearCoords;
      places = places
        .map(p => ({
          place: p,
          dist: calculateHaversineDistanceKm(latitude, longitude, p.latitude, p.longitude)
        }))
        .filter(item => (maxDistanceKm ? item.dist <= maxDistanceKm : true))
        .sort((a, b) => a.dist - b.dist)
        .map(item => item.place);
    }

    return places;
  }

  /**
   * Helper that converts natural intents into structured query parameters.
   * Requirement 27: e.g. "Quero um fondue legal" -> category = RESTAURANT, queryText = 'fondue'
   */
  async findFondueRestaurants(city?: City, maxPrice?: number): Promise<Place[]> {
    return this.queryPlaces({
      city,
      category: ['restaurante'],
      queryText: 'fondue',
      maxCostPerPerson: maxPrice
    });
  }

  async findLunchOptions(city: City, budgetPerPerson?: number): Promise<Place[]> {
    return this.queryPlaces({
      city,
      category: ['restaurante', 'cafe'],
      maxCostPerPerson: budgetPerPerson || 80
    });
  }

  async findFamilyAttractions(city?: City): Promise<Place[]> {
    return this.queryPlaces({
      city,
      category: ['parque', 'museu', 'chocolate'],
      forChildren: true
    });
  }

  async findIndoorAlternatives(city?: City): Promise<Place[]> {
    return this.queryPlaces({
      city,
      indoorOutdoor: 'indoor'
    });
  }

  async findFreePlaces(city?: City): Promise<Place[]> {
    return this.queryPlaces({
      city,
      maxCostPerPerson: 0
    });
  }
}

export const placeQueryService = new PlaceQueryService();

import { RouteSegment } from '../../types';
import { getApiUrl } from '../utils/apiClient';

export interface RouteCoordinates {
  lat: number;
  lng: number;
  name?: string;
}

export interface RouteEstimate {
  originName: string;
  destinationName: string;
  distanceKm: number;
  durationMinutes: number;
  durationWithBufferMinutes: number;
  trafficStatus: 'light' | 'moderate' | 'heavy';
  recommendedTransport: string;
  isDemo: boolean;
  provider: string;
}

export interface RouteProvider {
  name: string;
  isDemo: boolean;
  calculateRoute(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    options?: { tripId?: string; travelMode?: 'DRIVING' | 'WALKING'; bufferPercent?: number }
  ): Promise<RouteEstimate>;
  calculateTravelTime(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    options?: { bufferPercent?: number }
  ): Promise<number>;
  calculateDistance(
    origin: RouteCoordinates,
    destination: RouteCoordinates
  ): Promise<number>;
  calculateMatrix(
    origins: RouteCoordinates[],
    destinations: RouteCoordinates[]
  ): Promise<RouteEstimate[][]>;
}

export class AppRouteProvider implements RouteProvider {
  name = 'Google Routes Platform (Cache-First)';
  isDemo = false;

  async calculateRoute(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    options: { tripId?: string; travelMode?: 'DRIVING' | 'WALKING'; bufferPercent?: number } = {}
  ): Promise<RouteEstimate> {
    try {
      const res = await fetch(getApiUrl('/api/routes/compute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { latitude: origin.lat, longitude: origin.lng, label: origin.name },
          destination: { latitude: destination.lat, longitude: destination.lng, label: destination.name },
          travelMode: options.travelMode || 'DRIVING',
          bufferPercent: options.bufferPercent ?? 0.20,
          tripId: options.tripId
        })
      });

      if (res.ok) {
        const seg: RouteSegment = await res.json();
        return {
          originName: origin.name || 'Origem',
          destinationName: destination.name || 'Destino',
          distanceKm: seg.distance_km,
          durationMinutes: seg.duration_minutes,
          durationWithBufferMinutes: seg.duration_with_buffer_minutes,
          trafficStatus: seg.traffic_status || 'light',
          recommendedTransport: seg.distance_km < 1.0 ? 'A pé / Caminhada' : 'Carro / Transfer',
          isDemo: seg.provider === 'MOCK' || seg.provider === 'HAVERSINE_MOUNTAIN',
          provider: seg.provider
        };
      }
    } catch (err) {
      console.warn('[RouteProvider] Remote calculation failed, falling back to local simulation:', err);
    }

    // Direct local Haversine fallback if server is unreachable
    const dLat = (destination.lat - origin.lat) * 111.0;
    const dLng = (destination.lng - origin.lng) * 96.5;
    const straightDist = Math.sqrt(dLat * dLat + dLng * dLng);
    const distKm = Number(Math.max(0.3, straightDist * 1.35).toFixed(1));
    const durMin = Math.max(3, Math.round((distKm / 38.0) * 60));

    return {
      originName: origin.name || 'Origem',
      destinationName: destination.name || 'Destino',
      distanceKm: distKm,
      durationMinutes: durMin,
      durationWithBufferMinutes: Math.round(durMin * 1.20),
      trafficStatus: 'light',
      recommendedTransport: 'Carro / Transfer',
      isDemo: true,
      provider: 'HAVERSINE_MOUNTAIN'
    };
  }

  async calculateTravelTime(
    origin: RouteCoordinates,
    destination: RouteCoordinates,
    options: { bufferPercent?: number } = {}
  ): Promise<number> {
    const res = await this.calculateRoute(origin, destination, options);
    return res.durationWithBufferMinutes;
  }

  async calculateDistance(
    origin: RouteCoordinates,
    destination: RouteCoordinates
  ): Promise<number> {
    const res = await this.calculateRoute(origin, destination);
    return res.distanceKm;
  }

  async calculateMatrix(
    origins: RouteCoordinates[],
    destinations: RouteCoordinates[]
  ): Promise<RouteEstimate[][]> {
    const matrix: RouteEstimate[][] = [];
    for (let i = 0; i < origins.length; i++) {
      const row: RouteEstimate[] = [];
      for (let j = 0; j < destinations.length; j++) {
        row.push(await this.calculateRoute(origins[i], destinations[j]));
      }
      matrix.push(row);
    }
    return matrix;
  }
}

export const routeProvider: RouteProvider = new AppRouteProvider();

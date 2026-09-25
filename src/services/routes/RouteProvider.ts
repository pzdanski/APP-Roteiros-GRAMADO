export interface RouteEstimate {
  originName: string;
  destinationName: string;
  distanceKm: number;
  durationMinutes: number;
  trafficStatus: 'light' | 'moderate' | 'heavy';
  recommendedTransport: string;
  isDemo: boolean;
}

export interface RouteProvider {
  name: string;
  isDemo: boolean;
  calculateRoute(
    origin: { lat: number; lng: number; name?: string },
    destination: { lat: number; lng: number; name?: string }
  ): Promise<RouteEstimate>;
}

export class MockRouteProvider implements RouteProvider {
  name = 'OSRM / Google Routes (Simulação Serra)';
  isDemo = true;

  async calculateRoute(
    origin: { lat: number; lng: number; name?: string },
    destination: { lat: number; lng: number; name?: string }
  ): Promise<RouteEstimate> {
    // Haversine approx
    const dLat = (destination.lat - origin.lat) * 111;
    const dLng = (destination.lng - origin.lng) * 95;
    const distanceKm = Math.max(1, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) * 1.3 * 10) / 10);
    const durationMinutes = Math.max(4, Math.round(distanceKm * 2.2));

    return {
      originName: origin.name || 'Ponto de Partida',
      destinationName: destination.name || 'Destino',
      distanceKm,
      durationMinutes,
      trafficStatus: durationMinutes > 25 ? 'moderate' : 'light',
      recommendedTransport: 'Carro / Transfer',
      isDemo: true
    };
  }
}

export const routeProvider: RouteProvider = new MockRouteProvider();

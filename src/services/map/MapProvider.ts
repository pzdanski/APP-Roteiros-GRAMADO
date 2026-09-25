export interface MapMarker {
  id: string;
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  category: string;
  orderNumber?: number;
  iconType: 'hotel' | 'activity' | 'restaurant' | 'attraction';
  color?: string;
  placeId?: string;
  isDemo?: boolean;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface MapProvider {
  name: string;
  isDemo: boolean;
  getTileUrlPattern(): string;
  getAttribution(): string;
  formatMarkers(places: any[]): MapMarker[];
}

export class MockMapProvider implements MapProvider {
  name = 'MapLibre (OSM Demo Provider)';
  isDemo = true;

  getTileUrlPattern(): string {
    // In production, an authorized raster/vector style tile URL is used (e.g. MapTiler, Stadia, Protomaps)
    // Here we use a safe public OpenStreetMap style reference for demo simulation
    return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  }

  getAttribution(): string {
    return '© OpenStreetMap contributors • MapLibre GL Compatible (Modo DEMO)';
  }

  formatMarkers(places: any[]): MapMarker[] {
    return places.map((p, idx) => ({
      id: p.id || `marker-${idx}`,
      title: p.name,
      subtitle: `${p.city} • ${p.category}`,
      latitude: p.latitude || -29.3789,
      longitude: p.longitude || -50.8739,
      category: p.category,
      orderNumber: idx + 1,
      iconType: p.category === 'restaurante' || p.category === 'cafe' ? 'restaurant' : 'activity',
      color: p.category === 'restaurante' ? '#D97706' : '#1B4332',
      placeId: p.id,
      isDemo: true
    }));
  }
}

export const mapProvider: MapProvider = new MockMapProvider();

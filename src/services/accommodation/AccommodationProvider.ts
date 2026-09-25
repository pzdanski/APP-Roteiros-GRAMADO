import { 
  AccommodationRecommendation, 
  City, 
  AccommodationType 
} from '../../types';

export interface AccommodationSearchParams {
  city?: City;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  type?: AccommodationType;
  maxBudgetPerNight?: number;
  amenities?: string[];
}

export interface AccommodationProviderStatus {
  providerName: string;
  isConfigured: boolean;
  mode: 'CONFIGURATION_REQUIRED' | 'DEMO' | 'PRODUCTION';
  message: string;
}

export interface AccommodationProvider {
  getStatus(): AccommodationProviderStatus;
  searchRecommendations(params: AccommodationSearchParams): Promise<AccommodationRecommendation[]>;
}

/**
 * Curated Demo / Local Partner Provider for Serra Gaúcha
 * Used while direct API integrations (Google Hotels / Booking / Airbnb) are awaiting credentials.
 */
export class CuratedSerraAccommodationProvider implements AccommodationProvider {
  getStatus(): AccommodationProviderStatus {
    return {
      providerName: 'DUO21 Curadoria Local & Parceiros da Serra',
      isConfigured: false,
      mode: 'DEMO',
      message: 'Modo DEMO de referência local ativo. Integração com APIs externas em preparação técnica.'
    };
  }

  async searchRecommendations(params: AccommodationSearchParams): Promise<AccommodationRecommendation[]> {
    const city = params.city || 'Gramado';

    // Curated real-world benchmark accommodations across Gramado & Canela
    const demoCatalog: AccommodationRecommendation[] = [
      {
        id: 'acc-gra-01',
        name: 'Hotel Casa da Montanha',
        type: 'hotel',
        city: 'Gramado',
        neighborhood: 'Centro',
        estimated_avg_price_brl: 850,
        price_type: 'range',
        price_display: 'R$ 750 – R$ 1.100 (Faixa estimada na alta temporada)',
        rating: 4.9,
        distance_to_center_km: 0.3,
        distance_points: [
          { label: 'Rua Coberta', distance_km: 0.3, time_minutes: 4 },
          { label: 'Palácio dos Festivais', distance_km: 0.4, time_minutes: 5 }
        ],
        amenities: ['Café Colonial', 'Piscina Térmica', 'Estacionamento', 'Kids Play', 'Wi-Fi'],
        booking_url: 'https://casadamontanha.com.br',
        source: 'Curadoria Local DUO21 (Referência)',
        checked_at: '2026-03-01',
        confidence: 'medium',
        is_demo: true
      },
      {
        id: 'acc-gra-02',
        name: 'Pousada Bella Terra',
        type: 'pousada',
        city: 'Gramado',
        neighborhood: 'Centro',
        estimated_avg_price_brl: 420,
        price_type: 'estimate',
        price_display: 'R$ 380 – R$ 520 (Faixa estimada)',
        rating: 4.8,
        distance_to_center_km: 0.2,
        distance_points: [
          { label: 'Av. Borges de Medeiros', distance_km: 0.1, time_minutes: 2 },
          { label: 'Igreja Matriz São Pedro', distance_km: 0.3, time_minutes: 4 }
        ],
        amenities: ['Café da Manhã', 'Wi-Fi', 'Estacionamento Grátis', 'Bicicletas'],
        booking_url: '',
        source: 'Curadoria Local DUO21 (Referência)',
        checked_at: '2026-03-01',
        confidence: 'medium',
        is_demo: true
      },
      {
        id: 'acc-can-01',
        name: 'Pousada Encanto da Serra',
        type: 'pousada',
        city: 'Canela',
        neighborhood: 'Vila Suzana',
        estimated_avg_price_brl: 350,
        price_type: 'estimate',
        price_display: 'R$ 320 – R$ 440 (Faixa estimada)',
        rating: 4.7,
        distance_to_center_km: 1.2,
        distance_points: [
          { label: 'Catedral de Pedra', distance_km: 1.5, time_minutes: 5 },
          { label: 'Parque do Caracol', distance_km: 5.2, time_minutes: 10 }
        ],
        amenities: ['Café Serrano', 'Lareira', 'Área Verde', 'Estacionamento'],
        booking_url: '',
        source: 'Curadoria Local DUO21 (Referência)',
        checked_at: '2026-03-01',
        confidence: 'medium',
        is_demo: true
      },
      {
        id: 'acc-can-02',
        name: 'Cabanas do Vale da Ferradura',
        type: 'cabana',
        city: 'Canela',
        neighborhood: 'Caracol / Ferradura',
        estimated_avg_price_brl: 590,
        price_type: 'range',
        price_display: 'R$ 520 – R$ 780 (Faixa estimada)',
        rating: 4.9,
        distance_to_center_km: 6.5,
        distance_points: [
          { label: 'Mirante da Ferradura', distance_km: 1.8, time_minutes: 4 },
          { label: 'Parque Skyglass', distance_km: 3.5, time_minutes: 7 }
        ],
        amenities: ['Lareira', 'Banheira de Hidro', 'Vista Panorâmica', 'Privacidade'],
        booking_url: '',
        source: 'Curadoria Local DUO21 (Referência)',
        checked_at: '2026-03-01',
        confidence: 'medium',
        is_demo: true
      },
      {
        id: 'acc-nov-01',
        name: 'Hotel Petrópolis Colonial',
        type: 'hotel',
        city: 'Nova Petrópolis',
        neighborhood: 'Centro',
        estimated_avg_price_brl: 310,
        price_type: 'estimate',
        price_display: 'R$ 280 – R$ 380 (Faixa estimada)',
        rating: 4.6,
        distance_to_center_km: 0.4,
        distance_points: [
          { label: 'Praça das Flores e Labirinto', distance_km: 0.4, time_minutes: 5 },
          { label: 'Aldeia do Imigrante', distance_km: 0.9, time_minutes: 3 }
        ],
        amenities: ['Café Colonial Germânico', 'Estacionamento', 'Wi-Fi'],
        booking_url: '',
        source: 'Curadoria Local DUO21 (Referência)',
        checked_at: '2026-03-01',
        confidence: 'medium',
        is_demo: true
      }
    ];

    // Filter by city if specified
    const filtered = demoCatalog.filter(h => h.city === city);
    return filtered.length > 0 ? filtered : demoCatalog;
  }
}

export const accommodationProvider: AccommodationProvider = new CuratedSerraAccommodationProvider();

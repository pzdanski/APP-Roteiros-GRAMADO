import { City } from '../../types';

export interface AccommodationRecommendation {
  id: string;
  name: string;
  city: City;
  neighborhood: string;
  type: 'Hotel Boutique' | 'Pousada de Charme' | 'Hotel Família' | 'Resort de Luxo';
  price_display: string;
  rating: number;
  rating_count: number;
  recommended_for: 'casal' | 'familia' | 'todos';
  amenities: string[];
  booking_url: string;
  source: 'Parceiro DUO21' | 'Booking.com' | 'Direto';
  is_demo: boolean;
}

export const DEMO_ACCOMMODATIONS: AccommodationRecommendation[] = [
  {
    id: 'acc-1',
    name: 'Hotel Casa da Montanha',
    city: 'Gramado',
    neighborhood: 'Centro',
    type: 'Hotel Boutique',
    price_display: 'A partir de R$ 750/noite',
    rating: 4.9,
    rating_count: 1420,
    recommended_for: 'casal',
    amenities: ['Spa L\'Occitane', 'Piscina Térmica', 'Café Imperial', 'Localização Central'],
    booking_url: 'https://casadamontanha.com.br',
    source: 'Parceiro DUO21',
    is_demo: true
  },
  {
    id: 'acc-2',
    name: 'Hotel Ritta Höppner',
    city: 'Gramado',
    neighborhood: 'Bavária',
    type: 'Hotel Família',
    price_display: 'A partir de R$ 680/noite',
    rating: 4.9,
    rating_count: 2180,
    recommended_for: 'familia',
    amenities: ['Acesso livre ao Mini Mundo', 'Chá da Tarde Alemão', 'Bosque Privativo', 'Espaço Kids'],
    booking_url: 'https://rittahoppner.com.br',
    source: 'Booking.com',
    is_demo: true
  },
  {
    id: 'acc-3',
    name: 'Wood Hotel Gramado',
    city: 'Gramado',
    neighborhood: 'Centro',
    type: 'Hotel Boutique',
    price_display: 'A partir de R$ 590/noite',
    rating: 4.8,
    rating_count: 890,
    recommended_for: 'casal',
    amenities: ['Design Sustentável', 'Gastronomia do Chef Rodrigo Bellora', 'Bar Autoral'],
    booking_url: 'https://hotelwood.com.br',
    source: 'Parceiro DUO21',
    is_demo: true
  },
  {
    id: 'acc-4',
    name: 'Grande Hotel Canela',
    city: 'Canela',
    neighborhood: 'Centro',
    type: 'Hotel Família',
    price_display: 'A partir de R$ 420/noite',
    rating: 4.7,
    rating_count: 1650,
    recommended_for: 'familia',
    amenities: ['Lago Natural', 'Ampla Área Verde', 'Quadras de Tênis', 'Piscina Coberta'],
    booking_url: 'https://grandehotelcanela.com.br',
    source: 'Booking.com',
    is_demo: true
  }
];

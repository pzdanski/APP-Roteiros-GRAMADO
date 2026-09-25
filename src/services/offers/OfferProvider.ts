import { Offer } from '../../types';

export interface OfferProvider {
  name: string;
  getActiveOffers(): Promise<Offer[]>;
  getOffersByPlace(placeId: string): Promise<Offer[]>;
}

export const SEED_OFFERS: Offer[] = [
  {
    id: 'off_001',
    placeId: 'pl_007',
    placeName: 'Château dos Plátanos Fondue',
    city: 'Gramado',
    title: 'Sequência Tradicional de Fondue com 20% OFF',
    description: 'Sequência completa (queijo suíço, carnes nobres na pedra e chocolate de Gramado) com reserva antecipada.',
    originalPrice: 129.0,
    offerPrice: 99.9,
    discountPercent: 22,
    startAt: '2025-01-01',
    endAt: '2026-12-31',
    conditions: 'Válido para reservas antecipadas de segunda a quinta-feira.',
    source: 'Parceiro DUO21 Local',
    sourceUrl: 'https://divulgalugares.com.br/ofertas/chateau-platanos',
    checkedAt: new Date().toISOString().split('T')[0],
    confidence: 'high',
    isDemo: true
  },
  {
    id: 'off_002',
    placeId: 'pl_004',
    placeName: 'Parque Olivas de Gramado',
    city: 'Gramado',
    title: 'Entrada Sunset + Degustação de Azeites',
    description: 'Acesso às plantações de oliveiras, fazendinha e degustação sensorial com guia azeiteiro.',
    originalPrice: 139.0,
    offerPrice: 119.0,
    discountPercent: 14,
    startAt: '2025-01-01',
    endAt: '2026-12-31',
    conditions: 'Entrada a partir das 14h com vista para os cânions.',
    source: 'Parceiro DUO21 Local',
    checkedAt: new Date().toISOString().split('T')[0],
    confidence: 'high',
    isDemo: true
  },
  {
    id: 'off_003',
    placeId: 'pl_009',
    placeName: 'Café Bela Vista Colonial',
    city: 'Gramado',
    title: 'Café Colonial Histórico com Taça de Vinho Cortesia',
    description: 'Mais de 80 variedades entre doces, tortas alemãs, frios coloniais e carnes quentes.',
    originalPrice: 118.0,
    offerPrice: 105.0,
    discountPercent: 11,
    startAt: '2025-01-01',
    endAt: '2026-12-31',
    conditions: 'Válido das 11h30 às 19h.',
    source: 'Divulga Lugares Convênio',
    checkedAt: new Date().toISOString().split('T')[0],
    confidence: 'high',
    isDemo: true
  }
];

export class MockOfferProvider implements OfferProvider {
  name = 'DUO21 Offer Repository (Seed/Mock)';

  async getActiveOffers(): Promise<Offer[]> {
    const today = new Date().toISOString().split('T')[0];
    return SEED_OFFERS.filter(off => off.endAt >= today);
  }

  async getOffersByPlace(placeId: string): Promise<Offer[]> {
    const active = await this.getActiveOffers();
    return active.filter(off => off.placeId === placeId);
  }
}

export const offerProvider: OfferProvider = new MockOfferProvider();

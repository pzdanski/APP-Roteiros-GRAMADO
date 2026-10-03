import { Place, SerraEvent } from '../types';

export const SEED_PLACES: Place[] = [
  // GRAMADO
  {
    id: 'a0000001-0000-0000-0000-000000000001',
    legacy_id: 'plc-gra-01',
    source_id: 'plc-gra-01',
    name: 'Lago Negro',
    slug: 'lago-negro',
    city: 'Gramado',
    category: 'parque',
    description: 'Lago artificial cercado por árvores trazidas da Floresta Negra alemã e hortênsias. Passeio clássico em pedalinhos e caminhada.',
    latitude: -29.3905,
    longitude: -50.8808,
    address: 'R. A. J. Renner, Bairro Planalto, Gramado - RS',
    phone: '(54) 3286-0000',
    whatsapp: '',
    website: 'https://gramado.rs.gov.br',
    instagram: '@lagonegrooficial',
    booking_url: '',
    rating: 4.8,
    rating_count: 24500,
    price_level: 1,
    price_info: {
      adult_price: 0,
      is_free: true,
      currency: 'BRL',
      source_name: 'Prefeitura de Gramado',
      checked_at: '2026-03-01',
      confidence: 'high'
    },
    average_duration_minutes: 90,
    reservation_required: false,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'outdoor',
    opening_hours: {
      'seg': 'Aberto 24h (Pedalinhos: 08:30 - 18:00)',
      'ter': 'Aberto 24h (Pedalinhos: 08:30 - 18:00)',
      'qua': 'Aberto 24h (Pedalinhos: 08:30 - 18:00)',
      'qui': 'Aberto 24h (Pedalinhos: 08:30 - 18:00)',
      'sex': 'Aberto 24h (Pedalinhos: 08:30 - 18:00)',
      'sab': 'Aberto 24h (Pedalinhos: 08:30 - 18:00)',
      'dom': 'Aberto 24h (Pedalinhos: 08:30 - 18:00)'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
        caption: 'Reflexos no Lago Negro ao entardecer',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'O melhor horário do Lago',
      text: 'Vá bem cedinho (entre 8h e 9h) antes das excursões chegarem. A neblina sobre o lago e o reflexo dos pinheiros são imperdíveis.',
      curator_badge: '⭐ Dica Divulga Lugares',
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000002',
    legacy_id: 'plc-gra-02',
    source_id: 'plc-gra-02',
    name: 'Mini Mundo',
    slug: 'mini-mundo',
    city: 'Gramado',
    category: 'museu',
    description: 'Parque ao ar livre com réplicas fiéis de prédios, castelos e cidades em escala 1:24, com animações e personagens com vida própria.',
    latitude: -29.3822,
    longitude: -50.8753,
    address: 'R. Horácio Cardoso, 291 - Planalto, Gramado - RS',
    phone: '(54) 3286-4055',
    whatsapp: '(54) 99986-4055',
    website: 'https://minimundo.com.br',
    instagram: '@minimundogramado',
    booking_url: 'https://minimundo.com.br/ingressos',
    rating: 4.7,
    rating_count: 18200,
    price_level: 2,
    price_info: {
      adult_price: 108,
      child_price: 54,
      senior_price: 54,
      is_free: false,
      currency: 'BRL',
      source_name: 'Tabela Oficial Mini Mundo',
      checked_at: '2026-02-15',
      confidence: 'high'
    },
    average_duration_minutes: 120,
    reservation_required: false,
    accessible: true,
    pet_friendly: false,
    children_friendly: true,
    indoor_type: 'mixed',
    opening_hours: {
      'seg': '09:00 - 17:00',
      'ter': '09:00 - 17:00',
      'qua': '09:00 - 17:00',
      'qui': '09:00 - 17:00',
      'sex': '09:00 - 17:00',
      'sab': '09:00 - 17:00',
      'dom': '09:00 - 17:00'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
        caption: 'Castelo de Neuschwanstein no Mini Mundo',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: false,
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000003',
    legacy_id: 'plc-gra-03',
    source_id: 'plc-gra-03',
    name: 'Snowland Gramado',
    slug: 'snowland-gramado',
    city: 'Gramado',
    category: 'parque',
    description: 'Primeiro parque de neve indoor das Américas com pista de esqui, snowboard, patinação no gelo e montanha de neve a -5°C.',
    latitude: -29.4144,
    longitude: -50.9168,
    address: 'RS-235, 9009 - Carazal, Gramado - RS',
    phone: '(54) 3295-6000',
    whatsapp: '',
    website: 'https://snowland.com.br',
    instagram: '@snowlandgramado',
    booking_url: 'https://snowland.com.br/ingressos',
    rating: 4.6,
    rating_count: 22000,
    price_level: 4,
    price_info: {
      adult_price: 249,
      child_price: 189,
      is_free: false,
      currency: 'BRL',
      source_name: 'Gramado Official Ticket / Site Oficial',
      checked_at: '2026-03-01',
      confidence: 'high'
    },
    average_duration_minutes: 240,
    reservation_required: true,
    accessible: true,
    pet_friendly: false,
    children_friendly: true,
    indoor_type: 'indoor',
    opening_hours: {
      'seg': '10:00 - 17:00',
      'ter': 'Fechado para manutenção (consulte alta temporada)',
      'qua': '10:00 - 17:00',
      'qui': '10:00 - 17:00',
      'sex': '10:00 - 17:00',
      'sab': '10:00 - 17:00',
      'dom': '10:00 - 17:00'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1548777123-e216912df7d8?auto=format&fit=crop&w=1000&q=80',
        caption: 'Pista e vila de neve',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Dica essencial de roupa térmica',
      text: 'O ingresso inclui roupa impermeável e botas, mas leve meias grossas extras e luvas térmicas próprias.',
      curator_badge: '⭐ Dica Divulga Lugares'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000005',
    legacy_id: 'plc-gra-04',
    source_id: 'plc-gra-04',
    name: 'Rua Torta e Praça das Etnias',
    slug: 'rua-torta-praca-etnias',
    city: 'Gramado',
    category: 'mirante',
    description: 'Inspirada na Lombard Street de São Francisco, a Rua Torta é repleta de curvas e flores. Ao lado, a Praça das Etnias vende pães quentinhos saídos dos fornos coloniais.',
    latitude: -29.3801,
    longitude: -50.8711,
    address: 'Rua Emílio Sorgetz, 90 - Centro, Gramado - RS',
    rating: 4.7,
    rating_count: 14000,
    price_level: 1,
    price_info: {
      adult_price: 0,
      is_free: true,
      currency: 'BRL',
      source_name: 'Público',
      checked_at: '2026-01-10',
      confidence: 'high'
    },
    average_duration_minutes: 45,
    reservation_required: false,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'outdoor',
    opening_hours: {
      'seg': 'Aberto 24h (Fornos: 09:00 - 18:30)',
      'ter': 'Aberto 24h (Fornos: 09:00 - 18:30)',
      'qua': 'Aberto 24h (Fornos: 09:00 - 18:30)',
      'qui': 'Aberto 24h (Fornos: 09:00 - 18:30)',
      'sex': 'Aberto 24h (Fornos: 09:00 - 18:30)',
      'sab': 'Aberto 24h (Fornos: 09:00 - 18:30)',
      'dom': 'Aberto 24h (Fornos: 09:00 - 18:30)'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
        caption: 'Curvas floridas da Rua Torta',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: false,
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000004',
    legacy_id: 'plc-gra-05',
    source_id: 'plc-gra-05',
    name: 'Cantina Pastasciutta',
    slug: 'cantina-pastasciutta',
    city: 'Gramado',
    category: 'restaurante',
    description: 'Tradicional cantina italiana no centro de Gramado com salames pendurados, massas caseiras fartas e molhos autênticos.',
    latitude: -29.3789,
    longitude: -50.8732,
    address: 'Av. Borges de Medeiros, 2083 - Centro, Gramado - RS',
    phone: '(54) 3286-2131',
    whatsapp: '',
    website: 'https://pastasciutta.com.br',
    instagram: '@cantinapastasciuttagramado',
    rating: 4.8,
    rating_count: 8500,
    price_level: 3,
    price_info: {
      adult_price: 130,
      is_free: false,
      currency: 'BRL',
      source_name: 'Cardápio Médio por Pessoa',
      checked_at: '2026-02-20',
      confidence: 'high'
    },
    average_duration_minutes: 90,
    reservation_required: false,
    accessible: true,
    pet_friendly: false,
    children_friendly: true,
    indoor_type: 'indoor',
    opening_hours: {
      'seg': '11:30 - 23:30',
      'ter': '11:30 - 23:30',
      'qua': '11:30 - 23:30',
      'qui': '11:30 - 23:30',
      'sex': '11:30 - 23:30',
      'sab': '11:30 - 23:30',
      'dom': '11:30 - 23:30'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
        caption: 'Massa artesanal com molho tradicional',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Pratos fartos para compartilhar',
      text: 'Um prato individual muitas vezes serve duas pessoas com apetite moderado. Não deixe de provar o pão de alho de entrada.',
      curator_badge: '⭐ Dica Divulga Lugares'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'b0000001-0000-0000-0000-000000000002',
    legacy_id: 'plc-gra-colosseo-fondue',
    source_id: 'plc-gra-colosseo-fondue',
    name: 'Restaurante Colosseo Fondue',
    slug: 'restaurante-colosseo-fondue',
    city: 'Gramado',
    category: 'restaurante',
    description: 'Tradição em sequência de fondue na pedra no centro de Gramado com piano ao vivo e ambiente acolhedor.',
    latitude: -29.3785,
    longitude: -50.8732,
    address: 'Av. das Hortênsias, 1560 - Centro, Gramado - RS',
    phone: '(54) 3286-1927',
    whatsapp: '',
    website: 'https://colosseo.com.br',
    instagram: '@colosseogramado',
    rating: 4.8,
    rating_count: 4200,
    price_level: 3,
    price_info: {
      adult_price: 110,
      is_free: false,
      currency: 'BRL',
      source_name: 'Sequência Tradicional por Pessoa',
      checked_at: '2026-03-01',
      confidence: 'high'
    },
    average_duration_minutes: 105,
    reservation_required: false,
    accessible: true,
    pet_friendly: false,
    children_friendly: true,
    indoor_type: 'indoor',
    opening_hours: {
      'seg': '18:30 - 23:30',
      'ter': '18:30 - 23:30',
      'qua': '18:30 - 23:30',
      'qui': '18:30 - 23:30',
      'sex': '18:30 - 23:30',
      'sab': '18:30 - 23:30',
      'dom': '18:30 - 23:30'
    },
    tags: ['fondue', 'gastronomia', 'jantar', 'casal', 'familia'],
    suitable_for: ['casal', 'familia', 'criancas'],
    media: [
      {
        url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80',
        caption: 'Sequência tradicional de fondue com queijo, carnes na pedra e chocolate',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Sequência Completa de Fondue',
      text: 'Três etapas clássicas: queijo suíço com acompanhamentos, carnes nobres na pedra vulcânica e fondue de chocolate com frutas da estação.',
      curator_badge: '⭐ Fondue Recomendado DUO21'
    },
    active: true,
    is_demo: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000004',
    legacy_id: 'plc-gra-06',
    source_id: 'plc-gra-06',
    name: 'Olivas de Gramado',
    slug: 'olivas-de-gramado',
    city: 'Gramado',
    category: 'vinicola',
    description: 'Primeiro parque temático de olivicultura da Serra. Vistas panorâmicas para os cânions, piqueniques, degustação de azeites e pôr do sol inesquecível com música ao vivo.',
    latitude: -29.4478,
    longitude: -50.8423,
    address: 'Rua Vereador José Alexandre Benetti, 1808 - Linha 28, Gramado - RS',
    phone: '(54) 99610-7626',
    website: 'https://olivasdegramado.com.br',
    instagram: '@olivasdegramado',
    rating: 4.8,
    rating_count: 9800,
    price_level: 3,
    price_info: {
      adult_price: 129,
      child_price: 64,
      is_free: false,
      currency: 'BRL',
      source_name: 'Ingresso Oficial Olivas',
      checked_at: '2026-02-28',
      confidence: 'high'
    },
    average_duration_minutes: 180,
    reservation_required: true,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'mixed',
    opening_hours: {
      'seg': '10:30 - 18:00',
      'ter': '10:30 - 18:00',
      'qua': 'Fechado',
      'qui': '10:30 - 18:00',
      'sex': '10:30 - 18:00',
      'sab': '10:30 - 18:00',
      'dom': '10:30 - 18:00'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?auto=format&fit=crop&w=1000&q=80',
        caption: 'Pôr do sol sobre os olivais',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Pôr do sol com DJ e degustação',
      text: 'Reserve a parte da tarde (a partir das 15h) e fique até o sol se pôr atrás das montanhas.',
      curator_badge: '⭐ Dica Divulga Lugares'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },

  // CANELA
  {
    id: 'a0000001-0000-0000-0000-000000000010',
    legacy_id: 'plc-can-01',
    source_id: 'plc-can-01',
    name: 'Catedral de Pedra (Nossa Senhora de Lourdes)',
    slug: 'catedral-de-pedra',
    city: 'Canela',
    category: 'mirante',
    description: 'Monumento imponente em estilo gótico com torre de 65 metros e espetáculo diário de luzes sincronizadas e sinos.',
    latitude: -29.3627,
    longitude: -50.8143,
    address: 'Praça da Matriz, 69 - Centro, Canela - RS',
    rating: 4.9,
    rating_count: 31000,
    price_level: 1,
    price_info: {
      adult_price: 0,
      is_free: true,
      currency: 'BRL',
      source_name: 'Público / Paróquia',
      checked_at: '2026-01-15',
      confidence: 'high'
    },
    average_duration_minutes: 60,
    reservation_required: false,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'mixed',
    opening_hours: {
      'seg': '08:30 - 18:00 (Luzes: 20:00 e 21:00)',
      'ter': '08:30 - 18:00 (Luzes: 20:00 e 21:00)',
      'qua': '08:30 - 18:00 (Luzes: 20:00 e 21:00)',
      'qui': '08:30 - 18:00 (Luzes: 20:00 e 21:00)',
      'sex': '08:30 - 18:00 (Luzes: 20:00 e 21:00)',
      'sab': '08:30 - 18:00 (Luzes: 20:00 e 21:00)',
      'dom': '08:30 - 18:00 (Luzes: 20:00 e 21:00)'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1548625361-195fe57871b6?auto=format&fit=crop&w=1000&q=80',
        caption: 'Catedral de Pedra iluminada',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: false,
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000008',
    legacy_id: 'plc-can-02',
    source_id: 'plc-can-02',
    name: 'Parque do Caracol e Cascata do Caracol',
    slug: 'parque-do-caracol',
    city: 'Canela',
    category: 'parque',
    description: 'A mais famosa queda d’água do RS com 131 metros de altura, cercada por mata nativa de araucárias, mirantes modernos e bondinhos aéreos.',
    latitude: -29.3134,
    longitude: -50.8532,
    address: 'Rodovia RS-466, km 0 - Caracol, Canela - RS',
    phone: '(54) 3282-2005',
    website: 'https://parquedocaracol.com.br',
    instagram: '@parquedocaracol',
    rating: 4.8,
    rating_count: 26000,
    price_level: 2,
    price_info: {
      adult_price: 75,
      child_price: 37,
      senior_price: 37,
      is_free: false,
      currency: 'BRL',
      source_name: 'Site Oficial Parque do Caracol',
      checked_at: '2026-02-28',
      confidence: 'high'
    },
    average_duration_minutes: 150,
    reservation_required: false,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'outdoor',
    opening_hours: {
      'seg': '09:00 - 17:30',
      'ter': '09:00 - 17:30',
      'qua': '09:00 - 17:30',
      'qui': '09:00 - 17:30',
      'sex': '09:00 - 17:30',
      'sab': '09:00 - 17:30',
      'dom': '09:00 - 17:30'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=1000&q=80',
        caption: 'Cascata do Caracol com 131 metros',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Mirante dos bondinhos',
      text: 'Logo ao lado do parque ficam os Bondinhos Aéreos Parques da Serra, que oferecem vista frontal da cascata sem esforço físico.',
      curator_badge: '⭐ Dica Divulga Lugares'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000007',
    legacy_id: 'plc-can-03',
    source_id: 'plc-can-03',
    name: 'Skyglass Canela',
    slug: 'skyglass-canela',
    city: 'Canela',
    category: 'mirante',
    description: 'A maior plataforma de vidro estaiada do mundo sobre o Vale da Ferradura, a 360 metros de altura sobre o Rio Caí, com o brinquedo Abusado suspenso no ar.',
    latitude: -29.2882,
    longitude: -50.8491,
    address: 'Estrada Municipal CNL 350, 9800 - Zona Rural, Canela - RS',
    phone: '(54) 3699-9200',
    website: 'https://skyglasscanela.com.br',
    instagram: '@skyglasscanela',
    rating: 4.7,
    rating_count: 15400,
    price_level: 3,
    price_info: {
      adult_price: 130,
      child_price: 65,
      is_free: false,
      currency: 'BRL',
      source_name: 'Bilheteria Oficial Skyglass',
      checked_at: '2026-03-01',
      confidence: 'high'
    },
    average_duration_minutes: 120,
    reservation_required: false,
    accessible: true,
    pet_friendly: false,
    children_friendly: true,
    indoor_type: 'outdoor',
    opening_hours: {
      'seg': '09:00 - 18:00',
      'ter': '09:00 - 18:00',
      'qua': '09:00 - 18:00',
      'qui': '09:00 - 18:00',
      'sex': '09:00 - 18:00',
      'sab': '09:00 - 18:00',
      'dom': '09:00 - 18:00'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80',
        caption: 'Plataforma estaiada sobre o vale',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: false,
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000009',
    legacy_id: 'plc-can-04',
    source_id: 'plc-can-04',
    name: 'Alpen Park',
    slug: 'alpen-park',
    city: 'Canela',
    category: 'parque',
    description: 'Parque de aventura em meio à natureza com trenó alpino nas encostas, tirolesa, quadriciclo, cinema 4D e montanha-russa.',
    latitude: -29.3512,
    longitude: -50.7938,
    address: 'Rodovia Arnaldo Oppitz, 901 - Canela - RS',
    phone: '(54) 3282-9750',
    website: 'https://alpenpark.com.br',
    instagram: '@alpenpark',
    rating: 4.7,
    rating_count: 11000,
    price_level: 2,
    price_info: {
      adult_price: 119,
      is_free: false,
      currency: 'BRL',
      source_name: 'Passaporte Alpen',
      checked_at: '2026-02-25',
      confidence: 'high'
    },
    average_duration_minutes: 180,
    reservation_required: false,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'mixed',
    opening_hours: {
      'seg': '09:00 - 17:20',
      'ter': '09:00 - 17:20',
      'qua': '09:00 - 17:20',
      'qui': '09:00 - 17:20',
      'sex': '09:00 - 17:20',
      'sab': '09:00 - 17:20',
      'dom': '09:00 - 17:20'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
        caption: 'Trenó alpino entre as copas das árvores',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Trenó alpino em dia ensolarado',
      text: 'O trenó é o destaque absoluto. O visitante controla a velocidade por alavanca. Crianças a partir de 3 anos podem ir acompanhadas.',
      curator_badge: '⭐ Dica Divulga Lugares'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },

  // NOVA PETRÓPOLIS
  {
    id: 'a0000001-0000-0000-0000-000000000011',
    legacy_id: 'plc-nvp-01',
    source_id: 'plc-nvp-01',
    name: 'Labirinto Verde e Praça das Flores',
    slug: 'labirinto-verde',
    city: 'Nova Petrópolis',
    category: 'parque',
    description: 'Labirinto vivo de ciprestes plantados em círculos concêntricos no coração da Praça das Flores, cartão postal da colonização germânica.',
    latitude: -29.3762,
    longitude: -51.1141,
    address: 'Praça Theodor Amstad - Centro, Nova Petrópolis - RS',
    rating: 4.8,
    rating_count: 14200,
    price_level: 1,
    price_info: {
      adult_price: 0,
      is_free: true,
      currency: 'BRL',
      source_name: 'Público / Prefeitura',
      checked_at: '2026-01-20',
      confidence: 'high'
    },
    average_duration_minutes: 60,
    reservation_required: false,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'outdoor',
    opening_hours: {
      'seg': 'Aberto 24h',
      'ter': 'Aberto 24h',
      'qua': 'Aberto 24h',
      'qui': 'Aberto 24h',
      'sex': 'Aberto 24h',
      'sab': 'Aberto 24h',
      'dom': 'Aberto 24h'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=1000&q=80',
        caption: 'Labirinto de cercas vivas e flores bem cuidadas',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: false,
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000012',
    legacy_id: 'plc-nvp-02',
    source_id: 'plc-nvp-02',
    name: 'Parque Aldeia do Imigrante',
    slug: 'aldeia-do-imigrante',
    city: 'Nova Petrópolis',
    category: 'museu',
    description: 'Museu vivo a céu aberto preservando construções históricas autênticas em enxaimel, capela, escola colonial e produtos coloniais artesanais.',
    latitude: -29.3785,
    longitude: -51.1098,
    address: 'Av. 15 de Novembro, 1966 - Centro, Nova Petrópolis - RS',
    phone: '(54) 3281-2622',
    website: 'https://aldeiadoimigrante.com.br',
    instagram: '@aldeiadoimigrante',
    rating: 4.7,
    rating_count: 8700,
    price_level: 1,
    price_info: {
      adult_price: 25,
      child_price: 12,
      senior_price: 12,
      is_free: false,
      currency: 'BRL',
      source_name: 'Bilheteria Parque',
      checked_at: '2026-02-10',
      confidence: 'high'
    },
    average_duration_minutes: 120,
    reservation_required: false,
    accessible: true,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'mixed',
    opening_hours: {
      'seg': '08:30 - 17:30',
      'ter': '08:30 - 17:30',
      'qua': '08:30 - 17:30',
      'qui': '08:30 - 17:30',
      'sex': '08:30 - 17:30',
      'sab': '08:30 - 17:30',
      'dom': '08:30 - 17:30'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
        caption: 'Casas históricas enxaimel',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Pão de milho e cuca quentinha',
      text: 'Passe na aldeia histórica e prove a cuca recheada feita nos fornos de barro locais acompanhada de chimarrão.',
      curator_badge: '⭐ Dica Divulga Lugares'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  },
  {
    id: 'a0000001-0000-0000-0000-000000000013',
    legacy_id: 'plc-nvp-03',
    source_id: 'plc-nvp-03',
    name: 'Ninho das Águias',
    slug: 'ninho-das-aguias',
    city: 'Nova Petrópolis',
    category: 'mirante',
    description: 'Ponto culminante a 590 metros de altitude com rampa de voo livre e vista panorâmica espetacular de todo o Vale do Caí.',
    latitude: -29.4005,
    longitude: -51.1738,
    address: 'Estrada Linha Olinda, s/n - Zona Rural, Nova Petrópolis - RS',
    rating: 4.8,
    rating_count: 6200,
    price_level: 1,
    price_info: {
      adult_price: 15,
      is_free: false,
      currency: 'BRL',
      source_name: 'Clube de Voo Livre',
      checked_at: '2026-01-18',
      confidence: 'high'
    },
    average_duration_minutes: 90,
    reservation_required: false,
    accessible: false,
    pet_friendly: true,
    children_friendly: true,
    indoor_type: 'outdoor',
    opening_hours: {
      'seg': '09:00 - 19:00',
      'ter': '09:00 - 19:00',
      'qua': '09:00 - 19:00',
      'qui': '09:00 - 19:00',
      'sex': '09:00 - 19:00',
      'sab': '09:00 - 19:00',
      'dom': '09:00 - 19:00'
    },
    media: [
      {
        url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=80',
        caption: 'Pôr do sol panorâmico no Ninho das Águias',
        is_hero: true
      }
    ],
    is_divulga_lugares_partner: true,
    divulga_lugares_tip: {
      title: 'Leve toalha e cuia de chimarrão',
      text: 'O pôr do sol no Ninho é um dos mais poéticos do Sul. Chegue às 17h, estenda uma toalha na grama e curta o espetáculo.',
      curator_badge: '⭐ Dica Divulga Lugares'
    },
    active: true,
    is_demo: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z'
  }
];

export const SEED_EVENTS: SerraEvent[] = [
  {
    id: 'evt-01',
    name: 'Natal Luz de Gramado',
    slug: 'natal-luz-gramado',
    city: 'Gramado',
    description: 'O maior evento natalino do Brasil com o Show de Acendimento diário gratuito, Parada de Natal e grandes espetáculos musicais no Lago.',
    start_date: '2026-10-24',
    end_date: '2027-01-18',
    default_time: '20:00',
    is_anchor_event: true,
    location_name: 'Centro e Lago Joaquina Rita Bier',
    price_info: 'Show de Acendimento Gratuito / Espetáculos principais a partir de R$ 180',
    ticket_required: false,
    ticket_url: 'https://natalluzdegramado.com.br',
    banner_url: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?auto=format&fit=crop&w=1000&q=80',
    is_demo: true
  },
  {
    id: 'evt-02',
    name: 'Sonho de Natal de Canela',
    slug: 'sonho-de-natal-canela',
    city: 'Canela',
    description: 'Espetáculo de descida do Papai Noel da torre da Catedral de Pedra com show pirotécnico e iluminação sincronizada.',
    start_date: '2026-10-26',
    end_date: '2027-01-12',
    default_time: '20:30',
    is_anchor_event: true,
    location_name: 'Catedral de Pedra de Canela',
    price_info: 'Gratuito em praça pública',
    ticket_required: false,
    banner_url: 'https://images.unsplash.com/photo-1548625361-195fe57871b6?auto=format&fit=crop&w=1000&q=80',
    is_demo: true
  },
  {
    id: 'evt-03',
    name: 'Festival de Cinema de Gramado',
    slug: 'festival-cinema-gramado',
    city: 'Gramado',
    description: 'Tradicional tapete vermelho da Rua Coberta e exibição dos melhores filmes do cinema latino-americano e brasileiro no Palácio dos Festivais.',
    start_date: '2026-08-08',
    end_date: '2026-08-16',
    default_time: '18:00',
    is_anchor_event: true,
    location_name: 'Palácio dos Festivais / Rua Coberta',
    price_info: 'Tapete vermelho gratuito / Sessões sob consulta',
    ticket_required: false,
    is_demo: true
  },
  {
    id: 'evt-04',
    name: 'Magia da Páscoa de Gramado',
    slug: 'pascoa-gramado',
    city: 'Gramado',
    description: 'Paradas festivas, fábricas de chocolate ao vivo, personagens e decoração lúdica na Av. Borges de Medeiros.',
    start_date: '2026-03-15',
    end_date: '2026-04-12',
    default_time: '16:00',
    is_anchor_event: false,
    location_name: 'Av. Borges de Medeiros e Praça das Etnias',
    price_info: 'Gratuito',
    ticket_required: false,
    is_demo: true
  }
];

export const PRICING_TIERS = [
  { min_days: 1, max_days: 7, price_brl: 19.90, label: '1 a 7 dias' },
  { min_days: 8, max_days: 10, price_brl: 24.90, label: '8 a 10 dias' },
  { min_days: 11, max_days: 14, price_brl: 29.90, label: '11 a 14 dias' },
  { min_days: 15, max_days: 21, price_brl: 39.90, label: '15 a 21 dias' }
];

export function calculateTripPrice(daysCount: number): number {
  const tier = PRICING_TIERS.find(t => daysCount >= t.min_days && daysCount <= t.max_days);
  if (tier) return tier.price_brl;
  if (daysCount > 21) return 49.90;
  return 19.90;
}

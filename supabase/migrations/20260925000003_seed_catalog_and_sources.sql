-- ==============================================================================
-- DUO21 / Divulga Lugares - Migration 03: Seed Catalog & Sources
-- Database: PostgreSQL (Supabase)
-- Version: 20260925000003
-- ==============================================================================

-- 1. DATA SOURCES
INSERT INTO public.data_sources (id, name, type, base_url, active, reliability_level) VALUES
('duo21_curatorship', 'Curadoria DUO21 / Divulga Lugares', 'DUO21', 'https://divulgalugares.com.br', true, 'high'),
('official_gramado', 'Secretaria de Turismo de Gramado', 'OFFICIAL', 'https://gramado.rs.gov.br', true, 'high'),
('official_canela', 'Turismo Canela Paixão Natural', 'OFFICIAL', 'https://canela.rs.gov.br', true, 'high'),
('google_places', 'Google Places Platform (Cache)', 'GOOGLE', 'https://maps.googleapis.com', true, 'high'),
('user_verified', 'Auditoria Colaborativa DUO21', 'USER_REPORT', NULL, true, 'medium')
ON CONFLICT (id) DO NOTHING;

-- 2. CATEGORIES
INSERT INTO public.place_categories (id, code, name, icon, description, active) VALUES
('ATTRACTION', 'ATTRACTION', 'Atração Turística', 'Compass', 'Parques temáticos, mirantes e pontos de interesse geral', true),
('RESTAURANT', 'RESTAURANT', 'Restaurante', 'Utensils', 'Gastronomia típica, fondues, massas, churrascarias e bistrôs', true),
('CAFE', 'CAFE', 'Café & Confeitaria', 'Coffee', 'Cafés coloniais, confeitarias e paradas para lanche', true),
('HOTEL', 'HOTEL', 'Hotel', 'Building2', 'Hotéis confortáveis com infraestrutura completa', true),
('POUSADA', 'POUSADA', 'Pousada de Charme', 'Home', 'Pousadas acolhedoras em bairros residenciais ou natureza', true),
('CABIN', 'CABIN', 'Cabana / Chalé', 'Trees', 'Hospedagens rústicas e privativas com lareira', true),
('PARK', 'PARK', 'Parque & Natureza', 'Trees', 'Parques naturais, cascatas, trilhas e ar livre', true),
('MUSEUM', 'MUSEUM', 'Museu & Cultura', 'Landmark', 'Museus temáticos de história, automóveis e arte', true),
('SHOPPING', 'SHOPPING', 'Compras & Lojas', 'ShoppingBag', 'Avenidas comerciais e galerias de artesanato', true),
('CHOCOLATE', 'CHOCOLATE', 'Fábrica de Chocolate', 'Sparkles', 'Chocolaterias artesanais e fábricas visitáveis', true),
('WINERY', 'WINERY', 'Vinícola & Degustação', 'Wine', 'Vinícolas, caves e degustação de espumantes', true),
('NATURE', 'NATURE', 'Mirante & Paisagem', 'Mountain', 'Vistas panorâmicas dos vales da Serra Gaúcha', true),
('EXPERIENCE', 'EXPERIENCE', 'Experiência Noturna', 'Moon', 'Shows, eventos noturnos e experiências temáticas', true),
('FREE_ATTRACTION', 'FREE_ATTRACTION', 'Atração Gratuita', 'Smile', 'Espaços públicos, praças e lagos abertos', true),
('OTHER', 'OTHER', 'Outros Serviços', 'MapPin', 'Serviços turísticos e apoios gerais', true)
ON CONFLICT (id) DO NOTHING;

-- 3. TAGS
INSERT INTO public.place_tags (id, name, category_group) VALUES
('natureza', 'Natureza & Ar Livre', 'ambiente'),
('criancas', 'Ideal para Crianças', 'perfil'),
('casal', 'Viagem a Dois', 'perfil'),
('romantico', 'Romântico & Aconchegante', 'perfil'),
('aventura', 'Aventura & Emoção', 'experiencia'),
('gastronomia', 'Alta Gastronomia', 'gastronomia'),
('fondue', 'Sequência de Fondue', 'gastronomia'),
('italiano', 'Culinária Italiana & Massas', 'gastronomia'),
('churrasco', 'Churrasco & Galeto', 'gastronomia'),
('cafe', 'Café Colonial & Doces', 'gastronomia'),
('chocolate', 'Chocolate Artesanal', 'gastronomia'),
('gratuito', '100% Gratuito', 'custo'),
('instagramavel', 'Fotos & Mirantes', 'experiencia'),
('dia_de_chuva', 'Ideal para Dias de Chuva (Indoor)', 'ambiente'),
('idosos', 'Acessível para Idosos', 'perfil'),
('acessivel', 'Acessibilidade PCD', 'perfil'),
('centro', 'Próximo ao Centro', 'localizacao'),
('experiencia_local', 'Tradição Local Gaúcha', 'experiencia'),
('premium', 'Experiência Premium', 'custo'),
('economico', 'Bom Custo-Benefício', 'custo')
ON CONFLICT (id) DO NOTHING;

-- 4. SEED PLACES (Gramado, Canela, Nova Petrópolis)
-- 13 Atrações, 9 Restaurantes/Cafés, 5 Hospedagens = 27 places (is_demo = true)
INSERT INTO public.places (
    id, name, slug, city, state, country, category_id, subcategory, latitude, longitude, address,
    google_place_id, description_short, description_internal, duration_min, duration_max,
    indoor_outdoor, suitable_for_children, age_min, age_max, accessibility, pet_friendly,
    reservation_required, cost_level, estimated_cost_min, estimated_cost_max, cost_per_person,
    official_website, instagram, whatsapp, partner, divulga_lugares_recommended, divulga_lugares_tip,
    active, is_demo, source_id, checked_at, confidence
) VALUES
-- ATRAÇÃO 1: Lago Negro (Gramado)
('a0000001-0000-0000-0000-000000000001', 'Lago Negro', 'lago-negro', 'Gramado', 'RS', 'Brasil',
 'FREE_ATTRACTION', 'Parque Público', -29.3888, -50.8808, 'Rua A. J. Renner, Bairro Planalto, Gramado - RS',
 'ChIJQ3y-demo-lago-negro', 'Caminhada sob pinheiros da Floresta Negra alemã e pedalinhos no lago mais famoso da Serra.',
 'Parque aberto 24h. Aluguel de pedalinhos das 08h30 às 18h. Estacionamento gratuito nas ruas laterais.',
 60, 90, 'outdoor', true, 0, 99, true, true, false, 1, 0, 60, 0,
 'https://gramado.rs.gov.br', '@lagonegrooficial', NULL, false, true,
 '{"title": "Melhor horário para fotos", "text": "Chegue antes das 09h30 para pegar o espelho d''água calmo e evitar filas nos pedalinhos."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 2: Mini Mundo (Gramado)
('a0000001-0000-0000-0000-000000000002', 'Mini Mundo', 'mini-mundo', 'Gramado', 'RS', 'Brasil',
 'ATTRACTION', 'Parque Temático', -29.3820, -50.8770, 'Rua Horácio Cardoso, 291, Gramado - RS',
 'ChIJmini-mundo-demo', 'Parque ao ar livre com réplicas fiéis de castelos, cidades europeias e trens em miniatura.',
 'Excelente para crianças e famílias. Circuito acessível para carrinhos de bebê.',
 90, 120, 'outdoor', true, 2, 99, true, false, false, 2, 80, 110, 98,
 'https://minimundo.com.br', '@minimundogramado', '+555432861334', true, true,
 '{"title": "Dica de passeio com crianças", "text": "As crianças recebem um gibi com caça aos detalhes espalhados pelas miniaturas."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 3: Snowland (Gramado)
('a0000001-0000-0000-0000-000000000003', 'Snowland Gramado', 'snowland-gramado', 'Gramado', 'RS', 'Brasil',
 'ATTRACTION', 'Parque de Neve', -29.4005, -50.9160, 'RS-235, 9009, Carazal, Gramado - RS',
 'ChIJsnowland-demo', 'Primeiro parque de neve indoor das Américas com pista de patinação, esqui e tubing.',
 'Climatizado a -5ºC. Roupas térmicas inclusas no ingresso. Fazer reserva antecipada em alta temporada.',
 180, 240, 'indoor', true, 4, 75, true, false, true, 4, 189, 249, 219,
 'https://snowland.com.br', '@snowlandgramado', '+555432956000', true, true,
 '{"title": "Roupas extras", "text": "Traga luvas impermeáveis e meias grossas extras para maior conforto na montanha de neve."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 4: Olivas de Gramado (Gramado)
('a0000001-0000-0000-0000-000000000004', 'Olivas de Gramado', 'olivas-de-gramado', 'Gramado', 'RS', 'Brasil',
 'ATTRACTION', 'Parque Rural & Azeites', -29.4320, -50.8410, 'Rua Vereador José Alexandre Benetti, 1808, Gramado - RS',
 'ChIJolivas-gramado-demo', 'Plantações de oliveiras com vista espetacular para os canyons, degustação sensorial de azeites e piquenique.',
 'Melhor pôr do sol de Gramado com música ao vivo aos fins de semana.',
 120, 180, 'outdoor', true, 0, 99, true, true, true, 3, 119, 149, 129,
 'https://olivasdegramado.com.br', '@olivasdegramado', NULL, true, true,
 '{"title": "Sunset nas Olivas", "text": "Programe a visita a partir das 15h30 para aproveitar a degustação e assistir ao pôr do sol no gramado."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 5: Praça das Etnias & Rua Torta (Gramado)
('a0000001-0000-0000-0000-000000000005', 'Praça das Etnias e Rua Torta', 'praca-das-etnias', 'Gramado', 'RS', 'Brasil',
 'FREE_ATTRACTION', 'Ponto Histórico', -29.3792, -50.8710, 'Av. Borges de Medeiros, Centro, Gramado - RS',
 'ChIJpraca-etnias-demo', 'Casa do Colono com pães e cucas quentinhas assados no forno a lenha e a fotogênica Rua Torta.',
 'Ótimo passeio a pé no centro de Gramado. Pães saem fornadas das 10h às 17h.',
 45, 60, 'outdoor', true, 0, 99, true, true, false, 1, 0, 30, 0,
 'https://gramado.rs.gov.br', '@casadocolonogramado', NULL, false, true,
 '{"title": "Cuca quentinha", "text": "Compre o pão com linguiça ou a cuca de uva saindo do forno nos fornos coloniais."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 6: Mirante Vale do Quilombo (Gramado)
('a0000001-0000-0000-0000-000000000006', 'Mirante do Vale do Quilombo', 'mirante-vale-do-quilombo', 'Gramado', 'RS', 'Brasil',
 'NATURE', 'Mirante Natural', -29.3720, -50.8650, 'Av. das Hortênsias, Gramado - RS',
 'ChIJquilombo-demo', 'Vista panorâmica impressionante de 850 metros de altitude para a vegetação nativa da serra.',
 'Ponto de parada rápida na saída de Gramado para Canela. Gratuito.',
 20, 40, 'outdoor', true, 0, 99, true, true, false, 1, 0, 0, 0,
 NULL, NULL, NULL, false, false, NULL, true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 7: Cascata do Caracol & Bondinhos Aéreos (Canela)
('a0000001-0000-0000-0000-000000000007', 'Bondinhos Aéreos Parres', 'bondinhos-aereos-canela', 'Canela', 'RS', 'Brasil',
 'ATTRACTION', 'Parque com Teleférico', -29.3130, -50.8520, 'Estrada da Ferradura, 699, Canela - RS',
 'ChIJbondinhos-canela-demo', 'Cabines panorâmicas com vista privilegiada para a imponente Cascata do Caracol de 131 metros.',
 'Estrutura acessível com trilhas suspensas e esculturas sonoras para crianças.',
 90, 150, 'outdoor', true, 0, 99, true, false, false, 2, 70, 95, 80,
 'https://parquesdaserra.com.br', '@bondinhosaereos', '+555438783250', true, true,
 '{"title": "Estação Animal", "text": "Não deixe de descer na segunda estação para ver as esculturas de madeira talhadas por artistas da serra."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 8: Parque do Caracol (Canela)
('a0000001-0000-0000-0000-000000000008', 'Parque Estadual do Caracol', 'parque-do-caracol', 'Canela', 'RS', 'Brasil',
 'PARK', 'Parque Estadual', -29.3160, -50.8560, 'RS-466, Canela - RS',
 'ChIJparque-caracol-demo', 'O parque símbolo da serra com mirantes frontais para a cascata, trilhas na mata atlântica e observatório.',
 'Estrutura revitalizada com trilha ecológica e cafeteria.',
 90, 140, 'outdoor', true, 0, 99, true, true, false, 2, 60, 85, 75,
 'https://parquedocaracol.com.br', '@parquedocaracol', NULL, false, true, NULL,
 true, true, 'official_canela', CURRENT_DATE, 'high'),

-- ATRAÇÃO 9: Mundo a Vapor (Canela)
('a0000001-0000-0000-0000-000000000009', 'Mundo a Vapor', 'mundo-a-vapor', 'Canela', 'RS', 'Brasil',
 'MUSEUM', 'Parque Histórico', -29.3620, -50.8280, 'Av. Don Luiz Guanella, 1247, Canela - RS',
 'ChIJmundo-a-vapor-demo', 'Parque com réplicas mecânicas em funcionamento das grandes invenções a vapor do mundo.',
 'Ótimo para dias de chuva por ter grande ala coberta. Passeio de trem elétrico para crianças.',
 75, 100, 'indoor', true, 3, 99, true, false, false, 2, 65, 90, 78,
 'https://mundoavapor.com.br', '@mundoavapor', '+555432821125', true, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 10: Catedral de Pedra (Canela)
('a0000001-0000-0000-0000-000000000010', 'Catedral de Pedra Nossa Senhora de Lourdes', 'catedral-de-pedra', 'Canela', 'RS', 'Brasil',
 'FREE_ATTRACTION', 'Monumento Histórico', -29.3600, -50.8110, 'Praça da Matriz, Centro, Canela - RS',
 'ChIJcatedral-canela-demo', 'Monumento em estilo gótico inglês com espetáculo de luzes e sons gratuito todas as noites.',
 'Show de luzes gratuito às 20h00 e 21h00 na praça central de Canela.',
 30, 60, 'mixed', true, 0, 99, true, true, false, 1, 0, 0, 0,
 NULL, '@catedraldepedracanela', NULL, false, true,
 '{"title": "Espetáculo de Luzes", "text": "Chegue às 19h45 para sentar nos bancos da praça e apreciar o show de luzes na fachada de pedra."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 11: Praça das Flores & Labirinto Verde (Nova Petrópolis)
('a0000001-0000-0000-0000-000000000011', 'Praça das Flores e Labirinto Verde', 'labirinto-verde', 'Nova Petrópolis', 'RS', 'Brasil',
 'FREE_ATTRACTION', 'Praça e Lazer', -29.3758, -51.1153, 'Av. 15 de Novembro, Centro, Nova Petrópolis - RS',
 'ChIJlabirinto-np-demo', 'O coração florido da cidade alemã da serra com o labirinto vivo de ciprestes para diversão de todas as idades.',
 'Acesso gratuito. Excelente parada fotográfica e comércio de malhas.',
 45, 75, 'outdoor', true, 0, 99, true, true, false, 1, 0, 0, 0,
 NULL, NULL, NULL, false, true, NULL, true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 12: Parque Aldeia do Imigrante (Nova Petrópolis)
('a0000001-0000-0000-0000-000000000012', 'Parque Aldeia do Imigrante', 'aldeia-do-imigrante', 'Nova Petrópolis', 'RS', 'Brasil',
 'PARK', 'Vila Histórica', -29.3780, -51.1120, 'Av. 15 de Novembro, 1665, Nova Petrópolis - RS',
 'ChIJaldeia-imigrante-demo', 'Aldeia histórica viva com construções originais enxaimel, lago, artesanato e gastronomia típica alemã.',
 'Tranquilidade e ar puro. Música ao vivo aos finais de semana.',
 90, 120, 'outdoor', true, 0, 99, true, true, false, 1, 18, 25, 20,
 'https://aldeiadoimigrante.com.br', '@parquealdeiadoimigrante', NULL, true, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- ATRAÇÃO 13: Parque da Ferradura (Canela)
('a0000001-0000-0000-0000-000000000013', 'Parque da Ferradura', 'parque-da-ferradura', 'Canela', 'RS', 'Brasil',
 'PARK', 'Reserva Natural', -29.2780, -50.8520, 'Estrada do Caracol, Canela - RS',
 'ChIJferradura-demo', 'Canyon profundo de 420 metros moldado pelo Rio Santa Cruz em formato de ferradura com fauna nativa.',
 'Trilhas leves e mirantes espetaculares. Presença de quatis e macacos-prego.',
 90, 140, 'outdoor', true, 5, 99, false, false, false, 1, 15, 20, 15,
 NULL, NULL, NULL, false, false, NULL, true, true, 'official_canela', CURRENT_DATE, 'high'),

-- RESTAURANTE 1: Belle Du Valais (Gramado) - Fondue Premium
('b0000001-0000-0000-0000-000000000001', 'Belle Du Valais Restaurante', 'belle-du-valais', 'Gramado', 'RS', 'Brasil',
 'RESTAURANT', 'Fondue Suíço', -29.3810, -50.8715, 'Av. das Hortênsias, 1432, Gramado - RS',
 'ChIJbelle-du-valais-demo', 'Considerado o fondue mais premiado do Brasil em ambiente clássico à luz de velas com adega subterrânea.',
 'Sequência suíça autêntica com queijo emmental e gruyère, carnes nobres e chocolate premium.',
 120, 180, 'indoor', false, 8, 99, true, false, true, 4, 180, 240, 210,
 'https://belleduvalais.com.br', '@belleduvalais', '+555432861432', true, true,
 '{"title": "Mesa próxima à lareira", "text": "Reserve com 2 dias de antecedência para garantir as mesas com vista para o jardim de inverno."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 2: Colosseo Fondue (Gramado) - Fondue Tradicional
('b0000001-0000-0000-0000-000000000002', 'Restaurante Colosseo Fondue', 'restaurante-colosseo', 'Gramado', 'RS', 'Brasil',
 'RESTAURANT', 'Fondue Tradicional', -29.3785, -50.8732, 'Av. das Hortênsias, 1560, Centro, Gramado - RS',
 'ChIJcolosseo-demo', 'Tradição em fondue na pedra no centro de Gramado com piano ao vivo e carta de vinhos selecionada.',
 'Excelente opção de sequência completa na pedra (queijo, filé, picanha, frango e chocolate).',
 90, 150, 'indoor', true, 0, 99, true, false, true, 3, 110, 160, 130,
 'https://restaurantecolosseo.com.br', '@colosseogramado', '+555432867000', true, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 3: Galeto Di Paolo (Gramado) - Custo Médio Almoço
('b0000001-0000-0000-0000-000000000003', 'Galeto Di Paolo Gramado', 'galeto-di-paolo', 'Gramado', 'RS', 'Brasil',
 'RESTAURANT', 'Culinária Típica Gaúcha', -29.3870, -50.8640, 'Rua Garibaldi, 23, Gramado - RS',
 'ChIJdipaolo-demo', 'A autêntica culinária da imigração italiana com sopa de capeletti, galeto al primo canto e massas artesanais.',
 'Melhor galeto da Serra Gaúcha. Perfeito para almoços rápidos e fartos dentro do orçamento.',
 60, 90, 'indoor', true, 0, 99, true, false, false, 2, 75, 95, 82,
 'https://dipaolo.com.br', '@galetodipaolo', '+555432865080', true, true,
 '{"title": "Massa artesanal", "text": "Peça o tortéi com molho de nata e cogumelos, uma das especialidades mais elogiadas."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 4: Cantina Pastasciutta (Gramado)
('b0000001-0000-0000-0000-000000000004', 'Cantina Pastasciutta', 'cantina-pastasciutta', 'Gramado', 'RS', 'Brasil',
 'RESTAURANT', 'Cantina Italiana', -29.3770, -50.8745, 'Av. Borges de Medeiros, 2083, Gramado - RS',
 'ChIJpastasciutta-demo', 'Cantina tradicional com presuntos e queijos pendurados no teto, massas frescas e ambiente acolhedor.',
 'Porções generosas que servem duas pessoas com tranquilidade.',
 75, 120, 'indoor', true, 0, 99, true, false, false, 2, 70, 98, 85,
 'https://pastasciutta.com.br', '@cantinapastasciutta', NULL, false, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 5: Casa da Velha Bruxa (Gramado) - Café & Chocolates
('b0000001-0000-0000-0000-000000000005', 'Casa da Velha Bruxa', 'casa-da-velha-bruxa', 'Gramado', 'RS', 'Brasil',
 'CAFE', 'Cafeteria & Doces', -29.3788, -50.8738, 'Av. Borges de Medeiros, 2738, Centro, Gramado - RS',
 'ChIJvelhabruxa-demo', 'A mais icônica casa de doces e chocolates de Gramado ao lado da Rua Coberta com calda quente de Prawer.',
 'Famoso pelo waffle com calda de chocolate e sorvete artesanal.',
 45, 75, 'indoor', true, 0, 99, true, false, false, 2, 28, 55, 38,
 NULL, '@casadavelhabruxa', NULL, false, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 6: Magnólia Cine Gastrô Bar (Canela)
('b0000001-0000-0000-0000-000000000006', 'Magnólia Cine Gastrô Bar', 'magnolia-canela', 'Canela', 'RS', 'Brasil',
 'RESTAURANT', 'Bistrô & Bar Vintage', -29.3640, -50.8140, 'Rua Dona Carlinda, 255, Canela - RS',
 'ChIJmagnolia-demo', 'Casarão dos anos 50 restaurado com minicinema vintage, drinks autorais e cardápio contemporâneo.',
 'Espaço kids monitorado gratuito nos fundos, perfeito para casais com crianças pequenas.',
 90, 150, 'indoor', true, 0, 99, true, false, true, 3, 85, 130, 98,
 'https://magnoliacanela.com.br', '@magnoliacanela', '+555432781000', true, true,
 '{"title": "Espaço Kids Monitorado", "text": "Enquanto os pais jantam com calma, as crianças brincam no espaço temático com recreacionistas."}'::jsonb,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 7: Toro Gramado (Gramado) - Hambúrguer & Jazz
('b0000001-0000-0000-0000-000000000007', 'Toro Gramado Burgers & Jazz', 'toro-gramado', 'Gramado', 'RS', 'Brasil',
 'RESTAURANT', 'Hamburgueria & Jazz', -29.3730, -50.8670, 'Av. das Hortênsias, 804, Gramado - RS',
 'ChIJtoro-demo', 'Hambúrgueres na brasa, chopps artesanais e apresentações diárias de jazz, blues e soul.',
 'Não cobra entrada nem couvert artístico obrigatório.',
 60, 100, 'indoor', true, 0, 99, true, false, false, 2, 55, 80, 68,
 'https://torogramado.com.br', '@torogramado', NULL, false, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 8: Prawer Chocolates Fábrica (Gramado)
('b0000001-0000-0000-0000-000000000008', 'Prawer Chocolates Fábrica e Café', 'prawer-chocolates', 'Gramado', 'RS', 'Brasil',
 'CHOCOLATE', 'Chocolataria Artesanal', -29.3710, -50.8650, 'Av. das Hortênsias, 4100, Gramado - RS',
 'ChIJprawer-demo', 'A primeira fábrica artesanal de chocolates do Brasil (desde 1975) com visitação à linha de produção.',
 'Degustação guiada de bombons recheados e chocolate quente encorpado.',
 45, 60, 'indoor', true, 0, 99, true, false, false, 1, 0, 40, 15,
 'https://prawer.com.br', '@prawerchocolates', NULL, true, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- RESTAURANTE 9: Restaurante Opalma (Nova Petrópolis) - Almoço Colonial
('b0000001-0000-0000-0000-000000000009', 'Restaurante e Café Colonial Opalma', 'restaurante-opalma', 'Nova Petrópolis', 'RS', 'Brasil',
 'RESTAURANT', 'Café Colonial & Almoço', -29.3765, -51.1140, 'Av. 15 de Novembro, Centro, Nova Petrópolis - RS',
 'ChIJopalma-demo', 'Banquete colonial típico alemão com eisbein (joelho de porco), chucrute, pães caseiros e tortas artesanais.',
 'Fartura germânica a preço justo no centro da cidade florida.',
 60, 90, 'indoor', true, 0, 99, true, false, false, 2, 60, 78, 69,
 NULL, '@restauranteopalma', NULL, false, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- HOSPEDAGEM 1: Hotel Casa da Montanha (Gramado)
('c0000001-0000-0000-0000-000000000001', 'Hotel Casa da Montanha', 'hotel-casa-da-montanha', 'Gramado', 'RS', 'Brasil',
 'HOTEL', 'Hotel Boutique', -29.3775, -50.8718, 'Av. Borges de Medeiros, 3166, Centro, Gramado - RS',
 'ChIJcasadamontanha-demo', 'Hotel ícone de Gramado no centro com decoração alpina, piscina aquecida e café da manhã premiado.',
 'Base logística de alto conforto no centro.',
 60, 60, 'indoor', true, 0, 99, true, true, true, 4, 650, 1200, 850,
 'https://casadamontanha.com.br', '@casadamontanha', '+555432957575', true, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- HOSPEDAGEM 2: Hotel Saint Andrews (Gramado) - Luxo
('c0000001-0000-0000-0000-000000000002', 'Hotel Saint Andrews Gramado', 'hotel-saint-andrews', 'Gramado', 'RS', 'Brasil',
 'HOTEL', 'Relais & Châteaux', -29.3850, -50.8680, 'Rua das Flores, 171, Bairro Vale do Bosque, Gramado - RS',
 'ChIJstandrews-demo', 'Exclusivo castelo padrão Relais & Châteaux com mordomo privativo, spa e adega premiada.',
 'Hospedagem ultra-premium na serra.',
 60, 60, 'indoor', false, 14, 99, true, false, true, 4, 1800, 3500, 2400,
 'https://saintandrews.com.br', '@hotelsaintandrews', NULL, false, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- HOSPEDAGEM 3: Pousada Cravo & Canela (Canela)
('c0000001-0000-0000-0000-000000000003', 'Pousada Cravo e Canela', 'pousada-cravo-e-canela', 'Canela', 'RS', 'Brasil',
 'POUSADA', 'Pousada de Charme', -29.3610, -50.8170, 'Rua Tenente Manoel Corrêa, 144, Canela - RS',
 'ChIJcravocanela-demo', 'Casarão rústico em bosque de araucárias centenárias com lareira, chá da tarde cortesia e muito sossego.',
 'Base romântica tranquila em Canela.',
 60, 60, 'indoor', true, 0, 99, true, false, false, 3, 380, 580, 450,
 'https://pousadacravoecanela.com.br', '@pousadacravoecanela', '+555432821700', true, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- HOSPEDAGEM 4: Varanda das Bromélias Spa (Gramado)
('c0000001-0000-0000-0000-000000000004', 'Varanda das Bromélias Boutique Hotel', 'varanda-das-bromelias', 'Gramado', 'RS', 'Brasil',
 'HOTEL', 'Boutique Hotel & Spa', -29.3825, -50.8780, 'Rua Almirante Barroso, 374, Planalto, Gramado - RS',
 'ChIJvaranda-demo', 'Localizado no ponto mais alto de Gramado entre pinheiros, com piscina coberta e quartos com hidromassagem.',
 'Excelente para casais em lua de mel.',
 60, 60, 'indoor', true, 0, 99, true, true, false, 3, 420, 680, 490,
 'https://varandadasbromelias.com.br', '@varandadasbromelias', NULL, false, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high'),

-- HOSPEDAGEM 5: Pousada Blumenberg (Canela)
('c0000001-0000-0000-0000-000000000005', 'Pousada Blumenberg Canela', 'pousada-blumenberg', 'Canela', 'RS', 'Brasil',
 'POUSADA', 'Pousada Central', -29.3605, -50.8125, 'Rua Borges de Medeiros, 499, Centro, Canela - RS',
 'ChIJblumenberg-demo', 'Pousada confortável a 150m da Catedral de Pedra com excelente custo-benefício e café da manhã colonial.',
 'Ideal para passear a pé pelo centrinho de Canela.',
 60, 60, 'indoor', true, 0, 99, true, false, false, 2, 280, 420, 320,
 'https://pousadablumenberg.com.br', '@pousadablumenberg', NULL, true, true, NULL,
 true, true, 'duo21_curatorship', CURRENT_DATE, 'high')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category_id = EXCLUDED.category_id,
  cost_level = EXCLUDED.cost_level,
  cost_per_person = EXCLUDED.cost_per_person,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude;

-- 5. PLACE TAG ASSOCIATIONS (Exemplos reais para busca estruturada)
-- Lago Negro: natureza, casal, criancas, gratuito, instagramavel
INSERT INTO public.place_tag_relations (place_id, tag_id) VALUES
('a0000001-0000-0000-0000-000000000001', 'natureza'),
('a0000001-0000-0000-0000-000000000001', 'casal'),
('a0000001-0000-0000-0000-000000000001', 'criancas'),
('a0000001-0000-0000-0000-000000000001', 'gratuito'),
('a0000001-0000-0000-0000-000000000001', 'instagramavel'),

-- Mini Mundo: criancas, dia_de_chuva, centro
('a0000001-0000-0000-0000-000000000002', 'criancas'),
('a0000001-0000-0000-0000-000000000002', 'centro'),

-- Snowland: criancas, dia_de_chuva, aventura
('a0000001-0000-0000-0000-000000000003', 'criancas'),
('a0000001-0000-0000-0000-000000000003', 'dia_de_chuva'),
('a0000001-0000-0000-0000-000000000003', 'aventura'),

-- Olivas de Gramado: natureza, casal, gastronomia, instagramavel
('a0000001-0000-0000-0000-000000000004', 'natureza'),
('a0000001-0000-0000-0000-000000000004', 'casal'),
('a0000001-0000-0000-0000-000000000004', 'gastronomia'),
('a0000001-0000-0000-0000-000000000004', 'instagramavel'),

-- Belle Du Valais: fondue, gastronomia, casal, romantico, premium
('b0000001-0000-0000-0000-000000000001', 'fondue'),
('b0000001-0000-0000-0000-000000000001', 'gastronomia'),
('b0000001-0000-0000-0000-000000000001', 'casal'),
('b0000001-0000-0000-0000-000000000001', 'romantico'),
('b0000001-0000-0000-0000-000000000001', 'premium'),

-- Colosseo: fondue, gastronomia, casal
('b0000001-0000-0000-0000-000000000002', 'fondue'),
('b0000001-0000-0000-0000-000000000002', 'gastronomia'),
('b0000001-0000-0000-0000-000000000002', 'casal'),

-- Galeto Di Paolo: churrasco, italiano, gastronomia, economico, criancas
('b0000001-0000-0000-0000-000000000003', 'churrasco'),
('b0000001-0000-0000-0000-000000000003', 'italiano'),
('b0000001-0000-0000-0000-000000000003', 'gastronomia'),
('b0000001-0000-0000-0000-000000000003', 'economico'),
('b0000001-0000-0000-0000-000000000003', 'criancas'),

-- Cantina Pastasciutta: italiano, gastronomia, casal, criancas
('b0000001-0000-0000-0000-000000000004', 'italiano'),
('b0000001-0000-0000-0000-000000000004', 'gastronomia'),

-- Magnólia Canela: gastronomia, criancas, casal, romantico
('b0000001-0000-0000-0000-000000000006', 'gastronomia'),
('b0000001-0000-0000-0000-000000000006', 'criancas'),
('b0000001-0000-0000-0000-000000000006', 'casal')
ON CONFLICT DO NOTHING;

-- 6. PLACE OPERATIONAL HOURS (Horários dos locais)
INSERT INTO public.place_hours (place_id, day_of_week, open_time, close_time, closed, confidence) VALUES
-- Lago Negro (Aberto 24h todos os dias)
('a0000001-0000-0000-0000-000000000001', 0, '00:00', '23:59', false, 'high'),
('a0000001-0000-0000-0000-000000000001', 1, '00:00', '23:59', false, 'high'),
('a0000001-0000-0000-0000-000000000001', 2, '00:00', '23:59', false, 'high'),
('a0000001-0000-0000-0000-000000000001', 3, '00:00', '23:59', false, 'high'),
('a0000001-0000-0000-0000-000000000001', 4, '00:00', '23:59', false, 'high'),
('a0000001-0000-0000-0000-000000000001', 5, '00:00', '23:59', false, 'high'),
('a0000001-0000-0000-0000-000000000001', 6, '00:00', '23:59', false, 'high'),

-- Galeto Di Paolo (Almoço 11:30 às 15:30 e Jantar 19:00 às 23:00)
('b0000001-0000-0000-0000-000000000003', 1, '11:30', '23:00', false, 'high'),
('b0000001-0000-0000-0000-000000000003', 2, '11:30', '23:00', false, 'high'),
('b0000001-0000-0000-0000-000000000003', 3, '11:30', '23:00', false, 'high'),
('b0000001-0000-0000-0000-000000000003', 4, '11:30', '23:00', false, 'high'),
('b0000001-0000-0000-0000-000000000003', 5, '11:30', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000003', 6, '11:30', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000003', 0, '11:30', '22:30', false, 'high'),

-- Belle Du Valais (Jantar 19:00 às 23:30)
('b0000001-0000-0000-0000-000000000001', 1, '19:00', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000001', 2, '19:00', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000001', 3, '19:00', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000001', 4, '19:00', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000001', 5, '19:00', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000001', 6, '19:00', '23:30', false, 'high'),
('b0000001-0000-0000-0000-000000000001', 0, '19:00', '23:00', false, 'high')
ON CONFLICT DO NOTHING;

-- 7. PRICE OBSERVATIONS (Faixas e Temporadas)
INSERT INTO public.price_observations (place_id, price_min, price_max, price_type, season, confidence) VALUES
-- Belle Du Valais (Regular e Alta Temporada / Natal Luz)
('b0000001-0000-0000-0000-000000000001', 180.00, 220.00, 'PER_PERSON', 'REGULAR', 'high'),
('b0000001-0000-0000-0000-000000000001', 210.00, 260.00, 'PER_PERSON', 'HIGH_SEASON', 'high'),

-- Galeto Di Paolo
('b0000001-0000-0000-0000-000000000003', 75.00, 85.00, 'AVERAGE_MEAL', 'REGULAR', 'high'),
('b0000001-0000-0000-0000-000000000003', 85.00, 95.00, 'AVERAGE_MEAL', 'HIGH_SEASON', 'high'),

-- Mini Mundo
('a0000001-0000-0000-0000-000000000002', 80.00, 100.00, 'PER_ENTRY', 'REGULAR', 'high'),
('a0000001-0000-0000-0000-000000000002', 98.00, 115.00, 'PER_ENTRY', 'HIGH_SEASON', 'high'),

-- Snowland
('a0000001-0000-0000-0000-000000000003', 189.00, 229.00, 'PER_ENTRY', 'REGULAR', 'high'),
('a0000001-0000-0000-0000-000000000003', 229.00, 269.00, 'PER_ENTRY', 'HIGH_SEASON', 'high')
ON CONFLICT DO NOTHING;

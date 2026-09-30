-- ==============================================================================
-- DUO21 / Divulga Lugares - Migration 01: Core Schema
-- Database: PostgreSQL (Supabase)
-- Version: 20260925000001
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. DATA SOURCES (Rastreabilidade)
CREATE TABLE IF NOT EXISTS public.data_sources (
    id TEXT PRIMARY KEY, -- e.g. 'official_turismo_gramado', 'duo21_curatorship'
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('OFFICIAL', 'GOOGLE', 'REGIONAL', 'TICKET_PLATFORM', 'PARTNER', 'DUO21', 'USER_REPORT', 'OTHER')),
    base_url TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    reliability_level TEXT DEFAULT 'high' CHECK (reliability_level IN ('high', 'medium', 'low', 'unknown')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. CATEGORIES & TAGS
CREATE TABLE IF NOT EXISTS public.place_categories (
    id TEXT PRIMARY KEY, -- e.g. 'ATTRACTION', 'RESTAURANT'
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.place_tags (
    id TEXT PRIMARY KEY, -- e.g. 'natureza', 'fondue', 'criancas'
    name TEXT NOT NULL,
    category_group TEXT, -- e.g. 'perfil', 'gastronomia', 'ambiente'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PLACES TABLE (Atrações, Restaurantes, Cafés e Hospedagens)
CREATE TABLE IF NOT EXISTS public.places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    city TEXT NOT NULL CHECK (city IN ('Gramado', 'Canela', 'Nova Petrópolis')),
    state TEXT DEFAULT 'RS' NOT NULL,
    country TEXT DEFAULT 'Brasil' NOT NULL,
    
    category_id TEXT REFERENCES public.place_categories(id) ON UPDATE CASCADE NOT NULL,
    subcategory TEXT,
    
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    
    google_place_id TEXT,
    
    description_short TEXT NOT NULL,
    description_internal TEXT,
    
    duration_min INTEGER DEFAULT 60 NOT NULL,
    duration_max INTEGER DEFAULT 120 NOT NULL,
    
    indoor_outdoor TEXT DEFAULT 'outdoor' CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'mixed', 'rain_ok')) NOT NULL,
    
    suitable_for_children BOOLEAN DEFAULT TRUE NOT NULL,
    age_min INTEGER DEFAULT 0,
    age_max INTEGER DEFAULT 99,
    
    accessibility BOOLEAN DEFAULT TRUE NOT NULL,
    pet_friendly BOOLEAN DEFAULT FALSE NOT NULL,
    reservation_required BOOLEAN DEFAULT FALSE NOT NULL,
    
    cost_level INTEGER DEFAULT 2 CHECK (cost_level BETWEEN 1 AND 4) NOT NULL,
    estimated_cost_min NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    estimated_cost_max NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    cost_per_person NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    
    official_website TEXT,
    instagram TEXT,
    whatsapp TEXT,
    
    partner BOOLEAN DEFAULT FALSE NOT NULL,
    divulga_lugares_recommended BOOLEAN DEFAULT FALSE NOT NULL,
    divulga_lugares_tip JSONB,
    
    active BOOLEAN DEFAULT TRUE NOT NULL,
    is_demo BOOLEAN DEFAULT FALSE NOT NULL,
    
    source_id TEXT REFERENCES public.data_sources(id) ON UPDATE CASCADE,
    checked_at DATE DEFAULT CURRENT_DATE NOT NULL,
    confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')) NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Place Tag Relations (Many to Many)
CREATE TABLE IF NOT EXISTS public.place_tag_relations (
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
    tag_id TEXT REFERENCES public.place_tags(id) ON DELETE CASCADE NOT NULL,
    PRIMARY KEY (place_id, tag_id)
);

-- 5. PLACE HOURS
CREATE TABLE IF NOT EXISTS public.place_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Domingo, 1 = Segunda ...
    open_time TIME,
    close_time TIME,
    special_date DATE,
    closed BOOLEAN DEFAULT FALSE NOT NULL,
    source_id TEXT REFERENCES public.data_sources(id),
    checked_at DATE DEFAULT CURRENT_DATE NOT NULL,
    confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')) NOT NULL
);

-- 6. PRICE OBSERVATIONS
CREATE TABLE IF NOT EXISTS public.price_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
    price_min NUMERIC(10, 2) NOT NULL,
    price_max NUMERIC(10, 2) NOT NULL,
    price_type TEXT NOT NULL CHECK (price_type IN ('PER_PERSON', 'PER_COUPLE', 'PER_FAMILY', 'PER_ENTRY', 'AVERAGE_MEAL', 'FREE', 'UNKNOWN')),
    season TEXT DEFAULT 'REGULAR' CHECK (season IN ('LOW_SEASON', 'REGULAR', 'HIGH_SEASON', 'SPECIAL_EVENT')) NOT NULL,
    valid_from DATE,
    valid_until DATE,
    source_id TEXT REFERENCES public.data_sources(id),
    observed_at DATE DEFAULT CURRENT_DATE NOT NULL,
    confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. EVENTS & ANCHORS
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL CHECK (city IN ('Gramado', 'Canela', 'Nova Petrópolis')),
    venue_place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
    start_at DATE NOT NULL,
    end_at DATE NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    official_url TEXT,
    banner_url TEXT,
    source_id TEXT REFERENCES public.data_sources(id),
    checked_at DATE DEFAULT CURRENT_DATE NOT NULL,
    confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')) NOT NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TRIPS
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secure_token TEXT UNIQUE NOT NULL, -- e.g. 'v_ab83f2...'
    customer_name TEXT,
    customer_email TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'BRIEFING', 'PREVIEW', 'AWAITING_PAYMENT', 'PAID', 'GENERATING', 'READY', 'ACTIVE', 'FINISHED', 'CANCELLED'
    )),
    accommodation_status TEXT DEFAULT 'not_booked' CHECK (accommodation_status IN ('booked', 'not_booked', 'undecided')),
    accommodation_place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
    transport_type TEXT DEFAULT 'carro_alugado' NOT NULL,
    pace TEXT DEFAULT 'equilibrado' NOT NULL,
    generation_authorization BOOLEAN DEFAULT FALSE NOT NULL,
    price_brl NUMERIC(10, 2) DEFAULT 19.90 NOT NULL,
    is_demo BOOLEAN DEFAULT FALSE NOT NULL,
    unlock_source TEXT DEFAULT 'payment' CHECK (unlock_source IN ('payment', 'dev_test', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TRIP PROFILES (TravelProfile)
CREATE TABLE IF NOT EXISTS public.trip_profiles (
    trip_id UUID PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
    adults INTEGER DEFAULT 2 NOT NULL,
    children INTEGER DEFAULT 0 NOT NULL,
    children_ages JSONB DEFAULT '[]'::jsonb NOT NULL,
    interests JSONB DEFAULT '[]'::jsonb NOT NULL,
    must_have JSONB DEFAULT '[]'::jsonb NOT NULL,
    nice_to_have JSONB DEFAULT '[]'::jsonb NOT NULL,
    avoid JSONB DEFAULT '[]'::jsonb NOT NULL,
    budget_total NUMERIC(10, 2),
    budget_attractions NUMERIC(10, 2),
    budget_food_per_person NUMERIC(10, 2),
    budget_dinner_per_person NUMERIC(10, 2),
    budget_flexible TEXT DEFAULT 'equilibrado' CHECK (budget_flexible IN ('economico', 'equilibrado', 'conforto', 'luxo')),
    allow_premium_experience BOOLEAN DEFAULT TRUE NOT NULL,
    avoid_expensive_attractions BOOLEAN DEFAULT FALSE NOT NULL,
    raw_user_input TEXT,
    structured_profile JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. TRIP DAYS
CREATE TABLE IF NOT EXISTS public.trip_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    day_number INTEGER NOT NULL,
    city TEXT NOT NULL,
    theme TEXT NOT NULL,
    estimated_cost_min NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    estimated_cost_max NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    weather_forecast JSONB,
    UNIQUE (trip_id, day_number)
);

-- 11. TRIP ACTIVITIES
CREATE TABLE IF NOT EXISTS public.trip_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_day_id UUID REFERENCES public.trip_days(id) ON DELETE CASCADE NOT NULL,
    place_id UUID REFERENCES public.places(id) ON DELETE RESTRICT NOT NULL,
    activity_type TEXT NOT NULL, -- 'attraction', 'restaurant', 'cafe', 'event'
    start_time TIME NOT NULL,
    end_time TIME,
    position INTEGER NOT NULL,
    estimated_cost_min NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    estimated_cost_max NUMERIC(10, 2) DEFAULT 0 NOT NULL,
    reason TEXT,
    locked BOOLEAN DEFAULT FALSE NOT NULL,
    source TEXT DEFAULT 'DUO21 Engine' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. TRIP PREVIEWS (Seguro, sem nomes reais em slots bloqueados)
CREATE TABLE IF NOT EXISTS public.trip_previews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    day_number INTEGER NOT NULL,
    city TEXT NOT NULL,
    slot_type TEXT NOT NULL,
    display_category TEXT NOT NULL,
    display_icon TEXT,
    revealed_place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
    locked BOOLEAN DEFAULT TRUE NOT NULL,
    teaser_title TEXT NOT NULL,
    teaser_description TEXT,
    estimated_cost_range TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. USAGE & QUOTAS
CREATE TABLE IF NOT EXISTS public.trip_usage (
    trip_id UUID PRIMARY KEY REFERENCES public.trips(id) ON DELETE CASCADE,
    structural_changes_today INTEGER DEFAULT 0 NOT NULL,
    full_regenerations INTEGER DEFAULT 0 NOT NULL,
    guide_messages_today INTEGER DEFAULT 0 NOT NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE NOT NULL
);

-- 14. TRIP CHANGES (Auditoria de Alterações)
CREATE TABLE IF NOT EXISTS public.trip_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('SWAP', 'REPLAN_DAY', 'WEATHER', 'DATA_CORRECTION', 'FULL_REGENERATION', 'MANUAL')),
    requested_by TEXT DEFAULT 'user' NOT NULL,
    original_activity_id UUID,
    new_activity_id UUID,
    reason TEXT,
    consumed_quota BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. PAYMENTS (Asaas Gateway)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    provider TEXT DEFAULT 'ASAAS' NOT NULL,
    provider_payment_id TEXT UNIQUE,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'BRL' NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
    paid_at TIMESTAMP WITH TIME ZONE,
    raw_webhook_reference JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. API USAGE & COST GUARD
CREATE TABLE IF NOT EXISTS public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    provider TEXT NOT NULL CHECK (provider IN ('GEMINI', 'OPENAI', 'GOOGLE_PLACES', 'ROUTES', 'WEATHER', 'SEARCH', 'OTHER')),
    operation TEXT NOT NULL,
    request_count INTEGER DEFAULT 1 NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost_brl NUMERIC(8, 4) DEFAULT 0 NOT NULL,
    cached BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. EXTERNAL DATA CACHE
CREATE TABLE IF NOT EXISTS public.external_data_cache (
    cache_key TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 18. USER REPORTS
CREATE TABLE IF NOT EXISTS public.user_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('WRONG_HOURS', 'WRONG_PRICE', 'CLOSED', 'WRONG_LOCATION', 'OTHER')),
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    contact_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE
);
-- ==============================================================================
-- DUO21 / Divulga Lugares - Migration 02: Row Level Security (RLS)
-- Database: PostgreSQL (Supabase)
-- Version: 20260925000002
-- ==============================================================================

-- 1. ENABLE RLS ON ALL TABLES
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_tag_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_changes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- 2. PUBLIC CATALOG READ POLICIES (Anon / Authenticated)
-- Turistas podem consultar locais ativos, categorias, tags, horários e preços de referência
DROP POLICY IF EXISTS "Public read active places" ON public.places;
CREATE POLICY "Public read active places"
    ON public.places FOR SELECT
    USING (active = true);

DROP POLICY IF EXISTS "Public read place categories" ON public.place_categories;
CREATE POLICY "Public read place categories"
    ON public.place_categories FOR SELECT
    USING (active = true);

DROP POLICY IF EXISTS "Public read place tags" ON public.place_tags;
CREATE POLICY "Public read place tags"
    ON public.place_tags FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public read place tag relations" ON public.place_tag_relations;
CREATE POLICY "Public read place tag relations"
    ON public.place_tag_relations FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public read place hours" ON public.place_hours;
CREATE POLICY "Public read place hours"
    ON public.place_hours FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public read price observations" ON public.price_observations;
CREATE POLICY "Public read price observations"
    ON public.price_observations FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public read data sources" ON public.data_sources;
CREATE POLICY "Public read data sources"
    ON public.data_sources FOR SELECT
    USING (active = true);

DROP POLICY IF EXISTS "Public read events" ON public.events;
CREATE POLICY "Public read events"
    ON public.events FOR SELECT
    USING (active = true);

-- 3. TRIP READ POLICIES (Proteção de privacidade: Apenas por secure_token ou service_role)
-- O cliente só consegue consultar ou carregar uma viagem se fornecer o secure_token correto
DROP POLICY IF EXISTS "Trips accessible by secure token" ON public.trips;
CREATE POLICY "Trips accessible by secure token"
    ON public.trips FOR SELECT
    USING (
        current_setting('request.headers', true)::json->>'x-trip-token' = secure_token
        OR auth.role() = 'service_role'
    );

DROP POLICY IF EXISTS "Trip profiles accessible via matching trip" ON public.trip_profiles;
CREATE POLICY "Trip profiles accessible via matching trip"
    ON public.trip_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = public.trip_profiles.trip_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "Trip days accessible via matching trip" ON public.trip_days;
CREATE POLICY "Trip days accessible via matching trip"
    ON public.trip_days FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = public.trip_days.trip_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "Trip activities accessible via matching trip" ON public.trip_activities;
CREATE POLICY "Trip activities accessible via matching trip"
    ON public.trip_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trip_days td
            JOIN public.trips t ON t.id = td.trip_id
            WHERE td.id = public.trip_activities.trip_day_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "Trip previews accessible via matching trip" ON public.trip_previews;
CREATE POLICY "Trip previews accessible via matching trip"
    ON public.trip_previews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = public.trip_previews.trip_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

DROP POLICY IF EXISTS "Trip usage accessible via matching trip" ON public.trip_usage;
CREATE POLICY "Trip usage accessible via matching trip"
    ON public.trip_usage FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = public.trip_usage.trip_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

-- 4. INSERT/UPDATE POLICIES FOR TRIPS
-- Criação de novas viagens pelo fluxo da Landing/Briefing
DROP POLICY IF EXISTS "Public insert draft trips" ON public.trips;
CREATE POLICY "Public insert draft trips"
    ON public.trips FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert trip profiles" ON public.trip_profiles;
CREATE POLICY "Public insert trip profiles"
    ON public.trip_profiles FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert trip previews" ON public.trip_previews;
CREATE POLICY "Public insert trip previews"
    ON public.trip_previews FOR INSERT
    WITH CHECK (true);

-- 5. USER REPORTS POLICY
-- Turistas podem submeter report de erro sobre qualquer local, mas não podem listar outros reports
DROP POLICY IF EXISTS "Anyone can insert user report" ON public.user_reports;
CREATE POLICY "Anyone can insert user report"
    ON public.user_reports FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Only admin and service role can view reports" ON public.user_reports;
CREATE POLICY "Only admin and service role can view reports"
    ON public.user_reports FOR SELECT
    USING (auth.role() = 'service_role');

-- 6. STRICT RESTRICTION POLICIES (Payments, API Usage, Cache)
-- Somente o backend com service_role pode ler ou manipular pagamentos e custos de API
DROP POLICY IF EXISTS "Service role only for payments" ON public.payments;
CREATE POLICY "Service role only for payments"
    ON public.payments FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role only for api_usage" ON public.api_usage;
CREATE POLICY "Service role only for api_usage"
    ON public.api_usage FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role only for cache" ON public.external_data_cache;
CREATE POLICY "Service role only for cache"
    ON public.external_data_cache FOR ALL
    USING (auth.role() = 'service_role');
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
-- ==============================================================================
-- DUO21 / Divulga Lugares - Migration 04: Hardening, Indexes & Candidate RPC
-- Database: PostgreSQL (Supabase)
-- Version: 20260925000004
-- ==============================================================================

-- 1. PERFORMANCE INDEXES (Non-redundant, target queries)
-- Places
CREATE INDEX IF NOT EXISTS idx_places_city ON public.places (city);
CREATE INDEX IF NOT EXISTS idx_places_category_id ON public.places (category_id);
CREATE INDEX IF NOT EXISTS idx_places_google_place_id ON public.places (google_place_id) WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_places_active ON public.places (active);
CREATE INDEX IF NOT EXISTS idx_places_city_active ON public.places (city, active);

-- Tags & Tag Relations
CREATE INDEX IF NOT EXISTS idx_place_tag_relations_place_id ON public.place_tag_relations (place_id);
CREATE INDEX IF NOT EXISTS idx_place_tag_relations_tag_id ON public.place_tag_relations (tag_id);

-- Place Hours
CREATE INDEX IF NOT EXISTS idx_place_hours_place_id ON public.place_hours (place_id);
CREATE INDEX IF NOT EXISTS idx_place_hours_day_of_week ON public.place_hours (day_of_week);

-- Price Observations
CREATE INDEX IF NOT EXISTS idx_price_observations_place_id ON public.price_observations (place_id);
CREATE INDEX IF NOT EXISTS idx_price_observations_season ON public.price_observations (season);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_city ON public.events (city);
CREATE INDEX IF NOT EXISTS idx_events_dates ON public.events (start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_events_active ON public.events (active);

-- Trips & Itinerary
CREATE INDEX IF NOT EXISTS idx_trips_secure_token ON public.trips (secure_token);
CREATE INDEX IF NOT EXISTS idx_trips_status ON public.trips (status);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON public.trip_days (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_activities_trip_day_id ON public.trip_activities (trip_day_id);
CREATE INDEX IF NOT EXISTS idx_trip_previews_trip_id ON public.trip_previews (trip_id);

-- API Usage & Cost Guard
CREATE INDEX IF NOT EXISTS idx_api_usage_trip_id ON public.api_usage (trip_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage (created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON public.api_usage (provider);

-- External Data Cache
CREATE INDEX IF NOT EXISTS idx_external_data_cache_expires_at ON public.external_data_cache (expires_at);

-- 2. CANDIDATE PLACES RPC (Section 34)
-- Structured Postgres function to filter candidates without running costly LLM calls
CREATE OR REPLACE FUNCTION public.get_candidate_places(
    p_cities text[],
    p_categories text[] DEFAULT NULL,
    p_suitable_for_children boolean DEFAULT NULL,
    p_indoor_outdoor text DEFAULT NULL,
    p_max_cost_level integer DEFAULT 4,
    p_limit integer DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    category_id TEXT,
    subcategory TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    google_place_id TEXT,
    description_short TEXT,
    duration_min INTEGER,
    duration_max INTEGER,
    indoor_outdoor TEXT,
    suitable_for_children BOOLEAN,
    accessibility BOOLEAN,
    pet_friendly BOOLEAN,
    cost_level INTEGER,
    cost_per_person NUMERIC,
    partner BOOLEAN,
    divulga_lugares_recommended BOOLEAN,
    source_id TEXT,
    confidence TEXT
) 
LANGUAGE sql
STABLE
AS $$
    SELECT 
        p.id,
        p.name,
        p.slug,
        p.city,
        p.state,
        p.country,
        p.category_id,
        p.subcategory,
        p.latitude,
        p.longitude,
        p.address,
        p.google_place_id,
        p.description_short,
        p.duration_min,
        p.duration_max,
        p.indoor_outdoor,
        p.suitable_for_children,
        p.accessibility,
        p.pet_friendly,
        p.cost_level,
        p.cost_per_person,
        p.partner,
        p.divulga_lugares_recommended,
        p.source_id,
        p.confidence
    FROM public.places p
    WHERE p.active = TRUE
      AND p.city = ANY(p_cities)
      AND (p_categories IS NULL OR p.category_id = ANY(p_categories))
      AND (p_suitable_for_children IS NULL OR p_suitable_for_children = FALSE OR p.suitable_for_children = TRUE)
      AND (p_indoor_outdoor IS NULL OR p.indoor_outdoor = p_indoor_outdoor OR p.indoor_outdoor = 'mixed' OR p.indoor_outdoor = 'rain_ok')
      AND p.cost_level <= p_max_cost_level
    ORDER BY 
        p.divulga_lugares_recommended DESC,
        p.partner DESC,
        p.cost_level ASC
    LIMIT p_limit;
$$;

-- Allow public and authenticated roles to execute the candidate RPC
GRANT EXECUTE ON FUNCTION public.get_candidate_places TO anon, authenticated, service_role;
-- ==============================================================================
-- DUO21 / Divulga Lugares - Migration 05: Payment Orders & Transaction Audit
-- Database: PostgreSQL (Supabase)
-- Version: 20260925000005
-- ==============================================================================

-- 1. PAYMENT ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id TEXT PRIMARY KEY,
    trip_id TEXT,
    amount_brl NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    asaas_payment_id TEXT UNIQUE,
    customer_name TEXT,
    customer_email TEXT NOT NULL,
    customer_cpf TEXT,
    pix_qr_code TEXT,
    pix_copy_paste TEXT,
    is_sandbox BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ENABLE RLS
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES (Idempotent: drop if exists then create)
DROP POLICY IF EXISTS "Service role only for payment_orders" ON public.payment_orders;
CREATE POLICY "Service role only for payment_orders"
    ON public.payment_orders FOR ALL
    USING (auth.role() = 'service_role');

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_payment_orders_trip_id ON public.payment_orders (trip_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_asaas_id ON public.payment_orders (asaas_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders (status);

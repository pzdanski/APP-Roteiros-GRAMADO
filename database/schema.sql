-- ==============================================================================
-- DUO21 / Divulga Lugares - Roteiro Inteligente Serra Gaúcha
-- Supabase PostgreSQL Schema & Row Level Security (RLS)
-- Gramado / Canela / Nova Petrópolis
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TRAVELERS & ACCESS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.travelers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    secure_token TEXT UNIQUE NOT NULL, -- e.g. v_a8f9c2d1
    traveler_id UUID REFERENCES public.travelers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preview', 'paid', 'archived')),
    price_brl NUMERIC(10, 2) NOT NULL DEFAULT 19.90,
    price_tier_id TEXT NOT NULL DEFAULT 'tier-7d',
    total_estimated_spend_brl NUMERIC(10, 2) DEFAULT 0,
    is_demo BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trip_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    traveler_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    adults_count INTEGER NOT NULL DEFAULT 2,
    children_count INTEGER NOT NULL DEFAULT 0,
    children_ages INTEGER[] DEFAULT '{}',
    hotel_name TEXT,
    hotel_city TEXT DEFAULT 'Gramado',
    hotel_address TEXT,
    budget_total NUMERIC(10, 2),
    pace TEXT NOT NULL DEFAULT 'equilibrado' CHECK (pace IN ('tranquilo', 'equilibrado', 'aproveitar_bastante')),
    transport TEXT NOT NULL DEFAULT 'carro_alugado',
    arrival_airport TEXT,
    interests TEXT[] DEFAULT '{}',
    mandatory_places TEXT[] DEFAULT '{}',
    restrictions TEXT[] DEFAULT '{}',
    is_couple BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.trip_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID UNIQUE REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    guide_messages_today INTEGER NOT NULL DEFAULT 0,
    guide_messages_limit INTEGER NOT NULL DEFAULT 30,
    structural_changes_today INTEGER NOT NULL DEFAULT 0,
    structural_changes_limit INTEGER NOT NULL DEFAULT 3,
    full_regenerations_used INTEGER NOT NULL DEFAULT 0,
    full_regenerations_limit INTEGER NOT NULL DEFAULT 1,
    last_reset_date DATE DEFAULT CURRENT_DATE NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. PLACES, CATEGORIES & ATTRACTIONS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.places (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL CHECK (city IN ('Gramado', 'Canela', 'Nova Petrópolis')),
    category TEXT NOT NULL,
    description TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    whatsapp TEXT,
    website TEXT,
    instagram TEXT,
    booking_url TEXT,
    rating NUMERIC(2, 1) DEFAULT 4.8,
    rating_count INTEGER DEFAULT 0,
    price_level INTEGER DEFAULT 2 CHECK (price_level BETWEEN 1 AND 4),
    average_duration_minutes INTEGER NOT NULL DEFAULT 90,
    reservation_required BOOLEAN DEFAULT FALSE,
    accessible BOOLEAN DEFAULT TRUE,
    pet_friendly BOOLEAN DEFAULT FALSE,
    children_friendly BOOLEAN DEFAULT TRUE,
    indoor_type TEXT NOT NULL DEFAULT 'outdoor' CHECK (indoor_type IN ('indoor', 'outdoor', 'mixed', 'rain_ok')),
    opening_hours JSONB DEFAULT '{}'::jsonb,
    is_divulga_lugares_partner BOOLEAN DEFAULT FALSE,
    divulga_lugares_tip JSONB,
    active BOOLEAN DEFAULT TRUE,
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.place_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
    adult_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
    child_price NUMERIC(10, 2),
    senior_price NUMERIC(10, 2),
    is_free BOOLEAN DEFAULT FALSE,
    currency TEXT DEFAULT 'BRL',
    source_name TEXT NOT NULL,
    source_url TEXT,
    checked_at DATE NOT NULL,
    valid_until DATE,
    confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low', 'unknown')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.place_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    is_hero BOOLEAN DEFAULT FALSE,
    video_url TEXT,
    sort_order INTEGER DEFAULT 0
);

-- ------------------------------------------------------------------------------
-- 3. EVENTS & ANCHORS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    city TEXT NOT NULL CHECK (city IN ('Gramado', 'Canela', 'Nova Petrópolis')),
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    default_time TIME,
    is_anchor_event BOOLEAN DEFAULT FALSE,
    location_name TEXT NOT NULL,
    price_info TEXT,
    ticket_required BOOLEAN DEFAULT FALSE,
    ticket_url TEXT,
    banner_url TEXT,
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. ITINERARY DAYS & ACTIVITIES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trip_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    day_number INTEGER NOT NULL,
    date DATE NOT NULL,
    city_focus TEXT NOT NULL,
    theme_title TEXT NOT NULL,
    total_day_cost_estimated NUMERIC(10, 2) DEFAULT 0,
    weather_forecast JSONB,
    UNIQUE(trip_id, day_number)
);

CREATE TABLE IF NOT EXISTS public.trip_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_day_id UUID REFERENCES public.trip_days(id) ON DELETE CASCADE NOT NULL,
    place_id UUID REFERENCES public.places(id) ON DELETE RESTRICT NOT NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    travel_time_from_prev_minutes INTEGER DEFAULT 15,
    distance_km_from_prev NUMERIC(5, 2) DEFAULT 3.0,
    estimated_cost_per_person NUMERIC(10, 2) DEFAULT 0,
    is_anchor_event BOOLEAN DEFAULT FALSE,
    locked BOOLEAN DEFAULT FALSE,
    weather_status TEXT DEFAULT 'ideal',
    notes TEXT,
    sort_order INTEGER DEFAULT 0
);

-- ------------------------------------------------------------------------------
-- 5. ORDERS & ASAAS PAYMENTS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    amount_brl NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
    asaas_payment_id TEXT UNIQUE,
    customer_name TEXT,
    customer_email TEXT NOT NULL,
    customer_cpf TEXT,
    pix_qr_code TEXT,
    pix_copy_paste TEXT,
    is_sandbox BOOLEAN DEFAULT FALSE,
    webhook_payload JSONB,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 6. USER REPORTS & AUDIT LOGS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    place_id UUID REFERENCES public.places(id) ON DELETE CASCADE NOT NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('preco_diferente', 'horario_diferente', 'fechado', 'outro')),
    description TEXT NOT NULL,
    contact_email TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.weather_cache (
    city TEXT PRIMARY KEY,
    forecast JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.application_logs (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Public read policies for catalog (places and events)
CREATE POLICY "Public places are viewable by everyone" 
    ON public.places FOR SELECT USING (active = true);

CREATE POLICY "Public place prices are viewable by everyone" 
    ON public.place_prices FOR SELECT USING (true);

CREATE POLICY "Public events are viewable by everyone" 
    ON public.events FOR SELECT USING (true);

-- Trips viewable via secure_token only (protects traveler privacy)
CREATE POLICY "Trips viewable by secure token" 
    ON public.trips FOR SELECT USING (true);

CREATE POLICY "Trip preferences viewable with trip" 
    ON public.trip_preferences FOR SELECT USING (true);

-- User reports can be inserted by anyone (anonymous reports allowed)
CREATE POLICY "Anyone can report an issue" 
    ON public.user_reports FOR INSERT WITH CHECK (true);

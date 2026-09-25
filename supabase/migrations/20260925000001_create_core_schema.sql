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

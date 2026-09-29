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

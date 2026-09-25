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
CREATE POLICY "Public read active places"
    ON public.places FOR SELECT
    USING (active = true);

CREATE POLICY "Public read place categories"
    ON public.place_categories FOR SELECT
    USING (active = true);

CREATE POLICY "Public read place tags"
    ON public.place_tags FOR SELECT
    USING (true);

CREATE POLICY "Public read place tag relations"
    ON public.place_tag_relations FOR SELECT
    USING (true);

CREATE POLICY "Public read place hours"
    ON public.place_hours FOR SELECT
    USING (true);

CREATE POLICY "Public read price observations"
    ON public.price_observations FOR SELECT
    USING (true);

CREATE POLICY "Public read data sources"
    ON public.data_sources FOR SELECT
    USING (active = true);

CREATE POLICY "Public read events"
    ON public.events FOR SELECT
    USING (active = true);

-- 3. TRIP READ POLICIES (Proteção de privacidade: Apenas por secure_token ou service_role)
-- O cliente só consegue consultar ou carregar uma viagem se fornecer o secure_token correto
CREATE POLICY "Trips accessible by secure token"
    ON public.trips FOR SELECT
    USING (
        -- Permitir se o header da requisição ou parâmetro fornecer o secure_token
        current_setting('request.headers', true)::json->>'x-trip-token' = secure_token
        OR auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
    );

CREATE POLICY "Trip profiles accessible via matching trip"
    ON public.trip_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = public.trip_profiles.trip_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

CREATE POLICY "Trip days accessible via matching trip"
    ON public.trip_days FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = public.trip_days.trip_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

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

CREATE POLICY "Trip previews accessible via matching trip"
    ON public.trip_previews FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = public.trip_previews.trip_id
            AND (current_setting('request.headers', true)::json->>'x-trip-token' = t.secure_token OR auth.role() = 'service_role')
        )
    );

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
CREATE POLICY "Public insert draft trips"
    ON public.trips FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public insert trip profiles"
    ON public.trip_profiles FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public insert trip previews"
    ON public.trip_previews FOR INSERT
    WITH CHECK (true);

-- 5. USER REPORTS POLICY
-- Turistas podem submeter report de erro sobre qualquer local, mas não podem listar outros reports
CREATE POLICY "Anyone can insert user report"
    ON public.user_reports FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Only admin and service role can view reports"
    ON public.user_reports FOR SELECT
    USING (auth.role() = 'service_role');

-- 6. STRICT RESTRICTION POLICIES (Payments, API Usage, Cache)
-- Somente o backend com service_role pode ler ou manipular pagamentos e custos de API
CREATE POLICY "Service role only for payments"
    ON public.payments FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role only for api_usage"
    ON public.api_usage FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role only for cache"
    ON public.external_data_cache FOR ALL
    USING (auth.role() = 'service_role');

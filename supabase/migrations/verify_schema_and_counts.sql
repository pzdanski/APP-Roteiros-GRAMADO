-- ==============================================================================
-- DUO21 / Divulga Lugares - Schema Verification & Sanity Audit
-- Run in Supabase SQL Editor to verify tables, counts and RPC function
-- ==============================================================================

-- 1. Table Counts Audit
SELECT 
    (SELECT count(*) FROM public.places) AS places_count,
    (SELECT count(*) FROM public.place_categories) AS categories_count,
    (SELECT count(*) FROM public.place_tags) AS tags_count,
    (SELECT count(*) FROM public.data_sources) AS data_sources_count,
    (SELECT count(*) FROM public.events) AS events_count,
    (SELECT count(*) FROM public.trips) AS trips_count,
    (SELECT count(*) FROM public.trip_days) AS trip_days_count,
    (SELECT count(*) FROM public.trip_activities) AS trip_activities_count,
    (SELECT count(*) FROM public.payments) AS payments_count,
    (SELECT count(*) FROM public.payment_orders) AS payment_orders_count;

-- 2. Test Candidate Places RPC
SELECT count(*) AS candidates_returned_from_rpc
FROM public.get_candidate_places(ARRAY['Gramado', 'Canela', 'Nova Petrópolis']);

-- 3. Verify Active RLS Policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

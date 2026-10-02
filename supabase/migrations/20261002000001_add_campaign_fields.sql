-- ==============================================================================
-- DUO21 / Divulga Lugares - Migration 06: Commercial Campaigns & Order Analytics
-- Database: PostgreSQL (Supabase)
-- Version: 20261002000001
-- Description: Adds commercial campaign metadata and discount tracking to payment_orders.
-- ==============================================================================

-- 1. ADD CAMPAIGN & ANALYTICS COLUMNS TO PAYMENT ORDERS TABLE
ALTER TABLE public.payment_orders 
ADD COLUMN IF NOT EXISTS campaign_id TEXT,
ADD COLUMN IF NOT EXISTS campaign_slot INTEGER,
ADD COLUMN IF NOT EXISTS official_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS charged_price NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS trip_days INTEGER;

-- 2. CREATE CONDITIONAL INDEX FOR CAMPAIGN QUERIES
CREATE INDEX IF NOT EXISTS idx_payment_orders_campaign 
ON public.payment_orders (campaign_id) 
WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_orders_campaign_slot 
ON public.payment_orders (campaign_slot) 
WHERE campaign_slot IS NOT NULL;

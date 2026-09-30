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

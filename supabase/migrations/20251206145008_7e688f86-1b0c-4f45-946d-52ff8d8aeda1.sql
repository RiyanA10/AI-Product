-- Add cached_from_baseline_id column to competitor_products for tracking cache sources
ALTER TABLE public.competitor_products
ADD COLUMN IF NOT EXISTS cached_from_baseline_id uuid REFERENCES public.product_baselines(id);

-- Add is_cached flag for quick identification
ALTER TABLE public.competitor_products
ADD COLUMN IF NOT EXISTS is_cached boolean DEFAULT false;

-- Create unique constraint on (baseline_id, product_url) for upsert operations
-- First, remove duplicates (keep most recent by created_at)
DELETE FROM public.competitor_products a
USING public.competitor_products b
WHERE a.id < b.id
  AND a.baseline_id = b.baseline_id
  AND a.product_url = b.product_url
  AND a.product_url IS NOT NULL;

-- Create unique index for upsert (only for non-null product_urls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_products_baseline_url 
ON public.competitor_products(baseline_id, product_url) 
WHERE product_url IS NOT NULL;
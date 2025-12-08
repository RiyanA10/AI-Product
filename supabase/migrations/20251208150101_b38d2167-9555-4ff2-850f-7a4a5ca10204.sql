-- Add expected_quantity and expected_revenue columns to pricing_results
ALTER TABLE public.pricing_results
ADD COLUMN expected_quantity integer,
ADD COLUMN expected_revenue numeric;
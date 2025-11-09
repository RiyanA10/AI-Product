-- Drop existing overly permissive RLS policies
DROP POLICY IF EXISTS "Allow all on product_baselines" ON public.product_baselines;
DROP POLICY IF EXISTS "Allow all on competitor_prices" ON public.competitor_prices;
DROP POLICY IF EXISTS "Allow all on pricing_results" ON public.pricing_results;
DROP POLICY IF EXISTS "Allow all on inflation_snapshots" ON public.inflation_snapshots;
DROP POLICY IF EXISTS "Allow all on processing_status" ON public.processing_status;

-- Create secure RLS policies that require authentication
-- Product baselines: Users can only access their own data
CREATE POLICY "Users can view their own product baselines"
  ON public.product_baselines
  FOR SELECT
  TO authenticated
  USING (auth.uid() = merchant_id);

CREATE POLICY "Users can create their own product baselines"
  ON public.product_baselines
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Users can update their own product baselines"
  ON public.product_baselines
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = merchant_id);

CREATE POLICY "Users can delete their own product baselines"
  ON public.product_baselines
  FOR DELETE
  TO authenticated
  USING (auth.uid() = merchant_id);

-- Competitor prices: Users can only access data for their own baselines
CREATE POLICY "Users can view competitor prices for their baselines"
  ON public.competitor_prices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = merchant_id);

CREATE POLICY "Users can create competitor prices for their baselines"
  ON public.competitor_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Users can update competitor prices for their baselines"
  ON public.competitor_prices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = merchant_id);

CREATE POLICY "Users can delete competitor prices for their baselines"
  ON public.competitor_prices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = merchant_id);

-- Pricing results: Users can only access their own results
CREATE POLICY "Users can view their own pricing results"
  ON public.pricing_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = merchant_id);

CREATE POLICY "Users can create their own pricing results"
  ON public.pricing_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Users can update their own pricing results"
  ON public.pricing_results
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = merchant_id);

CREATE POLICY "Users can delete their own pricing results"
  ON public.pricing_results
  FOR DELETE
  TO authenticated
  USING (auth.uid() = merchant_id);

-- Processing status: Users can only access their own processing status
CREATE POLICY "Users can view their own processing status"
  ON public.processing_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_baselines
      WHERE product_baselines.id = processing_status.baseline_id
      AND product_baselines.merchant_id = auth.uid()
    )
  );

CREATE POLICY "Users can create processing status for their baselines"
  ON public.processing_status
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_baselines
      WHERE product_baselines.id = processing_status.baseline_id
      AND product_baselines.merchant_id = auth.uid()
    )
  );

CREATE POLICY "Users can update processing status for their baselines"
  ON public.processing_status
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_baselines
      WHERE product_baselines.id = processing_status.baseline_id
      AND product_baselines.merchant_id = auth.uid()
    )
  );

-- Inflation snapshots: Allow authenticated users to read (public data)
CREATE POLICY "Authenticated users can view inflation snapshots"
  ON public.inflation_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create inflation snapshots"
  ON public.inflation_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
-- Create pricing_performance table for tracking algorithm accuracy
CREATE TABLE pricing_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id uuid REFERENCES product_baselines(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  
  -- Price tracking
  suggested_price numeric NOT NULL,
  applied_price numeric,
  applied_at timestamp with time zone,
  
  -- Sales tracking
  predicted_sales integer NOT NULL,
  actual_sales integer,
  actual_profit numeric,
  
  -- Accuracy metrics
  sales_accuracy_score numeric,
  profit_accuracy_score numeric,
  
  -- Market data at time of suggestion
  market_average numeric,
  market_lowest numeric,
  market_highest numeric,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add RLS policies
ALTER TABLE pricing_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own performance data"
  ON pricing_performance FOR SELECT
  USING (auth.uid() = merchant_id);

CREATE POLICY "Users can insert their own performance data"
  ON pricing_performance FOR INSERT
  WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Users can update their own performance data"
  ON pricing_performance FOR UPDATE
  USING (auth.uid() = merchant_id);

-- Create index for faster queries
CREATE INDEX idx_pricing_performance_baseline ON pricing_performance(baseline_id);
CREATE INDEX idx_pricing_performance_merchant ON pricing_performance(merchant_id);
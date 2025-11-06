-- AI TRUEST™ Database Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: Product Baselines (uploaded from Excel)
CREATE TABLE IF NOT EXISTS product_baselines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'Electronics & Technology',
    'Fashion & Apparel',
    'Luxury Goods',
    'Food & Beverages',
    'Health & Beauty',
    'Home & Furniture',
    'Sports & Outdoors',
    'Toys & Games',
    'Books & Media',
    'Automotive Parts',
    'Pharmaceuticals',
    'Groceries (Staples)',
    'Office Supplies',
    'Pet Supplies'
  )),
  current_price DECIMAL(10,2) NOT NULL CHECK (current_price > 0),
  current_quantity INTEGER NOT NULL CHECK (current_quantity > 0),
  cost_per_unit DECIMAL(10,2) NOT NULL CHECK (cost_per_unit > 0),
  currency TEXT NOT NULL CHECK (currency IN ('SAR', 'USD')),
  base_elasticity DECIMAL(10,4) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table 2: Competitor Prices
CREATE TABLE IF NOT EXISTS competitor_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baseline_id UUID REFERENCES product_baselines(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  marketplace TEXT NOT NULL,
  lowest_price DECIMAL(10,2),
  average_price DECIMAL(10,2),
  highest_price DECIMAL(10,2),
  currency TEXT NOT NULL,
  products_found INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  fetch_status TEXT DEFAULT 'pending' CHECK (fetch_status IN ('pending', 'success', 'failed', 'no_data'))
);

-- Table 3: Pricing Results
CREATE TABLE IF NOT EXISTS pricing_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baseline_id UUID REFERENCES product_baselines(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  
  -- Calculation inputs
  base_elasticity DECIMAL(10,4) NOT NULL,
  inflation_rate DECIMAL(10,6) NOT NULL,
  inflation_adjustment DECIMAL(10,6) NOT NULL,
  competitor_factor DECIMAL(10,4) NOT NULL,
  calibrated_elasticity DECIMAL(10,4) NOT NULL,
  
  -- Results
  optimal_price DECIMAL(10,2) NOT NULL,
  suggested_price DECIMAL(10,2) NOT NULL,
  expected_monthly_profit DECIMAL(10,2),
  profit_increase_amount DECIMAL(10,2),
  profit_increase_percent DECIMAL(10,4),
  
  -- Market context
  market_average DECIMAL(10,2),
  market_lowest DECIMAL(10,2),
  market_highest DECIMAL(10,2),
  position_vs_market DECIMAL(10,4),
  
  -- Warnings
  has_warning BOOLEAN DEFAULT FALSE,
  warning_message TEXT,
  
  currency TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table 4: Inflation Snapshots (audit trail)
CREATE TABLE IF NOT EXISTS inflation_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inflation_rate DECIMAL(10,6) NOT NULL,
  source TEXT,
  fetched_at TIMESTAMP DEFAULT NOW()
);

-- Table 5: Processing Status Tracking
CREATE TABLE IF NOT EXISTS processing_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  baseline_id UUID REFERENCES product_baselines(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_step TEXT,
  error_message TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE product_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE inflation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies (merchant_id based access)
-- For now, allow all operations (we'll add auth later)
CREATE POLICY "Allow all on product_baselines" ON product_baselines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on competitor_prices" ON competitor_prices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on pricing_results" ON pricing_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on inflation_snapshots" ON inflation_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on processing_status" ON processing_status FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_product_baselines_merchant ON product_baselines(merchant_id);
CREATE INDEX idx_competitor_prices_baseline ON competitor_prices(baseline_id);
CREATE INDEX idx_pricing_results_baseline ON pricing_results(baseline_id);
CREATE INDEX idx_processing_status_baseline ON processing_status(baseline_id);
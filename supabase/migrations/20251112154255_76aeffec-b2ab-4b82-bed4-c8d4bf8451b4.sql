-- Add soft delete column to product_baselines
ALTER TABLE product_baselines
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add index for better query performance
CREATE INDEX idx_product_baselines_deleted_at ON product_baselines(deleted_at);

COMMENT ON COLUMN product_baselines.deleted_at IS 'Timestamp when product was soft deleted. NULL means active, non-NULL means deleted but preserved for AI analysis';
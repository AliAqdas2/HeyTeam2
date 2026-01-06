-- Add cancellation tracking fields to subscriptions table
-- These fields track when a subscription is set to cancel at period end

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMP;

-- Add index for querying subscriptions that are pending cancellation
CREATE INDEX IF NOT EXISTS idx_subscriptions_cancel_at_period_end 
ON subscriptions (cancel_at_period_end) 
WHERE cancel_at_period_end = TRUE;


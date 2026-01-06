-- Migration: Add fallback columns to push_notification_deliveries and enhanced logging to message_logs
-- Created: 2024-12-24
-- Purpose: Support database-persisted SMS fallback scheduling and comprehensive message logging

-- Add fallback-related columns to push_notification_deliveries
ALTER TABLE push_notification_deliveries 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE push_notification_deliveries 
ADD COLUMN IF NOT EXISTS template_id VARCHAR REFERENCES templates(id) ON DELETE SET NULL;

ALTER TABLE push_notification_deliveries 
ADD COLUMN IF NOT EXISTS custom_message TEXT;

ALTER TABLE push_notification_deliveries 
ADD COLUMN IF NOT EXISTS fallback_due_at TIMESTAMP;

ALTER TABLE push_notification_deliveries 
ADD COLUMN IF NOT EXISTS fallback_processed BOOLEAN DEFAULT FALSE;

-- Create index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_fallback 
ON push_notification_deliveries (status, fallback_processed, fallback_due_at) 
WHERE status = 'sent' AND fallback_processed = FALSE;

-- Add enhanced logging columns to message_logs
ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS priority INTEGER;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS priority_reason TEXT;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS delivery_attempt INTEGER DEFAULT 1;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS retry_at TIMESTAMP;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS batch_id VARCHAR;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS batch_position INTEGER;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS twilio_sid TEXT;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS twilio_status TEXT;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS cost_credits INTEGER;

ALTER TABLE message_logs 
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Create indexes for efficient logging queries
CREATE INDEX IF NOT EXISTS idx_message_logs_batch 
ON message_logs (batch_id);

CREATE INDEX IF NOT EXISTS idx_message_logs_event_type 
ON message_logs (event_type, status);

CREATE INDEX IF NOT EXISTS idx_message_logs_contact_job 
ON message_logs (contact_id, job_id);

-- Comments for documentation
COMMENT ON COLUMN push_notification_deliveries.fallback_due_at IS 'Timestamp when SMS fallback should be triggered (typically now + 30 seconds)';
COMMENT ON COLUMN push_notification_deliveries.fallback_processed IS 'Flag to prevent duplicate fallback processing by cron job';
COMMENT ON COLUMN push_notification_deliveries.custom_message IS 'Custom message content for broadcast messages (alternative to template)';
COMMENT ON COLUMN message_logs.batch_id IS 'Unique identifier for the message batch this log belongs to';
COMMENT ON COLUMN message_logs.processing_time_ms IS 'Time taken to process and send the message in milliseconds';


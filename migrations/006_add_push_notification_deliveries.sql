-- Migration to create push_notification_deliveries table for tracking push notification delivery status

CREATE TABLE IF NOT EXISTS push_notification_deliveries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id VARCHAR NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  campaign_id VARCHAR REFERENCES campaigns(id) ON DELETE SET NULL,
  device_token TEXT NOT NULL,
  notification_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'sms_fallback'
  delivered_at TIMESTAMP,
  sms_fallback_sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_notification_id ON push_notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_contact_id ON push_notification_deliveries(contact_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_job_id ON push_notification_deliveries(job_id);
CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_status ON push_notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_created_at ON push_notification_deliveries(created_at);

-- Index for finding undelivered notifications (for timeout checking)
CREATE INDEX IF NOT EXISTS idx_push_notification_deliveries_undelivered ON push_notification_deliveries(status, created_at) 
WHERE status = 'sent';


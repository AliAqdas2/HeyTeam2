-- Migration to create device_tokens table for push notifications
-- This table stores push notification device tokens for contacts

CREATE TABLE IF NOT EXISTS device_tokens (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id VARCHAR NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add index on contact_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_contact_id ON device_tokens(contact_id);

-- Add index on token for faster lookups when removing tokens
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);

-- Add composite index for querying tokens by contact and platform
CREATE INDEX IF NOT EXISTS idx_device_tokens_contact_platform ON device_tokens(contact_id, platform);


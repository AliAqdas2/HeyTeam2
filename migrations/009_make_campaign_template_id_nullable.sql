-- Migration to make template_id nullable in campaigns table
-- This allows campaigns to be created for custom messages that don't use a template

-- First, drop the NOT NULL constraint
ALTER TABLE campaigns ALTER COLUMN template_id DROP NOT NULL;

-- Update the foreign key constraint to allow NULL values
-- (PostgreSQL foreign keys already allow NULL by default, so we just need to drop NOT NULL)


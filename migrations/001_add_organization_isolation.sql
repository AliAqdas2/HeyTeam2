-- Migration to add organizationId columns and ensure proper data isolation
-- This migration adds organizationId foreign keys to all relevant tables

-- First, let's add the organizationId columns (they will be nullable initially)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE credit_grants ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS organization_id VARCHAR REFERENCES organizations(id) ON DELETE CASCADE;

-- Now populate the organizationId for existing records
-- This assumes that all existing users belong to organizations

-- Update contacts
UPDATE contacts 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = contacts.user_id
)
WHERE organization_id IS NULL;

-- Update jobs
UPDATE jobs 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = jobs.user_id
)
WHERE organization_id IS NULL;

-- Update templates
UPDATE templates 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = templates.user_id
)
WHERE organization_id IS NULL;

-- Update campaigns
UPDATE campaigns 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = campaigns.user_id
)
WHERE organization_id IS NULL;

-- Update messages
UPDATE messages 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = messages.user_id
)
WHERE organization_id IS NULL;

-- Update subscriptions (these should be per-organization, not per-user)
UPDATE subscriptions 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = subscriptions.user_id
)
WHERE organization_id IS NULL;

-- Update credit_grants
UPDATE credit_grants 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = credit_grants.user_id
)
WHERE organization_id IS NULL;

-- Update credit_transactions
UPDATE credit_transactions 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = credit_transactions.user_id
)
WHERE organization_id IS NULL;

-- Update feedback
UPDATE feedback 
SET organization_id = (
    SELECT organization_id 
    FROM users 
    WHERE users.id = feedback.user_id
)
WHERE organization_id IS NULL;

-- Now make the organizationId columns NOT NULL
ALTER TABLE contacts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE templates ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE credit_grants ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE credit_transactions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE feedback ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for better performance on organization-based queries
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_jobs_organization_id ON jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_templates_organization_id ON templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_organization_id ON campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_organization_id ON messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_grants_organization_id ON credit_grants(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_organization_id ON credit_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_organization_id ON feedback(organization_id);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_org_user ON contacts(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_user ON jobs(organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_messages_org_contact ON messages(organization_id, contact_id);

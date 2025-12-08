CREATE TABLE IF NOT EXISTS platform_settings (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_email TEXT NOT NULL DEFAULT 'feedback@heyteam.ai',
    support_email TEXT NOT NULL DEFAULT 'support@heyteam.ai',
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (feedback_email, support_email)
VALUES ('Feedback@HeyTeam.ai', 'support@heyteam.ai')
ON CONFLICT DO NOTHING;


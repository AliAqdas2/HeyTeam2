ALTER TABLE subscription_plans
    ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS feature_bullets TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS use_case TEXT NOT NULL DEFAULT '';

UPDATE subscription_plans
SET target_audience = 'Small teams or solo operators',
    feature_bullets = E'500 SMS per month (rolls over for 1 month)\nUpload contacts & send instant job alerts\nCreate and reuse custom SMS templates\nAuto follow-up messages for faster confirmations\nCentral job calendar for scheduling\nContractors can view their rota instantly via a shared link\nEmail support',
    use_case = 'Perfect for independent trades or small crews who want to simplify coordination.'
WHERE name = 'Starter';

UPDATE subscription_plans
SET target_audience = 'Growing teams and busy schedulers',
    feature_bullets = E'3,000 SMS per month (rolls over for 1 month)\nAll Starter features, plus:\nMulti-manager access for shared scheduling\nPriority support\nTemplate library for recurring jobs\nAdvanced central job calendar\nContractors can view and confirm their rota online',
    use_case = 'Ideal for field service teams managing multiple jobs or shifts per day.'
WHERE name = 'Team';

UPDATE subscription_plans
SET target_audience = 'Larger teams needing visibility, insights, and control',
    feature_bullets = E'10,000 SMS per month (rolls over for 1 month)\nAll Team features, plus:\nDedicated account support\nAI-powered insights on team availability and response times\nDedicated phone number for inbound/outbound SMS\nEnhanced analytics dashboard for management\nContractors can access live rota and shift updates via secure link',
    use_case = 'Perfect for multi-location or franchise operations managing large, mobile teams.'
WHERE name = 'Business';


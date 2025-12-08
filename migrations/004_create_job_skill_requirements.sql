CREATE TABLE IF NOT EXISTS job_skill_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id VARCHAR NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill TEXT NOT NULL,
    headcount INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_skill_requirements_job_id_idx
    ON job_skill_requirements (job_id);


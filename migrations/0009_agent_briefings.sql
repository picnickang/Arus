CREATE TABLE IF NOT EXISTS "agent_briefings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" varchar NOT NULL,
  "generated_at" timestamp DEFAULT now(),
  "period_start" timestamp NOT NULL,
  "period_end" timestamp NOT NULL,
  "sections" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "ai_summary" text,
  "status" text NOT NULL DEFAULT 'generating',
  "schedule_run_id" varchar,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_agent_briefings_org" ON "agent_briefings" ("org_id");
CREATE INDEX IF NOT EXISTS "idx_agent_briefings_generated" ON "agent_briefings" ("generated_at");
CREATE INDEX IF NOT EXISTS "idx_agent_briefings_status" ON "agent_briefings" ("status");

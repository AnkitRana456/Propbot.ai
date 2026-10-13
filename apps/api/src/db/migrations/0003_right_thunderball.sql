-- Phase 5: Lead Capture, Buyer DNA, Live Intent Score & Handoff Brief
ALTER TABLE "company_ai_settings" ADD COLUMN IF NOT EXISTS "scoring_config" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "lead_id" uuid REFERENCES "leads"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "score_explanation" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "score_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "handoff_brief" jsonb;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "duplicate_merge_suggestion" jsonb;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "sla_started_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_company_lead_idx" ON "conversations" USING btree ("company_id", "lead_id");
-- Phase 6: CRM Leads Management, Pipeline Kanban, Tasks & Follow-ups
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "page_url" varchar(500);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_company_next_follow_up_idx" ON "leads" USING btree ("company_id", "next_follow_up_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_company_assigned_status_idx" ON "leads" USING btree ("company_id", "assigned_agent_id", "status");
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_lead_status_due_idx" ON "tasks" USING btree ("lead_id", "status", "due_date");

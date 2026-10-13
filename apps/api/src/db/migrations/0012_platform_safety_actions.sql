-- Migration 0012: Platform Safety, AI Actions & LLMOps (Phase 15A)

-- 1. Alter domain_events: add is_dead column and index
ALTER TABLE "domain_events" ADD COLUMN IF NOT EXISTS "is_dead" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_dead_idx" ON "domain_events" USING btree ("is_dead", "processed_at");
--> statement-breakpoint

-- 2. Alter agent_actions: add lead_id, expires_at columns and indexes
ALTER TABLE "agent_actions" ADD COLUMN IF NOT EXISTS "lead_id" uuid;
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_actions_company_lead_idx" ON "agent_actions" USING btree ("company_id", "lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_actions_status_expires_idx" ON "agent_actions" USING btree ("status", "expires_at");
--> statement-breakpoint

-- 3. Alter leads: add next_best_action jsonb column
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_best_action" jsonb;
--> statement-breakpoint

-- 4. Create event_consumer_checkpoints table for consumer-level idempotency
CREATE TABLE IF NOT EXISTS "event_consumer_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"consumer_name" varchar(100) NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_consumer_checkpoints" ADD CONSTRAINT "event_consumer_checkpoints_event_id_domain_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."domain_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_consumer_checkpoint_uniq_idx" ON "event_consumer_checkpoints" USING btree ("event_id", "consumer_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_consumer_checkpoint_consumer_idx" ON "event_consumer_checkpoints" USING btree ("consumer_name", "processed_at");

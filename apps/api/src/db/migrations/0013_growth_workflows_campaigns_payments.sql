-- Migration 0013: Growth Layer - Workflows, Segments, Campaigns & Booking Payments (Phase 15B)

-- 1. Create workflows table
CREATE TABLE IF NOT EXISTS "workflows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"definition" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflows" ADD CONSTRAINT "workflows_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflows" ADD CONSTRAINT "workflows_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflows_company_idx" ON "workflows" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflows_status_idx" ON "workflows" USING btree ("company_id", "status");
--> statement-breakpoint
ALTER TABLE "workflows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflows" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "workflows" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);
--> statement-breakpoint

-- 2. Create workflow_runs table
CREATE TABLE IF NOT EXISTS "workflow_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"event_id" text,
	"status" varchar(50) DEFAULT 'running' NOT NULL,
	"current_node_id" varchar(100),
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_company_idx" ON "workflow_runs" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_workflow_idx" ON "workflow_runs" USING btree ("workflow_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_status_idx" ON "workflow_runs" USING btree ("company_id", "status");
--> statement-breakpoint
ALTER TABLE "workflow_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "workflow_runs" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);
--> statement-breakpoint

-- 3. Create workflow_run_steps table
CREATE TABLE IF NOT EXISTS "workflow_run_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"node_id" varchar(100) NOT NULL,
	"node_type" varchar(50) NOT NULL,
	"action_type" varchar(100),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"duration_ms" integer DEFAULT 0,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_run_id_workflow_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workflow_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_run_steps_run_idx" ON "workflow_run_steps" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_run_steps_company_idx" ON "workflow_run_steps" USING btree ("company_id");
--> statement-breakpoint
ALTER TABLE "workflow_run_steps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workflow_run_steps" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "workflow_run_steps" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);
--> statement-breakpoint

-- 4. Create segments table
CREATE TABLE IF NOT EXISTS "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"filter_criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cached_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "segments" ADD CONSTRAINT "segments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "segments" ADD CONSTRAINT "segments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "segments_company_idx" ON "segments" USING btree ("company_id");
--> statement-breakpoint
ALTER TABLE "segments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "segments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "segments" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);
--> statement-breakpoint

-- 5. Create campaigns table
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"segment_id" uuid,
	"name" varchar(255) NOT NULL,
	"channel" varchar(50) DEFAULT 'whatsapp' NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"schedule_type" varchar(50) DEFAULT 'immediate' NOT NULL,
	"send_window_start" varchar(10) DEFAULT '09:00',
	"send_window_end" varchar(10) DEFAULT '20:00',
	"frequency_cap" integer DEFAULT 2 NOT NULL,
	"variant_a" jsonb NOT NULL,
	"variant_b" jsonb,
	"a_b_test_enabled" boolean DEFAULT false NOT NULL,
	"stats" jsonb DEFAULT '{"recipients":0,"sent":0,"delivered":0,"read":0,"clicked":0,"optedOut":0}'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_company_idx" ON "campaigns" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns" USING btree ("company_id", "status");
--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "campaigns" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "campaigns" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);
--> statement-breakpoint

-- 6. Create campaign_recipients table
CREATE TABLE IF NOT EXISTS "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid,
	"lead_id" uuid,
	"variant" varchar(10) DEFAULT 'A' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"channel_message_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_recipients_campaign_idx" ON "campaign_recipients" USING btree ("campaign_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_recipients_company_idx" ON "campaign_recipients" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_recipients_contact_idx" ON "campaign_recipients" USING btree ("contact_id");
--> statement-breakpoint
ALTER TABLE "campaign_recipients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "campaign_recipients" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "campaign_recipients" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);
--> statement-breakpoint

-- 7. Create booking_transactions table
CREATE TABLE IF NOT EXISTS "booking_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"unit_id" varchar(100),
	"project_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"provider" varchar(50) DEFAULT 'razorpay' NOT NULL,
	"payment_link_id" varchar(255),
	"payment_link_url" text,
	"status" varchar(50) DEFAULT 'created' NOT NULL,
	"order_id" varchar(255),
	"payment_id" varchar(255),
	"receipt_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "booking_transactions" ADD CONSTRAINT "booking_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_transactions_company_idx" ON "booking_transactions" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_transactions_lead_idx" ON "booking_transactions" USING btree ("company_id", "lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_transactions_link_idx" ON "booking_transactions" USING btree ("payment_link_id");
--> statement-breakpoint
ALTER TABLE "booking_transactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "booking_transactions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "booking_transactions" AS RESTRICTIVE FOR ALL USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid) WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR NULLIF(current_setting('app.company_id', true), '') IS NULL);

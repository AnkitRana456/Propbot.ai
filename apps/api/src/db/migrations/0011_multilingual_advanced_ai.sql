-- Migration 0011: Multilingual and Advanced AI Extras (Phase 13)

-- 1. Create objection_playbooks table
CREATE TABLE IF NOT EXISTS "objection_playbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chatbot_id" uuid,
	"category" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"trigger_keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rebuttal_text" text NOT NULL,
	"suggested_action" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "objection_playbooks" ADD CONSTRAINT "objection_playbooks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "objection_playbooks" ADD CONSTRAINT "objection_playbooks_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "objection_playbooks_company_cat_idx" ON "objection_playbooks" USING btree ("company_id", "category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "objection_playbooks_company_bot_idx" ON "objection_playbooks" USING btree ("company_id", "chatbot_id");
--> statement-breakpoint

-- 2. Create re_engagement_logs table
CREATE TABLE IF NOT EXISTS "re_engagement_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"channel" varchar(50) DEFAULT 'whatsapp' NOT NULL,
	"interval_days" integer NOT NULL,
	"hook_template" text NOT NULL,
	"message_content" text NOT NULL,
	"status" varchar(50) DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "re_engagement_logs" ADD CONSTRAINT "re_engagement_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "re_engagement_logs" ADD CONSTRAINT "re_engagement_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_engagement_logs_company_lead_idx" ON "re_engagement_logs" USING btree ("company_id", "lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "re_engagement_logs_company_sent_idx" ON "re_engagement_logs" USING btree ("company_id", "sent_at");

CREATE TABLE IF NOT EXISTS "daily_analytics_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"chatbot_id" uuid,
	"date" date NOT NULL,
	"total_conversations" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"total_leads" integer DEFAULT 0 NOT NULL,
	"qualified_leads" integer DEFAULT 0 NOT NULL,
	"visits_booked" integer DEFAULT 0 NOT NULL,
	"visits_done" integer DEFAULT 0 NOT NULL,
	"deals_booked" integer DEFAULT 0 NOT NULL,
	"avg_latency_ms" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"positive_sentiment_count" integer DEFAULT 0 NOT NULL,
	"negative_sentiment_count" integer DEFAULT 0 NOT NULL,
	"metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaign_spends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"campaign_name" varchar(255) NOT NULL,
	"source" varchar(100) NOT NULL,
	"spend_amount" integer DEFAULT 0 NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"frequency" varchar(50) DEFAULT 'weekly' NOT NULL,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"format" varchar(50) DEFAULT 'csv' NOT NULL,
	"last_sent_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_analytics_rollups" ADD CONSTRAINT "daily_analytics_rollups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "daily_analytics_rollups" ADD CONSTRAINT "daily_analytics_rollups_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaign_spends" ADD CONSTRAINT "campaign_spends_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_rollups_company_date_idx" ON "daily_analytics_rollups" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "daily_rollups_company_bot_date_idx" ON "daily_analytics_rollups" USING btree ("company_id","chatbot_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "daily_rollups_unique_entry_idx" ON "daily_analytics_rollups" USING btree ("company_id","chatbot_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "campaign_spends_company_campaign_idx" ON "campaign_spends" USING btree ("company_id","campaign_name","period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_schedules_company_idx" ON "report_schedules" USING btree ("company_id");

-- Migration 0014: Voice Calling, MCP and Enterprise Security (Phase 15C)

-- 1. Create voice_calls table
CREATE TABLE IF NOT EXISTS "voice_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"lead_id" uuid,
	"contact_id" uuid,
	"call_sid" varchar(255) NOT NULL,
	"direction" varchar(50) DEFAULT 'outbound_callback' NOT NULL,
	"from_number" varchar(50) NOT NULL,
	"to_number" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'initiated' NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"recording_url" text,
	"transcript" text,
	"summary" text,
	"sentiment" varchar(50),
	"buyer_dna_extracted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"intent_score_delta" integer DEFAULT 0 NOT NULL,
	"disclosed_as_ai" boolean DEFAULT true NOT NULL,
	"escalated_to_human" boolean DEFAULT false NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_calls_company_idx" ON "voice_calls" USING btree ("company_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_calls_lead_idx" ON "voice_calls" USING btree ("company_id", "lead_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_calls_sid_idx" ON "voice_calls" USING btree ("call_sid");
--> statement-breakpoint
ALTER TABLE "voice_calls" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "voice_calls" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "voice_calls" AS PERMISSIVE FOR ALL 
USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL) 
WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL);
--> statement-breakpoint

-- 2. Create company_sso_configs table
CREATE TABLE IF NOT EXISTS "company_sso_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider_type" varchar(50) DEFAULT 'saml' NOT NULL,
	"domain" varchar(255) NOT NULL,
	"entity_id" varchar(500),
	"sso_url" text,
	"certificate" text,
	"client_id" varchar(255),
	"client_secret" text,
	"discovery_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"enforce_for_domain" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_sso_configs" ADD CONSTRAINT "company_sso_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "company_sso_domain_idx" ON "company_sso_configs" USING btree ("domain");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "company_sso_company_idx" ON "company_sso_configs" USING btree ("company_id");
--> statement-breakpoint
ALTER TABLE "company_sso_configs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "company_sso_configs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "company_sso_configs" AS PERMISSIVE FOR ALL 
USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL) 
WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL);

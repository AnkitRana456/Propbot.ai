-- Alter companies table
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "parent_company_id" uuid;
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "is_agency" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_company_id_companies_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Alter users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "working_hours" jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lead_capacity" integer DEFAULT 50;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_chatbots" text[] DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" varchar(255);
--> statement-breakpoint

-- Alter chatbots table
ALTER TABLE "chatbots" ADD COLUMN IF NOT EXISTS "client_id" uuid;
--> statement-breakpoint
ALTER TABLE "chatbots" ADD COLUMN IF NOT EXISTS "delivery_rules" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_client_id_companies_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatbots_client_idx" ON "chatbots" USING btree ("client_id");
--> statement-breakpoint

-- Alter subscriptions table
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "billing_cycle" varchar(20) DEFAULT 'monthly' NOT NULL;
--> statement-breakpoint

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(50) NOT NULL,
	"team" varchar(100),
	"lead_capacity" integer DEFAULT 50,
	"working_hours" jsonb,
	"token_hash" varchar(255) NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_invitations_company_email_idx" ON "user_invitations" USING btree ("company_id","email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_invitations_token_hash_idx" ON "user_invitations" USING btree ("token_hash");
--> statement-breakpoint

-- Create subscription_invoices table
CREATE TABLE IF NOT EXISTS "subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"subscription_id" uuid,
	"invoice_number" varchar(100) NOT NULL,
	"amount" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"status" varchar(50) DEFAULT 'paid' NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_invoice_id" varchar(255),
	"paid_at" timestamp with time zone,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_invoices_company_idx" ON "subscription_invoices" USING btree ("company_id","created_at");
--> statement-breakpoint

-- Create lead_credit_transactions table
CREATE TABLE IF NOT EXISTS "lead_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"reference_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_credit_transactions" ADD CONSTRAINT "lead_credit_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lead_credit_tx_company_idx" ON "lead_credit_transactions" USING btree ("company_id","created_at");
--> statement-breakpoint

-- Create api_keys table
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_keys_company_prefix_idx" ON "api_keys" USING btree ("company_id","key_prefix");

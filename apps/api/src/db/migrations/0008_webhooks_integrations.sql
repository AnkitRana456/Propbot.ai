-- Migration 0008: Webhook endpoints enhancement, webhook logs metadata, and integrations table
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "name" varchar(255) DEFAULT 'Webhook Endpoint' NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "headers" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "payload_template" text;

ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL;
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "lead_name" varchar(255);
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE SET NULL;
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "request_headers" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "response_headers" jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "next_retry_at" timestamp with time zone;
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "max_attempts" integer DEFAULT 3 NOT NULL;

CREATE INDEX IF NOT EXISTS "webhook_logs_status_idx" ON "webhook_logs" ("company_id", "status");
CREATE INDEX IF NOT EXISTS "webhook_logs_lead_idx" ON "webhook_logs" ("company_id", "lead_id");

CREATE TABLE IF NOT EXISTS "integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "provider" varchar(50) NOT NULL,
  "status" varchar(50) DEFAULT 'active' NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "events" text[] DEFAULT ARRAY['lead_captured']::text[] NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "integrations_company_idx" ON "integrations" ("company_id");
CREATE INDEX IF NOT EXISTS "integrations_company_provider_idx" ON "integrations" ("company_id", "provider");

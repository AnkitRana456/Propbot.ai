-- Migration 0016: lead engine (spec section 3).
-- PostgreSQL only. Every statement is additive/idempotent; no data is deleted or rewritten
-- except the counter backfill UPDATE on chatbots.

-- 1. Lead attribution, visit tracking and capture metadata
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "visit_count" integer NOT NULL DEFAULT 1;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "utm_params" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "ip_address" varchar(64);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "user_agent" varchar(500);

-- 2. Race-safe de-duplication (replaces find-then-insert with INSERT ... ON CONFLICT)
--    A person is one contact per company; one lead per contact per chatbot.
--    Pre-check on the local DB: 0 duplicate phones, 0 duplicate emails, so these will build cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_company_phone_uniq"
  ON "contacts" ("company_id", "phone") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_company_email_uniq"
  ON "contacts" ("company_id", lower("email"))
  WHERE "deleted_at" IS NULL AND "email" IS NOT NULL AND "email" <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "leads_company_bot_contact_uniq"
  ON "leads" ("company_id", "chatbot_id", "contact_id")
  WHERE "deleted_at" IS NULL AND "chatbot_id" IS NOT NULL;

-- 3. Per-chatbot analytics counters (incremented atomically with SET x = x + 1)
ALTER TABLE "chatbots" ADD COLUMN IF NOT EXISTS "total_leads" integer NOT NULL DEFAULT 0;
ALTER TABLE "chatbots" ADD COLUMN IF NOT EXISTS "brochure_downloads" integer NOT NULL DEFAULT 0;
UPDATE "chatbots" c
   SET "total_leads" = (SELECT count(*) FROM "leads" l WHERE l."chatbot_id" = c."id" AND l."deleted_at" IS NULL);

-- 4. Conversation lookups by chatbot + time
CREATE INDEX IF NOT EXISTS "conversations_chatbot_created_idx"
  ON "conversations" ("chatbot_id", "created_at");

-- 5. SMS OTP verification (Postgres has no TTL index: expiry is the expires_at column,
--    enforced on read and purged by a scheduled job)
CREATE TABLE IF NOT EXISTS "lead_otps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "chatbot_id" uuid REFERENCES "chatbots"("id") ON DELETE CASCADE,
  "phone" varchar(50) NOT NULL,
  "code_hash" varchar(128) NOT NULL,
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 5,
  "expires_at" timestamp with time zone NOT NULL,
  "last_sent_at" timestamp with time zone NOT NULL DEFAULT now(),
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lead_otps_phone_idx" ON "lead_otps" ("company_id", "chatbot_id", "phone");
CREATE INDEX IF NOT EXISTS "lead_otps_expires_idx" ON "lead_otps" ("expires_at");

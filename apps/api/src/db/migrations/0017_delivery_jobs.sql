-- Migration 0017: durable delivery queue for lead e-mail alerts and CRM sync (spec section 5).
--
-- Why a table: these calls go over the network (SMTP, HubSpot, Salesforce, Mailchimp) and can be slow or
-- fail. The lead save only writes a domain_event; a consumer inserts one row per job here, and a worker
-- loop delivers them outside any request or outbox transaction, retrying after 1s / 2s / 4s.

CREATE TABLE IF NOT EXISTS "delivery_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "kind" varchar(30) NOT NULL,                 -- lead_email_alert | crm_sync
  "provider" varchar(50) NOT NULL,             -- smtp | hubspot | salesforce | mailchimp
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "event_id" uuid,                             -- originating domain_events.id (idempotency key)
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "status" varchar(20) NOT NULL DEFAULT 'pending',  -- pending | success | skipped | dead_letter
  "attempts" integer NOT NULL DEFAULT 0,
  "max_attempts" integer NOT NULL DEFAULT 4,   -- 1 attempt + 3 retries
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_error" text,
  "external_id" varchar(255),                  -- id returned by the CRM / provider on success
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Worker scan: due pending jobs
CREATE INDEX IF NOT EXISTS "delivery_jobs_due_idx"
  ON "delivery_jobs" ("next_attempt_at") WHERE "status" = 'pending';
-- Dashboard / debugging: jobs per lead
CREATE INDEX IF NOT EXISTS "delivery_jobs_company_lead_idx" ON "delivery_jobs" ("company_id", "lead_id");
-- Idempotent enqueue: re-processing the same event never creates duplicate jobs
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_jobs_event_kind_provider_uniq"
  ON "delivery_jobs" ("event_id", "kind", "provider") WHERE "event_id" IS NOT NULL;

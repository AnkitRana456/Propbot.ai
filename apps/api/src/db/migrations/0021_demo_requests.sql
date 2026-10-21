-- Migration 0021: demo requests from the public marketing site. Additive only (one new table).
CREATE TABLE IF NOT EXISTS "demo_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "email" varchar(190) NOT NULL,
  "mobile" varchar(30) NOT NULL,
  "agency" varchar(160) NOT NULL,
  "listings" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'new',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "demo_requests_created_idx" ON "demo_requests" ("created_at");
CREATE INDEX IF NOT EXISTS "demo_requests_email_idx" ON "demo_requests" ("email");

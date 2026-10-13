-- Alter appointments table
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 45 NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "appointment_type" varchar(50) DEFAULT 'site_visit' NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "location" varchar(255);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "meeting_link" varchar(500);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "rescheduled_from_id" uuid REFERENCES "appointments"("id") ON DELETE SET NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder_sent_24h" boolean DEFAULT false NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder_sent_2h" boolean DEFAULT false NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "survey_token" varchar(100);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "survey_rating" integer;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "survey_feedback" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "survey_interested_in_booking" varchar(20);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "survey_completed_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "appointments_conflict_check_idx" ON "appointments" ("company_id", "scheduled_at", "assigned_agent_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_survey_token_idx" ON "appointments" ("survey_token");

-- Create calendar_integrations table
CREATE TABLE IF NOT EXISTS "calendar_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(50) DEFAULT 'google' NOT NULL,
  "is_connected" boolean DEFAULT false NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "token_expiry" timestamp with time zone,
  "calendar_id" varchar(255) DEFAULT 'primary',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "calendar_integrations_company_idx" ON "calendar_integrations" ("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_integrations_company_user_idx" ON "calendar_integrations" ("company_id", "user_id");

-- Create availability_settings table
CREATE TABLE IF NOT EXISTS "availability_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "agent_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "project_id" uuid REFERENCES "projects"("id") ON DELETE CASCADE,
  "working_days" jsonb DEFAULT '[1,2,3,4,5,6]'::jsonb NOT NULL,
  "start_time" varchar(10) DEFAULT '09:00' NOT NULL,
  "end_time" varchar(10) DEFAULT '18:00' NOT NULL,
  "slot_duration_minutes" integer DEFAULT 45 NOT NULL,
  "buffer_minutes" integer DEFAULT 15 NOT NULL,
  "max_visits_per_slot" integer DEFAULT 1 NOT NULL,
  "blackout_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "availability_settings_company_idx" ON "availability_settings" ("company_id");
CREATE UNIQUE INDEX IF NOT EXISTS "availability_settings_company_agent_project_idx" ON "availability_settings" ("company_id", "agent_id", "project_id");

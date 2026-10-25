-- Migration 0022: production hardening plus two features (cost sheets and walk-in capture).
-- Purely additive: new nullable or defaulted columns, one new table, indexes and row-level security.

-- WhatsApp: the business account id is needed to send message templates to Meta for review
ALTER TABLE "whatsapp_configs" ADD COLUMN IF NOT EXISTS "business_account_id" varchar(64);

-- Google Calendar: which account is connected, and whether the connection is a local simulation
ALTER TABLE "calendar_integrations" ADD COLUMN IF NOT EXISTS "account_email" varchar(255);
ALTER TABLE "calendar_integrations" ADD COLUMN IF NOT EXISTS "simulated" boolean NOT NULL DEFAULT false;

-- Cost sheets: per-project charges, and every sheet shared with a buyer
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cost_sheet_config" jsonb;

CREATE TABLE IF NOT EXISTS "cost_sheets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "unit_id" uuid NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE SET NULL,
  "token" varchar(64) NOT NULL,
  "lines" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "totals" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "discount" numeric(14, 2) NOT NULL DEFAULT 0,
  "notes" text,
  "valid_until" timestamp with time zone,
  "view_count" integer NOT NULL DEFAULT 0,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "cost_sheets_token_idx" ON "cost_sheets" ("token");
CREATE INDEX IF NOT EXISTS "cost_sheets_company_lead_idx" ON "cost_sheets" ("company_id", "lead_id");
CREATE INDEX IF NOT EXISTS "cost_sheets_company_unit_idx" ON "cost_sheets" ("company_id", "unit_id");

-- Walk-in capture: a revocable token for the sales-gallery kiosk page
ALTER TABLE "lead_sources" ADD COLUMN IF NOT EXISTS "kiosk_token" varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS "lead_sources_kiosk_token_idx" ON "lead_sources" ("kiosk_token") WHERE "kiosk_token" IS NOT NULL;

-- Row-level security on the new tenant table (same pattern as 0020)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE "cost_sheets" ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE "cost_sheets" FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "tenant_isolation_policy" ON "cost_sheets"';
  EXECUTE $p$CREATE POLICY "tenant_isolation_policy" ON "cost_sheets" AS PERMISSIVE FOR ALL
    USING ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL)
    WITH CHECK ("company_id" = NULLIF(current_setting('app.company_id', true), '')::uuid OR current_setting('app.company_id', true) IS NULL)$p$;
END $$;

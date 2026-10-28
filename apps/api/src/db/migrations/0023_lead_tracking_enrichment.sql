-- Migration 0023: Lead tracking enrichment — device info, geo-location, referrer.
-- Purely additive: new nullable columns on the leads table.

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "device_type"   varchar(32);   -- mobile | tablet | desktop | other
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "os_name"       varchar(64);   -- Android | iOS | Windows | macOS | Linux
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "browser_name"  varchar(64);   -- Chrome | Safari | Instagram | WhatsApp | etc.
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "city"          varchar(100);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "state"         varchar(100);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "country"       varchar(64);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "referrer_url"  varchar(500);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "landing_page"  varchar(500);

CREATE INDEX IF NOT EXISTS "leads_company_source_device_idx"
  ON "leads" ("company_id", "source", "device_type");

CREATE INDEX IF NOT EXISTS "leads_company_city_idx"
  ON "leads" ("company_id", "city");
